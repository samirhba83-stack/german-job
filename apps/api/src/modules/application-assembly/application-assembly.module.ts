import { Module } from '@nestjs/common';
import { ProfilesModule } from '../profiles/profiles.module';
import { UsersModule } from '../users/users.module';
import { CompaniesModule } from '../companies/companies.module';
import { JobsModule } from '../jobs/jobs.module';
import { ExecutionModule } from '../execution/execution.module';
import { ExecutionTrackingModule } from '../execution-tracking/execution-tracking.module';
import { DocumentsModule } from '../documents/documents.module';
import { CandidateApplicationAssemblyService } from './application/services/candidate-application-assembly.service';
import { APPLICATION_ASSEMBLY_STRATEGY } from './domain/ports/application-assembly-strategy.port';
import { DeterministicApplicationAssemblyStrategy } from './domain/strategies/deterministic-application-assembly.strategy';
import { APPLICATION_ASSEMBLY_CONFIG, DEFAULT_APPLICATION_ASSEMBLY_CONFIG } from './domain/application-assembly-config';

/**
 * Candidate Application Assembly Engine scaffold (M14). Not imported into
 * AppModule — same rule as every Phase 4 module before it. Depends on the
 * foundation bounded contexts it retrieves data from (profiles, users,
 * companies, jobs) plus ExecutionModule for the shared clock; deliberately
 * does not depend on email-provider, email-delivery, or provider-selection,
 * since it produces an ApplicationPackage rather than sending anything.
 *
 * M28.5: now also imports `DocumentsModule` — CV/motivation-letter candidates are sourced from
 * the real, secure `CandidateDocument` store (`CandidateDocumentRepository`) instead of
 * `UserProfile.cv`'s client-asserted metadata. This is still a read of document *metadata* only
 * (never bytes, never storage) — this module still produces an `ApplicationPackage` referencing
 * documents by id, never anything that sends or resolves content itself.
 */
@Module({
  imports: [ProfilesModule, UsersModule, CompaniesModule, JobsModule, ExecutionModule, ExecutionTrackingModule, DocumentsModule],
  providers: [
    CandidateApplicationAssemblyService,
    { provide: APPLICATION_ASSEMBLY_CONFIG, useValue: DEFAULT_APPLICATION_ASSEMBLY_CONFIG },
    { provide: APPLICATION_ASSEMBLY_STRATEGY, useClass: DeterministicApplicationAssemblyStrategy },
  ],
  exports: [CandidateApplicationAssemblyService],
})
export class ApplicationAssemblyModule {}
