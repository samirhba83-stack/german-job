import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/** App-wide rate-limit guard, extendable to customize tracker/key generation later. */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {}
