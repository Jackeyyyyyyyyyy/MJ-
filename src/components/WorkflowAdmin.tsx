import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Building2,
  CheckCircle2,
  Copy,
  GitBranch,
  Plus,
  Save,
  Send,
  Trash2,
  UserRound,
  Users,
  Workflow,
  XCircle,
} from 'lucide-react';
import { storage } from '../storage';
import { approvalSchema } from '../approvalSchema';
import {
  ApprovalMode,
  ApprovalStep,
  ApproverRule,
  CcRule,
  OrganizationDirectory,
  SubmitPermissionRule,
  WorkflowBranch,
  WorkflowBusinessType,
  WorkflowCondition,
  WorkflowConditionField,
  WorkflowConditionOperator,
  WorkflowNode,
  WorkflowTemplate,
  WorkflowVersion,
} from '../types';
import { cn } from '../lib/utils';

const DEFAULT_ORG_ID = 'default-org';
const BUSINESS_SCOPE_SEPARATOR = '|||';
const FORM_FIELD_PREFIX = 'form:';
const SUBMITTER_FIELD_PREFIX = 'submitter:';

interface BusinessScopeOption {
  key: string;
  moduleName: string;
  approvalTypeName: string;
  label: string;
  businessType: WorkflowBusinessType;
  fields: string[];
}

type ConditionFieldKind = 'number' | 'text' | 'member' | 'department' | 'role';

interface ConditionFieldOption {
  value: WorkflowConditionField;
  label: string;
  kind: ConditionFieldKind;
}

const businessTypeOptions: Array<{
  value: WorkflowBusinessType;
  label: string;
  moduleName: string;
  approvalTypeName: string;
}> = [
  { value: 'reimbursement', label: '报销审批', moduleName: '审批流配置', approvalTypeName: 'reimbursement' },
  { value: 'purchase', label: '采购审批', moduleName: '审批流配置', approvalTypeName: 'purchase' },
  { value: 'leave', label: '请假审批', moduleName: '审批流配置', approvalTypeName: 'leave' },
  { value: 'general', label: '通用审批', moduleName: '审批流配置', approvalTypeName: 'general' },
];

const conditionOperatorOptions: Array<{ value: WorkflowConditionOperator; label: string }> = [
  { value: 'lte', label: '<= 小于等于' },
  { value: 'gt', label: '> 大于' },
  { value: 'between', label: '区间' },
  { value: 'eq', label: '= 等于' },
];

const businessScopeOptions: BusinessScopeOption[] = approvalSchema.modules.flatMap((module) => (
  module.approvalTypes.map((approvalType) => {
    const fields = approvalType.businessFields;
    return {
      key: `${module.name}${BUSINESS_SCOPE_SEPARATOR}${approvalType.name}`,
      moduleName: module.name,
      approvalTypeName: approvalType.name,
      label: `${module.name} / ${approvalType.name}`,
      businessType: inferBusinessTypeFromNames(module.name, approvalType.name),
      fields: [...new Set(fields.filter(Boolean))],
    };
  })
));

const statusLabels: Record<WorkflowTemplate['status'], string> = {
  draft: '草稿',
  published: '已发布',
  disabled: '已停用',
};

const statusClasses: Record<WorkflowTemplate['status'], string> = {
  draft: 'bg-lightest-gray-background text-medium-gray',
  published: 'bg-[#e8f5e9] text-[#2e7d32]',
  disabled: 'bg-[#ffebee] text-[#c62828]',
};

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function readSelectedValues(event: React.ChangeEvent<HTMLSelectElement>) {
  return Array.from(event.currentTarget.selectedOptions, (option) => (option as HTMLOptionElement).value);
}

function inferBusinessTypeFromNames(moduleName: string, approvalTypeName: string): WorkflowBusinessType {
  const text = `${moduleName}${approvalTypeName}`;
  if (text.includes('请假')) return 'leave';
  if (text.includes('报销')) return 'reimbursement';
  if (/[采购付预款费资金备用金成本收入利润价格]/.test(text)) return 'purchase';
  return 'general';
}

function getBusinessScopeKey(moduleName?: string, approvalTypeName?: string) {
  return `${moduleName || ''}${BUSINESS_SCOPE_SEPARATOR}${approvalTypeName || ''}`;
}

function getBusinessScopeByKey(key: string) {
  return businessScopeOptions.find((option) => option.key === key) || businessScopeOptions[0];
}

function getBusinessScopeByNames(moduleName?: string, approvalTypeName?: string) {
  return businessScopeOptions.find((option) => (
    option.moduleName === moduleName && option.approvalTypeName === approvalTypeName
  )) || null;
}

function getWorkflowScopeLabel(moduleName?: string, approvalTypeName?: string) {
  if (moduleName && approvalTypeName) return `${moduleName} / ${approvalTypeName}`;
  return moduleName || approvalTypeName || '未设置业务';
}

function getTemplateScopeLabel(template: WorkflowTemplate) {
  return getWorkflowScopeLabel(
    template.moduleName || template.draft?.basic?.moduleName,
    template.approvalTypeName || template.draft?.basic?.approvalTypeName,
  );
}

function getBusinessTypeMeta(type?: string) {
  return businessTypeOptions.find((item) => item.value === type) || businessTypeOptions[businessTypeOptions.length - 1];
}

function isNumericConditionFieldValue(field: string) {
  const label = field.startsWith(FORM_FIELD_PREFIX) ? field.slice(FORM_FIELD_PREFIX.length) : field;
  return field === 'amount' || /金额|价格|费用|利润|汇率|数量|总额|时长|天数|小时/.test(label);
}

function getConditionFieldLabel(field: string) {
  if (field === 'amount') return '金额';
  if (field === 'submitter.member') return '提交人';
  if (field === 'submitter.department') return '提交人部门';
  if (field === 'submitter.role') return '提交人角色组';
  if (field.startsWith(FORM_FIELD_PREFIX)) return field.slice(FORM_FIELD_PREFIX.length);
  if (field.startsWith(SUBMITTER_FIELD_PREFIX)) return field.slice(SUBMITTER_FIELD_PREFIX.length);
  return field;
}

function getConditionFieldKind(field: string): ConditionFieldKind {
  if (field === 'submitter.member') return 'member';
  if (field === 'submitter.department') return 'department';
  if (field === 'submitter.role') return 'role';
  return isNumericConditionFieldValue(field) ? 'number' : 'text';
}

function getConditionFieldOptions(draft: WorkflowVersion | null): ConditionFieldOption[] {
  const scope = draft ? getBusinessScopeByNames(draft.basic.moduleName, draft.basic.approvalTypeName) : null;
  const formFieldOptions = (scope?.fields || []).map((field) => ({
    value: `${FORM_FIELD_PREFIX}${field}`,
    label: `表单 / ${field}`,
    kind: isNumericConditionFieldValue(field) ? 'number' as const : 'text' as const,
  }));

  return [
    { value: 'submitter.member', label: '提交人 / 本人', kind: 'member' },
    { value: 'submitter.department', label: '提交人 / 部门', kind: 'department' },
    { value: 'submitter.role', label: '提交人 / 角色组', kind: 'role' },
    ...formFieldOptions,
  ];
}

function defaultSubmitPermission(): SubmitPermissionRule {
  return {
    type: 'all_members',
    memberIds: [],
    departmentIds: [],
    excludedMemberIds: [],
  };
}

function defaultCcRule(): CcRule {
  return {
    timing: 'workflow_completed',
    memberIds: [],
    departmentIds: [],
    roleGroupIds: [],
  };
}

function defaultCondition(field: WorkflowConditionField = 'submitter.department'): WorkflowCondition {
  if (!isNumericConditionFieldValue(field)) {
    return {
      id: createId('cond'),
      field,
      operator: 'eq',
      value: '',
    };
  }

  return {
    id: createId('cond'),
    field,
    operator: 'lte',
    amountMax: 1000,
  };
}

function defaultStep(index: number): ApprovalStep {
  return {
    id: createId('step'),
    name: `审批节点 ${index}`,
    approverRule: {
      type: 'specific_members',
      memberIds: [],
    },
    approvalMode: 'one_of',
    emptyApproverAction: 'block_submit',
  };
}

function defaultBranch(): WorkflowBranch {
  return {
    id: 'branch-default',
    name: 'Default Branch',
    isDefault: true,
    conditions: [],
    approvalSteps: [defaultStep(1)],
  };
}

function createDraft(name: string, scope: BusinessScopeOption): WorkflowVersion {
  return prepareDraftForSave({
    id: createId('draft'),
    version: 1,
    status: 'draft',
    organizationId: DEFAULT_ORG_ID,
    businessType: scope.businessType,
    basic: {
      name,
      moduleName: scope.moduleName,
      approvalTypeName: scope.approvalTypeName,
      visibleRange: 'all',
    },
    submitPermission: defaultSubmitPermission(),
    branches: [defaultBranch()],
    ccRule: defaultCcRule(),
    formFields: [],
    nodes: [],
  });
}

function parseLegacyCondition(expression?: string): WorkflowCondition {
  const text = String(expression || '').trim();
  const numbers = (text.match(/\d+(?:\.\d+)?/g) || []).map(Number);

  if (numbers.length >= 2) {
    return {
      id: createId('cond'),
      field: 'amount',
      operator: 'between',
      amountMin: Math.min(numbers[0], numbers[1]),
      amountMax: Math.max(numbers[0], numbers[1]),
      expression: text,
    };
  }

  if (numbers.length === 1) {
    const isGreaterThan = text.includes('>');
    return {
      id: createId('cond'),
      field: 'amount',
      operator: isGreaterThan ? 'gt' : 'lte',
      ...(isGreaterThan ? { amountMin: numbers[0] } : { amountMax: numbers[0] }),
      expression: text,
    };
  }

  return defaultCondition();
}

function legacyNodeToStep(node: WorkflowNode, index: number): ApprovalStep {
  const legacyRule = node.rule || { type: 'specified', memberIds: [] };
  let approverRule: ApproverRule = { type: 'specific_members', memberIds: [] };

  if (legacyRule.type === 'specified') {
    approverRule = { type: 'specific_members', memberIds: legacyRule.memberIds || [] };
  } else if (legacyRule.type === 'role') {
    approverRule = { type: 'role_based', roleGroupId: legacyRule.roleGroupId || '' };
  } else if (legacyRule.type === 'direct_supervisor' || legacyRule.type === 'nth_supervisor' || legacyRule.type === 'multi_supervisor') {
    approverRule = { type: 'submitter_manager' };
  }

  return {
    id: node.id || createId('step'),
    name: node.title || `审批节点 ${index + 1}`,
    approverRule,
    approvalMode: 'one_of',
    emptyApproverAction: legacyRule.emptyApproverAction === 'auto_pass' ? 'auto_pass' : 'block_submit',
  };
}

function stepToLegacyNode(step: ApprovalStep, index: number): WorkflowNode {
  const rule = step.approverRule || { type: 'specific_members', memberIds: [] };
  let legacyRule: ApproverRule = {
    type: 'specified',
    memberIds: [],
    emptyApproverAction: step.emptyApproverAction,
  };

  if (rule.type === 'specific_members') {
    legacyRule = {
      type: 'specified',
      memberIds: rule.memberIds || [],
      emptyApproverAction: step.emptyApproverAction,
    };
  } else if (rule.type === 'role_based') {
    legacyRule = {
      type: 'role',
      roleGroupId: rule.roleGroupId || '',
      emptyApproverAction: step.emptyApproverAction,
    };
  } else if (rule.type === 'department_manager' || rule.type === 'submitter_manager') {
    legacyRule = {
      type: 'direct_supervisor',
      emptyApproverAction: step.emptyApproverAction,
    };
  }

  return {
    id: step.id || createId('node'),
    type: 'approver',
    title: step.name || `审批节点 ${index + 1}`,
    subtitle: step.approvalMode === 'all_of' ? '所有审批人都需通过' : '任一审批人通过即可',
    rule: legacyRule,
  };
}

function normalizeStep(step: Partial<ApprovalStep> | undefined, index: number): ApprovalStep {
  const rule = step?.approverRule || { type: 'specific_members', memberIds: [] };
  const type = ['specific_members', 'department_manager', 'submitter_manager', 'role_based'].includes(String(rule.type))
    ? rule.type
    : 'specific_members';

  return {
    id: step?.id || createId('step'),
    name: step?.name || `审批节点 ${index + 1}`,
    approverRule: {
      ...rule,
      type,
      memberIds: Array.isArray(rule.memberIds) ? rule.memberIds : [],
      departmentIds: Array.isArray(rule.departmentIds) ? rule.departmentIds : [],
      roleGroupIds: Array.isArray(rule.roleGroupIds) ? rule.roleGroupIds : [],
    },
    approvalMode: step?.approvalMode === 'all_of' ? 'all_of' : 'one_of',
    emptyApproverAction: step?.emptyApproverAction === 'auto_pass' ? 'auto_pass' : 'block_submit',
  };
}

function normalizeCondition(condition: Partial<WorkflowCondition> | undefined): WorkflowCondition {
  const field = String(condition?.field || 'submitter.department') as WorkflowConditionField;
  const operator = ['lte', 'gt', 'between', 'eq'].includes(String(condition?.operator))
    ? condition?.operator as WorkflowConditionOperator
    : isNumericConditionFieldValue(field) ? 'lte' : 'eq';

  return {
    id: condition?.id || createId('cond'),
    field,
    operator,
    value: condition?.value,
    amountMin: Number.isFinite(Number(condition?.amountMin)) ? Number(condition?.amountMin) : undefined,
    amountMax: Number.isFinite(Number(condition?.amountMax)) ? Number(condition?.amountMax) : undefined,
    expression: condition?.expression,
  };
}

function getAllowedConditionFields(scope: BusinessScopeOption) {
  return new Set<WorkflowConditionField>([
    'submitter.member',
    'submitter.department',
    'submitter.role',
    ...scope.fields.map((field) => `${FORM_FIELD_PREFIX}${field}`),
  ]);
}

function getFallbackConditionField(scope: BusinessScopeOption): WorkflowConditionField {
  const firstNumericField = scope.fields.find((field) => isNumericConditionFieldValue(field));
  return firstNumericField ? `${FORM_FIELD_PREFIX}${firstNumericField}` : 'submitter.department';
}

function rebaseConditionToScope(condition: WorkflowCondition, scope: BusinessScopeOption): WorkflowCondition {
  const allowedFields = getAllowedConditionFields(scope);
  if (allowedFields.has(condition.field)) return normalizeCondition(condition);

  const nextField = condition.field === 'department'
    ? 'submitter.department'
    : getFallbackConditionField(scope);

  return {
    ...defaultCondition(nextField),
    id: condition.id,
  };
}

function branchesFromLegacyNodes(nodes: WorkflowNode[] | undefined): WorkflowBranch[] {
  const safeNodes = Array.isArray(nodes) ? nodes : [];
  const branches: WorkflowBranch[] = [];

  safeNodes
    .filter((node) => node.type === 'condition')
    .flatMap((node) => node.conditions || [])
    .forEach((condition, index) => {
      branches.push({
        id: condition.id || createId('branch'),
        name: condition.title || `Branch ${index + 1}`,
        isDefault: false,
        conditions: [parseLegacyCondition(condition.expression)],
        approvalSteps: (condition.nodes || [])
          .filter((node) => node.type === 'approver')
          .map((node, stepIndex) => legacyNodeToStep(node, stepIndex)),
      });
    });

  const linearSteps = safeNodes
    .filter((node) => node.type === 'approver')
    .map((node, index) => legacyNodeToStep(node, index));

  branches.push({
    id: 'branch-default',
    name: 'Default Branch',
    isDefault: true,
    conditions: [],
    approvalSteps: linearSteps.length > 0 ? linearSteps : [defaultStep(1)],
  });

  return branches;
}

function normalizeBranches(draft: WorkflowVersion): WorkflowBranch[] {
  if (Array.isArray(draft.branches) && draft.branches.length > 0) {
    const branches = draft.branches.map((branch, index) => ({
      id: branch.id || createId('branch'),
      name: branch.name || (branch.isDefault ? 'Default Branch' : `Branch ${index + 1}`),
      isDefault: Boolean(branch.isDefault),
      conditions: Array.isArray(branch.conditions) ? branch.conditions.map(normalizeCondition) : [],
      approvalSteps: Array.isArray(branch.approvalSteps)
        ? branch.approvalSteps.map((step, stepIndex) => normalizeStep(step, stepIndex))
        : [],
    }));

    if (!branches.some((branch) => branch.isDefault)) {
      branches.push(defaultBranch());
    }

    return branches;
  }

  return branchesFromLegacyNodes(draft.nodes);
}

function normalizeDraftForEditor(draft: WorkflowVersion): WorkflowVersion {
  const scope = getBusinessScopeByNames(draft.basic?.moduleName, draft.basic?.approvalTypeName);
  const fallbackScope = scope
    || businessScopeOptions.find((option) => option.businessType === draft.businessType)
    || businessScopeOptions[0];
  const businessType = fallbackScope?.businessType || getBusinessTypeMeta(draft.businessType).value;
  const branches = normalizeBranches(draft).map((branch) => (
    branch.isDefault ? branch : {
      ...branch,
      conditions: branch.conditions.map((condition) => rebaseConditionToScope(condition, fallbackScope)),
    }
  ));

  return {
    ...draft,
    organizationId: draft.organizationId || DEFAULT_ORG_ID,
    businessType,
    basic: {
      name: draft.basic?.name || '新审批流',
      moduleName: scope?.moduleName || fallbackScope?.moduleName || '审批流配置',
      approvalTypeName: scope?.approvalTypeName || fallbackScope?.approvalTypeName || '通用审批',
      visibleRange: draft.basic?.visibleRange || 'all',
    },
    submitPermission: {
      ...defaultSubmitPermission(),
      ...(draft.submitPermission || {}),
      memberIds: draft.submitPermission?.memberIds || [],
      departmentIds: draft.submitPermission?.departmentIds || [],
      excludedMemberIds: draft.submitPermission?.excludedMemberIds || [],
    },
    branches,
    ccRule: {
      ...defaultCcRule(),
      ...(draft.ccRule || {}),
      memberIds: draft.ccRule?.memberIds || [],
      departmentIds: draft.ccRule?.departmentIds || [],
      roleGroupIds: draft.ccRule?.roleGroupIds || [],
      timing: 'workflow_completed',
    },
    nodes: Array.isArray(draft.nodes) ? draft.nodes : [],
  };
}

function prepareDraftForSave(draft: WorkflowVersion): WorkflowVersion {
  const nextDraft = normalizeDraftForEditor(draft);
  const defaultWorkflowBranch = nextDraft.branches?.find((branch) => branch.isDefault);
  const legacyNodes: WorkflowNode[] = [
    { id: 'node-start', type: 'start', title: '发起人', subtitle: 'Applicant' },
    ...((defaultWorkflowBranch?.approvalSteps || []).map(stepToLegacyNode)),
  ];

  return {
    ...nextDraft,
    nodes: legacyNodes,
  };
}

interface ValidationState {
  errors: string[];
  sections: Record<string, string[]>;
  branches: Record<string, string[]>;
  steps: Record<string, string[]>;
}

function createValidationState(): ValidationState {
  return { errors: [], sections: {}, branches: {}, steps: {} };
}

function addValidationError(
  state: ValidationState,
  section: string,
  message: string,
  branchId?: string,
  stepId?: string,
) {
  state.errors.push(message);
  state.sections[section] = [...(state.sections[section] || []), message];
  if (branchId) state.branches[branchId] = [...(state.branches[branchId] || []), message];
  if (stepId) state.steps[stepId] = [...(state.steps[stepId] || []), message];
}

function validateDraft(draft: WorkflowVersion | null): ValidationState {
  const state = createValidationState();
  if (!draft) return state;

  if (!draft.basic.name.trim()) {
    addValidationError(state, 'basic', '审批流名称不能为空');
  }

  const submitPermission = draft.submitPermission || defaultSubmitPermission();
  const hasSubmitScope = submitPermission.type === 'all_members'
    || (submitPermission.type === 'members' && submitPermission.memberIds.length > 0)
    || (submitPermission.type === 'departments' && submitPermission.departmentIds.length > 0);
  if (!hasSubmitScope) {
    addValidationError(state, 'submit', '至少配置一个提交权限范围');
  }

  const branches = draft.branches || [];
  if (!branches.some((branch) => branch.isDefault)) {
    addValidationError(state, 'branches', '必须包含 default branch');
  }

  branches.forEach((branch, branchIndex) => {
    const branchLabel = branch.name || `Branch ${branchIndex + 1}`;
    if (branch.approvalSteps.length === 0) {
      addValidationError(state, 'branches', `${branchLabel} 至少需要一个审批节点`, branch.id);
    }

    if (!branch.isDefault) {
      if (branch.conditions.length === 0) {
        addValidationError(state, 'branches', `${branchLabel} 必须配置条件`, branch.id);
      }

      branch.conditions.forEach((condition) => {
        if (!condition.field || !condition.operator) {
          addValidationError(state, 'branches', `${branchLabel} 条件不完整`, branch.id);
          return;
        }

        if (isNumericConditionFieldValue(condition.field)) {
          if (condition.operator === 'between') {
            if (!Number.isFinite(Number(condition.amountMin)) || !Number.isFinite(Number(condition.amountMax))) {
              addValidationError(state, 'branches', `${branchLabel} 数值区间必须填写有效数字`, branch.id);
            }
          } else if (condition.operator === 'lte' && !Number.isFinite(Number(condition.amountMax))) {
            addValidationError(state, 'branches', `${branchLabel} 数值上限必须填写有效数字`, branch.id);
          } else if (condition.operator === 'gt' && !Number.isFinite(Number(condition.amountMin))) {
            addValidationError(state, 'branches', `${branchLabel} 数值下限必须填写有效数字`, branch.id);
          } else if (condition.operator === 'eq' && !condition.value?.trim()) {
            addValidationError(state, 'branches', `${branchLabel} 条件值不能为空`, branch.id);
          }
        } else if (!condition.value?.trim()) {
          addValidationError(state, 'branches', `${branchLabel} 条件值不能为空`, branch.id);
        }
      });
    }

    branch.approvalSteps.forEach((step, stepIndex) => {
      const stepLabel = `${branchLabel} / Step ${stepIndex + 1}`;
      const rule = step.approverRule;
      if (!rule?.type) {
        addValidationError(state, 'branches', `${stepLabel} 必须配置审批人规则`, branch.id, step.id);
      } else if (rule.type === 'specific_members' && (!rule.memberIds || rule.memberIds.length === 0)) {
        addValidationError(state, 'branches', `${stepLabel} 必须选择指定成员`, branch.id, step.id);
      } else if (rule.type === 'role_based' && !rule.roleGroupId) {
        addValidationError(state, 'branches', `${stepLabel} 必须选择角色组`, branch.id, step.id);
      }
    });
  });

  return state;
}

function formatDate(value?: string) {
  if (!value) return '未保存';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '未保存';
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCondition(condition: WorkflowCondition) {
  const fieldLabel = getConditionFieldLabel(condition.field);
  if (isNumericConditionFieldValue(condition.field)) {
    if (condition.operator === 'between') return `${fieldLabel} > ${condition.amountMin ?? '?'} 且 <= ${condition.amountMax ?? '?'}`;
    if (condition.operator === 'gt') return `${fieldLabel} > ${condition.amountMin ?? '?'}`;
    if (condition.operator === 'lte') return `${fieldLabel} <= ${condition.amountMax ?? '?'}`;
    return `${fieldLabel} = ${condition.value || '?'}`;
  }

  const operator = conditionOperatorOptions.find((item) => item.value === condition.operator)?.label.split(' ')[0] || '=';
  return `${fieldLabel} ${operator} ${condition.value || '?'}`;
}

function formatStepRule(step: ApprovalStep, directory: OrganizationDirectory) {
  const rule = step.approverRule;
  if (rule.type === 'department_manager') return '部门主管';
  if (rule.type === 'submitter_manager') return '发起人的上级';
  if (rule.type === 'role_based') {
    return directory.roleGroups.find((role) => role.id === rule.roleGroupId)?.name || '指定角色';
  }
  return (rule.memberIds || [])
    .map((memberId) => directory.members.find((member) => member.id === memberId)?.name)
    .filter(Boolean)
    .join('、') || '指定成员';
}

function formatSubmitPermission(permission: SubmitPermissionRule, directory: OrganizationDirectory) {
  let scope = '全部成员';
  if (permission.type === 'members') {
    scope = permission.memberIds
      .map((memberId) => directory.members.find((member) => member.id === memberId)?.name)
      .filter(Boolean)
      .join('、') || '未选择成员';
  } else if (permission.type === 'departments') {
    scope = permission.departmentIds
      .map((departmentId) => directory.departments.find((department) => department.id === departmentId)?.name)
      .filter(Boolean)
      .join('、') || '未选择部门';
  }

  if (permission.excludedMemberIds.length === 0) return scope;

  const excluded = permission.excludedMemberIds
    .map((memberId) => directory.members.find((member) => member.id === memberId)?.name)
    .filter(Boolean)
    .join('、');
  return excluded ? `${scope}；排除 ${excluded}` : scope;
}

function getBranchTitle(branch: WorkflowBranch) {
  return branch.isDefault ? 'Default Branch' : branch.name;
}

type DesignerSelection =
  | { type: 'submit' }
  | { type: 'branch'; branchId: string }
  | { type: 'step'; branchId: string; stepId: string }
  | { type: 'cc' };

const submitDesignerSelection: DesignerSelection = { type: 'submit' };

function isDesignerSelected(
  selection: DesignerSelection,
  type: DesignerSelection['type'],
  branchId?: string,
  stepId?: string,
) {
  if (selection.type !== type) return false;
  if ((selection.type === 'branch' || selection.type === 'step') && selection.branchId !== branchId) return false;
  if (selection.type === 'step' && selection.stepId !== stepId) return false;
  return true;
}

function getApproverTypeLabel(type: ApproverRule['type']) {
  if (type === 'department_manager') return '部门主管';
  if (type === 'submitter_manager') return '发起人的上级';
  if (type === 'role_based') return '指定角色';
  return '指定成员';
}

function getApprovalModeLabel(mode: ApprovalMode) {
  return mode === 'all_of' ? '会签：所有人通过' : '或签：任一人通过';
}

function getEmptyApproverActionLabel(action: ApprovalStep['emptyApproverAction']) {
  return action === 'auto_pass' ? '找不到审批人时自动跳过' : '找不到审批人时报错';
}

function FlowConnector({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn("flex flex-col items-center", compact ? "h-8" : "h-12")}>
      <span className="h-full w-px bg-border-silver" />
    </div>
  );
}

function FlowAddButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative z-10 h-8 px-3 rounded-full bg-white border border-border-silver text-[12px] font-black text-interactive-blue shadow-sm flex items-center gap-1.5 hover:border-interactive-blue hover:bg-[#f5fbff]"
    >
      <Plus size={13} strokeWidth={3} />
      {label}
    </button>
  );
}

function FlowNode({
  tone,
  kicker,
  title,
  subtitle,
  meta,
  icon,
  selected,
  hasError,
  onClick,
  children,
}: {
  tone: 'submit' | 'approval' | 'condition' | 'cc' | 'end';
  kicker: string;
  title: string;
  subtitle: string;
  meta?: string;
  icon: React.ReactNode;
  selected?: boolean;
  hasError?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
}) {
  const toneClass = {
    submit: 'border-[#7d89b0] bg-white',
    approval: 'border-[#c9791b] bg-[#fffaf3]',
    condition: 'border-[#79a87b] bg-[#fbfff7]',
    cc: 'border-[#6697d4] bg-[#f7fbff]',
    end: 'border-border-silver bg-white',
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-lg border-2 p-0 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-sky-blue-highlight",
        toneClass,
        selected && "ring-2 ring-interactive-blue ring-offset-2",
        hasError && "border-[#c62828] bg-[#fffafa]"
      )}
    >
      <div className={cn(
        "h-8 rounded-t-[6px] px-3 flex items-center justify-between text-[11px] font-black",
        tone === 'approval' && "bg-[#c9791b] text-white",
        tone === 'submit' && "bg-[#7d89b0] text-white",
        tone === 'condition' && "bg-[#edf7ed] text-[#2e7d32]",
        tone === 'cc' && "bg-[#e7f1ff] text-[#2267ad]",
        tone === 'end' && "bg-lightest-gray-background text-medium-gray"
      )}>
        <span>{kicker}</span>
        {hasError && <AlertCircle size={14} />}
      </div>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <span className={cn(
            "mt-0.5 h-9 w-9 rounded-full flex shrink-0 items-center justify-center",
            tone === 'approval' && "bg-[#fff1df] text-[#a85e0c]",
            tone === 'submit' && "bg-lightest-gray-background text-midnight-graphite",
            tone === 'condition' && "bg-[#edf7ed] text-[#2e7d32]",
            tone === 'cc' && "bg-[#e7f1ff] text-[#2267ad]",
            tone === 'end' && "bg-lightest-gray-background text-medium-gray"
          )}>
            {icon}
          </span>
          <span className="min-w-0">
            <span className="block text-[15px] font-black text-midnight-graphite truncate">{title}</span>
            <span className="mt-1 block text-[12px] font-bold text-medium-gray leading-5">{subtitle}</span>
            {meta && <span className="mt-2 block text-[11px] font-black text-light-gray">{meta}</span>}
          </span>
        </div>
        {children}
      </div>
    </button>
  );
}

function WorkflowFlowDesigner({
  draft,
  directory,
  submitPermission,
  ccRule,
  branches,
  validation,
  selection,
  fieldOptions,
  memberOptions,
  departmentOptions,
  roleOptions,
  onSelect,
  onAddBranch,
  onRemoveBranch,
  onUpdateBranch,
  onAddCondition,
  onRemoveCondition,
  onUpdateCondition,
  onPatchSubmitPermission,
  onPatchCcRule,
  onAddStep,
  onUpdateStep,
  onRemoveStep,
  onMoveStep,
}: {
  draft: WorkflowVersion;
  directory: OrganizationDirectory;
  submitPermission: SubmitPermissionRule;
  ccRule: CcRule;
  branches: WorkflowBranch[];
  validation: ValidationState;
  selection: DesignerSelection;
  fieldOptions: ConditionFieldOption[];
  memberOptions: Array<{ value: string; label: string }>;
  departmentOptions: Array<{ value: string; label: string }>;
  roleOptions: Array<{ value: string; label: string }>;
  onSelect: (selection: DesignerSelection) => void;
  onAddBranch: () => void;
  onRemoveBranch: (branchId: string) => void;
  onUpdateBranch: (branchId: string, patch: Partial<WorkflowBranch>) => void;
  onAddCondition: (branchId: string) => void;
  onRemoveCondition: (branchId: string, conditionId: string) => void;
  onUpdateCondition: (branchId: string, conditionId: string, patch: Partial<WorkflowCondition>) => void;
  onPatchSubmitPermission: (patch: Partial<SubmitPermissionRule>) => void;
  onPatchCcRule: (patch: Partial<CcRule>) => void;
  onAddStep: (branchId: string) => void;
  onUpdateStep: (branchId: string, stepId: string, patch: Partial<ApprovalStep>) => void;
  onRemoveStep: (branchId: string, stepId: string) => void;
  onMoveStep: (branchId: string, stepId: string, direction: -1 | 1) => void;
}) {
  const defaultBranch = branches.find((branch) => branch.isDefault) || branches[branches.length - 1];
  const conditionalBranches = branches.filter((branch) => !branch.isDefault);
  const flowBranches = conditionalBranches.length > 0
    ? [...conditionalBranches, ...(defaultBranch ? [defaultBranch] : [])]
    : defaultBranch ? [defaultBranch] : [];
  const selectedBranch = selection.type === 'branch' || selection.type === 'step'
    ? branches.find((branch) => branch.id === selection.branchId) || null
    : null;
  const selectedStep = selection.type === 'step'
    ? selectedBranch?.approvalSteps.find((step) => step.id === selection.stepId) || null
    : null;
  const activeSelection: DesignerSelection = (
    (selection.type === 'branch' && selectedBranch)
    || (selection.type === 'step' && selectedStep)
    || selection.type === 'cc'
  ) ? selection : submitDesignerSelection;
  const canvasViewportRef = React.useRef<HTMLDivElement | null>(null);
  const panStartRef = React.useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const [isPanning, setIsPanning] = React.useState(false);
  const canvasMinWidth = Math.max(1040, flowBranches.length * 340);

  const handleCanvasPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;

    const target = event.target as HTMLElement;
    if (target.closest('button, input, select, textarea, a, [role="button"]')) return;

    const viewport = canvasViewportRef.current;
    if (!viewport) return;

    panStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      left: viewport.scrollLeft,
      top: viewport.scrollTop,
    };
    setIsPanning(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const handleCanvasPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const panStart = panStartRef.current;
    const viewport = canvasViewportRef.current;
    if (!panStart || !viewport) return;

    viewport.scrollLeft = panStart.left - (event.clientX - panStart.x);
    viewport.scrollTop = panStart.top - (event.clientY - panStart.y);
  };

  const stopCanvasPan = (event: React.PointerEvent<HTMLDivElement>) => {
    panStartRef.current = null;
    setIsPanning(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <section className="rounded-2xl border border-border-silver bg-white shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-border-silver flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-black text-white flex items-center justify-center">
            <GitBranch size={18} strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-[18px] font-black">流程设计</h2>
            <p className="mt-1 text-[12px] font-bold text-medium-gray">按飞书审批的画布方式配置提交人、条件分支、审批节点和抄送。</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onAddBranch}
            className="h-9 px-4 rounded-full bg-lightest-gray-background text-[12px] font-bold flex items-center gap-2 hover:bg-canvas-white"
          >
            <GitBranch size={14} /> 添加条件
          </button>
          {defaultBranch && (
            <button
              type="button"
              onClick={() => onAddStep(defaultBranch.id)}
              className="h-9 px-4 rounded-full bg-black text-white text-[12px] font-bold flex items-center gap-2"
            >
              <Plus size={14} /> 添加审批
            </button>
          )}
        </div>
      </div>

      {validation.sections.branches?.length > 0 && (
        <div className="mx-6 mt-5 rounded-2xl bg-[#ffebee] px-4 py-3 text-[12px] font-bold text-[#c62828]">
          {validation.sections.branches[0]}
        </div>
      )}

      <div className="grid min-h-[860px] lg:grid-cols-[minmax(640px,1fr)_360px]">
        <div
          ref={canvasViewportRef}
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={stopCanvasPan}
          onPointerCancel={stopCanvasPan}
          className={cn(
            "overflow-auto bg-[#f7f8fa] cursor-grab select-none",
            isPanning && "cursor-grabbing"
          )}
        >
          <div
            className="min-h-[860px] px-12 py-10"
            style={{
              minWidth: `${canvasMinWidth}px`,
              backgroundImage: 'radial-gradient(#d9dde5 1px, transparent 1px)',
              backgroundSize: '18px 18px',
            }}
          >
            <div className="mx-auto flex max-w-[1480px] flex-col items-center">
              <div className="w-[340px]">
                <FlowNode
                  tone="submit"
                  kicker="提交"
                  title="提交人"
                  subtitle={`可提交：${formatSubmitPermission(submitPermission, directory)}`}
                  meta={draft.formFields?.length ? `已关联 ${draft.formFields.length} 个表单字段` : '表单字段已由业务表单维护'}
                  icon={<UserRound size={17} strokeWidth={2.5} />}
                  selected={isDesignerSelected(activeSelection, 'submit')}
                  hasError={Boolean(validation.sections.submit?.length)}
                  onClick={() => onSelect({ type: 'submit' })}
                />
              </div>

              <FlowConnector />
              <FlowAddButton label="添加条件" onClick={onAddBranch} />
              <FlowConnector compact />

              <div className="relative w-full">
                {flowBranches.length > 1 && (
                  <div className="absolute left-[12%] right-[12%] top-5 h-px bg-border-silver" />
                )}
                <div
                  className="relative grid gap-5"
                  style={{ gridTemplateColumns: `repeat(${Math.max(flowBranches.length, 1)}, minmax(300px, 1fr))` }}
                >
                  {flowBranches.map((branch, branchIndex) => (
                    <div key={branch.id} className="flex min-w-[300px] flex-col items-center">
                      {flowBranches.length > 1 && <span className="h-5 w-px bg-border-silver" />}
                      <FlowNode
                        tone={branch.isDefault ? 'condition' : 'condition'}
                        kicker={branch.isDefault ? '默认条件' : `条件 ${branchIndex + 1}`}
                        title={getBranchTitle(branch)}
                        subtitle={branch.isDefault ? '其他条件未命中时进入' : branch.conditions.map(formatCondition).join(' 且 ') || '请设置条件'}
                        meta={branch.isDefault ? '优先级最低' : `优先级 ${branchIndex + 1}`}
                        icon={<GitBranch size={17} strokeWidth={2.5} />}
                        selected={isDesignerSelected(activeSelection, 'branch', branch.id)}
                        hasError={Boolean(validation.branches[branch.id]?.length)}
                        onClick={() => onSelect({ type: 'branch', branchId: branch.id })}
                      />

                      <FlowConnector compact />
                      <FlowAddButton label="审批" onClick={() => onAddStep(branch.id)} />
                      <FlowConnector compact />

                      <div className="flex w-full flex-col items-center gap-0">
                        {branch.approvalSteps.length === 0 ? (
                          <div className="w-full rounded-lg border border-dashed border-border-silver bg-white/80 p-5 text-center text-[12px] font-bold text-medium-gray">
                            当前分支暂无审批节点
                          </div>
                        ) : branch.approvalSteps.map((step, stepIndex) => (
                          <React.Fragment key={step.id}>
                            {stepIndex > 0 && <FlowConnector compact />}
                            <FlowNode
                              tone="approval"
                              kicker={`审批 ${stepIndex + 1}`}
                              title={step.name}
                              subtitle={formatStepRule(step, directory)}
                              meta={getApprovalModeLabel(step.approvalMode)}
                              icon={<CheckCircle2 size={17} strokeWidth={2.5} />}
                              selected={isDesignerSelected(activeSelection, 'step', branch.id, step.id)}
                              hasError={Boolean(validation.steps[step.id]?.length)}
                              onClick={() => onSelect({ type: 'step', branchId: branch.id, stepId: step.id })}
                            />
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <FlowConnector />
              <div className="w-[340px]">
                <FlowNode
                  tone="cc"
                  kicker="抄送"
                  title="抄送人"
                  subtitle={[
                    ccRule.memberIds.length ? `${ccRule.memberIds.length} 个成员` : '',
                    ccRule.departmentIds.length ? `${ccRule.departmentIds.length} 个部门` : '',
                    ccRule.roleGroupIds.length ? `${ccRule.roleGroupIds.length} 个角色` : '',
                  ].filter(Boolean).join('、') || '流程结束后抄送，可为空'}
                  icon={<Send size={17} strokeWidth={2.5} />}
                  selected={isDesignerSelected(activeSelection, 'cc')}
                  onClick={() => onSelect({ type: 'cc' })}
                />
              </div>
              <FlowConnector compact />
              <div className="w-[220px]">
                <FlowNode
                  tone="end"
                  kicker="结束"
                  title="流程完成"
                  subtitle="所有审批节点通过后结束"
                  icon={<CheckCircle2 size={17} strokeWidth={2.5} />}
                />
              </div>
            </div>
          </div>
        </div>

        <DesignerInspector
          selection={activeSelection}
          selectedBranch={selectedBranch}
          selectedStep={selectedStep}
          branches={branches}
          submitPermission={submitPermission}
          ccRule={ccRule}
          directory={directory}
          validation={validation}
          memberOptions={memberOptions}
          departmentOptions={departmentOptions}
          roleOptions={roleOptions}
          fieldOptions={fieldOptions}
          onSelect={onSelect}
          onRemoveBranch={onRemoveBranch}
          onUpdateBranch={onUpdateBranch}
          onAddCondition={onAddCondition}
          onRemoveCondition={onRemoveCondition}
          onUpdateCondition={onUpdateCondition}
          onPatchSubmitPermission={onPatchSubmitPermission}
          onPatchCcRule={onPatchCcRule}
          onAddStep={onAddStep}
          onUpdateStep={onUpdateStep}
          onRemoveStep={onRemoveStep}
          onMoveStep={onMoveStep}
        />
      </div>
    </section>
  );
}

function InspectorHeader({
  label,
  title,
  description,
}: {
  label: string;
  title: string;
  description: string;
}) {
  return (
    <div className="border-b border-border-silver px-5 py-5">
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-light-gray">{label}</p>
      <h3 className="mt-2 text-[20px] font-black text-midnight-graphite">{title}</h3>
      <p className="mt-1 text-[12px] font-bold leading-5 text-medium-gray">{description}</p>
    </div>
  );
}

function SegmentedButton({
  isActive,
  onClick,
  children,
}: {
  isActive: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-10 rounded-xl px-3 py-2 text-left text-[12px] font-black transition-all",
        isActive ? "bg-black text-white" : "bg-lightest-gray-background text-midnight-graphite hover:bg-canvas-white"
      )}
    >
      {children}
    </button>
  );
}

function ConditionValueControl({
  condition,
  branchId,
  memberOptions,
  departmentOptions,
  roleOptions,
  onUpdateCondition,
}: {
  condition: WorkflowCondition;
  branchId: string;
  memberOptions: Array<{ value: string; label: string }>;
  departmentOptions: Array<{ value: string; label: string }>;
  roleOptions: Array<{ value: string; label: string }>;
  onUpdateCondition: (branchId: string, conditionId: string, patch: Partial<WorkflowCondition>) => void;
}) {
  const kind = getConditionFieldKind(condition.field);

  if (kind === 'number' && condition.operator === 'between') {
    return (
      <div className="grid grid-cols-2 gap-2">
        <input
          className="input-field text-[13px]"
          type="number"
          value={condition.amountMin ?? ''}
          onChange={(event) => onUpdateCondition(branchId, condition.id, { amountMin: event.target.value === '' ? undefined : Number(event.target.value) })}
          placeholder="下限"
        />
        <input
          className="input-field text-[13px]"
          type="number"
          value={condition.amountMax ?? ''}
          onChange={(event) => onUpdateCondition(branchId, condition.id, { amountMax: event.target.value === '' ? undefined : Number(event.target.value) })}
          placeholder="上限"
        />
      </div>
    );
  }

  if (kind === 'number' && condition.operator === 'gt') {
    return (
      <input
        className="input-field text-[13px]"
        type="number"
        value={condition.amountMin ?? ''}
        onChange={(event) => onUpdateCondition(branchId, condition.id, { amountMin: event.target.value === '' ? undefined : Number(event.target.value) })}
        placeholder="金额下限"
      />
    );
  }

  if (kind === 'number' && condition.operator === 'lte') {
    return (
      <input
        className="input-field text-[13px]"
        type="number"
        value={condition.amountMax ?? ''}
        onChange={(event) => onUpdateCondition(branchId, condition.id, { amountMax: event.target.value === '' ? undefined : Number(event.target.value) })}
        placeholder="金额上限"
      />
    );
  }

  if (kind === 'department' || kind === 'member' || kind === 'role') {
    const options = kind === 'department' ? departmentOptions : kind === 'member' ? memberOptions : roleOptions;
    return (
      <select
        className="input-field text-[13px]"
        value={condition.value || ''}
        onChange={(event) => onUpdateCondition(branchId, condition.id, { value: event.target.value })}
      >
        <option value="">请选择{getConditionFieldLabel(condition.field)}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    );
  }

  return (
    <input
      className="input-field text-[13px]"
      type={kind === 'number' ? 'number' : 'text'}
      value={condition.value || ''}
      onChange={(event) => onUpdateCondition(branchId, condition.id, { value: event.target.value })}
      placeholder={`${getConditionFieldLabel(condition.field)}的值`}
    />
  );
}

function ConditionEditor({
  branch,
  condition,
  index,
  fieldOptions,
  memberOptions,
  departmentOptions,
  roleOptions,
  onRemoveCondition,
  onUpdateCondition,
}: {
  branch: WorkflowBranch;
  condition: WorkflowCondition;
  index: number;
  fieldOptions: ConditionFieldOption[];
  memberOptions: Array<{ value: string; label: string }>;
  departmentOptions: Array<{ value: string; label: string }>;
  roleOptions: Array<{ value: string; label: string }>;
  onRemoveCondition: (branchId: string, conditionId: string) => void;
  onUpdateCondition: (branchId: string, conditionId: string, patch: Partial<WorkflowCondition>) => void;
}) {
  const fieldKind = getConditionFieldKind(condition.field);
  const operatorOptions = fieldKind === 'number'
    ? conditionOperatorOptions
    : conditionOperatorOptions.filter((option) => option.value === 'eq');

  return (
    <div className="rounded-2xl border border-border-silver bg-white p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] font-black text-midnight-graphite">条件 {index + 1}</p>
        {branch.conditions.length > 1 && (
          <button
            type="button"
            onClick={() => onRemoveCondition(branch.id, condition.id)}
            className="h-7 px-2 rounded-full bg-[#ffebee] text-[11px] font-black text-[#c62828]"
          >
            删除
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <select
          className="input-field text-[13px]"
          value={condition.field}
          onChange={(event) => {
            const nextField = event.target.value as WorkflowConditionField;
            onUpdateCondition(branch.id, condition.id, { ...defaultCondition(nextField), id: condition.id });
          }}
        >
          {fieldOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <select
          className="input-field text-[13px]"
          value={condition.operator}
          onChange={(event) => onUpdateCondition(branch.id, condition.id, { operator: event.target.value as WorkflowConditionOperator })}
        >
          {operatorOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
      <ConditionValueControl
        condition={condition}
        branchId={branch.id}
        memberOptions={memberOptions}
        departmentOptions={departmentOptions}
        roleOptions={roleOptions}
        onUpdateCondition={onUpdateCondition}
      />
      <div className="rounded-xl bg-canvas-white px-3 py-2 text-[11px] font-bold text-medium-gray">
        当前规则：{formatCondition(condition)}
      </div>
    </div>
  );
}

function StepEditor({
  branch,
  step,
  stepIndex,
  memberOptions,
  roleOptions,
  validation,
  onSelect,
  onUpdateStep,
  onRemoveStep,
  onMoveStep,
}: {
  branch: WorkflowBranch;
  step: ApprovalStep;
  stepIndex: number;
  memberOptions: Array<{ value: string; label: string }>;
  roleOptions: Array<{ value: string; label: string }>;
  validation: ValidationState;
  onSelect: (selection: DesignerSelection) => void;
  onUpdateStep: (branchId: string, stepId: string, patch: Partial<ApprovalStep>) => void;
  onRemoveStep: (branchId: string, stepId: string) => void;
  onMoveStep: (branchId: string, stepId: string, direction: -1 | 1) => void;
}) {
  return (
    <>
      <InspectorHeader
        label="审批节点"
        title={step.name || `审批 ${stepIndex + 1}`}
        description={`位于 ${getBranchTitle(branch)}，用于配置审批人、会签方式和找不到审批人时的动作。`}
      />
      <div className="space-y-5 p-5">
        {validation.steps[step.id]?.length > 0 && (
          <div className="rounded-2xl bg-[#ffebee] px-4 py-3 text-[12px] font-bold text-[#c62828]">
            {validation.steps[step.id][0]}
          </div>
        )}

        <label className="block space-y-2">
          <span className="text-[12px] font-black uppercase tracking-wider text-light-gray">节点名称</span>
          <input
            className="input-field text-[14px]"
            value={step.name}
            onChange={(event) => onUpdateStep(branch.id, step.id, { name: event.target.value })}
            placeholder="节点名称"
          />
        </label>

        <div className="space-y-2">
          <span className="text-[12px] font-black uppercase tracking-wider text-light-gray">审批人类型</span>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: 'specific_members', label: '指定成员' },
              { value: 'department_manager', label: '部门主管' },
              { value: 'submitter_manager', label: '发起人上级' },
              { value: 'role_based', label: '指定角色' },
            ].map((item) => (
              <React.Fragment key={item.value}>
                <SegmentedButton
                  isActive={step.approverRule.type === item.value}
                  onClick={() => onUpdateStep(branch.id, step.id, {
                    approverRule: {
                      type: item.value as ApproverRule['type'],
                      memberIds: [],
                      departmentIds: [],
                      roleGroupIds: [],
                      roleGroupId: '',
                    },
                  })}
                >
                  {item.label}
                </SegmentedButton>
              </React.Fragment>
            ))}
          </div>
        </div>

        {step.approverRule.type === 'specific_members' && (
          <label className="block space-y-2">
            <span className="text-[12px] font-black uppercase tracking-wider text-light-gray">指定成员</span>
            <MultiSelect
              value={step.approverRule.memberIds || []}
              options={memberOptions}
              onChange={(memberIds) => onUpdateStep(branch.id, step.id, {
                approverRule: { ...step.approverRule, memberIds },
              })}
              emptyText="暂无成员"
            />
          </label>
        )}

        {step.approverRule.type === 'role_based' && (
          <label className="block space-y-2">
            <span className="text-[12px] font-black uppercase tracking-wider text-light-gray">角色组</span>
            <select
              className="input-field text-[13px]"
              value={step.approverRule.roleGroupId || ''}
              onChange={(event) => onUpdateStep(branch.id, step.id, {
                approverRule: { ...step.approverRule, roleGroupId: event.target.value },
              })}
            >
              <option value="">选择角色组</option>
              {roleOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        )}

        <label className="block space-y-2">
          <span className="text-[12px] font-black uppercase tracking-wider text-light-gray">通过方式</span>
          <select
            className="input-field text-[13px]"
            value={step.approvalMode}
            onChange={(event) => onUpdateStep(branch.id, step.id, { approvalMode: event.target.value as ApprovalMode })}
          >
            <option value="one_of">多人任意一人通过</option>
            <option value="all_of">所有人都要通过</option>
          </select>
        </label>

        <label className="block space-y-2">
          <span className="text-[12px] font-black uppercase tracking-wider text-light-gray">找不到审批人</span>
          <select
            className="input-field text-[13px]"
            value={step.emptyApproverAction}
            onChange={(event) => onUpdateStep(branch.id, step.id, {
              emptyApproverAction: event.target.value as ApprovalStep['emptyApproverAction'],
            })}
          >
            <option value="block_submit">找不到审批人时报错</option>
            <option value="auto_pass">找不到审批人时自动跳过</option>
          </select>
        </label>

        <div className="rounded-2xl bg-canvas-white px-4 py-3 text-[12px] font-bold leading-5 text-medium-gray">
          {getApproverTypeLabel(step.approverRule.type)} · {getApprovalModeLabel(step.approvalMode)} · {getEmptyApproverActionLabel(step.emptyApproverAction)}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => onMoveStep(branch.id, step.id, -1)}
            disabled={stepIndex === 0}
            className="h-10 rounded-full bg-lightest-gray-background text-[12px] font-black disabled:opacity-40"
          >
            上移
          </button>
          <button
            type="button"
            onClick={() => onMoveStep(branch.id, step.id, 1)}
            disabled={stepIndex === branch.approvalSteps.length - 1}
            className="h-10 rounded-full bg-lightest-gray-background text-[12px] font-black disabled:opacity-40"
          >
            下移
          </button>
          <button
            type="button"
            onClick={() => {
              onRemoveStep(branch.id, step.id);
              onSelect({ type: 'branch', branchId: branch.id });
            }}
            className="h-10 rounded-full bg-[#ffebee] text-[12px] font-black text-[#c62828]"
          >
            删除
          </button>
        </div>
      </div>
    </>
  );
}

function DesignerInspector({
  selection,
  selectedBranch,
  selectedStep,
  branches,
  submitPermission,
  ccRule,
  directory,
  validation,
  memberOptions,
  departmentOptions,
  roleOptions,
  fieldOptions,
  onSelect,
  onRemoveBranch,
  onUpdateBranch,
  onAddCondition,
  onRemoveCondition,
  onUpdateCondition,
  onPatchSubmitPermission,
  onPatchCcRule,
  onAddStep,
  onUpdateStep,
  onRemoveStep,
  onMoveStep,
}: {
  selection: DesignerSelection;
  selectedBranch: WorkflowBranch | null;
  selectedStep: ApprovalStep | null;
  branches: WorkflowBranch[];
  submitPermission: SubmitPermissionRule;
  ccRule: CcRule;
  directory: OrganizationDirectory;
  validation: ValidationState;
  memberOptions: Array<{ value: string; label: string }>;
  departmentOptions: Array<{ value: string; label: string }>;
  roleOptions: Array<{ value: string; label: string }>;
  fieldOptions: ConditionFieldOption[];
  onSelect: (selection: DesignerSelection) => void;
  onRemoveBranch: (branchId: string) => void;
  onUpdateBranch: (branchId: string, patch: Partial<WorkflowBranch>) => void;
  onAddCondition: (branchId: string) => void;
  onRemoveCondition: (branchId: string, conditionId: string) => void;
  onUpdateCondition: (branchId: string, conditionId: string, patch: Partial<WorkflowCondition>) => void;
  onPatchSubmitPermission: (patch: Partial<SubmitPermissionRule>) => void;
  onPatchCcRule: (patch: Partial<CcRule>) => void;
  onAddStep: (branchId: string) => void;
  onUpdateStep: (branchId: string, stepId: string, patch: Partial<ApprovalStep>) => void;
  onRemoveStep: (branchId: string, stepId: string) => void;
  onMoveStep: (branchId: string, stepId: string, direction: -1 | 1) => void;
}) {
  if (selection.type === 'step' && selectedBranch && selectedStep) {
    return (
      <aside className="border-t border-border-silver bg-white lg:border-l lg:border-t-0">
        <StepEditor
          branch={selectedBranch}
          step={selectedStep}
          stepIndex={selectedBranch.approvalSteps.findIndex((step) => step.id === selectedStep.id)}
          memberOptions={memberOptions}
          roleOptions={roleOptions}
          validation={validation}
          onSelect={onSelect}
          onUpdateStep={onUpdateStep}
          onRemoveStep={onRemoveStep}
          onMoveStep={onMoveStep}
        />
      </aside>
    );
  }

  if (selection.type === 'branch' && selectedBranch) {
    const branchIndex = branches.filter((branch) => !branch.isDefault).findIndex((branch) => branch.id === selectedBranch.id);

    return (
      <aside className="border-t border-border-silver bg-white lg:border-l lg:border-t-0">
        <InspectorHeader
          label={selectedBranch.isDefault ? '默认条件' : '条件分支'}
          title={getBranchTitle(selectedBranch)}
          description={selectedBranch.isDefault
            ? '当所有条件都不命中时，系统进入默认分支。'
            : '多个条件按“且”关系判断；分支在画布中从左到右表示优先级。'}
        />
        <div className="space-y-5 p-5">
          {validation.branches[selectedBranch.id]?.length > 0 && (
            <div className="rounded-2xl bg-[#ffebee] px-4 py-3 text-[12px] font-bold text-[#c62828]">
              {validation.branches[selectedBranch.id][0]}
            </div>
          )}

          <label className="block space-y-2">
            <span className="text-[12px] font-black uppercase tracking-wider text-light-gray">分支名称</span>
            <input
              className="input-field text-[14px]"
              value={getBranchTitle(selectedBranch)}
              readOnly={selectedBranch.isDefault}
              onChange={(event) => onUpdateBranch(selectedBranch.id, { name: event.target.value })}
            />
          </label>

          <div className="rounded-2xl bg-canvas-white px-4 py-3 text-[12px] font-bold leading-5 text-medium-gray">
            {selectedBranch.isDefault ? '默认分支会排在最后。' : `当前优先级：${branchIndex + 1}`}
          </div>

          {!selectedBranch.isDefault && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-[13px] font-black text-midnight-graphite">进入条件</h4>
                <button
                  type="button"
                  onClick={() => onAddCondition(selectedBranch.id)}
                  className="h-8 px-3 rounded-full bg-lightest-gray-background text-[12px] font-black text-interactive-blue"
                >
                  添加条件
                </button>
              </div>
              {selectedBranch.conditions.map((condition, index) => (
                <React.Fragment key={condition.id}>
                  <ConditionEditor
                    branch={selectedBranch}
                    condition={condition}
                    index={index}
                    fieldOptions={fieldOptions}
                    memberOptions={memberOptions}
                    departmentOptions={departmentOptions}
                    roleOptions={roleOptions}
                    onRemoveCondition={onRemoveCondition}
                    onUpdateCondition={onUpdateCondition}
                  />
                </React.Fragment>
              ))}
            </div>
          )}

          {selectedBranch.isDefault && (
            <div className="rounded-2xl border border-border-silver bg-white p-4 text-[12px] font-bold leading-5 text-medium-gray">
              默认分支不需要设置条件，适合兜底审批人，例如直属上级或财务负责人。
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-[13px] font-black text-midnight-graphite">审批节点</h4>
              <button
                type="button"
                onClick={() => onAddStep(selectedBranch.id)}
                className="h-8 px-3 rounded-full bg-black text-[12px] font-black text-white"
              >
                添加审批
              </button>
            </div>
            <div className="space-y-2">
              {selectedBranch.approvalSteps.length === 0 ? (
                <div className="rounded-2xl bg-canvas-white p-4 text-center text-[12px] font-bold text-medium-gray">
                  当前分支暂无审批节点。
                </div>
              ) : selectedBranch.approvalSteps.map((step, index) => (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => onSelect({ type: 'step', branchId: selectedBranch.id, stepId: step.id })}
                  className="w-full rounded-2xl border border-border-silver bg-white px-4 py-3 text-left hover:bg-canvas-white"
                >
                  <span className="block text-[13px] font-black text-midnight-graphite">{index + 1}. {step.name}</span>
                  <span className="mt-1 block text-[11px] font-bold text-medium-gray">{getApproverTypeLabel(step.approverRule.type)} · {getApprovalModeLabel(step.approvalMode)}</span>
                </button>
              ))}
            </div>
          </div>

          {!selectedBranch.isDefault && (
            <button
              type="button"
              onClick={() => onRemoveBranch(selectedBranch.id)}
              className="h-11 w-full rounded-full bg-[#ffebee] text-[13px] font-black text-[#c62828]"
            >
              删除分支
            </button>
          )}
        </div>
      </aside>
    );
  }

  if (selection.type === 'cc') {
    return (
      <aside className="border-t border-border-silver bg-white lg:border-l lg:border-t-0">
        <InspectorHeader
          label="抄送"
          title="抄送配置"
          description="审批流程完成后，把结果同步给相关成员、部门或角色组。"
        />
        <div className="space-y-5 p-5">
          <label className="block space-y-2">
            <span className="text-[12px] font-black uppercase tracking-wider text-light-gray">抄送成员</span>
            <MultiSelect
              value={ccRule.memberIds}
              options={memberOptions}
              onChange={(memberIds) => onPatchCcRule({ memberIds })}
              emptyText="暂无成员"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-[12px] font-black uppercase tracking-wider text-light-gray">抄送部门</span>
            <MultiSelect
              value={ccRule.departmentIds}
              options={departmentOptions}
              onChange={(departmentIds) => onPatchCcRule({ departmentIds })}
              emptyText="暂无部门"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-[12px] font-black uppercase tracking-wider text-light-gray">抄送角色</span>
            <MultiSelect
              value={ccRule.roleGroupIds}
              options={roleOptions}
              onChange={(roleGroupIds) => onPatchCcRule({ roleGroupIds })}
              emptyText="暂无角色"
            />
          </label>
        </div>
      </aside>
    );
  }

  return (
    <aside className="border-t border-border-silver bg-white lg:border-l lg:border-t-0">
      <InspectorHeader
        label="提交"
        title="提交人设置"
        description="设置谁可以发起这个审批流。表单字段和组织架构会在这里作为条件和审批人来源。"
      />
      <div className="space-y-5 p-5">
        {validation.sections.submit?.length > 0 && (
          <div className="rounded-2xl bg-[#ffebee] px-4 py-3 text-[12px] font-bold text-[#c62828]">
            {validation.sections.submit[0]}
          </div>
        )}

        <div className="space-y-2">
          <span className="text-[12px] font-black uppercase tracking-wider text-light-gray">可提交范围</span>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: 'all_members', label: '全部' },
              { value: 'members', label: '成员' },
              { value: 'departments', label: '部门' },
            ].map((item) => (
              <React.Fragment key={item.value}>
                <SegmentedButton
                  isActive={submitPermission.type === item.value}
                  onClick={() => onPatchSubmitPermission({ type: item.value as SubmitPermissionRule['type'] })}
                >
                  {item.label}
                </SegmentedButton>
              </React.Fragment>
            ))}
          </div>
        </div>

        {submitPermission.type === 'members' && (
          <label className="block space-y-2">
            <span className="text-[12px] font-black uppercase tracking-wider text-light-gray">可提交成员</span>
            <MultiSelect
              value={submitPermission.memberIds}
              options={memberOptions}
              onChange={(memberIds) => onPatchSubmitPermission({ memberIds })}
              emptyText="暂无成员"
            />
          </label>
        )}

        {submitPermission.type === 'departments' && (
          <label className="block space-y-2">
            <span className="text-[12px] font-black uppercase tracking-wider text-light-gray">可提交部门</span>
            <MultiSelect
              value={submitPermission.departmentIds}
              options={departmentOptions}
              onChange={(departmentIds) => onPatchSubmitPermission({ departmentIds })}
              emptyText="暂无部门"
            />
          </label>
        )}

        <label className="block space-y-2">
          <span className="text-[12px] font-black uppercase tracking-wider text-light-gray">排除成员</span>
          <MultiSelect
            value={submitPermission.excludedMemberIds}
            options={memberOptions}
            onChange={(excludedMemberIds) => onPatchSubmitPermission({ excludedMemberIds })}
            emptyText="暂无成员"
          />
        </label>

        <div className="rounded-2xl bg-canvas-white px-4 py-3 text-[12px] font-bold leading-5 text-medium-gray">
          当前可提交：{formatSubmitPermission(submitPermission, directory)}
        </div>
      </div>
    </aside>
  );
}

function SectionCard({
  title,
  icon,
  children,
  actions,
  errors,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
  errors?: string[];
}) {
  return (
    <section className="rounded-2xl border border-border-silver bg-white shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-border-silver flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-black text-white flex items-center justify-center">
            {icon}
          </div>
          <h2 className="text-[18px] font-black">{title}</h2>
        </div>
        {actions}
      </div>
      {errors && errors.length > 0 && (
        <div className="mx-6 mt-5 rounded-2xl bg-[#ffebee] px-4 py-3 text-[12px] font-bold text-[#c62828]">
          {errors[0]}
        </div>
      )}
      <div className="p-6">{children}</div>
    </section>
  );
}

function MultiSelect({
  value,
  options,
  onChange,
  emptyText,
}: {
  value: string[];
  options: Array<{ value: string; label: string }>;
  onChange: (value: string[]) => void;
  emptyText: string;
}) {
  return (
    <select
      multiple
      className="input-field min-h-[116px] text-[13px]"
      value={value}
      onChange={(event) => onChange(readSelectedValues(event))}
    >
      {options.length === 0 ? (
        <option disabled>{emptyText}</option>
      ) : (
        options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))
      )}
    </select>
  );
}

export default function WorkflowAdmin() {
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [directory, setDirectory] = useState<OrganizationDirectory>({ departments: [], members: [], roleGroups: [] });
  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState<WorkflowVersion | null>(null);
  const [createBusinessKey, setCreateBusinessKey] = useState(businessScopeOptions[0]?.key || '');
  const [createName, setCreateName] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [validation, setValidation] = useState<ValidationState>(createValidationState());
  const [designerSelection, setDesignerSelection] = useState<DesignerSelection>(submitDesignerSelection);

  const selectedTemplate = templates.find((template) => template.id === selectedId) || null;
  const enabledMembers = useMemo(
    () => directory.members.filter((member) => member.enabled !== false),
    [directory.members],
  );
  const memberOptions = useMemo(
    () => enabledMembers.map((member) => ({
      value: member.id,
      label: `${member.name}${member.accountUsername ? `（${member.accountUsername}）` : '（未绑定账号）'}`,
    })),
    [enabledMembers],
  );
  const departmentOptions = useMemo(
    () => directory.departments.map((department) => ({ value: department.id, label: department.name })),
    [directory.departments],
  );
  const roleOptions = useMemo(
    () => directory.roleGroups.map((roleGroup) => ({ value: roleGroup.id, label: roleGroup.name })),
    [directory.roleGroups],
  );
  const conditionFieldOptionsForDraft = useMemo(
    () => getConditionFieldOptions(draft),
    [draft?.basic.moduleName, draft?.basic.approvalTypeName],
  );
  const summaryLines = useMemo(() => {
    if (!draft) return [];
    const permission = draft.submitPermission || defaultSubmitPermission();
    return (draft.branches || []).map((branch) => {
      const conditionText = branch.isDefault
        ? '未命中任何条件时'
        : `当 ${branch.conditions.map(formatCondition).join('，')} 时`;
      const steps = branch.approvalSteps.map((step) => formatStepRule(step, directory)).join('，再由 ');
      return `适用于：${formatSubmitPermission(permission, directory)}；${conditionText}，${steps ? `先由 ${steps} 审批` : '尚未配置审批节点'}。`;
    });
  }, [directory, draft]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [nextTemplates, nextDirectory] = await Promise.all([
        storage.getWorkflowTemplates(),
        storage.getOrganizationDirectory(),
      ]);
      const normalizedTemplates = nextTemplates.map((template) => ({
        ...template,
        draft: normalizeDraftForEditor(template.draft),
        publishedVersion: template.publishedVersion ? normalizeDraftForEditor(template.publishedVersion) : undefined,
      }));
      setTemplates(normalizedTemplates);
      setDirectory(nextDirectory);
      const nextSelected = normalizedTemplates[0] || null;
      setSelectedId(nextSelected?.id || '');
      setDraft(nextSelected ? normalizeDraftForEditor(JSON.parse(JSON.stringify(nextSelected.draft))) : null);
      setValidation(createValidationState());
      setDesignerSelection(submitDesignerSelection);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const selectTemplate = (template: WorkflowTemplate) => {
    setSelectedId(template.id);
    setDraft(normalizeDraftForEditor(JSON.parse(JSON.stringify(template.draft))));
    setMessage('');
    setValidation(createValidationState());
    setDesignerSelection(submitDesignerSelection);
  };

  const patchDraft = (updater: (current: WorkflowVersion) => WorkflowVersion) => {
    setDraft((current) => current ? normalizeDraftForEditor(updater(current)) : current);
  };

  const patchBasic = (patch: Partial<WorkflowVersion['basic']>) => {
    patchDraft((current) => ({
      ...current,
      basic: { ...current.basic, ...patch },
    }));
  };

  const patchSubmitPermission = (patch: Partial<SubmitPermissionRule>) => {
    patchDraft((current) => ({
      ...current,
      submitPermission: {
        ...defaultSubmitPermission(),
        ...(current.submitPermission || {}),
        ...patch,
      },
    }));
  };

  const patchCcRule = (patch: Partial<CcRule>) => {
    patchDraft((current) => ({
      ...current,
      ccRule: {
        ...defaultCcRule(),
        ...(current.ccRule || {}),
        ...patch,
        timing: 'workflow_completed',
      },
    }));
  };

  const updateBranch = (branchId: string, patch: Partial<WorkflowBranch>) => {
    patchDraft((current) => ({
      ...current,
      branches: (current.branches || []).map((branch) => (
        branch.id === branchId ? { ...branch, ...patch } : branch
      )),
    }));
  };

  const updateCondition = (branchId: string, conditionId: string, patch: Partial<WorkflowCondition>) => {
    patchDraft((current) => ({
      ...current,
      branches: (current.branches || []).map((branch) => (
        branch.id === branchId
          ? {
              ...branch,
              conditions: branch.conditions.map((condition) => (
                condition.id === conditionId ? normalizeCondition({ ...condition, ...patch }) : condition
              )),
            }
          : branch
      )),
    }));
  };

  const addCondition = (branchId: string) => {
    const defaultField = conditionFieldOptionsForDraft[0]?.value || 'submitter.department';
    patchDraft((current) => ({
      ...current,
      branches: (current.branches || []).map((branch) => (
        branch.id === branchId
          ? { ...branch, conditions: [...branch.conditions, defaultCondition(defaultField)] }
          : branch
      )),
    }));
  };

  const removeCondition = (branchId: string, conditionId: string) => {
    patchDraft((current) => ({
      ...current,
      branches: (current.branches || []).map((branch) => (
        branch.id === branchId
          ? { ...branch, conditions: branch.conditions.filter((condition) => condition.id !== conditionId) }
          : branch
      )),
    }));
  };

  const addBranch = () => {
    const branchId = createId('branch');
    const defaultField = conditionFieldOptionsForDraft[0]?.value || 'submitter.department';
    patchDraft((current) => {
      const branchCount = (current.branches || []).filter((branch) => !branch.isDefault).length + 1;
      const branches = current.branches || [defaultBranch()];
      const defaultIndex = branches.findIndex((branch) => branch.isDefault);
      const nextBranch: WorkflowBranch = {
        id: branchId,
        name: `Branch ${branchCount}`,
        isDefault: false,
        conditions: [defaultCondition(defaultField)],
        approvalSteps: [defaultStep(1)],
      };

      if (defaultIndex < 0) {
        return { ...current, branches: [...branches, nextBranch, defaultBranch()] };
      }

      return {
        ...current,
        branches: [
          ...branches.slice(0, defaultIndex),
          nextBranch,
          ...branches.slice(defaultIndex),
        ],
      };
    });
    setDesignerSelection({ type: 'branch', branchId });
  };

  const removeBranch = (branchId: string) => {
    patchDraft((current) => ({
      ...current,
      branches: (current.branches || []).filter((branch) => branch.isDefault || branch.id !== branchId),
    }));
    setDesignerSelection((current) => (
      (current.type === 'branch' || current.type === 'step') && current.branchId === branchId
        ? submitDesignerSelection
        : current
    ));
  };

  const addStep = (branchId: string) => {
    const stepId = createId('step');
    patchDraft((current) => ({
      ...current,
      branches: (current.branches || []).map((branch) => (
        branch.id === branchId
          ? { ...branch, approvalSteps: [...branch.approvalSteps, { ...defaultStep(branch.approvalSteps.length + 1), id: stepId }] }
          : branch
      )),
    }));
    setDesignerSelection({ type: 'step', branchId, stepId });
  };

  const updateStep = (branchId: string, stepId: string, patch: Partial<ApprovalStep>) => {
    patchDraft((current) => ({
      ...current,
      branches: (current.branches || []).map((branch) => (
        branch.id === branchId
          ? {
              ...branch,
              approvalSteps: branch.approvalSteps.map((step, index) => (
                step.id === stepId ? normalizeStep({ ...step, ...patch }, index) : step
              )),
            }
          : branch
      )),
    }));
  };

  const removeStep = (branchId: string, stepId: string) => {
    patchDraft((current) => ({
      ...current,
      branches: (current.branches || []).map((branch) => (
        branch.id === branchId
          ? { ...branch, approvalSteps: branch.approvalSteps.filter((step) => step.id !== stepId) }
          : branch
      )),
    }));
    setDesignerSelection((current) => (
      current.type === 'step' && current.branchId === branchId && current.stepId === stepId
        ? { type: 'branch', branchId }
        : current
    ));
  };

  const moveStep = (branchId: string, stepId: string, direction: -1 | 1) => {
    patchDraft((current) => ({
      ...current,
      branches: (current.branches || []).map((branch) => {
        if (branch.id !== branchId) return branch;
        const index = branch.approvalSteps.findIndex((step) => step.id === stepId);
        const nextIndex = index + direction;
        if (index < 0 || nextIndex < 0 || nextIndex >= branch.approvalSteps.length) return branch;
        const steps = [...branch.approvalSteps];
        const [step] = steps.splice(index, 1);
        steps.splice(nextIndex, 0, step);
        return { ...branch, approvalSteps: steps };
      }),
    }));
  };

  const saveDraft = async () => {
    if (!selectedTemplate || !draft) return null;
    const nextDraft = prepareDraftForSave(draft);
    const saved = await storage.updateWorkflowDraft(selectedTemplate.id, nextDraft);
    const normalized = {
      ...saved,
      draft: normalizeDraftForEditor(saved.draft),
      publishedVersion: saved.publishedVersion ? normalizeDraftForEditor(saved.publishedVersion) : undefined,
    };
    setTemplates((current) => current.map((template) => template.id === normalized.id ? normalized : template));
    setDraft(JSON.parse(JSON.stringify(normalized.draft)));
    return normalized;
  };

  const handleCreate = async () => {
    const scope = getBusinessScopeByKey(createBusinessKey);
    const name = createName.trim() || `${scope.approvalTypeName}审批流`;
    setIsSaving(true);
    setMessage('');
    try {
      const created = await storage.createWorkflowTemplate({
        name,
        businessType: scope.businessType,
        organizationId: DEFAULT_ORG_ID,
        moduleName: scope.moduleName,
        approvalTypeName: scope.approvalTypeName,
      });
      const nextDraft = createDraft(name, scope);
      const updated = await storage.updateWorkflowDraft(created.id, nextDraft);
      const normalized = {
        ...updated,
        draft: normalizeDraftForEditor(updated.draft),
        publishedVersion: updated.publishedVersion ? normalizeDraftForEditor(updated.publishedVersion) : undefined,
      };
      setTemplates((current) => [normalized, ...current]);
      setSelectedId(normalized.id);
      setDraft(JSON.parse(JSON.stringify(normalized.draft)));
      setCreateName('');
      setValidation(validateDraft(normalized.draft));
      setDesignerSelection(submitDesignerSelection);
      setMessage('审批流已创建');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '创建失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!draft) return;
    setIsSaving(true);
    setMessage('');
    const nextValidation = validateDraft(draft);
    setValidation(nextValidation);
    try {
      await saveDraft();
      setMessage(nextValidation.errors.length > 0 ? '草稿已保存，请处理发布校验项。' : '草稿已保存');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!selectedTemplate || !draft) return;
    const nextValidation = validateDraft(draft);
    setValidation(nextValidation);
    if (nextValidation.errors.length > 0) {
      setMessage('发布失败，请先处理校验项。');
      return;
    }

    setIsSaving(true);
    setMessage('');
    try {
      await saveDraft();
      const published = await storage.publishWorkflowTemplate(selectedTemplate.id);
      const normalized = {
        ...published,
        draft: normalizeDraftForEditor(published.draft),
        publishedVersion: published.publishedVersion ? normalizeDraftForEditor(published.publishedVersion) : undefined,
      };
      setTemplates((current) => current.map((template) => template.id === normalized.id ? normalized : template));
      setDraft(JSON.parse(JSON.stringify(normalized.draft)));
      setMessage('审批流已发布');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '发布失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (status: WorkflowTemplate['status']) => {
    if (!selectedTemplate) return;
    setIsSaving(true);
    setMessage('');
    try {
      const updated = await storage.setWorkflowTemplateStatus(selectedTemplate.id, status);
      const normalized = {
        ...updated,
        draft: normalizeDraftForEditor(updated.draft),
        publishedVersion: updated.publishedVersion ? normalizeDraftForEditor(updated.publishedVersion) : undefined,
      };
      setTemplates((current) => current.map((template) => template.id === normalized.id ? normalized : template));
      setMessage(status === 'disabled' ? '审批流已停用' : '审批流已启用');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '状态更新失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDuplicate = async (templateId: string) => {
    setIsSaving(true);
    setMessage('');
    try {
      const duplicated = await storage.duplicateWorkflowTemplate(templateId);
      const normalized = {
        ...duplicated,
        draft: normalizeDraftForEditor(duplicated.draft),
        publishedVersion: duplicated.publishedVersion ? normalizeDraftForEditor(duplicated.publishedVersion) : undefined,
      };
      setTemplates((current) => [normalized, ...current]);
      setSelectedId(normalized.id);
      setDraft(JSON.parse(JSON.stringify(normalized.draft)));
      setDesignerSelection(submitDesignerSelection);
      setMessage('审批流副本已创建');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '复制失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedTemplate) return;
    const confirmed = window.confirm(`确认删除审批流「${selectedTemplate.name}」？已发起的历史申请不会被删除。`);
    if (!confirmed) return;

    setIsSaving(true);
    setMessage('');
    try {
      await storage.deleteWorkflowTemplate(selectedTemplate.id);
      const nextTemplates = templates.filter((template) => template.id !== selectedTemplate.id);
      const nextSelected = nextTemplates[0] || null;
      setTemplates(nextTemplates);
      setSelectedId(nextSelected?.id || '');
      setDraft(nextSelected ? JSON.parse(JSON.stringify(nextSelected.draft)) : null);
      setValidation(createValidationState());
      setDesignerSelection(submitDesignerSelection);
      setMessage('审批流已删除');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '删除失败');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="text-[15px] font-bold text-medium-gray">正在加载审批流配置...</div>;
  }

  const submitPermission = draft?.submitPermission || defaultSubmitPermission();
  const ccRule = draft?.ccRule || defaultCcRule();
  const branches = draft?.branches || [];

  return (
    <div className="space-y-8 pb-32 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-black text-light-gray uppercase tracking-[0.2em]">Workflow Config</p>
          <h1 className="text-2xl font-black text-midnight-graphite tracking-tight">审批流配置</h1>
          <p className="mt-2 text-[14px] font-medium text-medium-gray">配置模板、提交范围、条件分支、审批节点与抄送规则。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="px-3 py-1.5 rounded-full bg-white border border-border-silver text-[11px] font-black text-medium-gray">
            {templates.length} 个模板
          </span>
          <span className="px-3 py-1.5 rounded-full bg-[#e8f5e9] text-[#2e7d32] text-[11px] font-black">
            {templates.filter((template) => template.status === 'published').length} 个已发布
          </span>
        </div>
      </div>

      {message && (
        <div className="rounded-2xl border border-border-silver bg-white px-5 py-4 text-[13px] font-bold text-midnight-graphite">
          {message}
        </div>
      )}

      <section className="rounded-2xl border border-border-silver bg-white shadow-sm p-5">
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
          <select
            className="input-field text-[15px]"
            value={createBusinessKey}
            onChange={(event) => setCreateBusinessKey(event.target.value)}
          >
            {businessScopeOptions.map((option) => (
              <option key={option.key} value={option.key}>{option.label}</option>
            ))}
          </select>
          <input
            className="input-field text-[15px]"
            value={createName}
            onChange={(event) => setCreateName(event.target.value)}
            placeholder="新审批流名称"
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={isSaving}
            className="h-11 px-5 rounded-full bg-black text-white text-[13px] font-bold flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <Plus size={15} strokeWidth={3} /> 新建
          </button>
        </div>
      </section>

      <div className="grid gap-6 2xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-border-silver bg-white shadow-sm overflow-hidden h-fit">
          <div className="px-5 py-4 border-b border-border-silver flex items-center gap-3">
            <Workflow size={17} />
            <h2 className="text-[16px] font-black">流程列表</h2>
          </div>
          <div className="divide-y divide-border-silver max-h-[760px] overflow-y-auto">
            {templates.length === 0 ? (
              <div className="p-8 text-center text-[13px] font-bold text-medium-gray">暂无审批流模板</div>
            ) : templates.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => selectTemplate(template)}
                className={cn(
                  "w-full text-left p-5 transition-colors",
                  selectedId === template.id ? 'bg-lightest-gray-background' : 'hover:bg-canvas-white'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[14px] font-black text-midnight-graphite truncate">{template.name}</p>
                    <p className="mt-1 text-[12px] font-bold text-medium-gray">
                      {getTemplateScopeLabel(template)} · v{template.currentVersion || 1}
                    </p>
                    <p className="mt-1 text-[11px] font-bold text-light-gray">更新于 {formatDate(template.updatedAt)}</p>
                  </div>
                  <span className={cn("shrink-0 px-2.5 py-1 rounded-full text-[10px] font-black", statusClasses[template.status])}>
                    {statusLabels[template.status]}
                  </span>
                </div>
                <div className="mt-4 flex justify-end">
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleDuplicate(template.id);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        event.stopPropagation();
                        void handleDuplicate(template.id);
                      }
                    }}
                    className="h-8 px-3 rounded-full bg-white border border-border-silver text-[11px] font-black text-medium-gray flex items-center gap-1.5"
                  >
                    <Copy size={13} /> 复制
                  </span>
                </div>
              </button>
            ))}
          </div>
        </aside>

        {!draft || !selectedTemplate ? (
          <section className="rounded-2xl border border-border-silver bg-white shadow-sm p-12 text-center text-[14px] font-bold text-medium-gray">
            请先选择或新建审批流。
          </section>
        ) : (
          <div className="space-y-6">
            <section className="rounded-2xl border border-border-silver bg-white shadow-sm overflow-hidden">
              <div className="p-6 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-black", statusClasses[selectedTemplate.status])}>
                      {statusLabels[selectedTemplate.status]}
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-lightest-gray-background text-[10px] font-black text-medium-gray">
                      {getWorkflowScopeLabel(draft.basic.moduleName, draft.basic.approvalTypeName)}
                    </span>
                  </div>
                  <h2 className="mt-3 text-[24px] font-black text-midnight-graphite tracking-tight truncate">{draft.basic.name}</h2>
                  <p className="mt-1 text-[12px] font-bold text-medium-gray">
                    当前版本 v{draft.version || 1}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving}
                    className="h-10 px-4 rounded-full bg-black text-white text-[12px] font-bold flex items-center gap-2 disabled:opacity-40"
                  >
                    <Save size={14} /> 保存草稿
                  </button>
                  <button
                    type="button"
                    onClick={handlePublish}
                    disabled={isSaving}
                    className="h-10 px-4 rounded-full bg-[#2e7d32] text-white text-[12px] font-bold flex items-center gap-2 disabled:opacity-40"
                  >
                    <CheckCircle2 size={14} /> 发布
                  </button>
                  {selectedTemplate.status === 'disabled' ? (
                    <button
                      type="button"
                      onClick={() => handleStatusChange('published')}
                      disabled={isSaving}
                      className="h-10 px-4 rounded-full bg-lightest-gray-background text-[12px] font-bold disabled:opacity-40"
                    >
                      启用
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleStatusChange('disabled')}
                      disabled={isSaving}
                      className="h-10 px-4 rounded-full bg-[#ffebee] text-[#c62828] text-[12px] font-bold flex items-center gap-2 disabled:opacity-40"
                    >
                      <XCircle size={14} /> 停用
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isSaving}
                    className="h-10 px-4 rounded-full bg-white border border-[#f1c7c7] text-[#c62828] text-[12px] font-bold flex items-center gap-2 disabled:opacity-40"
                  >
                    <Trash2 size={14} /> 删除
                  </button>
                </div>
              </div>
              {validation.errors.length > 0 && (
                <div className="border-t border-border-silver bg-[#fff7e6] p-5">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 text-[#9a5b00]" size={18} />
                    <div>
                      <p className="text-[13px] font-black text-[#9a5b00]">发布校验</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {validation.errors.map((error) => (
                          <span key={error} className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-[#9a5b00] border border-[#f0d69a]">
                            {error}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>

            <SectionCard
              title="基础信息"
              icon={<Workflow size={18} strokeWidth={2.5} />}
              errors={validation.sections.basic}
            >
              <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr_180px]">
                <label className="space-y-2">
                  <span className="text-[12px] font-black text-light-gray uppercase tracking-wider">审批流名称</span>
                  <input
                    className={cn("input-field text-[15px]", validation.sections.basic?.length && "ring-2 ring-[#c62828]")}
                    value={draft.basic.name}
                    onChange={(event) => patchBasic({ name: event.target.value })}
                    placeholder="审批流名称"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-[12px] font-black text-light-gray uppercase tracking-wider">适用业务类型</span>
                  <select
                    className="input-field text-[15px]"
                    value={getBusinessScopeKey(draft.basic.moduleName, draft.basic.approvalTypeName)}
                    onChange={(event) => {
                      const scope = getBusinessScopeByKey(event.target.value);
                      patchDraft((current) => ({
                        ...current,
                        businessType: scope.businessType,
                        basic: {
                          ...current.basic,
                          moduleName: scope.moduleName,
                          approvalTypeName: scope.approvalTypeName,
                        },
                        branches: (current.branches || []).map((branch) => (
                          branch.isDefault ? branch : {
                            ...branch,
                            conditions: branch.conditions.map((condition) => rebaseConditionToScope(condition, scope)),
                          }
                        )),
                      }));
                    }}
                  >
                    {businessScopeOptions.map((option) => (
                      <option key={option.key} value={option.key}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-[12px] font-black text-light-gray uppercase tracking-wider">版本状态</span>
                  <input className="input-field text-[15px]" value={`v${draft.version || 1} / ${statusLabels[selectedTemplate.status]}`} readOnly />
                </label>
              </div>
            </SectionCard>

            <WorkflowFlowDesigner
              draft={draft}
              directory={directory}
              submitPermission={submitPermission}
              ccRule={ccRule}
              branches={branches}
              validation={validation}
              selection={designerSelection}
              fieldOptions={conditionFieldOptionsForDraft}
              memberOptions={memberOptions}
              departmentOptions={departmentOptions}
              roleOptions={roleOptions}
              onSelect={setDesignerSelection}
              onAddBranch={addBranch}
              onRemoveBranch={removeBranch}
              onUpdateBranch={updateBranch}
              onAddCondition={addCondition}
              onRemoveCondition={removeCondition}
              onUpdateCondition={updateCondition}
              onPatchSubmitPermission={patchSubmitPermission}
              onPatchCcRule={patchCcRule}
              onAddStep={addStep}
              onUpdateStep={updateStep}
              onRemoveStep={removeStep}
              onMoveStep={moveStep}
            />

            <div className="hidden">
            <SectionCard
              title="提交权限"
              icon={<Users size={18} strokeWidth={2.5} />}
              errors={validation.sections.submit}
            >
              <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
                <div className="space-y-3">
                  {[
                    { value: 'all_members', label: '全部成员', icon: Users },
                    { value: 'members', label: '指定成员', icon: UserRound },
                    { value: 'departments', label: '指定部门', icon: Building2 },
                  ].map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => patchSubmitPermission({ type: item.value as SubmitPermissionRule['type'] })}
                      className={cn(
                        "w-full min-h-12 rounded-2xl px-4 py-3 text-left text-[13px] font-black transition-all flex items-center gap-3 border",
                        submitPermission.type === item.value
                          ? "bg-black text-white border-black"
                          : "bg-white text-midnight-graphite border-border-silver hover:bg-lightest-gray-background"
                      )}
                    >
                      <item.icon size={16} />
                      {item.label}
                    </button>
                  ))}
                </div>
                <div className="space-y-5">
                  {submitPermission.type === 'members' && (
                    <label className="space-y-2 block">
                      <span className="text-[12px] font-black text-light-gray uppercase tracking-wider">可提交成员</span>
                      <MultiSelect
                        value={submitPermission.memberIds}
                        options={memberOptions}
                        onChange={(memberIds) => patchSubmitPermission({ memberIds })}
                        emptyText="暂无成员"
                      />
                    </label>
                  )}
                  {submitPermission.type === 'departments' && (
                    <label className="space-y-2 block">
                      <span className="text-[12px] font-black text-light-gray uppercase tracking-wider">可提交部门</span>
                      <MultiSelect
                        value={submitPermission.departmentIds}
                        options={departmentOptions}
                        onChange={(departmentIds) => patchSubmitPermission({ departmentIds })}
                        emptyText="暂无部门"
                      />
                    </label>
                  )}
                  <label className="space-y-2 block">
                    <span className="text-[12px] font-black text-light-gray uppercase tracking-wider">排除成员</span>
                    <MultiSelect
                      value={submitPermission.excludedMemberIds}
                      options={memberOptions}
                      onChange={(excludedMemberIds) => patchSubmitPermission({ excludedMemberIds })}
                      emptyText="暂无成员"
                    />
                  </label>
                  <div className="rounded-2xl bg-canvas-white px-4 py-3 text-[13px] font-bold text-midnight-graphite">
                    可提交范围：{formatSubmitPermission(submitPermission, directory)}
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="条件分流与审批节点"
              icon={<GitBranch size={18} strokeWidth={2.5} />}
              actions={(
                <button
                  type="button"
                  onClick={addBranch}
                  className="h-9 px-4 rounded-full bg-lightest-gray-background text-[12px] font-bold flex items-center gap-2"
                >
                  <Plus size={14} /> 新增 Branch
                </button>
              )}
              errors={validation.sections.branches}
            >
              <div className="space-y-5">
                {branches.map((branch) => (
                  <article
                    key={branch.id}
                    className={cn(
                      "rounded-2xl border p-5 space-y-5",
                      validation.branches[branch.id]?.length ? "border-[#c62828] bg-[#fffafa]" : "border-border-silver bg-white"
                    )}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={cn(
                          "px-2.5 py-1 rounded-full text-[10px] font-black",
                          branch.isDefault ? "bg-black text-white" : "bg-lightest-gray-background text-medium-gray"
                        )}>
                          {branch.isDefault ? 'DEFAULT' : 'BRANCH'}
                        </span>
                        <input
                          className="min-w-0 flex-1 bg-transparent text-[16px] font-black text-midnight-graphite outline-none"
                          value={getBranchTitle(branch)}
                          readOnly={branch.isDefault}
                          onChange={(event) => updateBranch(branch.id, { name: event.target.value })}
                        />
                      </div>
                      {!branch.isDefault && (
                        <button
                          type="button"
                          onClick={() => removeBranch(branch.id)}
                          className="h-9 px-4 rounded-full bg-[#ffebee] text-[#c62828] text-[12px] font-bold flex items-center justify-center gap-2"
                        >
                          <Trash2 size={14} /> 删除 Branch
                        </button>
                      )}
                    </div>

                    {!branch.isDefault && branch.conditions.map((condition) => (
                      <div key={condition.id} className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_1fr]">
                        <select
                          className="input-field text-[13px]"
                          value={condition.field}
                          onChange={(event) => {
                            const nextField = event.target.value as WorkflowConditionField;
                            updateCondition(branch.id, condition.id, { ...defaultCondition(nextField), id: condition.id });
                          }}
                        >
                          {conditionFieldOptionsForDraft.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                        <select
                          className="input-field text-[13px]"
                          value={condition.operator}
                          onChange={(event) => updateCondition(branch.id, condition.id, { operator: event.target.value as WorkflowConditionOperator })}
                        >
                          {conditionOperatorOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                        {isNumericConditionFieldValue(condition.field) && condition.operator === 'between' ? (
                          <>
                            <input
                              className="input-field text-[13px]"
                              type="number"
                              value={condition.amountMin ?? ''}
                              onChange={(event) => updateCondition(branch.id, condition.id, { amountMin: event.target.value === '' ? undefined : Number(event.target.value) })}
                              placeholder="下限"
                            />
                            <input
                              className="input-field text-[13px]"
                              type="number"
                              value={condition.amountMax ?? ''}
                              onChange={(event) => updateCondition(branch.id, condition.id, { amountMax: event.target.value === '' ? undefined : Number(event.target.value) })}
                              placeholder="上限"
                            />
                          </>
                        ) : isNumericConditionFieldValue(condition.field) && condition.operator === 'gt' ? (
                          <input
                            className="input-field text-[13px] lg:col-span-2"
                            type="number"
                            value={condition.amountMin ?? ''}
                            onChange={(event) => updateCondition(branch.id, condition.id, { amountMin: event.target.value === '' ? undefined : Number(event.target.value) })}
                            placeholder="金额下限"
                          />
                        ) : isNumericConditionFieldValue(condition.field) && condition.operator === 'lte' ? (
                          <input
                            className="input-field text-[13px] lg:col-span-2"
                            type="number"
                            value={condition.amountMax ?? ''}
                            onChange={(event) => updateCondition(branch.id, condition.id, { amountMax: event.target.value === '' ? undefined : Number(event.target.value) })}
                            placeholder="金额上限"
                          />
                        ) : (
                          <input
                            className="input-field text-[13px] lg:col-span-2"
                            value={condition.value || ''}
                            onChange={(event) => updateCondition(branch.id, condition.id, { value: event.target.value })}
                            placeholder="条件值"
                          />
                        )}
                      </div>
                    ))}

                    {branch.isDefault && (
                      <div className="rounded-2xl bg-canvas-white px-4 py-3 text-[13px] font-bold text-medium-gray">
                        未命中其他条件时进入默认分支。
                      </div>
                    )}

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-[14px] font-black text-midnight-graphite">审批节点</h3>
                        <button
                          type="button"
                          onClick={() => addStep(branch.id)}
                          className="h-8 px-3 rounded-full bg-lightest-gray-background text-[12px] font-bold flex items-center gap-2"
                        >
                          <Plus size={13} /> 添加 Step
                        </button>
                      </div>

                      {branch.approvalSteps.length === 0 && (
                        <div className="rounded-2xl bg-canvas-white p-8 text-center text-[13px] font-bold text-medium-gray">
                          当前分支暂无审批节点。
                        </div>
                      )}

                      {branch.approvalSteps.map((step, stepIndex) => (
                        <div
                          key={step.id}
                          className={cn(
                            "rounded-2xl border p-4 space-y-4",
                            validation.steps[step.id]?.length ? "border-[#c62828] bg-white" : "border-border-silver bg-canvas-white"
                          )}
                        >
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex items-center gap-3">
                              <span className="w-9 h-9 rounded-2xl bg-black text-white flex items-center justify-center text-[12px] font-black">
                                {stepIndex + 1}
                              </span>
                              <p className="text-[12px] font-black text-light-gray uppercase tracking-wider">Step {stepIndex + 1}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => moveStep(branch.id, step.id, -1)}
                                disabled={stepIndex === 0}
                                className="w-8 h-8 rounded-full bg-white border border-border-silver flex items-center justify-center disabled:opacity-40"
                                title="上移"
                              >
                                <ArrowUp size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveStep(branch.id, step.id, 1)}
                                disabled={stepIndex === branch.approvalSteps.length - 1}
                                className="w-8 h-8 rounded-full bg-white border border-border-silver flex items-center justify-center disabled:opacity-40"
                                title="下移"
                              >
                                <ArrowDown size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeStep(branch.id, step.id)}
                                className="h-8 px-3 rounded-full bg-[#ffebee] text-[#c62828] text-[11px] font-bold flex items-center gap-1.5"
                              >
                                <Trash2 size={13} /> 删除
                              </button>
                            </div>
                          </div>

                          <div className="grid gap-3 lg:grid-cols-3">
                            <input
                              className="input-field text-[13px]"
                              value={step.name}
                              onChange={(event) => updateStep(branch.id, step.id, { name: event.target.value })}
                              placeholder="节点名称"
                            />
                            <select
                              className="input-field text-[13px]"
                              value={step.approverRule.type}
                              onChange={(event) => {
                                const type = event.target.value as ApproverRule['type'];
                                updateStep(branch.id, step.id, {
                                  approverRule: {
                                    type,
                                    memberIds: [],
                                    departmentIds: [],
                                    roleGroupIds: [],
                                    roleGroupId: '',
                                  },
                                });
                              }}
                            >
                              <option value="specific_members">指定成员</option>
                              <option value="department_manager">部门主管</option>
                              <option value="submitter_manager">发起人的上级</option>
                              <option value="role_based">指定角色</option>
                            </select>
                            <select
                              className="input-field text-[13px]"
                              value={step.approvalMode}
                              onChange={(event) => updateStep(branch.id, step.id, { approvalMode: event.target.value as ApprovalMode })}
                            >
                              <option value="one_of">多人任意一人通过</option>
                              <option value="all_of">所有人都要通过</option>
                            </select>
                          </div>

                          {step.approverRule.type === 'specific_members' && (
                            <MultiSelect
                              value={step.approverRule.memberIds || []}
                              options={memberOptions}
                              onChange={(memberIds) => updateStep(branch.id, step.id, {
                                approverRule: { ...step.approverRule, memberIds },
                              })}
                              emptyText="暂无成员"
                            />
                          )}

                          {step.approverRule.type === 'role_based' && (
                            <select
                              className="input-field text-[13px]"
                              value={step.approverRule.roleGroupId || ''}
                              onChange={(event) => updateStep(branch.id, step.id, {
                                approverRule: { ...step.approverRule, roleGroupId: event.target.value },
                              })}
                            >
                              <option value="">选择角色组</option>
                              {roleOptions.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                          )}

                          <select
                            className="input-field text-[13px]"
                            value={step.emptyApproverAction}
                            onChange={(event) => updateStep(branch.id, step.id, {
                              emptyApproverAction: event.target.value as ApprovalStep['emptyApproverAction'],
                            })}
                          >
                            <option value="block_submit">找不到审批人时报错</option>
                            <option value="auto_pass">找不到审批人时自动跳过</option>
                          </select>

                          {validation.steps[step.id]?.length > 0 && (
                            <p className="text-[12px] font-bold text-[#c62828]">{validation.steps[step.id][0]}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </SectionCard>

            <SectionCard
              title="抄送配置"
              icon={<Send size={18} strokeWidth={2.5} />}
            >
              <div className="grid gap-4 lg:grid-cols-3">
                <label className="space-y-2">
                  <span className="text-[12px] font-black text-light-gray uppercase tracking-wider">抄送成员</span>
                  <MultiSelect
                    value={ccRule.memberIds}
                    options={memberOptions}
                    onChange={(memberIds) => patchCcRule({ memberIds })}
                    emptyText="暂无成员"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-[12px] font-black text-light-gray uppercase tracking-wider">抄送部门</span>
                  <MultiSelect
                    value={ccRule.departmentIds}
                    options={departmentOptions}
                    onChange={(departmentIds) => patchCcRule({ departmentIds })}
                    emptyText="暂无部门"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-[12px] font-black text-light-gray uppercase tracking-wider">抄送角色</span>
                  <MultiSelect
                    value={ccRule.roleGroupIds}
                    options={roleOptions}
                    onChange={(roleGroupIds) => patchCcRule({ roleGroupIds })}
                    emptyText="暂无角色"
                  />
                </label>
              </div>
            </SectionCard>
            </div>

            <SectionCard
              title="流程摘要"
              icon={<CheckCircle2 size={18} strokeWidth={2.5} />}
            >
              <div className="space-y-3">
                {summaryLines.map((line, index) => (
                  <div key={`${line}-${index}`} className="rounded-2xl bg-canvas-white px-4 py-3 text-[13px] font-bold text-midnight-graphite leading-6">
                    {line}
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        )}
      </div>
    </div>
  );
}
