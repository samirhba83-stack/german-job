-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'EMPLOYER', 'CANDIDATE');

-- CreateEnum
CREATE TYPE "GermanLevel" AS ENUM ('A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'NATIVE');

-- CreateEnum
CREATE TYPE "LanguageProficiency" AS ENUM ('BASIC', 'CONVERSATIONAL', 'FLUENT', 'NATIVE');

-- CreateEnum
CREATE TYPE "AvailabilityStatus" AS ENUM ('IMMEDIATELY', 'WITHIN_1_MONTH', 'WITHIN_3_MONTHS', 'NOT_AVAILABLE');

-- CreateEnum
CREATE TYPE "CompanyStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CompanyIndustry" AS ENUM ('IT_SOFTWARE', 'ENGINEERING', 'MANUFACTURING', 'FINANCE', 'HEALTHCARE', 'RETAIL', 'LOGISTICS', 'CONSTRUCTION', 'HOSPITALITY', 'EDUCATION', 'CONSULTING', 'OTHER');

-- CreateEnum
CREATE TYPE "CompanySize" AS ENUM ('STARTUP', 'SMALL', 'MEDIUM', 'LARGE', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "VisaSponsorship" AS ENUM ('NOT_OFFERED', 'CASE_BY_CASE', 'OFFERED');

-- CreateEnum
CREATE TYPE "AusbildungSupport" AS ENUM ('NOT_OFFERED', 'LIMITED', 'OFFERED');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'INTERNSHIP', 'WORKING_STUDENT', 'FREELANCE', 'AUSBILDUNG', 'DUAL_STUDY');

-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('PERMANENT', 'FIXED_TERM', 'TEMPORARY', 'FREELANCE_CONTRACT');

-- CreateEnum
CREATE TYPE "RemotePolicy" AS ENUM ('ON_SITE', 'HYBRID', 'REMOTE');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('EUR', 'USD', 'GBP', 'CHF');

-- CreateEnum
CREATE TYPE "SalaryPeriod" AS ENUM ('HOURLY', 'MONTHLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "ExperienceLevel" AS ENUM ('ENTRY_LEVEL', 'JUNIOR', 'MID_LEVEL', 'SENIOR', 'LEAD', 'EXECUTIVE');

-- CreateEnum
CREATE TYPE "EducationLevel" AS ENUM ('NONE', 'SECONDARY_SCHOOL', 'VOCATIONAL_TRAINING', 'BACHELOR', 'MASTER', 'PHD');

-- CreateEnum
CREATE TYPE "EnglishLevel" AS ENUM ('A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'NATIVE');

-- CreateEnum
CREATE TYPE "ApplicationLifecycleStatus" AS ENUM ('DRAFT', 'PREPARED', 'QUEUED', 'SENT', 'DELIVERED', 'OPENED', 'VIEWED', 'COMPANY_REPLIED', 'INTERVIEW_SCHEDULED', 'INTERVIEW_COMPLETED', 'OFFER_RECEIVED', 'CONTRACT_SIGNED', 'REJECTED', 'WITHDRAWN', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ActorRole" AS ENUM ('CANDIDATE', 'COMPANY', 'ADMIN', 'SYSTEM', 'AUTOMATION');

-- CreateEnum
CREATE TYPE "ApplicationChannelType" AS ENUM ('DIRECT', 'CAMPAIGN', 'REFERRAL', 'IMPORT', 'API');

-- CreateEnum
CREATE TYPE "TransitionReasonCode" AS ENUM ('CANDIDATE_REQUEST', 'COMPANY_DECISION', 'POSITION_FILLED', 'QUALIFICATION_MISMATCH', 'POLICY_TIMEOUT', 'DATA_RETENTION', 'DUPLICATE', 'SYSTEM_SIGNAL', 'OTHER');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'READY', 'RUNNING', 'PAUSED', 'COOLING_DOWN', 'RESUMING', 'COMPLETED', 'STOPPED', 'CANCELLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CampaignStrategyType" AS ENUM ('CONSERVATIVE', 'BALANCED', 'AGGRESSIVE', 'OUTCOME_OPTIMIZED', 'AI_OPTIMIZED', 'CUSTOM');

-- CreateEnum
CREATE TYPE "CampaignTargetStatus" AS ENUM ('PENDING', 'SELECTED', 'QUEUED', 'DISPATCHED', 'SKIPPED', 'FAILED', 'EXCLUDED');

-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('PLANNED', 'RUNNING', 'COMPLETED', 'PARTIALLY_COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "DispatchOutcome" AS ENUM ('SUCCEEDED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ReplayScope" AS ENUM ('ALL_FAILED', 'SINCE_CHECKPOINT', 'SPECIFIC_TARGETS');

-- CreateEnum
CREATE TYPE "CampaignActorRole" AS ENUM ('CANDIDATE', 'ADMIN', 'SYSTEM', 'AUTOMATION');

-- CreateEnum
CREATE TYPE "CampaignReasonCode" AS ENUM ('CANDIDATE_REQUEST', 'GOAL_REACHED', 'RISK_THRESHOLD_EXCEEDED', 'COMPANY_FATIGUE_DETECTED', 'DUPLICATE_DETECTED', 'RATE_LIMIT_REACHED', 'EXECUTION_WINDOW_CLOSED', 'MANUAL_OVERRIDE', 'SYSTEM_SIGNAL', 'POLICY_TIMEOUT', 'OTHER');

-- CreateEnum
CREATE TYPE "CampaignOutcomeGoal" AS ENUM ('REPLIES', 'INTERVIEWS', 'OFFERS', 'CONTRACTS');

-- CreateEnum
CREATE TYPE "TrendDirection" AS ENUM ('UP', 'FLAT', 'DOWN');

-- CreateEnum
CREATE TYPE "Weekday" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'CANDIDATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "germanLevel" "GermanLevel",
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferredCities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "salaryExpectationMin" INTEGER,
    "salaryExpectationMax" INTEGER,
    "salaryExpectationCurrency" TEXT,
    "availabilityStatus" "AvailabilityStatus",
    "availableFrom" TIMESTAMP(3),
    "cvFileName" TEXT,
    "cvFileUrl" TEXT,
    "cvMimeType" TEXT,
    "cvSizeBytes" INTEGER,
    "cvUploadedAt" TIMESTAMP(3),
    "photoFileName" TEXT,
    "photoFileUrl" TEXT,
    "photoMimeType" TEXT,
    "photoSizeBytes" INTEGER,
    "photoUploadedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_experience_entries" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_experience_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "education_entries" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "degree" TEXT NOT NULL,
    "fieldOfStudy" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "education_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "language_entries" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "proficiency" "LanguageProficiency" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "language_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "CompanyStatus" NOT NULL DEFAULT 'ACTIVE',
    "industry" "CompanyIndustry" NOT NULL,
    "size" "CompanySize" NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "postalCode" TEXT,
    "street" TEXT,
    "websiteUrl" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "visaSponsorship" "VisaSponsorship" NOT NULL DEFAULT 'NOT_OFFERED',
    "ausbildungSupport" "AusbildungSupport" NOT NULL DEFAULT 'NOT_OFFERED',
    "hiringQualityScore" INTEGER,
    "hiringQualityComputedAt" TIMESTAMP(3),
    "trustScoreValue" INTEGER,
    "trustScoreComputedAt" TIMESTAMP(3),
    "description" TEXT,
    "logoUrl" TEXT,
    "foundedYear" INTEGER,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_listings" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "employmentType" "EmploymentType" NOT NULL,
    "contractType" "ContractType" NOT NULL,
    "workingTimeHoursPerWeek" INTEGER,
    "workingTimeIsFlexible" BOOLEAN NOT NULL DEFAULT false,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "postalCode" TEXT,
    "street" TEXT,
    "remotePolicy" "RemotePolicy" NOT NULL DEFAULT 'ON_SITE',
    "salaryMin" INTEGER,
    "salaryMax" INTEGER,
    "salaryCurrency" "Currency",
    "salaryPeriod" "SalaryPeriod",
    "experienceMinYears" INTEGER,
    "experienceLevel" "ExperienceLevel",
    "educationLevel" "EducationLevel",
    "educationFieldOfStudy" TEXT,
    "educationRequired" BOOLEAN,
    "germanLevelRequired" "GermanLevel",
    "germanRequired" BOOLEAN,
    "englishLevelRequired" "EnglishLevel",
    "englishRequired" BOOLEAN,
    "visaSponsorshipAvailable" "VisaSponsorship",
    "requiresEuWorkAuthorization" BOOLEAN,
    "isAusbildungPosition" BOOLEAN NOT NULL DEFAULT false,
    "ausbildungDurationMonths" INTEGER,
    "applicationDeadline" TIMESTAMP(3),
    "status" "JobStatus" NOT NULL DEFAULT 'DRAFT',
    "benefits" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requiredSkills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "niceToHaveSkills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "status" "ApplicationLifecycleStatus" NOT NULL DEFAULT 'DRAFT',
    "snapshotJobTitle" TEXT NOT NULL,
    "snapshotCompanyName" TEXT NOT NULL,
    "snapshotJobLocation" TEXT NOT NULL,
    "snapshotSalarySummary" TEXT,
    "snapshotCapturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "channelType" "ApplicationChannelType" NOT NULL DEFAULT 'DIRECT',
    "channelCampaignRef" TEXT,
    "intelReplyProbability" DOUBLE PRECISION,
    "intelInterviewProbability" DOUBLE PRECISION,
    "intelOfferProbability" DOUBLE PRECISION,
    "intelContractProbability" DOUBLE PRECISION,
    "intelExpectedTimeToReplyAmount" DOUBLE PRECISION,
    "intelExpectedTimeToReplyUnit" TEXT,
    "intelExpectedTimeToInterviewAmount" DOUBLE PRECISION,
    "intelExpectedTimeToInterviewUnit" TEXT,
    "intelExpectedTimeToContractAmount" DOUBLE PRECISION,
    "intelExpectedTimeToContractUnit" TEXT,
    "intelConfidenceScore" DOUBLE PRECISION,
    "intelHistoricalSuccessScore" DOUBLE PRECISION,
    "intelRiskScore" DOUBLE PRECISION,
    "intelDecisionExplanation" TEXT,
    "intelRecommendationExplanation" TEXT,
    "intelComputedAt" TIMESTAMP(3),
    "intelComputedBy" TEXT,
    "submittedAt" TIMESTAMP(3),
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timeline_entries" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorRole" "ActorRole" NOT NULL,
    "actorId" TEXT,
    "sourceChannelType" "ApplicationChannelType" NOT NULL,
    "sourceCampaignRef" TEXT,
    "reasonCode" "TransitionReasonCode",
    "reasonNote" TEXT,
    "previousState" "ApplicationLifecycleStatus",
    "currentState" "ApplicationLifecycleStatus" NOT NULL,
    "metadata" JSONB,
    "correlationId" TEXT NOT NULL,
    "evidenceType" TEXT,
    "evidenceExternalId" TEXT,
    "evidenceUrl" TEXT,
    "confidence" DOUBLE PRECISION,

    CONSTRAINT "timeline_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "strategyType" "CampaignStrategyType" NOT NULL DEFAULT 'BALANCED',
    "strategyParameters" JSONB,
    "goalTargetApplicationCount" INTEGER NOT NULL,
    "goalDesiredOutcome" "CampaignOutcomeGoal" NOT NULL,
    "goalDeadline" TIMESTAMP(3),
    "batchPlanBaseSize" INTEGER NOT NULL,
    "batchPlanMinSize" INTEGER NOT NULL,
    "batchPlanMaxSize" INTEGER NOT NULL,
    "batchPlanAdaptive" BOOLEAN NOT NULL DEFAULT false,
    "batchPlanExpansionIncrement" INTEGER,
    "executionWindowWeekdays" "Weekday"[],
    "executionWindowDailyStartHour" INTEGER NOT NULL,
    "executionWindowDailyEndHour" INTEGER NOT NULL,
    "executionWindowTimezone" TEXT NOT NULL,
    "executionWindowRespectHolidays" BOOLEAN NOT NULL DEFAULT true,
    "rateLimitMaxPerDay" INTEGER NOT NULL,
    "rateLimitMaxPerHour" INTEGER NOT NULL,
    "rateLimitMaxPerCompanyPerWindow" INTEGER NOT NULL,
    "adaptiveReplyRateFactor" DOUBLE PRECISION,
    "adaptiveBounceRateFactor" DOUBLE PRECISION,
    "adaptiveTimeOfDayFactor" DOUBLE PRECISION,
    "adaptiveWeekdayFactor" DOUBLE PRECISION,
    "adaptiveGermanHolidayFactor" DOUBLE PRECISION,
    "adaptiveCompanyWorkingHoursFactor" DOUBLE PRECISION,
    "adaptiveCampaignHealthFactor" DOUBLE PRECISION,
    "adaptiveCompanyFatigueFactor" DOUBLE PRECISION,
    "adaptiveUserReputationFactor" DOUBLE PRECISION,
    "adaptiveRiskScoreFactor" DOUBLE PRECISION,
    "adaptiveComputedBy" TEXT,
    "adaptiveComputedAt" TIMESTAMP(3),
    "checkpointLastCompletedBatchId" TEXT,
    "checkpointCursorPosition" INTEGER,
    "checkpointSavedAt" TIMESTAMP(3),
    "cooldownStartedAt" TIMESTAMP(3),
    "cooldownUntil" TIMESTAMP(3),
    "cooldownReason" "CampaignReasonCode",
    "healthScore" DOUBLE PRECISION,
    "riskScore" DOUBLE PRECISION,
    "progressScore" DOUBLE PRECISION,
    "successTrend" "TrendDirection",
    "replyTrend" "TrendDirection",
    "performanceTrend" "TrendDirection",
    "healthComputedBy" TEXT,
    "healthComputedAt" TIMESTAMP(3),
    "intelBestSendTime" TEXT,
    "intelBestBatchSize" INTEGER,
    "intelBestCompanyOrder" TEXT[],
    "intelBestResumeDocumentId" TEXT,
    "intelBestResumeConfidence" DOUBLE PRECISION,
    "intelBestResumeExplanation" TEXT,
    "intelBestResumeSelectedBy" TEXT,
    "intelBestResumeSelectedAt" TIMESTAMP(3),
    "intelBestMotivationDocumentId" TEXT,
    "intelBestMotivationConfidence" DOUBLE PRECISION,
    "intelBestMotivationExplanation" TEXT,
    "intelBestMotivationSelectedBy" TEXT,
    "intelBestMotivationSelectedAt" TIMESTAMP(3),
    "intelReplyPrediction" DOUBLE PRECISION,
    "intelInterviewPrediction" DOUBLE PRECISION,
    "intelOfferPrediction" DOUBLE PRECISION,
    "intelContractPrediction" DOUBLE PRECISION,
    "intelRiskPrediction" DOUBLE PRECISION,
    "intelDecisionExplanation" TEXT,
    "intelRecommendationExplanation" TEXT,
    "intelComputedBy" TEXT,
    "intelComputedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_targets" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "status" "CampaignTargetStatus" NOT NULL DEFAULT 'PENDING',
    "resumeDocumentId" TEXT,
    "resumeConfidence" DOUBLE PRECISION,
    "resumeExplanation" TEXT,
    "resumeSelectedBy" TEXT,
    "resumeSelectedAt" TIMESTAMP(3),
    "motivationDocumentId" TEXT,
    "motivationConfidence" DOUBLE PRECISION,
    "motivationExplanation" TEXT,
    "motivationSelectedBy" TEXT,
    "motivationSelectedAt" TIMESTAMP(3),
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispatch_attempts" (
    "id" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "outcome" "DispatchOutcome" NOT NULL,
    "failureReason" TEXT,
    "evidenceType" TEXT,
    "evidenceExternalId" TEXT,
    "evidenceUrl" TEXT,

    CONSTRAINT "dispatch_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batches" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "plannedSize" INTEGER NOT NULL,
    "targetIds" TEXT[],
    "status" "BatchStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_memory_entries" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "alreadyApplied" BOOLEAN NOT NULL DEFAULT false,
    "alreadyContacted" BOOLEAN NOT NULL DEFAULT false,
    "coolingDownUntil" TIMESTAMP(3),
    "previousReplyAt" TIMESTAMP(3),
    "interviewCount" INTEGER NOT NULL DEFAULT 0,
    "offerCount" INTEGER NOT NULL DEFAULT 0,
    "historicalSuccessScore" DOUBLE PRECISION,
    "futureAiNotes" TEXT,
    "lastInteractionAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_memory_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_timeline_entries" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorRole" "CampaignActorRole" NOT NULL,
    "actorId" TEXT,
    "source" TEXT NOT NULL,
    "reasonCode" "CampaignReasonCode",
    "reasonNote" TEXT,
    "previousState" "CampaignStatus",
    "currentState" "CampaignStatus" NOT NULL,
    "metadata" JSONB,
    "correlationId" TEXT NOT NULL,
    "evidenceType" TEXT,
    "evidenceExternalId" TEXT,
    "evidenceUrl" TEXT,
    "aiExplanation" TEXT,

    CONSTRAINT "campaign_timeline_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_userId_key" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_userId_key" ON "user_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "companies_ownerId_key" ON "companies"("ownerId");

-- CreateIndex
CREATE INDEX "job_listings_status_createdAt_idx" ON "job_listings"("status", "createdAt");

-- CreateIndex
CREATE INDEX "job_listings_companyId_idx" ON "job_listings"("companyId");

-- CreateIndex
CREATE INDEX "job_listings_city_idx" ON "job_listings"("city");

-- CreateIndex
CREATE INDEX "job_listings_employmentType_idx" ON "job_listings"("employmentType");

-- CreateIndex
CREATE INDEX "job_listings_contractType_idx" ON "job_listings"("contractType");

-- CreateIndex
CREATE INDEX "job_listings_remotePolicy_idx" ON "job_listings"("remotePolicy");

-- CreateIndex
CREATE INDEX "applications_candidateId_idx" ON "applications"("candidateId");

-- CreateIndex
CREATE INDEX "applications_jobId_idx" ON "applications"("jobId");

-- CreateIndex
CREATE INDEX "applications_companyId_idx" ON "applications"("companyId");

-- CreateIndex
CREATE INDEX "applications_status_createdAt_idx" ON "applications"("status", "createdAt");

-- CreateIndex
CREATE INDEX "timeline_entries_applicationId_timestamp_idx" ON "timeline_entries"("applicationId", "timestamp");

-- CreateIndex
CREATE INDEX "campaigns_ownerId_idx" ON "campaigns"("ownerId");

-- CreateIndex
CREATE INDEX "campaigns_status_createdAt_idx" ON "campaigns"("status", "createdAt");

-- CreateIndex
CREATE INDEX "campaign_targets_campaignId_idx" ON "campaign_targets"("campaignId");

-- CreateIndex
CREATE INDEX "campaign_targets_campaignId_status_idx" ON "campaign_targets"("campaignId", "status");

-- CreateIndex
CREATE INDEX "dispatch_attempts_targetId_idx" ON "dispatch_attempts"("targetId");

-- CreateIndex
CREATE INDEX "batches_campaignId_idx" ON "batches"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "company_memory_entries_campaignId_companyId_key" ON "company_memory_entries"("campaignId", "companyId");

-- CreateIndex
CREATE INDEX "campaign_timeline_entries_campaignId_timestamp_idx" ON "campaign_timeline_entries"("campaignId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_userId_key" ON "subscriptions"("userId");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_experience_entries" ADD CONSTRAINT "work_experience_entries_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "user_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "education_entries" ADD CONSTRAINT "education_entries_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "user_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "language_entries" ADD CONSTRAINT "language_entries_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "user_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_listings" ADD CONSTRAINT "job_listings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "job_listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timeline_entries" ADD CONSTRAINT "timeline_entries_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_targets" ADD CONSTRAINT "campaign_targets_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_attempts" ADD CONSTRAINT "dispatch_attempts_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "campaign_targets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_memory_entries" ADD CONSTRAINT "company_memory_entries_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_timeline_entries" ADD CONSTRAINT "campaign_timeline_entries_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
