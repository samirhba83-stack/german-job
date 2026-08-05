import { Injectable } from '@nestjs/common';
import { ExecutionClock } from '../../domain/ports/execution-clock.port';

@Injectable()
export class SystemClock implements ExecutionClock {
  now(): Date {
    return new Date();
  }
}
