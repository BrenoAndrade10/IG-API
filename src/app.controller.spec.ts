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

  describe('privacy', () => {
    it('should return the privacy policy HTML', () => {
      expect(appController.privacy()).toContain('Política de Privacidade');
      expect(appController.privacy()).toContain('<!DOCTYPE html>');
    });
  });

  describe('receiveInstagramWebhook', () => {
    it('should acknowledge comment events when the Instagram token is not configured', async () => {
      const previousAccessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
      delete process.env.INSTAGRAM_ACCESS_TOKEN;

      await expect(
        appController.receiveInstagramWebhook({
          entry: [
            {
              changes: [
                {
                  field: 'comments',
                  value: {
                    id: '18084267293257338',
                    text: '👏👏',
                  },
                },
              ],
            },
          ],
        }),
      ).resolves.toBe('EVENT_RECEIVED');

      if (previousAccessToken) {
        process.env.INSTAGRAM_ACCESS_TOKEN = previousAccessToken;
      } else {
        delete process.env.INSTAGRAM_ACCESS_TOKEN;
      }
    });
  });
});
