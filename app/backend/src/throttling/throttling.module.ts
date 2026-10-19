import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { ThrottlerStorage } from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Named throttler buckets used across the backend.
 *
 * - `public-username`: GET /usernames/:username — 60 req/min per IP
 * - `public-link`:     GET /links/:id            — 30 req/min per IP
 * - `authenticated`:   dashboard/analytics       — 120 req/min per user ID
 */
export const THROTTLER_NAMES = {
  PUBLIC_USERNAME: 'public-username',
  PUBLIC_LINK: 'public-link',
  AUTHENTICATED: 'authenticated',
} as const;

/**
 * Custom guard that adds a `Retry-After` header (in seconds) to 429 responses.
 * The value is derived from the throttler's `timeToBlockExpire`/`timeToExpire`
 * metadata exposed on the thrown `ThrottlerException`.
 */
@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('REDIS_URL');
        const storage: ThrottlerStorage | undefined = redisUrl
          ? new ThrottlerStorageRedisService(new Redis(redisUrl))
          : undefined;

        return {
          throttlers: [
            { name: THROTTLER_NAMES.PUBLIC_USERNAME, ttl: 60_000, limit: 60 },
            { name: THROTTLER_NAMES.PUBLIC_LINK, ttl: 60_000, limit: 30 },
            { name: THROTTLER_NAMES.AUTHENTICATED, ttl: 60_000, limit: 120 },
          ],
          ...(storage ? { storage } : {}),
        };
      },
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
  exports: [ThrottlerModule],
})
export class ThrottlingModule {}
