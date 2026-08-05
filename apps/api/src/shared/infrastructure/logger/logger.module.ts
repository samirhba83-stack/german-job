import { Global, Module } from '@nestjs/common';

/** Placeholder for a structured logger provider (e.g. Pino/Winston) — uses Nest's built-in Logger for now. */
@Global()
@Module({})
export class LoggerModule {}
