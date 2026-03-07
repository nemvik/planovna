import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('should return readiness contract', () => {
      expect(appController.getReadiness()).toEqual({
        status: 'ready',
        service: 'api',
      });
    });

    it('should alias /health to readiness contract', () => {
      expect(appController.getHealth()).toEqual({
        status: 'ready',
        service: 'api',
      });
    });
  });
});
