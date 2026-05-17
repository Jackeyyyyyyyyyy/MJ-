import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export enum ApprovalStatus {
  DRAFT = '草稿',
  PENDING = '待审批',
  APPROVED = '已批准',
  REJECTED = '已拒绝',
}

export type Role = 'applicant' | 'approver' | 'boss' | 'developer';

export type AdminView = 'accounts' | 'ai-assistant' | 'organization' | 'workflows';

export type ApproverRuleType =
  | 'specified'
  | 'direct_supervisor'
  | 'nth_supervisor'
  | 'multi_supervisor'
  | 'role'
  | 'initiator_select';

export interface OrganizationDepartment {
  id: string;
  name: string;
  parentId?: string;
  leaderIds: string[];
}

export interface OrganizationMember {
  id: string;
  name: string;
  accountUsername?: string;
  departmentId: string;
  title: string;
  supervisorId?: string;
  roleGroupIds: string[];
  enabled: boolean;
}

export interface OrganizationRoleGroup {
  id: string;
  name: string;
  memberIds: string[];
}

export interface OrganizationDirectory {
  departments: OrganizationDepartment[];
  members: OrganizationMember[];
  roleGroups: OrganizationRoleGroup[];
  updatedAt?: string;
}

export interface ApproverRule {
  type: ApproverRuleType;
  memberIds?: string[];
  roleGroupId?: string;
  supervisorLevel?: number;
  supervisorDepth?: number;
  emptyApproverAction?: 'auto_pass' | 'block_submit';
}

export type WorkflowStepStatus = 'not_started' | 'pending' | 'approved' | 'rejected' | 'skipped';

export interface WorkflowApproverSnapshot {
  memberId: string;
  name: string;
  accountUsername?: string;
}

export interface WorkflowInstanceStep {
  stepId: string;
  name: string;
  order: number;
  approvers: WorkflowApproverSnapshot[];
  status: WorkflowStepStatus;
  actedByMemberId?: string;
  actedByName?: string;
  actedByAccountUsername?: string;
  actedAt?: string;
  comment?: string;
}

export interface WorkflowInstance {
  workflowId: string;
  workflowName: string;
  workflowVersion: number;
  currentStepIndex: number;
  steps: WorkflowInstanceStep[];
}

export interface WorkflowFormField {
  id: string;
  label: string;
  type: string;
  required?: boolean;
}

export interface WorkflowNode {
  id: string;
  type: 'start' | 'approver' | 'condition' | 'cc';
  title: string;
  subtitle?: string;
  rule?: ApproverRule;
  conditions?: Array<{
    id: string;
    title: string;
    expression: string;
    priority: number;
    nodes: WorkflowNode[];
  }>;
}

export interface WorkflowVersion {
  id: string;
  version: number;
  status: 'draft' | 'published' | 'disabled';
  basic: {
    name: string;
    moduleName: string;
    approvalTypeName: string;
    visibleRange?: string;
  };
  formFields?: WorkflowFormField[];
  nodes: WorkflowNode[];
  savedAt?: string;
  savedBy?: string;
  publishedAt?: string;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  moduleName: string;
  approvalTypeName: string;
  status: 'draft' | 'published' | 'disabled';
  currentVersion: number;
  draft: WorkflowVersion;
  publishedVersion?: WorkflowVersion;
  updatedAt?: string;
  updatedBy?: string;
}

export type WorkflowTemplateInput = Pick<WorkflowTemplate, 'name' | 'moduleName' | 'approvalTypeName'>;

export interface User {
  username: string;
  role: Role;
  name: string;
}

export interface AccountPermission {
  key: string;
  label: string;
}

export interface SystemAccount extends User {
  id: string;
  roleLabel: string;
  permissions: AccountPermission[];
  canSwitchPerspective: boolean;
  isSuperAdmin: boolean;
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AccountInput {
  username: string;
  name: string;
  role: Exclude<Role, 'developer'>;
  password?: string;
  enabled?: boolean;
}

export interface BusinessField {
  name: string;
}

export interface ApprovalType {
  name: string;
  businessFields: string[];
  commonFields: string[];
  notes?: string;
}

export interface Module {
  name: string;
  approvalTypes: ApprovalType[];
}

export interface Schema {
  systemName: string;
  commonFields: string[];
  modules: Module[];
}

export interface ApprovalLog {
  action: string;
  user: string;
  time: string;
  details?: string;
}

export interface ApprovalAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  uploadedAt: string;
}

export type AiSuggestionStatus = 'generating' | 'generated' | 'failed' | 'skipped';

export interface AiSuggestion {
  status: AiSuggestionStatus;
  riskLevel?: string;
  advice?: string;
  displayText: string;
  rawText?: string;
  generatedAt?: string;
  error?: string;
}

export interface AiPromptConfig {
  key: string;
  moduleName: string;
  approvalTypeName: string;
  prompt: string;
  updatedAt?: string;
  updatedBy?: string;
  isDefault?: boolean;
}

export interface AiAssistantRecord {
  id: string;
  moduleName: string;
  approvalTypeName: string;
  status: ApprovalStatus;
  applicant: string;
  createdAt: string;
  updatedAt: string;
  approver?: string;
  rejectReason?: string;
  aiSuggestion?: Pick<AiSuggestion, 'status' | 'riskLevel' | 'displayText'> | null;
  businessData: Record<string, string>;
}

export interface AiAssistantOverview {
  aiEnabled: boolean;
  summary: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    today: number;
    highRisk: number;
    aiAttention: number;
  };
  highRiskRecords: AiAssistantRecord[];
  aiAttentionRecords: AiAssistantRecord[];
  priorityRecords: AiAssistantRecord[];
  moduleStats: Array<{
    moduleName: string;
    total: number;
    pending: number;
    highRisk: number;
  }>;
  topApplicants: Array<{
    name: string;
    count: number;
  }>;
}

export interface AiAssistantChatResponse {
  enabled: boolean;
  answer: string;
  relatedRecords: AiAssistantRecord[];
}

export interface AiAssistantPromptConfig {
  prompt: string;
  updatedAt?: string;
  updatedBy?: string;
  isDefault?: boolean;
}

export interface ApprovalRecord {
  id: string;
  moduleName: string;
  approvalTypeName: string;
  businessData: Record<string, any>;
  status: ApprovalStatus;
  applicant: string;
  workflowInstance?: WorkflowInstance;
  currentUserCanApprove?: boolean;
  aiSuggestion?: AiSuggestion;
  createdAt: string;
  updatedAt: string;
  approver?: string;
  approvedAt?: string;
  rejectedAt?: string;
  rejectReason?: string;
  logs: ApprovalLog[];
}
