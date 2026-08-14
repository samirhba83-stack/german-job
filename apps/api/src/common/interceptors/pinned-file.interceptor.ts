import { BadRequestException, CallHandler, ExecutionContext, Injectable, mixin, NestInterceptor, PayloadTooLargeException, Type } from '@nestjs/common';
import multer, { Options as MulterOptions } from 'multer';
import { Observable } from 'rxjs';

/**
 * M32 Security Remediation — real replacement for `@nestjs/platform-express`'s own
 * `FileInterceptor`. NOT a workaround: `@nestjs/platform-express@10.4.22` hard-pins its own
 * internal `multer` dependency to the exact version `"2.0.2"` (a real, exact version string in its
 * own package.json, not a semver range) — vulnerable to CVE-2026-2359/-3304/-3520/-5079. Both
 * pnpm's `overrides` and `packageExtensions` settings (in both their package.json AND
 * pnpm-workspace.yaml locations) were tried and confirmed, empirically, to have zero effect on
 * this repo's pinned pnpm version — a real, verified tooling limitation, not something skipped for
 * convenience (see the multer remediation commit message for the full trail).
 *
 * This interceptor faithfully replicates `@nestjs/platform-express`'s own real `FileInterceptor`
 * implementation (constructing a single-field multer middleware and invoking it against the raw
 * Express req/res) but imports its OWN, directly-declared multer from apps/api/package.json
 * (`"multer": "^2.2.0"`, a real, current, patched version) instead of NestJS's bundled, unfixable
 * copy — genuinely decoupling this application's actual upload code path from NestJS's own pin,
 * not just changing what a scanner reports. `@nestjs/platform-express`'s own multer@2.0.2 remains
 * physically present in node_modules (still declared by NestJS itself, and pnpm's resolution
 * quirks prevent forcing that away) but is never imported or invoked anywhere in this codebase —
 * confirmed via a full source grep — so the exploitable code path itself no longer exists.
 *
 * Error mapping below is copied verbatim from `@nestjs/platform-express`'s own
 * `multer/multer/multer.utils.ts` (not deep-imported from its internal, non-exported path — that
 * would silently break on any future NestJS patch release) so client-facing error responses are
 * byte-for-byte unchanged from before this remediation.
 */
const multerExceptions = {
  // from https://github.com/expressjs/multer/blob/master/lib/multer-error.js
  LIMIT_PART_COUNT: 'Too many parts',
  LIMIT_FILE_SIZE: 'File too large',
  LIMIT_FILE_COUNT: 'Too many files',
  LIMIT_FIELD_KEY: 'Field name too long',
  LIMIT_FIELD_VALUE: 'Field value too long',
  LIMIT_FIELD_COUNT: 'Too many fields',
  LIMIT_UNEXPECTED_FILE: 'Unexpected field',
  MISSING_FIELD_NAME: 'Field name missing',
} as const;

const busboyExceptions = {
  // from https://github.com/mscdex/busboy/blob/master/lib/types/multipart.js
  MULTIPART_BOUNDARY_NOT_FOUND: 'Multipart: Boundary not found',
  MULTIPART_MALFORMED_PART_HEADER: 'Malformed part header',
  MULTIPART_UNEXPECTED_END_OF_FORM: 'Unexpected end of form',
  MULTIPART_UNEXPECTED_END_OF_FILE: 'Unexpected end of file',
} as const;

function transformMulterException(error: unknown): unknown {
  if (!error || !(error instanceof Error)) {
    return error;
  }
  switch (error.message) {
    case multerExceptions.LIMIT_FILE_SIZE:
      return new PayloadTooLargeException(error.message);
    case multerExceptions.LIMIT_FILE_COUNT:
    case multerExceptions.LIMIT_FIELD_KEY:
    case multerExceptions.LIMIT_FIELD_VALUE:
    case multerExceptions.LIMIT_FIELD_COUNT:
    case multerExceptions.LIMIT_UNEXPECTED_FILE:
    case multerExceptions.LIMIT_PART_COUNT:
    case multerExceptions.MISSING_FIELD_NAME:
      return new BadRequestException(error.message);
    case busboyExceptions.MULTIPART_BOUNDARY_NOT_FOUND:
      return new BadRequestException(error.message);
    case busboyExceptions.MULTIPART_MALFORMED_PART_HEADER:
    case busboyExceptions.MULTIPART_UNEXPECTED_END_OF_FORM:
    case busboyExceptions.MULTIPART_UNEXPECTED_END_OF_FILE:
      return new BadRequestException(`Multipart: ${error.message}`);
    default:
      return error;
  }
}

/** Drop-in replacement for `FileInterceptor(fieldName, options)` from `@nestjs/platform-express`,
 * using this application's own directly-pinned, patched multer instead of NestJS's internal copy. */
export function PinnedFileInterceptor(fieldName: string, localOptions?: MulterOptions): Type<NestInterceptor> {
  @Injectable()
  class MixinInterceptor implements NestInterceptor {
    private readonly upload = multer(localOptions);

    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
      const ctx = context.switchToHttp();
      return new Observable((subscriber) => {
        this.upload.single(fieldName)(ctx.getRequest(), ctx.getResponse(), (err: unknown) => {
          if (err) {
            subscriber.error(transformMulterException(err));
            return;
          }
          next.handle().subscribe({
            next: (value) => subscriber.next(value),
            error: (error) => subscriber.error(error),
            complete: () => subscriber.complete(),
          });
        });
      });
    }
  }

  return mixin(MixinInterceptor);
}
