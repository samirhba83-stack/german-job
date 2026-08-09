import { FollowUpControlType, FollowUpControlStatus, RecruitmentTaskType, RecruitmentTaskStatus, RecruitmentTaskPriority, DueDateConfidence } from '../enums/recruitment-operations.enum';

export interface FollowUpControlDto {
  id: string;
  applicationId: string;
  campaignId: string | null;
  controlType: FollowUpControlType;
  status: FollowUpControlStatus;
  reasonCode: string;
  explanation: string;
  classification: string | null;
  confidence: number | null;
  createdAt: string;
  effectiveAt: string;
  expiresAt: string | null;
  releasedAt: string | null;
  releasedBy: string | null;
  releaseReason: string | null;
}

export interface ReleaseFollowUpControlRequestDto {
  reason: string;
}

export interface RecruitmentTaskDto {
  id: string;
  applicationId: string;
  companyId: string | null;
  jobId: string | null;
  taskType: RecruitmentTaskType;
  title: string;
  explanation: string;
  priority: RecruitmentTaskPriority;
  dueAt: string | null;
  dueDateConfidence: DueDateConfidence | null;
  originalDateText: string | null;
  status: RecruitmentTaskStatus;
  completedAt: string | null;
  dismissedAt: string | null;
  dismissReason: string | null;
  createdAt: string;
}

export interface DismissTaskRequestDto {
  reason?: string;
}

export interface ConfirmTaskDueDateRequestDto {
  dueAt: string;
}
