import { Test, TestingModule } from '@nestjs/testing';
import axios from 'axios';
import { AppController } from './app.controller';
import { AppService } from './app.service';

jest.mock('axios');

const mockedAxios = jest.mocked(axios);

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
    const previousAccessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
    const previousRecipeImageUrl = process.env.RECIPE_IMAGE_URL;

    beforeEach(() => {
      mockedAxios.post.mockResolvedValue({ data: { ok: true } });
    });

    afterEach(() => {
      jest.clearAllMocks();

      if (previousAccessToken) {
        process.env.INSTAGRAM_ACCESS_TOKEN = previousAccessToken;
      } else {
        delete process.env.INSTAGRAM_ACCESS_TOKEN;
      }

      if (previousRecipeImageUrl) {
        process.env.RECIPE_IMAGE_URL = previousRecipeImageUrl;
      } else {
        delete process.env.RECIPE_IMAGE_URL;
      }
    });

    it('should acknowledge comment events when the Instagram token is not configured', async () => {
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
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('should send the apple recipe DM when the comment says MAÇÃ', async () => {
      process.env.INSTAGRAM_ACCESS_TOKEN = 'test-token';

      await appController.receiveInstagramWebhook({
        entry: [
          {
            changes: [
              {
                field: 'comments',
                value: {
                  id: '18084267293257338',
                  text: 'Quero a receita da MAÇÃ',
                },
              },
            ],
          },
        ],
      });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://graph.instagram.com/v26.0/me/messages',
        expect.objectContaining({
          recipient: {
            comment_id: '18084267293257338',
          },
          message: expect.objectContaining({
            text: expect.stringContaining('receita da maçã cozida'),
          }),
        }),
        expect.any(Object),
      );
    });

    it('should send the apple recipe DM when the comment says MACA without accent', async () => {
      process.env.INSTAGRAM_ACCESS_TOKEN = 'test-token';

      await appController.receiveInstagramWebhook({
        entry: [
          {
            changes: [
              {
                field: 'comments',
                value: {
                  id: '18084267293257338',
                  text: 'maca',
                },
              },
            ],
          },
        ],
      });

      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    });

    it('should not send the apple recipe DM when the comment does not include the keyword', async () => {
      process.env.INSTAGRAM_ACCESS_TOKEN = 'test-token';

      await appController.receiveInstagramWebhook({
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
      });

      expect(mockedAxios.post).not.toHaveBeenCalled();
    });
  });
});
