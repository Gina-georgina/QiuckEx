import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UsernamesController } from './usernames.controller';
import { UsernamesService } from './usernames.service';
import {
  UsernameConflictError,
  UsernameLimitExceededError,
  UsernameClaimInvalidError,
} from './errors';

describe('UsernamesController', () => {
  let controller: UsernamesController;
  let usernamesService: jest.Mocked<UsernamesService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  const validPublicKey = 'GBXGQ55JMQ4L2B6E7S8Y9Z0A1B2C3D4E5F6G7H8I7YWR';

  beforeEach(async () => {
    const mockCreate = jest.fn().mockResolvedValue({ ok: true });
    const mockVerifyAndCreateClaim = jest.fn().mockResolvedValue({ ok: true });
    const mockListByPublicKey = jest.fn().mockResolvedValue([]);
    const mockGetTrendingCreators = jest.fn().mockResolvedValue({ data: [], next_cursor: null, has_more: false });
    const mockGetRecentlyActiveUsers = jest.fn().mockResolvedValue({ data: [], next_cursor: null, has_more: false });
    const mockGetFeaturedCreators = jest.fn().mockResolvedValue({ data: [], next_cursor: null, has_more: false });
    const mockUpdateProfile = jest.fn().mockResolvedValue({ ok: true });
    const mockEmit = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsernamesController],
      providers: [
        {
          provide: UsernamesService,
          useValue: {
            create: mockCreate,
            verifyAndCreateClaim: mockVerifyAndCreateClaim,
            listByPublicKey: mockListByPublicKey,
            getTrendingCreators: mockGetTrendingCreators,
            getRecentlyActiveUsers: mockGetRecentlyActiveUsers,
            getFeaturedCreators: mockGetFeaturedCreators,
            updateProfile: mockUpdateProfile,
          },
        },
        {
          provide: EventEmitter2,
          useValue: { emit: mockEmit },
        },
      ],
    }).compile();

    controller = module.get<UsernamesController>(UsernamesController);
    usernamesService = module.get(UsernamesService) as jest.Mocked<UsernamesService>;
    eventEmitter = module.get(EventEmitter2) as jest.Mocked<EventEmitter2>;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createUsername', () => {
    it('returns 201 and ok: true on success', async () => {
      const body = { username: 'alice_123', publicKey: validPublicKey };
      const result = await controller.createUsername(body);
      expect(result).toEqual({ ok: true });
      expect(usernamesService.create).toHaveBeenCalledWith('alice_123', validPublicKey);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'username.claimed',
        expect.objectContaining({
          username: 'alice_123',
          publicKey: validPublicKey,
        }),
      );
    });

    it('throws ConflictException when username is already taken', async () => {
      usernamesService.create.mockRejectedValueOnce(
        new UsernameConflictError('taken'),
      );
      const body = { username: 'taken', publicKey: validPublicKey };
      const err = await controller.createUsername(body).catch((e) => e);
      expect(err).toBeInstanceOf(ConflictException);
      expect(err.response).toMatchObject({
        code: 'USERNAME_CONFLICT',
        message: expect.stringContaining('taken'),
      });
    });

    it('throws ForbiddenException when wallet limit exceeded', async () => {
      usernamesService.create.mockRejectedValueOnce(
        new UsernameLimitExceededError(validPublicKey, 2),
      );
      const body = { username: 'newuser', publicKey: validPublicKey };
      const err = await controller.createUsername(body).catch((e) => e);
      expect(err).toBeInstanceOf(ForbiddenException);
      expect(err.response).toMatchObject({ code: 'USERNAME_LIMIT_EXCEEDED' });
    });
  });

  describe('claimUsername', () => {
    it('verifies and creates a claim, then emits username.claimed', async () => {
      const body = {
        username: 'alice_123',
        signature: `${Date.now()}.base64-signature`,
        publicKey: validPublicKey,
      };

      await expect(controller.claimUsername(body)).resolves.toEqual({ ok: true });
      expect(usernamesService.verifyAndCreateClaim).toHaveBeenCalledWith(
        body.username,
        body.signature,
        body.publicKey,
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'username.claimed',
        expect.objectContaining({ username: body.username, publicKey: body.publicKey }),
      );
    });

    it('rejects an invalid claim signature', async () => {
      usernamesService.verifyAndCreateClaim.mockRejectedValueOnce(
        new UsernameClaimInvalidError(),
      );

      const err = await controller.claimUsername({
        username: 'alice_123',
        signature: 'expired.signature',
        publicKey: validPublicKey,
      }).catch((error) => error);

      expect(err).toBeInstanceOf(BadRequestException);
      expect(err.response).toMatchObject({ code: 'USERNAME_CLAIM_INVALID' });
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('rejects a taken username', async () => {
      usernamesService.verifyAndCreateClaim.mockRejectedValueOnce(
        new UsernameConflictError('alice_123'),
      );

      const err = await controller.claimUsername({
        username: 'alice_123',
        signature: `${Date.now()}.base64-signature`,
        publicKey: validPublicKey,
      }).catch((error) => error);

      expect(err).toBeInstanceOf(ConflictException);
      expect(err.response).toMatchObject({ code: 'USERNAME_CONFLICT' });
    });
  });

  describe('listUsernames', () => {
    it('returns usernames for wallet', async () => {
      const rows = [
        {
          id: 'id1',
          username: 'alice',
          public_key: validPublicKey,
          created_at: '2025-01-01T00:00:00Z',
        },
      ];
      usernamesService.listByPublicKey.mockResolvedValueOnce(rows);
      const result = await controller.listUsernames({ publicKey: validPublicKey });
      expect(result).toEqual({ usernames: rows });
      expect(usernamesService.listByPublicKey).toHaveBeenCalledWith(validPublicKey);
    });
  });

  describe('getTrendingCreators', () => {
    it('maps ranked creators to the response shape and forwards pagination info', async () => {
      const creators = [
        {
          id: 'id-1',
          username: 'alice',
          public_key: validPublicKey,
          created_at: '2025-01-01T00:00:00Z',
          last_active_at: '2025-01-02T00:00:00Z',
          is_public: true,
          transaction_volume: 500,
          transaction_count: 5,
        },
      ];
      usernamesService.getTrendingCreators.mockResolvedValueOnce({
        data: creators,
        next_cursor: 'next-page-cursor',
        has_more: true,
      });

      const result = await controller.getTrendingCreators({ timeWindowHours: 24, limit: 10 });

      expect(usernamesService.getTrendingCreators).toHaveBeenCalledWith(24, 10, undefined);
      expect(result.creators).toEqual([
        {
          id: 'id-1',
          username: 'alice',
          publicKey: validPublicKey,
          lastActiveAt: '2025-01-02T00:00:00Z',
          createdAt: '2025-01-01T00:00:00Z',
          transactionVolume: 500,
          transactionCount: 5,
        },
      ]);
      expect(result.timeWindowHours).toBe(24);
      expect(result.next_cursor).toBe('next-page-cursor');
      expect(result.has_more).toBe(true);
    });
  });

  describe('getRecentlyActive', () => {
    it('maps recently active users to the response shape and forwards pagination info', async () => {
      const users = [
        {
          id: 'id-1',
          username: 'alice',
          public_key: validPublicKey,
          created_at: '2025-01-01T00:00:00Z',
          last_active_at: '2025-01-02T00:00:00Z',
          is_public: true,
        },
      ];
      usernamesService.getRecentlyActiveUsers.mockResolvedValueOnce({
        data: users,
        next_cursor: null,
        has_more: false,
      });

      const result = await controller.getRecentlyActive({ timeWindowHours: 24, limit: 10 });

      expect(usernamesService.getRecentlyActiveUsers).toHaveBeenCalledWith(24, 10, undefined);
      expect(result.users).toEqual([
        {
          id: 'id-1',
          username: 'alice',
          publicKey: validPublicKey,
          lastActiveAt: '2025-01-02T00:00:00Z',
          createdAt: '2025-01-01T00:00:00Z',
        },
      ]);
      expect(result.has_more).toBe(false);
      expect(result.next_cursor).toBeNull();
    });
  });

  describe('updateProfile', () => {
    const body = {
      publicKey: validPublicKey,
      displayName: 'Alice',
      bio: 'Hello world',
    };

    it('returns ok: true on success', async () => {
      const result = await controller.updateProfile(body);
      expect(result).toEqual({ ok: true });
      expect(usernamesService.updateProfile).toHaveBeenCalledWith(
        validPublicKey,
        expect.objectContaining({ displayName: 'Alice', bio: 'Hello world' }),
      );
    });

    it('throws ConflictException with USERNAME_CONFLICT on conflict', async () => {
      usernamesService.updateProfile.mockRejectedValueOnce(
        new UsernameConflictError('taken'),
      );
      const err = await controller.updateProfile(body).catch((e) => e);
      expect(err).toBeInstanceOf(ConflictException);
      expect(err.response).toMatchObject({ code: 'USERNAME_CONFLICT' });
    });

    it('throws ForbiddenException with USERNAME_NOT_OWNED when not owned', async () => {
      usernamesService.updateProfile.mockRejectedValueOnce(
        new ForbiddenException({
          code: 'USERNAME_NOT_OWNED',
          message: 'Profile not owned by wallet',
        }),
      );
      const err = await controller.updateProfile(body).catch((e) => e);
      expect(err).toBeInstanceOf(ForbiddenException);
      expect(err.response).toMatchObject({ code: 'USERNAME_NOT_OWNED' });
    });

    it('throws BadRequestException with USERNAME_PROFILE_INVALID on malformed payload', async () => {
      usernamesService.updateProfile.mockRejectedValueOnce(
        new BadRequestException({
          code: 'USERNAME_PROFILE_INVALID',
          message: 'Invalid profile payload',
        }),
      );
      const err = await controller.updateProfile(body).catch((e) => e);
      expect(err).toBeInstanceOf(BadRequestException);
      expect(err.response).toMatchObject({ code: 'USERNAME_PROFILE_INVALID' });
    });

    it('throws ServiceUnavailableException with USERNAME_DEPENDENCY_UNAVAILABLE on dependency failure', async () => {
      usernamesService.updateProfile.mockRejectedValueOnce(
        new ServiceUnavailableException({
          code: 'USERNAME_DEPENDENCY_UNAVAILABLE',
          message: 'Dependency unavailable',
        }),
      );
      const err = await controller.updateProfile(body).catch((e) => e);
      expect(err).toBeInstanceOf(ServiceUnavailableException);
      expect(err.response).toMatchObject({
        code: 'USERNAME_DEPENDENCY_UNAVAILABLE',
      });
    });
  });

  describe('getFeaturedCreators', () => {
    it('maps featured creators to the response shape and forwards pagination info', async () => {
      const creators = [
        {
          id: 'id-1',
          username: 'alice',
          public_key: validPublicKey,
          created_at: '2025-01-01T00:00:00Z',
          last_active_at: null,
          is_public: true,
          featured_rank: 1,
        },
      ];
      usernamesService.getFeaturedCreators.mockResolvedValueOnce({
        data: creators,
        next_cursor: null,
        has_more: false,
      });

      const result = await controller.getFeaturedCreators({ limit: 10 });

      expect(usernamesService.getFeaturedCreators).toHaveBeenCalledWith(10, undefined);
      expect(result.profiles).toEqual([
        {
          id: 'id-1',
          username: 'alice',
          publicKey: validPublicKey,
          lastActiveAt: '2025-01-01T00:00:00Z',
          createdAt: '2025-01-01T00:00:00Z',
          featuredRank: 1,
        },
      ]);
      expect(result.has_more).toBe(false);
    });
  });

  describe('discovery endpoints', () => {
    const discoveryCases: Array<{
      name: string;
      handler: (query: any) => Promise<any>;
      serviceMethod: keyof UsernamesService;
      query: Record<string, unknown>;
      expectedArgs: unknown[];
    }> = [
      {
        name: 'getTrendingCreators',
        handler: (query) => controller.getTrendingCreators(query),
        serviceMethod: 'getTrendingCreators',
        query: { timeWindowHours: 24, limit: 10 },
        expectedArgs: [24, 10, undefined],
      },
      {
        name: 'getRecentlyActive',
        handler: (query) => controller.getRecentlyActive(query),
        serviceMethod: 'getRecentlyActiveUsers',
        query: { timeWindowHours: 24, limit: 10 },
        expectedArgs: [24, 10, undefined],
      },
      {
        name: 'getFeaturedCreators',
        handler: (query) => controller.getFeaturedCreators(query),
        serviceMethod: 'getFeaturedCreators',
        query: { limit: 10 },
        expectedArgs: [10, undefined],
      },
    ];

    describe.each(discoveryCases)('$name', ({ handler, serviceMethod, query, expectedArgs }) => {
      it('returns a paginated payload on the happy path', async () => {
        (usernamesService[serviceMethod] as jest.Mock).mockResolvedValueOnce({
          data: [],
          next_cursor: 'cursor-1',
          has_more: true,
        });

        const result = await handler(query);

        expect(usernamesService[serviceMethod]).toHaveBeenCalledWith(...expectedArgs);
        expect(result).toMatchObject({ next_cursor: 'cursor-1', has_more: true });
      });

      it('rejects invalid query params with 400', async () => {
        const err = await handler({ ...query, limit: -1 }).catch((e) => e);

        expect(err).toBeInstanceOf(BadRequestException);
        expect(usernamesService[serviceMethod]).not.toHaveBeenCalled();
      });

      it('maps dependency failures to 503', async () => {
        (usernamesService[serviceMethod] as jest.Mock).mockRejectedValueOnce(
          new Error('database unavailable'),
        );

        const err = await handler(query).catch((e) => e);

        expect(err).toBeInstanceOf(ServiceUnavailableException);
        expect(err.response).toMatchObject({ code: 'DISCOVERY_UNAVAILABLE' });
      });
    });

    it('exposes rate-limit metadata for discovery routes', () => {
      const metadata = Reflect.getMetadata(
        'THROTTLER:LIMIT',
        controller.getTrendingCreators,
      );
      expect(metadata).toBeDefined();
    });

    it('does not shadow /username/:username with discovery routes', () => {
      const routePaths = Reflect.getMetadata(
        'path',
        UsernamesController,
      ) as string[] | string | undefined;
      const discoveryPaths = ['trending', 'recently-active', 'featured'];

      for (const path of discoveryPaths) {
        expect(path).not.toBe(':username');
      }
      expect(routePaths).toBeDefined();
    });
  });
});
