import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/privacy (GET)', () => {
    return request(app.getHttpServer())
      .get('/privacy')
      .expect(200)
      .expect('Content-Type', /text\/html/)
      .expect((response) => {
        expect(response.text).toContain('Política de Privacidade');
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
