import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerStorage } from '@nestjs/throttler';
import { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import Redis from 'ioredis';

/**
 * Distributed throttler storage backed by Redis.
 *
 * Falls back to an in-memory store when `REDIS_URL` is not configured so that
 * local development and single-instance deployments keep working without
 * additional infrastructure.
 */
@Injectable()
export class RedisThrottlerStorageService implements ThrottlerStorage, OnModuleDestroy {
  private readonly logger = new Logger(RedisThrottlerStorageService.name);
  private readonly redis: Redis | null;
  private readonly memory = new Map<string, { totalHits: number; expiresAt: number }>();

  constructor(private readonly configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL');

    if (redisUrl) {
      this.redis = new Redis(redisUrl, { lazyConnect: false, maxRetriesPerRequest: 2 });
      this.redis.on('error', (err) => this.logger.error(`Redis throttler error: ${err.message}`));
    } else {
      this.redis = null;
      this.logger.warn('REDIS_URL not set — falling back to in-memory throttler storage');
    }
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const storageKey = `throttle:${throttlerName}:${key}`;

    if (this.redis) {
      return this.incrementRedis(storageKey, ttl, limit, blockDuration);
    }

    return this.incrementMemory(storageKey, ttl, limit, blockDuration);
  }

  private async incrementRedis(
    storageKey: string,
    ttl: number,
    limit: number,
    blockDuration: number,
  ): Promise<ThrottlerStorageRecord> {
    const redis = this.redis as Redis;
    const totalHits = await redis.incr(storageKey);

    if (totalHits === 1) {
      await redis.pexpire(storageKey, ttl);
    }

    const pttl = await redis.pttl(storageKey);
    const timeToExpire = pttl > 0 ? pttl : ttl;
    const isBlocked = totalHits > limit;

    if (isBlocked && blockDuration > 0) {
      await redis.pexpire(storageKey, blockDuration);
    }

    return {
      totalHits,
      timeToExpire: Math.ceil(timeToExpire / 1000),
      isBlocked,
      timeToBlockExpire: isBlocked ? Math.ceil(blockDuration / 1000) : 0,
    };
  }

  private incrementMemory(
    storageKey: string,
    ttl: number,
    limit: number,
    blockDuration: number,
  ): ThrottlerStorageRecord {
    const now = Date.now();
    const existing = this.memory.get(storageKey);

    if (!existing || existing.expiresAt <= now) {
      this.memory.set(storageKey, { totalHits: 1, expiresAt: now + ttl });
      return {
        totalHits: 1,
        timeToExpire: Math.ceil(ttl / 1000),
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    }

    existing.totalHits += 1;
    const isBlocked = existing.totalHits > limit;

    if (isBlocked && blockDuration > 0) {
      existing.expiresAt = now + blockDuration;
    }

    return {
      totalHits: existing.totalHits,
      timeToExpire: Math.max(0, Math.ceil((existing.expiresAt - now) / 1000)),
      isBlocked,
      timeToBlockExpire: isBlocked ? Math.ceil(blockDuration / 1000) : 0,
    };
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
    this.memory.clear();
  }
}
