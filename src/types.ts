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

export interface ApprovalRecord {
  id: string;
  moduleName: string;
  approvalTypeName: string;
  businessData: Record<string, any>;
  status: ApprovalStatus;
  applicant: string;
  aiSuggestion?: AiSuggestion;
  createdAt: string;
  updatedAt: string;
  approver?: string;
  approvedAt?: string;
  rejectedAt?: string;
  rejectReason?: string;
  logs: ApprovalLog[];
}
