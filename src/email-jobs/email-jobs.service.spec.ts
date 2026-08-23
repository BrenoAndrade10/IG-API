import { SchedulerRegistry } from '@nestjs/schedule';
import { EmailJobsService } from './email-jobs.service';

const sendEmailMock = jest.fn();

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: sendEmailMock,
    },
  })),
}));

jest.mock('cron', () => ({
  CronJob: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
  })),
}));

jest.mock('./email-jobs.config', () => ({
  emailJobs: [
    {
      name: 'disabled-job',
      enabled: false,
      cron: '0 9 * * *',
      timezone: 'America/Sao_Paulo',
      sender: {
        name: 'Sender',
        email: 'sender@example.com',
      },
      to: ['disabled@example.com'],
      subject: 'Disabled',
      htmlContent: '<p>Disabled body</p>',
    },
    {
      name: 'enabled-job',
      enabled: true,
      cron: '0 10 * * *',
      timezone: 'America/Sao_Paulo',
      sender: {
        name: 'Sender',
        email: 'sender@example.com',
      },
      to: ['enabled@example.com'],
      cc: ['copy@example.com'],
      subject: 'Enabled',
      htmlContent: '<p>Enabled body</p>',
    },
  ],
}));

describe('EmailJobsService', () => {
  const previousApiKey = process.env.RESEND_API_KEY;

  afterEach(() => {
    jest.clearAllMocks();

    if (previousApiKey) {
      process.env.RESEND_API_KEY = previousApiKey;
    } else {
      delete process.env.RESEND_API_KEY;
    }
  });

  it('should only register enabled email jobs', () => {
    const schedulerRegistry = {
      addCronJob: jest.fn(),
    } as unknown as SchedulerRegistry;
    const service = new EmailJobsService(schedulerRegistry);

    service.onModuleInit();

    expect(schedulerRegistry.addCronJob).toHaveBeenCalledTimes(1);
    expect(schedulerRegistry.addCronJob).toHaveBeenCalledWith(
      'enabled-job',
      expect.objectContaining({
        start: expect.any(Function),
      }),
    );
  });

  it('should send configured emails through Resend', async () => {
    process.env.RESEND_API_KEY = 'test-api-key';
    sendEmailMock.mockResolvedValue({ data: { id: 'test-id' } });
    const schedulerRegistry = {
      addCronJob: jest.fn(),
    } as unknown as SchedulerRegistry;
    const service = new EmailJobsService(schedulerRegistry);

    await (
      service as unknown as {
        handleEmailJob(jobConfig: {
          name: string;
          enabled: boolean;
          cron: string;
          timezone: string;
          sender: { name: string; email: string };
          to: string[];
          cc?: string[];
          subject: string;
          htmlContent: string;
        }): Promise<void>;
      }
    ).handleEmailJob({
      name: 'enabled-job',
      enabled: true,
      cron: '0 10 * * *',
      timezone: 'America/Sao_Paulo',
      sender: {
        name: 'Sender',
        email: 'sender@example.com',
      },
      to: ['enabled@example.com'],
      cc: ['copy@example.com'],
      subject: 'Enabled',
      htmlContent: '<p>Enabled body</p>',
    });

    expect(sendEmailMock).toHaveBeenCalledWith({
      from: 'Sender <sender@example.com>',
      to: ['enabled@example.com'],
      cc: ['copy@example.com'],
      subject: 'Enabled',
      html: '<p>Enabled body</p>',
    });
  });
});
