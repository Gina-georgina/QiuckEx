import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { CompatibilityController } from '../src/compatibility/compatibility.controller';
import { CompatibilityService } from '../src/compatibility/compatibility.service';
import { FeatureFlagService } from '../src/feature-flag/feature-flag.service';

describe('API Compatibility (e2e)', () => {
  let app: INestApplication;
  let featureFlagService: FeatureFlagService;

  const compatibilityPayload = {
    clientVersion: '1.0.0',
    platform: 'web',
    capabilities: ['legacy-endpoint'],
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    featureFlagService = app.get<FeatureFlagService>(FeatureFlagService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('with compatibility feature flag enabled', () => {
    beforeEach(() => {
      jest
        .spyOn(featureFlagService, 'isEnabled')
        .mockImplementation((flag: string) => flag === 'api-compatibility');
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('returns a successful compatibility response', async () => {
      const response = await request(app.getHttpServer())
        .post('/compatibility/check')
        .send(compatibilityPayload)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.compatible).toBe(true);
      expect(response.body).toHaveProperty('supportedVersion');
    });

    it('exposes the controller through the module', () => {
      const controller = app.get<CompatibilityController>(CompatibilityController);
      expect(controller).toBeDefined();
    });

    it('returns a stable error code for invalid payloads', async () => {
      const response = await request(app.getHttpServer())
        .post('/compatibility/check')
        .send({ clientVersion: 123 })
        .expect(400);

      expect(response.body).toHaveProperty('code');
      expect(response.body.code).toBe('COMPATIBILITY_INVALID_PAYLOAD');
    });
  });

  describe('with compatibility feature flag disabled', () => {
    beforeEach(() => {
      jest
        .spyOn(featureFlagService, 'isEnabled')
        .mockImplementation((flag: string) => flag !== 'api-compatibility');
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('returns a stable error code indicating the feature is disabled', async () => {
      const response = await request(app.getHttpServer())
        .post('/compatibility/check')
        .send(compatibilityPayload)
        .expect(403);

      expect(response.body).toHaveProperty('code');
      expect(response.body.code).toBe('COMPATIBILITY_FEATURE_DISABLED');
    });

    it('does not expose the compatibility service', () => {
      const service = app.get<CompatibilityService>(CompatibilityService, {
        strict: false,
      });
      expect(service).toBeDefined();
    });
  });

  describe('unauthorized access', () => {
    beforeEach(() => {
      jest
        .spyOn(featureFlagService, 'isEnabled')
        .mockImplementation((flag: string) => flag === 'api-compatibility');
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('returns a stable error code when no credentials are provided', async () => {
      const response = await request(app.getHttpServer())
        .post('/compatibility/check')
        .send(compatibilityPayload)
        .expect(401);

      expect(response.body).toHaveProperty('code');
      expect(response.body.code).toBe('COMPATIBILITY_UNAUTHORIZED');
    });

    it('returns a stable error code when credentials are invalid', async () => {
      const response = await request(app.getHttpServer())
        .post('/compatibility/check')
        .set('Authorization', 'Bearer invalid-token')
        .send(compatibilityPayload)
        .expect(401);

      expect(response.body).toHaveProperty('code');
      expect(response.body.code).toBe('COMPATIBILITY_UNAUTHORIZED');
    });
  });
});