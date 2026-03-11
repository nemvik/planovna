jest.mock('./app.service', () => ({
  AppService: class AppService {},
}));

import { AppController } from './app.controller';
import type {
  AppService,
  LivenessResponse,
  ReadinessResponse,
} from './app.service';

describe('AppController', () => {
  let appController: AppController;
  let appService: jest.Mocked<Pick<AppService, 'getHealth' | 'getReadiness'>>;

  beforeEach(() => {
    appService = {
      getHealth: jest.fn<LivenessResponse, []>(),
      getReadiness: jest.fn<Promise<ReadinessResponse>, []>(),
    };

    appController = new AppController(appService as AppService);
  });

  describe('health', () => {
    it('should return lightweight liveness contract', () => {
      appService.getHealth.mockReturnValue({
        status: 'ready',
        service: 'api',
      });

      expect(appController.getHealth()).toEqual({
        status: 'ready',
        service: 'api',
      });
      expect(appService.getHealth).toHaveBeenCalledTimes(1);
    });

    it('should return readiness contract when dependencies are ready', async () => {
      const response = {
        status: jest.fn(),
      } as any;

      appService.getReadiness.mockResolvedValue({
        status: 'ready',
        service: 'api',
        dependencies: {
          database: {
            status: 'up',
          },
        },
      });

      await expect(appController.getReadiness(response)).resolves.toEqual({
        status: 'ready',
        service: 'api',
        dependencies: {
          database: {
            status: 'up',
          },
        },
      });
      expect(response.status).not.toHaveBeenCalled();
    });

    it('should return 503 readiness contract when database is unavailable', async () => {
      const response = {
        status: jest.fn(),
      } as any;

      appService.getReadiness.mockResolvedValue({
        status: 'not_ready',
        service: 'api',
        dependencies: {
          database: {
            status: 'down',
            code: 'DATABASE_UNAVAILABLE',
            reason: 'database unreachable',
          },
        },
      });

      await expect(appController.getReadiness(response)).resolves.toEqual({
        status: 'not_ready',
        service: 'api',
        dependencies: {
          database: {
            status: 'down',
            code: 'DATABASE_UNAVAILABLE',
            reason: 'database unreachable',
          },
        },
      });
      expect(response.status).toHaveBeenCalledWith(503);
    });
  });
});
