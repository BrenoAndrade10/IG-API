import { Module } from '@nestjs/common';
import { EmailJobsService } from './email-jobs.service';

@Module({
  providers: [EmailJobsService],
})
export class EmailJobsModule {}
