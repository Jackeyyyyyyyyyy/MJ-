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

export type Role = 'employee' | 'boss' | 'developer';

export type AdminView = 'accounts' | 'ai-assistant' | 'organization' | 'workflows';

export type ApproverRuleType =
  | 'specific_members'
  | 'department_manager'
  | 'submitter_manager'
  | 'specified'
  | 'direct_supervisor'
  | 'nth_supervisor'
  | 'multi_supervisor'
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
  enabled: boolean;
}

export interface OrganizationDirectory {
  departments: OrganizationDepartment[];
  members: OrganizationMember[];
  updatedAt?: string;
}

export interface ApproverRule {
  type: ApproverRuleType;
  memberIds?: string[];
  departmentIds?: string[];
  supervisorLevel?: number;
  supervisorDepth?: number;
  emptyApproverAction?: 'auto_pass' | 'block_submit';
}

export type WorkflowTemplateStatus = 'draft' | 'published' | 'disabled';

export type WorkflowBusinessType = 'reimbursement' | 'purchase' | 'leave' | 'general';

export type SubmitPermissionType = 'all_members' | 'members' | 'departments';

export interface SubmitPermissionRule {
  type: SubmitPermissionType;
  memberIds: string[];
  departmentIds: string[];
  excludedMemberIds: string[];
}

export type WorkflowConditionField = string;

export type WorkflowConditionOperator = 'lte' | 'gt' | 'between' | 'eq';

export interface WorkflowCondition {
  id: string;
  field: WorkflowConditionField;
  operator: WorkflowConditionOperator;
  value?: string;
  amountMin?: number;
  amountMax?: number;
  expression?: string;
}

export type ApprovalMode = 'one_of' | 'all_of';

export interface ApprovalStep {
  id: string;
  name: string;
  approverRule: ApproverRule;
  approvalMode: ApprovalMode;
  emptyApproverAction: 'auto_pass' | 'block_submit';
}

export interface WorkflowBranch {
  id: string;
  name: string;
  isDefault: boolean;
  conditions: WorkflowCondition[];
  approvalSteps: ApprovalStep[];
}

export interface CcRule {
  timing: 'workflow_completed';
  memberIds: string[];
  departmentIds: string[];
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
  status: WorkflowTemplateStatus;
  organizationId?: string;
  businessType?: WorkflowBusinessType;
  basic: {
    name: string;
    moduleName: string;
    approvalTypeName: string;
    visibleRange?: string;
  };
  submitPermission?: SubmitPermissionRule;
  branches?: WorkflowBranch[];
  ccRule?: CcRule;
  formFields?: WorkflowFormField[];
  nodes: WorkflowNode[];
  savedAt?: string;
  savedBy?: string;
  publishedAt?: string;
}

export interface ApprovalWorkflowTemplate {
  id: string;
  name: string;
  organizationId?: string;
  businessType?: WorkflowBusinessType;
  moduleName: string;
  approvalTypeName: string;
  status: WorkflowTemplateStatus;
  currentVersion: number;
  draft: WorkflowVersion;
  publishedVersion?: WorkflowVersion;
  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface WorkflowTemplate extends ApprovalWorkflowTemplate {}

export interface WorkflowTemplateInput {
  name: string;
  businessType: WorkflowBusinessType;
  organizationId?: string;
  moduleName?: string;
  approvalTypeName?: string;
}

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
  currentUserHasApproved?: boolean;
  aiSuggestion?: AiSuggestion;
  createdAt: string;
  updatedAt: string;
  approver?: string;
  approvedAt?: string;
  rejectedAt?: string;
  rejectReason?: string;
  logs: ApprovalLog[];
}
