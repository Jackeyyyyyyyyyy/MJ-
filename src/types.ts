import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export enum ApprovalStatus {
  DRAFT = '草稿',
  PENDING = '待审批',
  PROCESSING = '待办理',
  APPROVED = '已批准',
  COMPLETED = '已完成',
  REJECTED = '已拒绝',
}

export type Role = 'employee' | 'boss' | 'developer';

export type AdminView = 'accounts' | 'ai-assistant' | 'ai-assistant-prompt' | 'organization' | 'workflows' | 'business-forms' | 'ai-branch-logs';

export type ApproverRuleType =
  | 'specific_members'
  | 'specific_positions'
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
  positionTitles?: string[];
  departmentIds?: string[];
  supervisorLevel?: number;
  supervisorDepth?: number;
  supervisorLevels?: string;
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

export type WorkflowConditionOperator =
  | 'lt'
  | 'lte'
  | 'gt'
  | 'gte'
  | 'between'
  | 'eq'
  | 'neq'
  | 'contains'
  | 'not_contains';

export interface WorkflowCondition {
  id: string;
  field: WorkflowConditionField;
  operator: WorkflowConditionOperator;
  value?: string;
  currencyValue?: string;
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
  conditionMode?: 'rules' | 'ai';
  aiBranchRule?: AiBranchRule;
  conditions: WorkflowCondition[];
  approvalSteps: ApprovalStep[];
}

export interface AiBranchRule {
  prompt: string;
}

export interface CcRule {
  timing: 'workflow_completed';
  memberIds: string[];
  departmentIds: string[];
}

export interface ProcessorRule {
  timing: 'approval_completed';
  enabled?: boolean;
  taskName?: string;
  memberIds: string[];
  departmentIds: string[];
}

export type WorkflowStepStatus = 'not_started' | 'pending' | 'approved' | 'rejected' | 'skipped';

export interface WorkflowApproverSnapshot {
  memberId: string;
  name: string;
  accountUsername?: string;
  status?: 'pending' | 'approved' | 'rejected' | 'closed';
  actedAt?: string;
  comment?: string;
}

export interface WorkflowCcRecipientSnapshot {
  memberId: string;
  name: string;
  accountUsername?: string;
}

export interface WorkflowProcessorSnapshot {
  memberId: string;
  name: string;
  accountUsername?: string;
  status?: 'pending' | 'completed';
  actedAt?: string;
  comment?: string;
}

export interface WorkflowInstanceStep {
  stepId: string;
  name: string;
  order: number;
  approvers: WorkflowApproverSnapshot[];
  approvalMode?: ApprovalMode;
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
  conditionMode?: 'rules' | 'ai';
  aiBranchRule?: AiBranchRule;
  rule?: ApproverRule;
  approvalMode?: ApprovalMode;
  emptyApproverAction?: 'auto_pass' | 'block_submit';
  ccRule?: CcRule;
  conditions?: Array<{
    id: string;
    title: string;
    expression: string;
    priority: number;
    isDefault?: boolean;
    aiDescription?: string;
    workflowConditions?: WorkflowCondition[];
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
  processorRule?: ProcessorRule;
  formFields?: WorkflowFormField[];
  flowMode?: 'flexible';
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
  accountName?: string;
  linkedMember?: {
    id: string;
    name: string;
    departmentName: string;
    title: string;
  };
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
  name?: string;
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
  amountFields?: string[];
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

export interface AiBranchDecisionLog {
  id: string;
  recordId?: string;
  moduleName?: string;
  approvalTypeName?: string;
  workflowId?: string;
  workflowName?: string;
  workflowVersion?: number;
  nodeId?: string;
  nodeTitle?: string;
  prompt?: string;
  applicant?: string;
  selectedBranchId?: string;
  selectedBranchTitle?: string;
  fallbackBranchId?: string;
  fallbackBranchTitle?: string;
  reason?: string;
  confidence?: number;
  status: 'success' | 'fallback' | 'failed' | 'skipped';
  error?: string;
  rawText?: string;
  branches?: Array<{ id: string; title: string; description?: string; isDefault?: boolean }>;
  businessData?: Record<string, any>;
  createdAt: string;
  durationMs?: number;
}

export interface ApprovalRecord {
  id: string;
  moduleName: string;
  approvalTypeName: string;
  businessData: Record<string, any>;
  status: ApprovalStatus;
  applicant: string;
  workflowInstance?: WorkflowInstance;
  ccRecipients?: WorkflowCcRecipientSnapshot[];
  processors?: WorkflowProcessorSnapshot[];
  processorTaskName?: string;
  currentUserCanApprove?: boolean;
  currentUserHasApproved?: boolean;
  currentUserCanProcess?: boolean;
  currentUserHasProcessed?: boolean;
  currentUserIsCc?: boolean;
  aiSuggestion?: AiSuggestion;
  createdAt: string;
  updatedAt: string;
  approver?: string;
  approvedAt?: string;
  rejectedAt?: string;
  processedBy?: string;
  processedByAccountUsername?: string;
  processedAt?: string;
  processComment?: string;
  rejectReason?: string;
  logs: ApprovalLog[];
}
