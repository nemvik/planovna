import { Module } from '@nestjs/common';
import { OperationService } from './operation.service';

@Module({
  providers: [OperationService],
  exports: [OperationService],
})
export class OperationModule {}
