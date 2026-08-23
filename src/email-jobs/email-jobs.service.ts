import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import axios from 'axios';
import { CronJob } from 'cron';
import { emailJobs, EmailJobConfig } from './email-jobs.config';
import { Resend } from 'resend';

@Injectable()
export class EmailJobsService implements OnModuleInit {
  private readonly logger = new Logger(EmailJobsService.name);

  constructor(private readonly schedulerRegistry: SchedulerRegistry) {}

  onModuleInit() {
    emailJobs.forEach((jobConfig) => this.registerEmailJob(jobConfig));
  }

  private registerEmailJob(jobConfig: EmailJobConfig) {
    if (!jobConfig.enabled) {
      this.logger.log(`Email job "${jobConfig.name}" está desabilitado.`);
      return;
    }

    const job = new CronJob(
      jobConfig.cron,
      () => void this.handleEmailJob(jobConfig),
      null,
      false,
      jobConfig.timezone,
    );

    this.schedulerRegistry.addCronJob(jobConfig.name, job);
    job.start();

    this.logger.log(
      `Email job "${jobConfig.name}" agendado: ${jobConfig.cron} (${jobConfig.timezone}).`,
    );
  }

  private async handleEmailJob(jobConfig: EmailJobConfig) {
    this.logger.log(
      `Executando email job "${jobConfig.name}" para ${jobConfig.to.join(', ')}.`,
    );

    try {
      await this.sendEmail(jobConfig);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.error(
          `Falha no email job "${jobConfig.name}": ${JSON.stringify(
            error.response?.data ?? error.message,
          )}`,
        );
        return;
      }

      this.logger.error(`Falha no email job "${jobConfig.name}".`, error);
    }
  }

  private async sendEmail(jobConfig: EmailJobConfig) {
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      this.logger.warn(
        `RESEND_API_KEY não configurada; email job "${jobConfig.name}" não enviado.`,
      );
      return;
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    await Promise.all(
      jobConfig.to.map((recipientEmail) =>
        resend.emails.send({
          from: `${jobConfig.sender.name} <${jobConfig.sender.email}>`,
          to: [recipientEmail],
          cc: jobConfig.cc,
          subject: jobConfig.subject,
          html: jobConfig.htmlContent,
        }),
      ),
    );

    this.logger.log(
      `Email job "${jobConfig.name}" enviado para ${jobConfig.to.length} destinatário(s).`,
    );
  }
}
