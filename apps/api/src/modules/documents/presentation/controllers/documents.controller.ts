import { BadRequestException, Body, Controller, Get, Inject, Param, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../../auth/application/dto/jwt-payload.interface';
import { DocumentUploadService } from '../../application/services/document-upload.service';
import { CandidateDocumentRepository, CANDIDATE_DOCUMENT_REPOSITORY } from '../../domain/ports/candidate-document.repository';
import { CandidateDocumentRecord } from '../../domain/models/candidate-document';
import { UploadDocumentDto } from '../../application/dto/upload-document.dto';

/** A hardcoded outer safety bound at the multer layer — the real, configurable policy limit
 * (`EMAIL_ATTACHMENT_MAX_FILE_SIZE_BYTES`, default 10MB) is enforced inside
 * `DocumentUploadService`; this is only a defensive ceiling so a wildly oversized request body is
 * rejected by multer before it's even fully buffered (Phase 8 "early rejection before large
 * allocations"). */
const MULTER_OUTER_SIZE_BOUND_BYTES = 15 * 1024 * 1024;

/** Never returns `storageProvider`/`storageBucket`/`storageObjectKey` — Phase 13 explicitly
 * forbids exposing storage keys to any client. */
function toSafeResponse(document: CandidateDocumentRecord) {
  return {
    id: document.id,
    documentType: document.documentType,
    version: document.version,
    isActive: document.isActive,
    safeFileName: document.safeFileName,
    mimeType: document.mimeType,
    sizeBytes: document.sizeBytes,
    scanStatus: document.scanStatus,
    scopeApplicationId: document.scopeApplicationId,
    createdAt: document.createdAt,
  };
}

/**
 * M28.5 — the real, secure document upload API. Every route is `me`-scoped (the owner is always
 * derived from the verified JWT, never a client-supplied userId), matching the pre-existing
 * profiles module's own `me`-scoping convention. Superseded (`isActive: false`) rows remain
 * queryable for version-history transparency but a client never receives a storage key it could
 * use to reach object storage directly.
 */
@ApiTags('documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly uploadService: DocumentUploadService,
    @Inject(CANDIDATE_DOCUMENT_REPOSITORY) private readonly documents: CandidateDocumentRepository,
  ) {}

  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MULTER_OUTER_SIZE_BOUND_BYTES } }))
  @Post()
  async upload(@UploadedFile() file: Express.Multer.File, @Body() dto: UploadDocumentDto, @CurrentUser() user: JwtPayload) {
    if (!file) {
      throw new BadRequestException('No file was uploaded.');
    }

    const result = await this.uploadService.upload({
      ownerUserId: user.sub,
      documentType: dto.documentType,
      originalFileName: file.originalname,
      claimedMimeType: file.mimetype,
      content: file.buffer,
      scopeApplicationId: dto.scopeApplicationId ?? null,
    });

    if (!result.accepted) {
      throw new BadRequestException({ message: result.detail, reason: result.rejectionReason });
    }

    return toSafeResponse(result.document);
  }

  @Get('me')
  async listMine(@CurrentUser() user: JwtPayload, @Query('limit') limit?: string, @Query('offset') offset?: string) {
    const documents = await this.documents.listByOwner(user.sub, limit ? Math.min(Number(limit), 100) : 50, offset ? Number(offset) : 0);
    return documents.map(toSafeResponse);
  }

  @Get('me/:id')
  async getMine(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    const document = await this.documents.findById(id);
    if (!document || document.ownerUserId !== user.sub) {
      return null;
    }
    return toSafeResponse(document);
  }
}
