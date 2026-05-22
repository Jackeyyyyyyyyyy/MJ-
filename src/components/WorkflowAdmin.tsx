import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Bot,
  Building2,
  CheckCircle2,
  Crosshair,
  GitBranch,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  Save,
  Send,
  Trash2,
  UserRound,
  Users,
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

type ConditionFieldKind = 'number' | 'currency' | 'text' | 'member' | 'department';
type WorkflowConditionBranch = NonNullable<WorkflowNode['conditions']>[number];

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
  { value: 'lt', label: '< 小于' },
  { value: 'lte', label: '<= 小于等于' },
  { value: 'gt', label: '> 大于' },
  { value: 'gte', label: '>= 大于等于' },
  { value: 'between', label: '区间' },
  { value: 'eq', label: '= 等于' },
  { value: 'neq', label: '!= 不等于' },
  { value: 'contains', label: '包含' },
  { value: 'not_contains', label: '不包含' },
];

const numericConditionOperators = new Set<WorkflowConditionOperator>(['lt', 'lte', 'gt', 'gte', 'between', 'eq', 'neq']);
const currencyConditionOperators = new Set<WorkflowConditionOperator>(['eq', 'neq']);
const textConditionOperators = new Set<WorkflowConditionOperator>(['eq', 'neq', 'contains', 'not_contains']);
const identityConditionOperators = new Set<WorkflowConditionOperator>(['eq', 'neq']);

function getBusinessScopeOptions(): BusinessScopeOption[] {
  return approvalSchema.modules.flatMap((module) => (
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
}

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

const legacyRoleGroupMembers: Record<string, string[]> = {
  'role-board': ['qin-an-tang'],
  'role-gm': ['fan-lu'],
  'role-finance': ['qian-lin', 'hu-ning-fei', 'ye-fei', 'wang-tumiao', 'jiang-hua'],
  'role-sales': ['yang-nan', 'hong-wei'],
  'role-admin': ['lin-jin-biao'],
  'role-warehouse': ['huang-song-yuan'],
  'role-ops': ['li-qi'],
  'role-assistant': ['qin-sheng'],
};

function getLegacyRoleGroupMemberIds(roleGroupId?: string) {
  return legacyRoleGroupMembers[String(roleGroupId || '')] || [];
}

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

function getBusinessScopeByNames(moduleName?: string, approvalTypeName?: string) {
  return getBusinessScopeOptions().find((option) => (
    option.moduleName === moduleName && option.approvalTypeName === approvalTypeName
  )) || null;
}

function normalizeTemplateForEditor(template: WorkflowTemplate): WorkflowTemplate {
  return {
    ...template,
    draft: normalizeDraftForEditor(template.draft),
    publishedVersion: template.publishedVersion ? normalizeDraftForEditor(template.publishedVersion) : undefined,
  };
}

function sortWorkflowTemplatesByBusinessScope(templates: WorkflowTemplate[]) {
  const orderByScope = new Map(getBusinessScopeOptions().map((option, index) => [option.key, index]));

  return [...templates].sort((left, right) => {
    const leftKey = getBusinessScopeKey(left.moduleName || left.draft?.basic?.moduleName, left.approvalTypeName || left.draft?.basic?.approvalTypeName);
    const rightKey = getBusinessScopeKey(right.moduleName || right.draft?.basic?.moduleName, right.approvalTypeName || right.draft?.basic?.approvalTypeName);
    const leftOrder = orderByScope.get(leftKey);
    const rightOrder = orderByScope.get(rightKey);

    if (leftOrder !== undefined || rightOrder !== undefined) {
      return (leftOrder ?? Number.MAX_SAFE_INTEGER) - (rightOrder ?? Number.MAX_SAFE_INTEGER);
    }

    return `${left.moduleName}/${left.approvalTypeName}`.localeCompare(`${right.moduleName}/${right.approvalTypeName}`, 'zh-Hans-CN');
  });
}

function getGeneratedWorkflowName(scope: Pick<BusinessScopeOption, 'approvalTypeName'>) {
  return `${scope.approvalTypeName}审批流`;
}

function getWorkflowTitle(moduleName?: string, approvalTypeName?: string) {
  return approvalTypeName || moduleName || '未设置业务';
}

function getWorkflowMeta(moduleName?: string, version?: number) {
  return [moduleName, `v${version || 1}`].filter(Boolean).join(' · ');
}

function getTemplateOptionLabel(template: WorkflowTemplate) {
  const moduleName = template.moduleName || template.draft?.basic?.moduleName;
  const approvalTypeName = template.approvalTypeName || template.draft?.basic?.approvalTypeName;
  return `${getWorkflowTitle(moduleName, approvalTypeName)} · ${statusLabels[template.status]} · v${template.currentVersion || 1}`;
}

function formatWorkflowMessage(message: string) {
  const knownMessages: Record<string, string> = {
    'published workflow template already exists for this organization and approval type': '该业务已有已发布流程，请先停用旧版本后再发布。',
    'missing workflow template fields': '审批流信息不完整，请补齐后再保存。',
    'workflow template not found': '未找到该审批流，可能已被删除。',
  };

  return knownMessages[message] || message;
}

function getBusinessTypeMeta(type?: string) {
  return businessTypeOptions.find((item) => item.value === type) || businessTypeOptions[businessTypeOptions.length - 1];
}

function isNumericConditionFieldValue(field: string) {
  return field === 'amount' || /金额|价格|费用|利润|汇率|数量|总额|时长|天数|小时/.test(field);
}

function getConditionFieldLabel(field: string) {
  if (field === 'amount') return '金额';
  if (field === 'currency') return '币种符号';
  if (field === 'amount') return '金额';
  if (field === 'submitter.member') return '提交人';
  if (field === 'submitter.department') return '提交人部门';
  return field;
}

function getConditionFieldKind(field: string): ConditionFieldKind {
  if (field === 'currency') return 'currency';
  return 'number';
}

function getConditionOperatorOptions(field: string) {
  if (field === 'currency') {
    return conditionOperatorOptions.filter((option) => currencyConditionOperators.has(option.value));
  }
  if (field === 'amount') {
    return conditionOperatorOptions.filter((option) => numericConditionOperators.has(option.value));
  }
  return conditionOperatorOptions.filter((option) => numericConditionOperators.has(option.value));
}

function getFallbackConditionOperator(field: string): WorkflowConditionOperator {
  if (field === 'currency') return 'eq';
  return 'lte';
}

function getConditionFieldOptions(draft: WorkflowVersion | null): ConditionFieldOption[] {
  return [
    { value: 'amount', label: '金额', kind: 'number' },
    { value: 'currency', label: '币种符号', kind: 'currency' },
  ];
  const scope = draft ? getBusinessScopeByNames(draft.basic.moduleName, draft.basic.approvalTypeName) : null;
  const formFieldOptions = (scope?.fields || []).map((field) => ({
    value: `${FORM_FIELD_PREFIX}${field}`,
    label: `表单 / ${field}`,
    kind: isNumericConditionFieldValue(field) ? 'number' as const : 'text' as const,
  }));

  return [
    { value: 'submitter.member', label: '提交人 / 本人', kind: 'member' },
    { value: 'submitter.department', label: '提交人 / 部门', kind: 'department' },
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
  };
}

function defaultCondition(field: WorkflowConditionField = 'amount'): WorkflowCondition {
  if (field === 'currency') {
    return {
      id: createId('cond'),
      field,
      operator: 'eq',
      value: '¥',
    };
  }

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
    approvalSteps: [],
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
    const isGreaterThanOrEqual = text.includes('>=');
    const isGreaterThan = !isGreaterThanOrEqual && text.includes('>');
    const isLessThan = text.includes('<') && !text.includes('<=');
    return {
      id: createId('cond'),
      field: 'amount',
      operator: isGreaterThanOrEqual ? 'gte' : isGreaterThan ? 'gt' : isLessThan ? 'lt' : 'lte',
      ...(isGreaterThanOrEqual || isGreaterThan ? { amountMin: numbers[0] } : { amountMax: numbers[0] }),
      expression: text,
    };
  }

  return defaultCondition();
}

function legacyNodeToStep(node: WorkflowNode, index: number): ApprovalStep {
  const legacyRule = (node.rule || { type: 'specified', memberIds: [] }) as ApproverRule & {
    roleGroupId?: string;
    type?: string;
  };
  let approverRule: ApproverRule = { type: 'specific_members', memberIds: [] };

  if (legacyRule.type === 'specified') {
    approverRule = { type: 'specific_members', memberIds: legacyRule.memberIds || [] };
  } else if (String(legacyRule.type) === 'role') {
    approverRule = { type: 'specific_members', memberIds: getLegacyRoleGroupMemberIds(legacyRule.roleGroupId) };
  } else if (legacyRule.type === 'direct_supervisor') {
    approverRule = { type: 'multi_supervisor', supervisorDepth: 1 };
  } else if (legacyRule.type === 'nth_supervisor' || legacyRule.type === 'multi_supervisor') {
    approverRule = {
      type: 'multi_supervisor',
      supervisorDepth: Math.max(1, Number(legacyRule.supervisorDepth || legacyRule.supervisorLevel) || 1),
    };
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
  } else if (rule.type === 'submitter_manager') {
    legacyRule = {
      type: 'direct_supervisor',
      emptyApproverAction: step.emptyApproverAction,
    };
  } else if (rule.type === 'multi_supervisor') {
    legacyRule = {
      type: 'multi_supervisor',
      supervisorDepth: Math.max(1, Number(rule.supervisorDepth) || 1),
      emptyApproverAction: step.emptyApproverAction,
    };
  }

  return {
    id: step.id || createId('node'),
    type: 'approver',
    title: step.name || `审批节点 ${index + 1}`,
    subtitle: rule.type === 'multi_supervisor'
      ? `连续审批：发起人的上 ${Math.max(1, Number(rule.supervisorDepth) || 1)} 级主管`
      : step.approvalMode === 'all_of' ? '所有审批人都需通过' : '任一审批人通过即可',
    rule: legacyRule,
  };
}

function stepToFlowNode(step: ApprovalStep, index: number): WorkflowNode {
  return {
    ...stepToLegacyNode(step, index),
    id: step.id || createId('node'),
    type: 'approver',
    title: step.name || `审批节点 ${index + 1}`,
    rule: step.approverRule,
    approvalMode: step.approvalMode,
    emptyApproverAction: step.emptyApproverAction,
  };
}

function flowNodesFromDraft(draft: WorkflowVersion): WorkflowNode[] {
  if (draft.flowMode !== 'flexible') return [];

  const nodes = Array.isArray(draft.nodes) ? draft.nodes.filter((node) => node.type !== 'start') : [];
  if (nodes.some((node) => node.type === 'approver' || node.type === 'condition' || node.type === 'cc')) {
    return nodes;
  }

  const branches = draft.branches || [];
  const defaultBranch = branches.find((branch) => branch.isDefault) || branches[branches.length - 1];
  const conditionalBranches = branches.filter((branch) => !branch.isDefault);
  if (conditionalBranches.length === 0) {
    return (defaultBranch?.approvalSteps || []).map(stepToFlowNode);
  }

  return [{
    id: createId('flow-condition'),
    type: 'condition',
    title: '条件分化',
    subtitle: '按条件进入不同分支',
    conditions: [
      ...conditionalBranches.map((branch, index) => ({
        id: branch.id,
        title: branch.name || `条件 ${index + 1}`,
        expression: branch.conditions.map(formatCondition).join(' 且 '),
        priority: index + 1,
        isDefault: false,
        workflowConditions: branch.conditions,
        nodes: branch.approvalSteps.map(stepToFlowNode),
      })),
      ...(defaultBranch ? [{
        id: defaultBranch.id,
        title: '默认条件',
        expression: '',
        priority: 999,
        isDefault: true,
        workflowConditions: [],
        nodes: defaultBranch.approvalSteps.map(stepToFlowNode),
      }] : []),
    ],
  }];
}

function collectFlowSteps(nodes: WorkflowNode[]): ApprovalStep[] {
  const steps: ApprovalStep[] = [];
  nodes.forEach((node) => {
    if (node.type === 'approver') {
      steps.push(normalizeStep({
        id: node.id,
        name: node.title,
        approverRule: node.rule || { type: 'specific_members', memberIds: [] },
        approvalMode: node.approvalMode || 'one_of',
        emptyApproverAction: node.emptyApproverAction || 'block_submit',
      }, steps.length));
    } else if (node.type === 'condition') {
      const firstBranch = node.conditions?.find((condition) => !condition.isDefault) || node.conditions?.[0];
      steps.push(...collectFlowSteps(firstBranch?.nodes || []));
    }
  });
  return steps;
}

function collectFlowCcRule(nodes: WorkflowNode[]): CcRule | null {
  for (const node of nodes) {
    if (node.type === 'cc') {
      return {
        ...defaultCcRule(),
        ...(node.ccRule || {}),
        memberIds: node.ccRule?.memberIds || [],
        departmentIds: node.ccRule?.departmentIds || [],
      };
    }
    if (node.type === 'condition') {
      for (const condition of node.conditions || []) {
        const ccRule = collectFlowCcRule(condition.nodes || []);
        if (ccRule) return ccRule;
      }
    }
  }
  return null;
}

function startFlowNode(): WorkflowNode {
  return { id: 'node-start', type: 'start', title: '发起人', subtitle: 'Applicant' };
}

function findFlowNode(nodes: WorkflowNode[], nodeId: string): WorkflowNode | null {
  for (const node of nodes) {
    if (node.id === nodeId) return node;
    if (node.type === 'condition') {
      for (const condition of node.conditions || []) {
        const matched = findFlowNode(condition.nodes || [], nodeId);
        if (matched) return matched;
      }
    }
  }
  return null;
}

function getFlowBranchExpression(conditions: WorkflowCondition[] = []) {
  return conditions.map(formatCondition).join(' 且 ');
}

function branchesFromFlowNodes(nodes: WorkflowNode[]): WorkflowBranch[] {
  const conditionNode = nodes.find((node) => node.type === 'condition');
  if (conditionNode?.conditions?.length) {
    return conditionNode.conditions.map((condition, index) => ({
      id: condition.id || createId('branch'),
      name: condition.title || (condition.isDefault ? 'Default Branch' : `Branch ${index + 1}`),
      isDefault: Boolean(condition.isDefault),
      conditionMode: conditionNode.conditionMode === 'ai' ? 'ai' : 'rules',
      aiBranchRule: conditionNode.aiBranchRule,
      conditions: condition.isDefault
        ? []
        : conditionNode.conditionMode === 'ai'
          ? []
          : (condition.workflowConditions || [parseLegacyCondition(condition.expression)]),
      approvalSteps: collectFlowSteps(condition.nodes || []),
    }));
  }

  return [{
    id: 'branch-default',
    name: 'Default Branch',
    isDefault: true,
    conditions: [],
    approvalSteps: collectFlowSteps(nodes),
  }];
}

function normalizeStep(step: Partial<ApprovalStep> | undefined, index: number): ApprovalStep {
  const rule = step?.approverRule || { type: 'specific_members', memberIds: [] };
  const isLegacyRoleRule = String(rule.type) === 'role_based' || String(rule.type) === 'role';
  const {
    roleGroupId: legacyRoleGroupId,
    roleGroupIds: _legacyRoleGroupIds,
    ...ruleWithoutRoleGroups
  } = rule as ApproverRule & { roleGroupId?: string; roleGroupIds?: string[] };
  const type = String(rule.type) === 'department_manager' || String(rule.type) === 'submitter_manager'
    ? 'multi_supervisor'
    : ['specific_members', 'submitter_manager', 'multi_supervisor'].includes(String(rule.type))
      ? rule.type
      : 'specific_members';

  return {
    id: step?.id || createId('step'),
    name: step?.name || `审批节点 ${index + 1}`,
    approverRule: {
      ...ruleWithoutRoleGroups,
      type,
      ...(type === 'multi_supervisor' ? { supervisorDepth: Math.max(1, Number(rule.supervisorDepth || rule.supervisorLevel) || 1) } : {}),
      memberIds: isLegacyRoleRule ? getLegacyRoleGroupMemberIds(legacyRoleGroupId) : Array.isArray(rule.memberIds) ? rule.memberIds : [],
      departmentIds: Array.isArray(rule.departmentIds) ? rule.departmentIds : [],
    },
    approvalMode: step?.approvalMode === 'all_of' ? 'all_of' : 'one_of',
    emptyApproverAction: step?.emptyApproverAction === 'auto_pass' ? 'auto_pass' : 'block_submit',
  };
}

function normalizeCondition(condition: Partial<WorkflowCondition> | undefined): WorkflowCondition {
  const field = String(condition?.field || 'submitter.department') as WorkflowConditionField;
  const operatorOptions = getConditionOperatorOptions(field);
  const operator = operatorOptions.some((option) => option.value === condition?.operator)
    ? condition?.operator as WorkflowConditionOperator
    : getFallbackConditionOperator(field);

  return {
    id: condition?.id || createId('cond'),
    field,
    operator,
    value: condition?.value,
    currencyValue: condition?.currencyValue,
    amountMin: Number.isFinite(Number(condition?.amountMin)) ? Number(condition?.amountMin) : undefined,
    amountMax: Number.isFinite(Number(condition?.amountMax)) ? Number(condition?.amountMax) : undefined,
    expression: condition?.expression,
  };
}

function getAllowedConditionFields(scope: BusinessScopeOption) {
  return new Set<WorkflowConditionField>([
    'currency',
    'amount',
  ]);
}

function getFallbackConditionField(scope: BusinessScopeOption): WorkflowConditionField {
  return 'amount';
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
    const branches: WorkflowBranch[] = draft.branches.map((branch, index) => ({
      id: branch.id || createId('branch'),
      name: branch.name || (branch.isDefault ? 'Default Branch' : `Branch ${index + 1}`),
      isDefault: Boolean(branch.isDefault),
      conditionMode: branch.conditionMode === 'ai' ? 'ai' as const : 'rules' as const,
      aiBranchRule: branch.aiBranchRule,
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
    || getBusinessScopeOptions().find((option) => option.businessType === draft.businessType)
    || getBusinessScopeOptions()[0];
  const businessType = fallbackScope?.businessType || getBusinessTypeMeta(draft.businessType).value;
  const isFlexibleFlow = draft.flowMode === 'flexible';
  const normalizedBranches = normalizeBranches(draft).map((branch) => (
    branch.isDefault ? branch : {
      ...branch,
      conditions: branch.conditions.map((condition) => rebaseConditionToScope(condition, fallbackScope)),
    }
  ));
  const branches = isFlexibleFlow ? normalizedBranches : [defaultBranch()];

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
      timing: 'workflow_completed',
    },
    flowMode: isFlexibleFlow ? 'flexible' : undefined,
    nodes: isFlexibleFlow && Array.isArray(draft.nodes) ? draft.nodes : [],
  };
}

function prepareDraftForSave(draft: WorkflowVersion): WorkflowVersion {
  const nextDraft = normalizeDraftForEditor(draft);
  const flowNodes = flowNodesFromDraft(nextDraft);
  const scope = getBusinessScopeByNames(nextDraft.basic.moduleName, nextDraft.basic.approvalTypeName);
  const generatedName = getGeneratedWorkflowName(scope || {
    approvalTypeName: nextDraft.basic.approvalTypeName || '通用审批',
  });
  const legacyNodes: WorkflowNode[] = [
    startFlowNode(),
    ...flowNodes,
  ];

  return {
    ...nextDraft,
    basic: {
      ...nextDraft.basic,
      name: generatedName,
    },
    flowMode: 'flexible',
    branches: branchesFromFlowNodes(flowNodes),
    ccRule: collectFlowCcRule(flowNodes) || defaultCcRule(),
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

function collectAiConditionBranchIds(nodes: WorkflowNode[] = [], branchIds = new Set<string>()) {
  nodes.forEach((node) => {
    if (node.type !== 'condition') return;
    if (node.conditionMode === 'ai') {
      (node.conditions || []).forEach((condition) => branchIds.add(condition.id));
    }
    (node.conditions || []).forEach((condition) => collectAiConditionBranchIds(condition.nodes || [], branchIds));
  });
  return branchIds;
}

function validateDraft(draft: WorkflowVersion | null): ValidationState {
  const state = createValidationState();
  if (!draft) return state;

  const submitPermission = draft.submitPermission || defaultSubmitPermission();
  const hasSubmitScope = submitPermission.type === 'all_members'
    || (submitPermission.type === 'members' && submitPermission.memberIds.length > 0)
    || (submitPermission.type === 'departments' && submitPermission.departmentIds.length > 0);
  if (!hasSubmitScope) {
    addValidationError(state, 'submit', '至少配置一个提交权限范围');
  }

  const branches = draft.branches || [];
  const aiBranchIds = collectAiConditionBranchIds(flowNodesFromDraft(draft));
  if (!branches.some((branch) => branch.isDefault)) {
    addValidationError(state, 'branches', '必须包含 default branch');
  }

  branches.forEach((branch, branchIndex) => {
    const branchLabel = branch.name || `Branch ${branchIndex + 1}`;
    const isAiBranch = branch.conditionMode === 'ai' || aiBranchIds.has(branch.id);
    if (!branch.isDefault && !isAiBranch) {
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
          } else if (['lt', 'lte'].includes(condition.operator) && !Number.isFinite(Number(condition.amountMax))) {
            addValidationError(state, 'branches', `${branchLabel} 数值上限必须填写有效数字`, branch.id);
          } else if (['gt', 'gte'].includes(condition.operator) && !Number.isFinite(Number(condition.amountMin))) {
            addValidationError(state, 'branches', `${branchLabel} 数值下限必须填写有效数字`, branch.id);
          } else if (['eq', 'neq'].includes(condition.operator) && !Number.isFinite(Number(condition.value))) {
            addValidationError(state, 'branches', `${branchLabel} 条件值必须填写有效数字`, branch.id);
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
    const currencyText = condition.currencyValue ? ` 且 币种 = ${condition.currencyValue}` : '';
    if (condition.operator === 'between') return `${fieldLabel} > ${condition.amountMin ?? '?'} 且 <= ${condition.amountMax ?? '?'}${currencyText}`;
    if (condition.operator === 'lt') return `${fieldLabel} < ${condition.amountMax ?? '?'}${currencyText}`;
    if (condition.operator === 'gt') return `${fieldLabel} > ${condition.amountMin ?? '?'}${currencyText}`;
    if (condition.operator === 'gte') return `${fieldLabel} >= ${condition.amountMin ?? '?'}${currencyText}`;
    if (condition.operator === 'lte') return `${fieldLabel} <= ${condition.amountMax ?? '?'}${currencyText}`;
    if (condition.operator === 'neq') return `${fieldLabel} != ${condition.value || '?'}${currencyText}`;
    return `${fieldLabel} = ${condition.value || '?'}${currencyText}`;
  }

  const operator = conditionOperatorOptions.find((item) => item.value === condition.operator)?.label.split(' ')[0] || '=';
  return `${fieldLabel} ${operator} ${condition.value || '?'}`;
}

function formatStepRule(step: ApprovalStep, directory: OrganizationDirectory) {
  const rule = step.approverRule;
  if (rule.type === 'multi_supervisor') return getSupervisorDepthLabel(rule);
  if (rule.type === 'submitter_manager') return '发起人的上级';
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

function formatPreviewSubmitter(member: OrganizationDirectory['members'][number] | null, directory: OrganizationDirectory) {
  if (!member) return '暂无可预览申请人';

  const departmentName = directory.departments.find((department) => department.id === member.departmentId)?.name;
  return [member.name, departmentName, member.title].filter(Boolean).join(' · ');
}

function getBranchTitle(branch: WorkflowBranch) {
  return branch.isDefault ? 'Default Branch' : branch.name;
}

type DesignerSelection =
  | { type: 'submit' }
  | { type: 'branch'; branchId: string }
  | { type: 'step'; branchId: string; stepId: string }
  | { type: 'flow-node'; nodeId: string }
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
  if (type === 'multi_supervisor') return '发起人的多级上级';
  if (type === 'submitter_manager') return '发起人的上级';
  return '指定成员';
}

function getSupervisorDepthLabel(rule: ApproverRule) {
  if (rule.type !== 'multi_supervisor') return getApproverTypeLabel(rule.type);
  const depth = Math.max(1, Number(rule.supervisorDepth) || 1);
  return depth === 1 ? '发起人的直属上级' : `发起人的上 ${depth} 级主管`;
}

function getSupervisorLevelLabel(level: number) {
  const numerals = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  const normalizedLevel = Math.max(1, Number(level) || 1);
  return `第${numerals[normalizedLevel - 1] || normalizedLevel}级主管`;
}

function getEligibleSubmitterMembers(permission: SubmitPermissionRule, directory: OrganizationDirectory) {
  const excludedMemberIds = new Set(permission.excludedMemberIds || []);
  return directory.members.filter((member) => {
    if (member.enabled === false || excludedMemberIds.has(member.id)) return false;
    if (permission.type === 'members') return permission.memberIds.includes(member.id);
    if (permission.type === 'departments') return permission.departmentIds.includes(member.departmentId);
    return true;
  });
}

function getSupervisorChainPreview(
  directory: OrganizationDirectory,
  submitterId: string,
  depth: number,
) {
  const membersById = new Map(directory.members.map((member) => [member.id, member]));
  const submitter = membersById.get(submitterId) || null;
  const chain: Array<{ level: number; label: string; name: string; isMissing: boolean }> = [];
  let current = submitter;
  const maxDepth = Math.max(1, Number(depth) || 1);

  for (let index = 0; index < maxDepth; index += 1) {
    const supervisor = current?.supervisorId ? membersById.get(current.supervisorId) : null;
    const level = index + 1;
    chain.push({
      level,
      label: getSupervisorLevelLabel(level),
      name: supervisor?.name || '未配置',
      isMissing: !supervisor,
    });
    current = supervisor || null;
  }

  return { submitter, chain };
}

function SupervisorChainPreview({
  rule,
  directory,
  previewSubmitter,
  previewKey,
  compact = false,
}: {
  rule: ApproverRule;
  directory: OrganizationDirectory;
  previewSubmitter: OrganizationDirectory['members'][number] | null;
  previewKey: string;
  compact?: boolean;
}) {
  if (rule.type !== 'multi_supervisor') return null;

  const depth = Math.max(1, Number(rule.supervisorDepth) || 1);
  if (!previewSubmitter) {
    return (
      <div className="mt-3 rounded-md bg-lightest-gray-background px-3 py-2 text-[11px] font-bold text-medium-gray">
        暂无可预览的发起人
      </div>
    );
  }

  const preview = getSupervisorChainPreview(directory, previewSubmitter.id, depth);
  return (
    <div className={cn(
      "mt-3 space-y-2 rounded-md bg-lightest-gray-background px-3 py-2",
      compact ? "text-[10px]" : "text-[11px]"
    )}>
      <p className="text-[10px] font-black text-light-gray">
        {depth}级直接主管 · 以 {preview.submitter?.name || previewSubmitter.name} 预览
      </p>
      <div className="space-y-1.5">
        {preview.chain.map((item) => (
          <div
            key={`${previewKey}-supervisor-${item.level}`}
            className={cn(
              "flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 font-black",
              compact ? "text-[10px]" : "text-[11px]",
              item.isMissing
                ? "border-transparent bg-[#ffebee] text-[#c62828]"
                : "border-border-silver bg-white text-midnight-graphite"
            )}
          >
            <span className="shrink-0 text-medium-gray">{item.label}</span>
            <span className="min-w-0 truncate">{item.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function getApprovalModeLabel(mode: ApprovalMode) {
  return mode === 'all_of' ? '会签：所有人通过' : '或签：任一人通过';
}

function getEmptyApproverActionLabel(action: ApprovalStep['emptyApproverAction']) {
  return action === 'auto_pass' ? '找不到审批人时自动跳过' : '找不到审批人时报错';
}

type FlowAnchorSide = 'top' | 'bottom' | 'left' | 'right';
type FlowPoint = { x: number; y: number };
type FlowNodeBox = { x: number; y: number; width: number; height: number };

const FLOW_EDGE_COLOR = '#CBD5E1';
const FLOW_EDGE_STROKE = 2;
const FLOW_ARROW_WIDTH = 10;
const FLOW_ARROW_HEIGHT = 7;
const FLOW_BRANCH_CARD_WIDTH = 300;
const FLOW_BRANCH_GAP = 180;

function getNodeAnchor(node: FlowNodeBox, side: FlowAnchorSide): FlowPoint {
  switch (side) {
    case 'top':
      return { x: node.x + node.width / 2, y: node.y };
    case 'bottom':
      return { x: node.x + node.width / 2, y: node.y + node.height };
    case 'left':
      return { x: node.x, y: node.y + node.height / 2 };
    case 'right':
      return { x: node.x + node.width, y: node.y + node.height / 2 };
    default:
      return { x: node.x + node.width / 2, y: node.y + node.height / 2 };
  }
}

function buildOrthogonalPath(
  start: FlowPoint,
  end: FlowPoint,
  options: { viaY?: number; radius?: number } = {},
) {
  const radius = options.radius ?? 12;

  if (Math.abs(start.x - end.x) < 0.1) {
    return `M ${start.x} ${start.y} V ${end.y}`;
  }

  const viaY = options.viaY ?? start.y + (end.y - start.y) / 2;
  const directionX = end.x > start.x ? 1 : -1;
  const directionY = end.y > viaY ? 1 : -1;
  const firstRadius = Math.min(radius, Math.abs(end.x - start.x) / 2, Math.abs(viaY - start.y));
  const secondRadius = Math.min(radius, Math.abs(end.x - start.x) / 2, Math.abs(end.y - viaY));

  return [
    `M ${start.x} ${start.y}`,
    `V ${viaY - firstRadius}`,
    `Q ${start.x} ${viaY} ${start.x + directionX * firstRadius} ${viaY}`,
    `H ${end.x - directionX * secondRadius}`,
    `Q ${end.x} ${viaY} ${end.x} ${viaY + directionY * secondRadius}`,
    `V ${end.y}`,
  ].join(' ');
}

function renderArrowMarker(id: string) {
  return (
    <marker
      id={id}
      markerHeight={FLOW_ARROW_HEIGHT}
      markerUnits="userSpaceOnUse"
      markerWidth={FLOW_ARROW_WIDTH}
      orient="auto"
      refX={FLOW_ARROW_WIDTH}
      refY={FLOW_ARROW_HEIGHT / 2}
    >
      <path d={`M 0 0 L ${FLOW_ARROW_WIDTH} ${FLOW_ARROW_HEIGHT / 2} L 0 ${FLOW_ARROW_HEIGHT} Z`} fill={FLOW_EDGE_COLOR} />
    </marker>
  );
}

function FlowConnectorLayer({
  width,
  height,
  paths,
  arrows,
  className,
}: {
  width: number;
  height: number;
  paths: string[];
  arrows?: FlowPoint[];
  className?: string;
}) {
  return (
    <div className={cn("pointer-events-none absolute left-0 top-0 w-full", className)}>
      <svg
        aria-hidden="true"
        className="h-full w-full overflow-visible"
        preserveAspectRatio="none"
        viewBox={`0 0 ${width} ${height}`}
      >
        <g
          fill="none"
          stroke={FLOW_EDGE_COLOR}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={FLOW_EDGE_STROKE}
          vectorEffect="non-scaling-stroke"
        >
          {paths.map((path, index) => (
            <path key={`${path}-${index}`} d={path} />
          ))}
        </g>
      </svg>
      {arrows?.map((point, index) => (
        <svg
          key={`${point.x}-${point.y}-${index}`}
          aria-hidden="true"
          className="absolute overflow-visible"
          style={{
            height: FLOW_ARROW_HEIGHT,
            left: `calc(${(point.x / width) * 100}% - ${FLOW_ARROW_WIDTH / 2}px)`,
            top: `calc(${(point.y / height) * 100}% - 1px)`,
            width: FLOW_ARROW_WIDTH,
          }}
          viewBox={`0 0 ${FLOW_ARROW_WIDTH} ${FLOW_ARROW_HEIGHT}`}
        >
          <path d={`M 0 0 L ${FLOW_ARROW_WIDTH} 0 L ${FLOW_ARROW_WIDTH / 2} ${FLOW_ARROW_HEIGHT} Z`} fill={FLOW_EDGE_COLOR} />
        </svg>
      ))}
    </div>
  );
}

function FlowConnector({ compact = false }: { compact?: boolean }) {
  const arrowId = React.useId();
  const height = compact ? 48 : 68;

  return (
    <div className={cn("flex flex-col items-center", compact ? "h-12" : "h-[68px]")}>
      <svg
        aria-hidden="true"
        className="h-full w-4 overflow-visible"
        preserveAspectRatio="none"
        viewBox={`0 0 16 ${height}`}
      >
        <defs>
          {renderArrowMarker(arrowId)}
        </defs>
        <path
          d={`M 8 0 V ${height - 8}`}
          fill="none"
          markerEnd={`url(#${arrowId})`}
          stroke={FLOW_EDGE_COLOR}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={FLOW_EDGE_STROKE}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

function FlowBranchRail({ count }: { count: number }) {
  if (count <= 1) return null;

  const width = count * FLOW_BRANCH_CARD_WIDTH + (count - 1) * FLOW_BRANCH_GAP;
  const height = 88;
  const cardStep = FLOW_BRANCH_CARD_WIDTH + FLOW_BRANCH_GAP;
  const firstCenter = FLOW_BRANCH_CARD_WIDTH / 2;
  const lastCenter = firstCenter + (count - 1) * cardStep;
  const branchCenters = Array.from({ length: count }, (_, index) => firstCenter + index * cardStep);
  const splitY = 38;
  const arrowY = height - FLOW_ARROW_HEIGHT - 2;

  return (
    <FlowConnectorLayer
      arrows={branchCenters.map((center) => ({ x: center, y: arrowY }))}
      className="top-0 h-[88px]"
      height={height}
      paths={[
        buildOrthogonalPath({ x: width / 2, y: 0 }, { x: width / 2, y: splitY }),
        `M ${firstCenter} ${splitY} H ${lastCenter}`,
        ...branchCenters.map((center) => buildOrthogonalPath({ x: center, y: splitY }, { x: center, y: arrowY })),
      ]}
      width={width}
    />
  );
}

const FlowBranchLane: React.FC<{
  showBottomConnector: boolean;
  children: React.ReactNode;
}> = ({
  showBottomConnector,
  children,
}) => {
  const arrowId = React.useId();
  const height = 56;

  return (
    <div className="relative mx-auto flex h-full w-[300px] min-w-[300px] flex-col items-center">
      <div className="relative z-10 flex w-full flex-col items-center">
        {children}
      </div>
      {showBottomConnector && (
        <svg
          aria-hidden="true"
          className="min-h-14 flex-1 w-4 overflow-visible"
          preserveAspectRatio="none"
          viewBox={`0 0 16 ${height}`}
        >
          <defs>
            {renderArrowMarker(arrowId)}
          </defs>
          <path
            d={`M 8 0 V ${height - 8}`}
            fill="none"
            markerEnd={`url(#${arrowId})`}
            stroke={FLOW_EDGE_COLOR}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={FLOW_EDGE_STROKE}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}
    </div>
  );
};

function FlowMergeRail({ count }: { count: number }) {
  if (count <= 1) return <FlowConnector />;

  const width = count * FLOW_BRANCH_CARD_WIDTH + (count - 1) * FLOW_BRANCH_GAP;
  const height = 88;
  const cardStep = FLOW_BRANCH_CARD_WIDTH + FLOW_BRANCH_GAP;
  const firstCenter = FLOW_BRANCH_CARD_WIDTH / 2;
  const lastCenter = firstCenter + (count - 1) * cardStep;
  const mergeY = 34;
  const arrowY = height - FLOW_ARROW_HEIGHT - 2;

  return (
    <div className="relative h-[88px]" style={{ width: `${width}px` }}>
      <FlowConnectorLayer
        arrows={[{ x: width / 2, y: arrowY }]}
        height={height}
        paths={[
          `M ${firstCenter} ${mergeY} H ${lastCenter}`,
          buildOrthogonalPath({ x: width / 2, y: mergeY }, { x: width / 2, y: arrowY }),
        ]}
        width={width}
      />
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

function FlowInsertButton({
  onApproval,
  onCondition,
  onAiCondition,
  onCc,
}: {
  onApproval: () => void;
  onCondition: (branchCount: number) => void;
  onAiCondition: (branchCount: number) => void;
  onCc: () => void;
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const items = [
    { label: '添加审批', icon: <CheckCircle2 size={14} strokeWidth={2.4} />, onClick: onApproval },
    { label: '添加抄送', icon: <Send size={14} strokeWidth={2.4} />, onClick: onCc },
  ];

  return (
    <div className="relative z-20">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="h-8 w-8 rounded-full border border-border-silver bg-white text-interactive-blue shadow-sm transition-all hover:scale-105 hover:border-interactive-blue hover:shadow-md flex items-center justify-center"
        aria-label="添加流程节点"
      >
        <Plus size={15} strokeWidth={3} />
      </button>
      {isOpen && (
        <div className="absolute left-1/2 top-10 w-56 -translate-x-1/2 rounded-2xl border border-border-silver bg-white/95 p-1.5 shadow-xl shadow-black/10 backdrop-blur">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                item.onClick();
                setIsOpen(false);
              }}
              className="flex h-9 w-full items-center gap-2 rounded-xl px-3 text-left text-[12px] font-black text-midnight-graphite transition-colors hover:bg-lightest-gray-background"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-canvas-white text-medium-gray">
                {item.icon}
              </span>
              {item.label}
            </button>
          ))}
          <div className="my-1 h-px bg-border-silver" />
          {[
            { label: '添加条件分化', icon: <GitBranch size={14} strokeWidth={2.4} />, onClick: onCondition },
            { label: '添加 AI 条件分化', icon: <Bot size={14} strokeWidth={2.4} />, onClick: onAiCondition },
          ].map((group) => (
            <div key={group.label} className="px-1 py-1">
              <div className="flex items-center gap-2 px-2 py-1 text-[11px] font-black text-medium-gray">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-canvas-white text-medium-gray">
                  {group.icon}
                </span>
                {group.label}
              </div>
              <div className="mt-1 grid grid-cols-5 gap-1">
                {FLOW_BRANCH_COUNT_OPTIONS.map((count) => (
                  <button
                    key={`${group.label}-${count}`}
                    type="button"
                    onClick={() => {
                      group.onClick(count);
                      setIsOpen(false);
                    }}
                    className="h-8 rounded-lg bg-lightest-gray-background text-[12px] font-black text-midnight-graphite transition-colors hover:bg-[#e7f1ff] hover:text-interactive-blue"
                  >
                    {count}层
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
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
    approval: 'border-[#e2b56c] bg-white',
    condition: 'border-[#79a87b] bg-[#fbfff7]',
    cc: 'border-[#6697d4] bg-[#f7fbff]',
    end: 'border-border-silver bg-white',
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-lg border p-0 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-sky-blue-highlight",
        toneClass,
        selected && "ring-2 ring-interactive-blue ring-offset-2",
        hasError && "border-[#c62828] bg-[#fffafa]"
      )}
    >
      <div className={cn(
        "h-7 rounded-t-[6px] px-3 flex items-center justify-between text-[11px] font-black",
        tone === 'approval' && "bg-[#fff7e6] text-[#8a5a12]",
        tone === 'submit' && "bg-[#7d89b0] text-white",
        tone === 'condition' && "bg-[#edf7ed] text-[#2e7d32]",
        tone === 'cc' && "bg-[#e7f1ff] text-[#2267ad]",
        tone === 'end' && "bg-lightest-gray-background text-medium-gray"
      )}>
        <span>{kicker}</span>
        {hasError && <AlertCircle size={14} />}
      </div>
      <div className="p-3">
        <div className="flex items-start gap-2.5">
          <span className={cn(
            "mt-0.5 h-8 w-8 rounded-full flex shrink-0 items-center justify-center",
            tone === 'approval' && "bg-[#fff7e6] text-[#8a5a12]",
            tone === 'submit' && "bg-lightest-gray-background text-midnight-graphite",
            tone === 'condition' && "bg-[#edf7ed] text-[#2e7d32]",
            tone === 'cc' && "bg-[#e7f1ff] text-[#2267ad]",
            tone === 'end' && "bg-lightest-gray-background text-medium-gray"
          )}>
            {icon}
          </span>
          <span className="min-w-0">
            <span className="block text-[14px] font-black text-midnight-graphite truncate">{title}</span>
            <span className="mt-1 block text-[11px] font-bold text-medium-gray leading-5">{subtitle}</span>
            {meta && <span className="hidden">{meta}</span>}
          </span>
        </div>
        {children}
      </div>
    </button>
  );
}

type FlowInsertKind = 'approval' | 'condition' | 'ai-condition' | 'cc';
const FLOW_BRANCH_COUNT_OPTIONS = [2, 3, 4, 5, 6];

function clampFlowBranchCount(value: number) {
  const min = FLOW_BRANCH_COUNT_OPTIONS[0];
  const max = FLOW_BRANCH_COUNT_OPTIONS[FLOW_BRANCH_COUNT_OPTIONS.length - 1];
  return Math.max(min, Math.min(max, Number(value) || min));
}

function getAiBranchLetter(index: number) {
  return String.fromCharCode(65 + index);
}

function createConditionBranch(
  isAiCondition: boolean,
  index: number,
  totalCount: number,
  field: WorkflowConditionField,
): WorkflowConditionBranch {
  const isDefault = index === totalCount - 1;
  const condition = defaultCondition(field);
  const aiLetter = getAiBranchLetter(index);

  if (isAiCondition) {
    return {
      id: createId(isDefault ? 'flow-else' : 'flow-branch'),
      title: `${aiLetter} 分支`,
      expression: isDefault ? `AI 选择 ${aiLetter}，或 AI 失败时兜底` : `AI 选择 ${aiLetter}`,
      priority: isDefault ? 999 : index + 1,
      isDefault,
      aiDescription: isDefault
        ? `未选择其他分支，或 AI 无法判断时进入 ${aiLetter} 分支`
        : `符合 AI 判断规则时进入 ${aiLetter} 分支`,
      workflowConditions: [],
      nodes: [],
    };
  }

  return {
    id: createId(isDefault ? 'flow-else' : 'flow-branch'),
    title: isDefault ? '其余情况' : `条件 ${index + 1}`,
    expression: isDefault ? '' : formatCondition(condition),
    priority: isDefault ? 999 : index + 1,
    isDefault,
    workflowConditions: isDefault ? [] : [condition],
    nodes: [],
  };
}

function createConditionBranches(isAiCondition: boolean, branchCount: number, field: WorkflowConditionField) {
  const totalCount = clampFlowBranchCount(branchCount);
  return Array.from({ length: totalCount }, (_, index) => createConditionBranch(isAiCondition, index, totalCount, field));
}

function resizeConditionBranches(
  branches: WorkflowConditionBranch[] = [],
  isAiCondition: boolean,
  branchCount: number,
  field: WorkflowConditionField,
) {
  const totalCount = clampFlowBranchCount(branchCount);
  const conditionCount = totalCount - 1;
  const conditionalBranches = branches.filter((branch) => !branch.isDefault);
  const defaultBranch = branches.find((branch) => branch.isDefault);
  const nextConditionalBranches = Array.from({ length: conditionCount }, (_, index) => {
    const existing = conditionalBranches[index];
    if (existing) {
      return {
        ...existing,
        title: existing.title || (isAiCondition ? `${getAiBranchLetter(index)} 分支` : `条件 ${index + 1}`),
        expression: existing.expression || (isAiCondition ? `AI 选择 ${getAiBranchLetter(index)}` : getFlowBranchExpression(existing.workflowConditions || [])),
        priority: index + 1,
        isDefault: false,
      };
    }
    return createConditionBranch(isAiCondition, index, totalCount, field);
  });

  const fallbackBranch = defaultBranch
    ? {
        ...defaultBranch,
        title: defaultBranch.title || (isAiCondition ? `${getAiBranchLetter(totalCount - 1)} 分支` : '其余情况'),
        expression: defaultBranch.expression || (isAiCondition ? `AI 选择 ${getAiBranchLetter(totalCount - 1)}，或 AI 失败时兜底` : ''),
        priority: 999,
        isDefault: true,
        workflowConditions: [],
      }
    : createConditionBranch(isAiCondition, totalCount - 1, totalCount, field);

  return [...nextConditionalBranches, fallbackBranch];
}

function FlowGap({
  onInsert,
  compact,
}: {
  onInsert: (kind: FlowInsertKind, branchCount?: number) => void;
  compact?: boolean;
}) {
  return (
    <>
      <FlowConnector compact={compact} />
      <FlowInsertButton
        onApproval={() => onInsert('approval')}
        onCondition={(branchCount) => onInsert('condition', branchCount)}
        onAiCondition={(branchCount) => onInsert('ai-condition', branchCount)}
        onCc={() => onInsert('cc')}
      />
      <FlowConnector compact={compact} />
    </>
  );
}

function getFlowNodeTone(node: WorkflowNode): 'approval' | 'condition' | 'cc' {
  if (node.type === 'condition') return 'condition';
  if (node.type === 'cc') return 'cc';
  return 'approval';
}

function getFlowNodeIcon(node: WorkflowNode) {
  if (node.type === 'condition' && node.conditionMode === 'ai') return <Bot size={17} strokeWidth={2.5} />;
  if (node.type === 'condition') return <GitBranch size={17} strokeWidth={2.5} />;
  if (node.type === 'cc') return <Send size={17} strokeWidth={2.5} />;
  return <CheckCircle2 size={17} strokeWidth={2.5} />;
}

function getFlowNodeSubtitle(node: WorkflowNode, directory: OrganizationDirectory) {
  if (node.type === 'condition' && node.conditionMode === 'ai') return `AI 二选一 · ${node.conditions?.length || 0} 个分支`;
  if (node.type === 'condition') return `${node.conditions?.length || 0} 个分支`;
  if (node.type === 'cc') {
    const rule = node.ccRule || defaultCcRule();
    return [
      rule.memberIds.length ? `${rule.memberIds.length} 个成员` : '',
      rule.departmentIds.length ? `${rule.departmentIds.length} 个部门` : '',
    ].filter(Boolean).join('、') || '到达这里时抄送';
  }
  return formatStepRule({
    id: node.id,
    name: node.title,
    approverRule: node.rule || { type: 'specific_members', memberIds: [] },
    approvalMode: node.approvalMode || 'one_of',
    emptyApproverAction: node.emptyApproverAction || 'block_submit',
  }, directory);
}

function FlowSequence({
  nodes,
  path,
  directory,
  previewSubmitter,
  selection,
  onSelect,
  onInsert,
}: {
  nodes: WorkflowNode[];
  path: string[];
  directory: OrganizationDirectory;
  previewSubmitter: OrganizationDirectory['members'][number] | null;
  selection: DesignerSelection;
  onSelect: (selection: DesignerSelection) => void;
  onInsert: (path: string[], index: number, kind: FlowInsertKind, branchCount?: number) => void;
}) {
  return (
    <div className="flex w-full flex-col items-center">
      <FlowGap compact onInsert={(kind, branchCount) => onInsert(path, 0, kind, branchCount)} />
      {nodes.map((node, index) => (
        <React.Fragment key={node.id}>
          <div className="w-[300px]">
            <FlowNode
              tone={getFlowNodeTone(node)}
              kicker={node.type === 'condition' ? (node.conditionMode === 'ai' ? 'AI 条件分化' : '条件分化') : node.type === 'cc' ? '抄送' : `审批 ${index + 1}`}
              title={node.title || (node.type === 'condition' ? (node.conditionMode === 'ai' ? 'AI 条件分化' : '条件分化') : node.type === 'cc' ? '抄送对象' : `审批节点 ${index + 1}`)}
              subtitle={getFlowNodeSubtitle(node, directory)}
              icon={getFlowNodeIcon(node)}
              selected={selection.type === 'flow-node' && selection.nodeId === node.id}
              onClick={() => onSelect({ type: 'flow-node', nodeId: node.id })}
            >
              {node.type === 'approver' && (
                <SupervisorChainPreview
                  rule={node.rule || { type: 'specific_members', memberIds: [] }}
                  directory={directory}
                  previewSubmitter={previewSubmitter}
                  previewKey={node.id}
                  compact
                />
              )}
            </FlowNode>
          </div>

          {node.type === 'condition' && (
            <div className="relative my-1 pt-[72px]">
              <FlowBranchRail count={Math.max(1, node.conditions?.length || 0)} />
              <div
                className="relative grid items-start"
                style={{
                  columnGap: `${FLOW_BRANCH_GAP}px`,
                  gridTemplateColumns: `repeat(${Math.max(1, node.conditions?.length || 0)}, ${FLOW_BRANCH_CARD_WIDTH}px)`,
                }}
              >
                {(node.conditions || []).map((condition, conditionIndex) => (
                  <FlowBranchLane key={condition.id} showBottomConnector={(node.conditions?.length || 0) > 1}>
                    <FlowNode
                      tone="condition"
                      kicker={condition.isDefault ? '其余情况' : `条件 ${conditionIndex + 1}`}
                      title={condition.title || (condition.isDefault ? '其余情况' : `条件 ${conditionIndex + 1}`)}
                      subtitle={condition.isDefault ? '未命中其他条件' : condition.expression || '点击右侧配置条件'}
                      icon={<GitBranch size={17} strokeWidth={2.5} />}
                    />
                    <FlowSequence
                      nodes={condition.nodes || []}
                      path={[...path, condition.id]}
                      directory={directory}
                      previewSubmitter={previewSubmitter}
                      selection={selection}
                      onSelect={onSelect}
                      onInsert={onInsert}
                    />
                  </FlowBranchLane>
                ))}
              </div>
              <FlowMergeRail count={Math.max(1, node.conditions?.length || 0)} />
            </div>
          )}

          <FlowGap compact onInsert={(kind, branchCount) => onInsert(path, index + 1, kind, branchCount)} />
        </React.Fragment>
      ))}
    </div>
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
  selectedFlowNode,
  fieldOptions,
  memberOptions,
  departmentOptions,
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
  flowNodes,
  onInsertFlowNode,
  onUpdateFlowNode,
  onUpdateFlowConditionBranchCount,
  onUpdateFlowBranch,
  onAddFlowBranchCondition,
  onRemoveFlowBranchCondition,
  onUpdateFlowBranchCondition,
  onRemoveFlowNode,
}: {
  draft: WorkflowVersion;
  directory: OrganizationDirectory;
  submitPermission: SubmitPermissionRule;
  ccRule: CcRule;
  branches: WorkflowBranch[];
  validation: ValidationState;
  selection: DesignerSelection;
  selectedFlowNode: WorkflowNode | null;
  fieldOptions: ConditionFieldOption[];
  memberOptions: Array<{ value: string; label: string }>;
  departmentOptions: Array<{ value: string; label: string }>;
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
  flowNodes: WorkflowNode[];
  onInsertFlowNode: (path: string[], index: number, kind: FlowInsertKind, branchCount?: number) => void;
  onUpdateFlowNode: (nodeId: string, patch: Partial<WorkflowNode>) => void;
  onUpdateFlowConditionBranchCount: (nodeId: string, branchCount: number) => void;
  onUpdateFlowBranch: (nodeId: string, branchId: string, patch: Partial<WorkflowConditionBranch>) => void;
  onAddFlowBranchCondition: (nodeId: string, branchId: string) => void;
  onRemoveFlowBranchCondition: (nodeId: string, branchId: string, conditionId: string) => void;
  onUpdateFlowBranchCondition: (nodeId: string, branchId: string, conditionId: string, patch: Partial<WorkflowCondition>) => void;
  onRemoveFlowNode: (nodeId: string) => void;
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
  const branchFlowWidth = flowBranches.length > 0
    ? flowBranches.length * FLOW_BRANCH_CARD_WIDTH + Math.max(0, flowBranches.length - 1) * FLOW_BRANCH_GAP
    : FLOW_BRANCH_CARD_WIDTH;
  const activeSelection: DesignerSelection = (
    (selection.type === 'branch' && selectedBranch)
    || (selection.type === 'step' && selectedStep)
    || selection.type === 'flow-node'
    || selection.type === 'cc'
  ) ? selection : submitDesignerSelection;
  const panStartRef = React.useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const [isPanning, setIsPanning] = React.useState(false);
  const canvasMinWidth = Math.max(1080, branchFlowWidth + 160);
  const canvasContentHeight = 980;
  const fullscreenDesignerRef = React.useRef<HTMLElement | null>(null);
  const canvasFrameRef = React.useRef<HTMLDivElement | null>(null);
  const canvasContentRef = React.useRef<HTMLDivElement | null>(null);
  const canvasFlowRef = React.useRef<HTMLDivElement | null>(null);
  const [canvasView, setCanvasView] = React.useState({ scale: 1, x: 0, y: 0 });
  const [isCanvasFullscreen, setIsCanvasFullscreen] = React.useState(false);
  const eligibleSubmitters = React.useMemo(
    () => getEligibleSubmitterMembers(submitPermission, directory),
    [submitPermission, directory],
  );
  const [previewSubmitterId, setPreviewSubmitterId] = React.useState('');
  const previewSubmitter = eligibleSubmitters.find((member) => member.id === previewSubmitterId)
    || eligibleSubmitters[0]
    || null;

  React.useEffect(() => {
    if (!previewSubmitterId || !eligibleSubmitters.some((member) => member.id === previewSubmitterId)) {
      setPreviewSubmitterId(eligibleSubmitters[0]?.id || '');
    }
  }, [eligibleSubmitters, previewSubmitterId]);

  const fitWorkflowCanvas = React.useCallback(() => {
    const frame = canvasFrameRef.current;
    const flow = canvasFlowRef.current;
    if (!frame || !flow) return;

    const contentWidth = flow.offsetWidth;
    const contentHeight = flow.offsetHeight;
    if (!contentWidth || !contentHeight) return;

    const paddingX = 72;
    const paddingY = 64;

    const scale = Math.min(
      1.2,
      Math.max(0.36, Math.min((frame.clientWidth - paddingX) / contentWidth, (frame.clientHeight - paddingY) / contentHeight)),
    );

    setCanvasView({
      scale,
      x: (frame.clientWidth - contentWidth * scale) / 2 - flow.offsetLeft * scale,
      y: Math.max(32, (frame.clientHeight - contentHeight * scale) / 2) - flow.offsetTop * scale,
    });
  }, []);

  React.useEffect(() => {
    const frame = window.requestAnimationFrame(fitWorkflowCanvas);
    return () => window.cancelAnimationFrame(frame);
  }, [fitWorkflowCanvas, canvasMinWidth, flowBranches.length, branches.length, flowNodes.length]);

  React.useEffect(() => {
    const handleFullscreenChange = () => {
      setIsCanvasFullscreen(document.fullscreenElement === fullscreenDesignerRef.current);
      window.requestAnimationFrame(fitWorkflowCanvas);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [fitWorkflowCanvas]);

  const zoomWorkflowCanvas = (nextScale: number, clientX?: number, clientY?: number) => {
    const frame = canvasFrameRef.current;
    if (!frame) return;

    setCanvasView((current) => {
      const scale = Math.min(1.65, Math.max(0.35, nextScale));
      const rect = frame.getBoundingClientRect();
      const originX = (clientX ?? rect.left + rect.width / 2) - rect.left;
      const originY = (clientY ?? rect.top + rect.height / 2) - rect.top;
      const contentX = (originX - current.x) / current.scale;
      const contentY = (originY - current.y) / current.scale;

      return {
        scale,
        x: originX - contentX * scale,
        y: originY - contentY * scale,
      };
    });
  };

  const handleCanvasPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;

    const target = event.target as HTMLElement;
    if (target.closest('button, input, select, textarea, a, [role="button"]')) return;

    panStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      left: canvasView.x,
      top: canvasView.y,
    };
    setIsPanning(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const handleCanvasPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const panStart = panStartRef.current;
    if (!panStart) return;

    setCanvasView((current) => ({
      ...current,
      x: panStart.left + event.clientX - panStart.x,
      y: panStart.top + event.clientY - panStart.y,
    }));
  };

  const stopCanvasPan = (event: React.PointerEvent<HTMLDivElement>) => {
    panStartRef.current = null;
    setIsPanning(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const toggleCanvasFullscreen = async () => {
    const designer = fullscreenDesignerRef.current;
    if (!designer) return;

    if (document.fullscreenElement === designer) {
      await document.exitFullscreen();
      return;
    }

    await designer.requestFullscreen();
  };

  return (
    <section
      ref={fullscreenDesignerRef}
      className="diagram-fullscreen-workspace rounded-xl border border-border-silver bg-white shadow-sm overflow-visible"
    >
      <div className="px-5 py-4 border-b border-border-silver flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-black text-white flex items-center justify-center">
            <GitBranch size={18} strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-[18px] font-black">流程设计</h2>
            <p className="hidden">按飞书审批的画布方式配置提交人、条件分支、审批节点和抄送。</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex h-9 items-center gap-2 rounded-full bg-lightest-gray-background px-3 text-[12px] font-bold text-medium-gray">
            <UserRound size={14} strokeWidth={2.4} />
            <span>申请人预览</span>
            {eligibleSubmitters.length > 0 ? (
              <select
                className="bg-transparent text-[12px] font-black text-midnight-graphite outline-none"
                value={previewSubmitter?.id || ''}
                onChange={(event) => setPreviewSubmitterId(event.target.value)}
              >
                {eligibleSubmitters.map((member) => (
                  <option key={member.id} value={member.id}>{member.name}</option>
                ))}
              </select>
            ) : (
              <span className="text-[12px] font-black text-light-gray">暂无成员</span>
            )}
          </label>
        </div>
      </div>

      {validation.sections.branches?.length > 0 && (
        <div className="mx-6 mt-5 rounded-2xl bg-[#ffebee] px-4 py-3 text-[12px] font-bold text-[#c62828]">
          {validation.sections.branches[0]}
        </div>
      )}

      <div className="workflow-designer-grid grid min-h-[680px] items-start lg:grid-cols-[minmax(720px,1fr)_360px]">
        <div
          ref={canvasFrameRef}
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={stopCanvasPan}
          onPointerCancel={stopCanvasPan}
          onWheel={(event) => {
            event.preventDefault();
            zoomWorkflowCanvas(canvasView.scale * (event.deltaY > 0 ? 0.9 : 1.1), event.clientX, event.clientY);
          }}
          className={cn(
            "workflow-canvas-frame relative min-h-[680px] overflow-hidden bg-[#f7f8fa] cursor-grab select-none touch-none",
            isPanning && "cursor-grabbing"
          )}
        >
          <div className="absolute right-5 top-5 z-20 flex items-center gap-1 rounded-full border border-border-silver bg-white/95 p-1 shadow-sm">
            <button type="button" className="h-8 w-8 rounded-full text-medium-gray hover:bg-lightest-gray-background flex items-center justify-center" onClick={() => zoomWorkflowCanvas(canvasView.scale * 0.88)}>
              <Minus size={14} />
            </button>
            <span className="min-w-12 text-center text-[11px] font-black text-medium-gray">{Math.round(canvasView.scale * 100)}%</span>
            <button type="button" className="h-8 w-8 rounded-full text-medium-gray hover:bg-lightest-gray-background flex items-center justify-center" onClick={() => zoomWorkflowCanvas(canvasView.scale * 1.12)}>
              <Plus size={14} />
            </button>
            <button type="button" className="h-8 w-8 rounded-full text-medium-gray hover:bg-lightest-gray-background flex items-center justify-center" onClick={fitWorkflowCanvas}>
              <Crosshair size={14} />
            </button>
            <button
              type="button"
              className="h-8 w-8 rounded-full text-medium-gray hover:bg-lightest-gray-background flex items-center justify-center"
              onClick={toggleCanvasFullscreen}
              title={isCanvasFullscreen ? '退出全屏' : '全屏'}
              aria-label={isCanvasFullscreen ? '退出全屏' : '全屏'}
            >
              {isCanvasFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
          </div>
          <div
            ref={canvasContentRef}
            className="absolute left-0 top-0 px-10 py-8"
            style={{
              minHeight: `${canvasContentHeight}px`,
              minWidth: `${canvasMinWidth}px`,
              backgroundImage: 'radial-gradient(#d9dde5 1px, transparent 1px)',
              backgroundSize: '18px 18px',
              transform: `translate3d(${canvasView.x}px, ${canvasView.y}px, 0) scale(${canvasView.scale})`,
              transformOrigin: '0 0',
            }}
          >
            <div ref={canvasFlowRef} className="mx-auto flex max-w-[1480px] flex-col items-center">
              <div className="w-[300px]">
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
                >
                  <div className="mt-3 flex items-center justify-between gap-2 rounded-md bg-lightest-gray-background px-3 py-2 text-[11px] font-black">
                    <span className="shrink-0 text-light-gray">当前预览</span>
                    <span className="min-w-0 truncate text-midnight-graphite">
                      {formatPreviewSubmitter(previewSubmitter, directory)}
                    </span>
                  </div>
                </FlowNode>
              </div>

              <FlowSequence
                nodes={flowNodes}
                path={[]}
                directory={directory}
                previewSubmitter={previewSubmitter}
                selection={activeSelection}
                onSelect={onSelect}
                onInsert={onInsertFlowNode}
              />
              <div className="w-[180px]">
                <FlowNode
                  tone="end"
                  kicker="结束"
                  title="流程完成"
                  subtitle="完成"
                  icon={<CheckCircle2 size={17} strokeWidth={2.5} />}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="workflow-inspector-panel min-h-0">
          <DesignerInspector
            selection={activeSelection}
            selectedFlowNode={selectedFlowNode}
            selectedBranch={selectedBranch}
            selectedStep={selectedStep}
            branches={branches}
            submitPermission={submitPermission}
            ccRule={ccRule}
            directory={directory}
            validation={validation}
            memberOptions={memberOptions}
            departmentOptions={departmentOptions}
            fieldOptions={fieldOptions}
            previewSubmitter={previewSubmitter}
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
          onUpdateFlowNode={onUpdateFlowNode}
          onUpdateFlowConditionBranchCount={onUpdateFlowConditionBranchCount}
          onUpdateFlowBranch={onUpdateFlowBranch}
          onAddFlowBranchCondition={onAddFlowBranchCondition}
          onRemoveFlowBranchCondition={onRemoveFlowBranchCondition}
          onUpdateFlowBranchCondition={onUpdateFlowBranchCondition}
          onRemoveFlowNode={onRemoveFlowNode}
        />
      </div>
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
    <div className="border-b border-border-silver px-4 py-4">
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-light-gray">{label}</p>
      <h3 className="mt-1 text-[17px] font-black text-midnight-graphite">{title}</h3>
      <p className="hidden">{description}</p>
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
  onUpdateCondition,
}: {
  condition: WorkflowCondition;
  branchId: string;
  memberOptions: Array<{ value: string; label: string }>;
  departmentOptions: Array<{ value: string; label: string }>;
  onUpdateCondition: (branchId: string, conditionId: string, patch: Partial<WorkflowCondition>) => void;
}) {
  const kind = getConditionFieldKind(condition.field);
  const amountCurrencySelect = kind === 'number' ? (
    <select
      className="input-field text-[13px]"
      value={condition.currencyValue || ''}
      onChange={(event) => onUpdateCondition(branchId, condition.id, { currencyValue: event.target.value || undefined })}
    >
      <option value="">不限币种</option>
      <option value="¥">¥</option>
      <option value="$">$</option>
    </select>
  ) : null;

  if (kind === 'currency') {
    return (
      <select
        className="input-field text-[13px]"
        value={condition.value || '¥'}
        onChange={(event) => onUpdateCondition(branchId, condition.id, { value: event.target.value })}
      >
        <option value="¥">¥</option>
        <option value="$">$</option>
      </select>
    );
  }

  if (kind === 'number' && condition.operator === 'between') {
    return (
      <div className="grid grid-cols-3 gap-2">
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
        {amountCurrencySelect}
      </div>
    );
  }

  if (kind === 'number' && ['gt', 'gte'].includes(condition.operator)) {
    return (
      <div className="grid grid-cols-2 gap-2">
        <input
          className="input-field text-[13px]"
          type="number"
          value={condition.amountMin ?? ''}
          onChange={(event) => onUpdateCondition(branchId, condition.id, { amountMin: event.target.value === '' ? undefined : Number(event.target.value) })}
          placeholder="金额下限"
        />
        {amountCurrencySelect}
      </div>
    );
  }

  if (kind === 'number' && ['lt', 'lte'].includes(condition.operator)) {
    return (
      <div className="grid grid-cols-2 gap-2">
        <input
          className="input-field text-[13px]"
          type="number"
          value={condition.amountMax ?? ''}
          onChange={(event) => onUpdateCondition(branchId, condition.id, { amountMax: event.target.value === '' ? undefined : Number(event.target.value) })}
          placeholder="金额上限"
        />
        {amountCurrencySelect}
      </div>
    );
  }

  if (kind === 'number') {
    return (
      <div className="grid grid-cols-2 gap-2">
        <input
          className="input-field text-[13px]"
          type="number"
          value={condition.value || ''}
          onChange={(event) => onUpdateCondition(branchId, condition.id, { value: event.target.value })}
          placeholder={`${getConditionFieldLabel(condition.field)}的值`}
        />
        {amountCurrencySelect}
      </div>
    );
  }

  if (kind === 'department' || kind === 'member') {
    const options = kind === 'department' ? departmentOptions : memberOptions;
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
      type="text"
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
  onRemoveCondition,
  onUpdateCondition,
}: {
  branch: WorkflowBranch;
  condition: WorkflowCondition;
  index: number;
  fieldOptions: ConditionFieldOption[];
  memberOptions: Array<{ value: string; label: string }>;
  departmentOptions: Array<{ value: string; label: string }>;
  onRemoveCondition: (branchId: string, conditionId: string) => void;
  onUpdateCondition: (branchId: string, conditionId: string, patch: Partial<WorkflowCondition>) => void;
}) {
  const operatorOptions = getConditionOperatorOptions(condition.field);

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
        onUpdateCondition={onUpdateCondition}
      />
      <div className="rounded-xl bg-canvas-white px-3 py-2 text-[11px] font-bold text-medium-gray">
        当前规则：{formatCondition(condition)}
      </div>
    </div>
  );
}

function FlowConditionBranchEditor({
  nodeId,
  branch,
  index,
  isAiCondition,
  fieldOptions,
  memberOptions,
  departmentOptions,
  onUpdateFlowBranch,
  onAddFlowBranchCondition,
  onRemoveFlowBranchCondition,
  onUpdateFlowBranchCondition,
}: {
  nodeId: string;
  branch: WorkflowConditionBranch;
  index: number;
  isAiCondition?: boolean;
  fieldOptions: ConditionFieldOption[];
  memberOptions: Array<{ value: string; label: string }>;
  departmentOptions: Array<{ value: string; label: string }>;
  onUpdateFlowBranch: (nodeId: string, branchId: string, patch: Partial<WorkflowConditionBranch>) => void;
  onAddFlowBranchCondition: (nodeId: string, branchId: string) => void;
  onRemoveFlowBranchCondition: (nodeId: string, branchId: string, conditionId: string) => void;
  onUpdateFlowBranchCondition: (nodeId: string, branchId: string, conditionId: string, patch: Partial<WorkflowCondition>) => void;
}) {
  const conditions = branch.workflowConditions || [];
  const editorBranch: WorkflowBranch = {
    id: branch.id,
    name: branch.title,
    isDefault: Boolean(branch.isDefault),
    conditions,
    approvalSteps: [],
  };

  if (branch.isDefault) {
    return (
      <div className="rounded-2xl border border-border-silver bg-white px-4 py-3">
        <p className="text-[13px] font-black text-midnight-graphite">{branch.title || '其余情况'}</p>
        <p className="mt-1 text-[11px] font-bold text-medium-gray">
          {isAiCondition ? 'AI 未选择其他分支，或判断失败时，进入这条兜底分支。' : '其他条件都不命中时，自动进入这条分支。'}
        </p>
        {isAiCondition && (
          <textarea
            className="input-field mt-3 min-h-[76px] resize-none text-[13px]"
            value={branch.aiDescription || ''}
            onChange={(event) => onUpdateFlowBranch(nodeId, branch.id, { aiDescription: event.target.value })}
            placeholder="写给 AI 看的 B 分支说明"
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border-silver bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <label className="min-w-0 flex-1 space-y-2">
          <span className="text-[12px] font-black uppercase tracking-wider text-light-gray">分支名称</span>
          <input
            className="input-field text-[14px]"
            value={branch.title || `条件 ${index + 1}`}
            onChange={(event) => onUpdateFlowBranch(nodeId, branch.id, { title: event.target.value })}
          />
        </label>
        <button
          type="button"
          onClick={() => onAddFlowBranchCondition(nodeId, branch.id)}
          className={cn("mt-6 h-9 shrink-0 rounded-full bg-black px-3 text-[12px] font-black text-white", isAiCondition && "hidden")}
        >
          添加条件
        </button>
      </div>

      {isAiCondition ? (
        <label className="block space-y-2">
          <span className="text-[12px] font-black uppercase tracking-wider text-light-gray">写给 AI 看的分支说明</span>
          <textarea
            className="input-field min-h-[88px] resize-none text-[13px]"
            value={branch.aiDescription || ''}
            onChange={(event) => onUpdateFlowBranch(nodeId, branch.id, { aiDescription: event.target.value })}
            placeholder="例如：表单内容涉及合同、退款争议、客户投诉或其他风险时选择 A 分支"
          />
        </label>
      ) : (
      <div className="space-y-3">
        {conditions.map((condition, conditionIndex) => (
          <React.Fragment key={condition.id}>
            <ConditionEditor
              branch={editorBranch}
              condition={condition}
              index={conditionIndex}
              fieldOptions={fieldOptions}
              memberOptions={memberOptions}
              departmentOptions={departmentOptions}
              onRemoveCondition={(branchId, conditionId) => onRemoveFlowBranchCondition(nodeId, branchId, conditionId)}
              onUpdateCondition={(branchId, conditionId, patch) => onUpdateFlowBranchCondition(nodeId, branchId, conditionId, patch)}
            />
          </React.Fragment>
        ))}
      </div>
      )}
    </div>
  );
}

function StepEditor({
  branch,
  step,
  stepIndex,
  memberOptions,
  directory,
  previewSubmitter,
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
  directory: OrganizationDirectory;
  previewSubmitter: OrganizationDirectory['members'][number] | null;
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
              { value: 'multi_supervisor', label: '发起人上级' },
            ].map((item) => (
              <React.Fragment key={item.value}>
                <SegmentedButton
                  isActive={step.approverRule.type === item.value}
                  onClick={() => onUpdateStep(branch.id, step.id, {
                    approverRule: {
                      type: item.value as ApproverRule['type'],
                      memberIds: [],
                      departmentIds: [],
                      ...(item.value === 'multi_supervisor' ? { supervisorDepth: 1 } : {}),
                    },
                    approvalMode: item.value === 'multi_supervisor' ? 'one_of' : step.approvalMode,
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

        {step.approverRule.type === 'multi_supervisor' && (
          <div className="space-y-2">
            <label className="block space-y-2">
              <span className="text-[12px] font-black uppercase tracking-wider text-light-gray">主管层级</span>
              <input
                className="input-field text-[14px]"
                type="number"
                min={1}
                max={20}
                value={Math.max(1, Number(step.approverRule.supervisorDepth) || 1)}
                onChange={(event) => onUpdateStep(branch.id, step.id, {
                  approverRule: {
                    ...step.approverRule,
                    supervisorDepth: Math.max(1, Math.min(20, Number(event.target.value) || 1)),
                  },
                  approvalMode: 'one_of',
                })}
              />
            </label>
            <SupervisorChainPreview
              rule={step.approverRule}
              directory={directory}
              previewSubmitter={previewSubmitter}
              previewKey={step.id}
            />
          </div>
        )}

        {step.approverRule.type === 'specific_members' && (
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
        )}

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
          {getSupervisorDepthLabel(step.approverRule)}{step.approverRule.type === 'specific_members' ? ` · ${getApprovalModeLabel(step.approvalMode)}` : ''} · {getEmptyApproverActionLabel(step.emptyApproverAction)}
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
  selectedFlowNode,
  branches,
  submitPermission,
  ccRule,
  directory,
  validation,
  memberOptions,
  departmentOptions,
  fieldOptions,
  previewSubmitter,
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
  onUpdateFlowNode,
  onUpdateFlowConditionBranchCount,
  onUpdateFlowBranch,
  onAddFlowBranchCondition,
  onRemoveFlowBranchCondition,
  onUpdateFlowBranchCondition,
  onRemoveFlowNode,
}: {
  selection: DesignerSelection;
  selectedBranch: WorkflowBranch | null;
  selectedStep: ApprovalStep | null;
  selectedFlowNode: WorkflowNode | null;
  branches: WorkflowBranch[];
  submitPermission: SubmitPermissionRule;
  ccRule: CcRule;
  directory: OrganizationDirectory;
  validation: ValidationState;
  memberOptions: Array<{ value: string; label: string }>;
  departmentOptions: Array<{ value: string; label: string }>;
  fieldOptions: ConditionFieldOption[];
  previewSubmitter: OrganizationDirectory['members'][number] | null;
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
  onUpdateFlowNode: (nodeId: string, patch: Partial<WorkflowNode>) => void;
  onUpdateFlowConditionBranchCount: (nodeId: string, branchCount: number) => void;
  onUpdateFlowBranch: (nodeId: string, branchId: string, patch: Partial<WorkflowConditionBranch>) => void;
  onAddFlowBranchCondition: (nodeId: string, branchId: string) => void;
  onRemoveFlowBranchCondition: (nodeId: string, branchId: string, conditionId: string) => void;
  onUpdateFlowBranchCondition: (nodeId: string, branchId: string, conditionId: string, patch: Partial<WorkflowCondition>) => void;
  onRemoveFlowNode: (nodeId: string) => void;
}) {
  const inspectorClassName = "border-t border-border-silver bg-white lg:sticky lg:top-20 lg:self-start lg:border-l lg:border-t-0 lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto";

  if (selection.type === 'flow-node' && selectedFlowNode) {
    if (selectedFlowNode.type === 'cc') {
      const rule = selectedFlowNode.ccRule || defaultCcRule();
      return (
        <aside className={inspectorClassName}>
          <InspectorHeader label="抄送" title="抄送配置" description="配置流程到达此处时需要同步的人。" />
          <div className="space-y-5 p-5">
            <label className="block space-y-2">
              <span className="text-[12px] font-black uppercase tracking-wider text-light-gray">抄送成员</span>
              <MultiSelect
                value={rule.memberIds}
                options={memberOptions}
                onChange={(memberIds) => onUpdateFlowNode(selectedFlowNode.id, { ccRule: { ...rule, memberIds } })}
                emptyText="暂无成员"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-[12px] font-black uppercase tracking-wider text-light-gray">抄送部门</span>
              <MultiSelect
                value={rule.departmentIds}
                options={departmentOptions}
                onChange={(departmentIds) => onUpdateFlowNode(selectedFlowNode.id, { ccRule: { ...rule, departmentIds } })}
                emptyText="暂无部门"
              />
            </label>
            <button
              type="button"
              onClick={() => onRemoveFlowNode(selectedFlowNode.id)}
              className="h-11 w-full rounded-full bg-[#ffebee] text-[13px] font-black text-[#c62828]"
            >
              删除这个节点
            </button>
          </div>
        </aside>
      );
    }

    if (selectedFlowNode.type === 'condition') {
      const isAiCondition = selectedFlowNode.conditionMode === 'ai';
      return (
        <aside className={inspectorClassName}>
          <InspectorHeader
            label={isAiCondition ? 'AI 条件分化' : '条件分化'}
            title={selectedFlowNode.title || (isAiCondition ? 'AI 条件分化' : '条件分化')}
            description={isAiCondition ? 'AI 只负责在 A/B 分支中做选择，后续审批节点仍按人工配置执行。' : '条件分化会按命中的分支继续执行。'}
          />
          <div className="space-y-5 p-5">
            <label className="block space-y-2">
              <span className="text-[12px] font-black uppercase tracking-wider text-light-gray">节点名称</span>
              <input
                className="input-field text-[14px]"
                value={selectedFlowNode.title || ''}
                onChange={(event) => onUpdateFlowNode(selectedFlowNode.id, { title: event.target.value })}
              />
            </label>
            <div className="rounded-2xl bg-lightest-gray-background px-4 py-3">
              <span className="text-[12px] font-black uppercase tracking-wider text-light-gray">分化类型</span>
              <p className="mt-1 text-[14px] font-black text-midnight-graphite">
                {isAiCondition ? 'AI 条件分化' : '普通条件分化'}
              </p>
            </div>
            <label className="block space-y-2">
              <span className="text-[12px] font-black uppercase tracking-wider text-light-gray">分化层数</span>
              <select
                className="input-field text-[14px]"
                value={clampFlowBranchCount(selectedFlowNode.conditions?.length || 2)}
                onChange={(event) => onUpdateFlowConditionBranchCount(selectedFlowNode.id, Number(event.target.value))}
              >
                {FLOW_BRANCH_COUNT_OPTIONS.map((count) => (
                  <option key={count} value={count}>{count}层</option>
                ))}
              </select>
            </label>
            {isAiCondition && (
              <label className="block space-y-2">
                <span className="text-[12px] font-black uppercase tracking-wider text-light-gray">AI 判断提示词</span>
                <textarea
                  className="input-field min-h-[120px] resize-none text-[13px]"
                  value={selectedFlowNode.aiBranchRule?.prompt || ''}
                  onChange={(event) => onUpdateFlowNode(selectedFlowNode.id, {
                    aiBranchRule: { prompt: event.target.value },
                  })}
                  placeholder="例如：判断申请是否涉及法务风险；涉及合同、退款争议、客户投诉选择 A，否则选择 B。"
                />
              </label>
            )}
            <div className="space-y-3">
              {(selectedFlowNode.conditions || []).map((condition, conditionIndex) => (
                <React.Fragment key={condition.id}>
                  <FlowConditionBranchEditor
                    nodeId={selectedFlowNode.id}
                    branch={condition}
                    index={conditionIndex}
                    isAiCondition={selectedFlowNode.conditionMode === 'ai'}
                    fieldOptions={fieldOptions}
                    memberOptions={memberOptions}
                    departmentOptions={departmentOptions}
                    onUpdateFlowBranch={onUpdateFlowBranch}
                    onAddFlowBranchCondition={onAddFlowBranchCondition}
                    onRemoveFlowBranchCondition={onRemoveFlowBranchCondition}
                    onUpdateFlowBranchCondition={onUpdateFlowBranchCondition}
                  />
                </React.Fragment>
              ))}
            </div>
            <button
              type="button"
              onClick={() => onRemoveFlowNode(selectedFlowNode.id)}
              className="h-11 w-full rounded-full bg-[#ffebee] text-[13px] font-black text-[#c62828]"
            >
              删除这个条件分化
            </button>
            <div className="hidden">
              {(selectedFlowNode.conditions || []).map((condition) => (
                <div key={condition.id} className="rounded-2xl border border-border-silver bg-white px-4 py-3">
                  <p className="text-[13px] font-black text-midnight-graphite">{condition.title}</p>
                  <p className="mt-1 text-[11px] font-bold text-medium-gray">
                    {condition.isDefault ? '未命中其他条件时进入' : condition.expression || '默认条件待配置'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      );
    }

    const rule = selectedFlowNode.rule || { type: 'specific_members', memberIds: [] };
    return (
      <aside className={inspectorClassName}>
        <InspectorHeader label="审批节点" title={selectedFlowNode.title || '审批节点'} description="配置当前审批节点。" />
        <div className="space-y-5 p-5">
          <label className="block space-y-2">
            <span className="text-[12px] font-black uppercase tracking-wider text-light-gray">节点名称</span>
            <input
              className="input-field text-[14px]"
              value={selectedFlowNode.title || ''}
              onChange={(event) => onUpdateFlowNode(selectedFlowNode.id, { title: event.target.value })}
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <SegmentedButton
              isActive={rule.type === 'specific_members'}
              onClick={() => onUpdateFlowNode(selectedFlowNode.id, {
                rule: { type: 'specific_members', memberIds: [] },
                approvalMode: selectedFlowNode.approvalMode || 'one_of',
              })}
            >
              指定成员
            </SegmentedButton>
            <SegmentedButton
              isActive={rule.type === 'multi_supervisor'}
              onClick={() => onUpdateFlowNode(selectedFlowNode.id, {
                rule: { type: 'multi_supervisor', supervisorDepth: 1 },
                approvalMode: 'one_of',
              })}
            >
              发起人上级
            </SegmentedButton>
          </div>
          {rule.type === 'specific_members' && (
            <label className="block space-y-2">
              <span className="text-[12px] font-black uppercase tracking-wider text-light-gray">指定成员</span>
              <MultiSelect
                value={rule.memberIds || []}
                options={memberOptions}
                onChange={(memberIds) => onUpdateFlowNode(selectedFlowNode.id, { rule: { ...rule, memberIds } })}
                emptyText="暂无成员"
              />
            </label>
          )}
          {rule.type === 'multi_supervisor' && (
            <div className="space-y-2">
              <label className="block space-y-2">
                <span className="text-[12px] font-black uppercase tracking-wider text-light-gray">主管层级</span>
                <input
                  className="input-field text-[14px]"
                  type="number"
                  min={1}
                  max={20}
                  value={Math.max(1, Number(rule.supervisorDepth) || 1)}
                  onChange={(event) => onUpdateFlowNode(selectedFlowNode.id, {
                    rule: { ...rule, supervisorDepth: Math.max(1, Math.min(20, Number(event.target.value) || 1)) },
                    approvalMode: 'one_of',
                  })}
                />
              </label>
              <SupervisorChainPreview
                rule={rule}
                directory={directory}
                previewSubmitter={previewSubmitter}
                previewKey={selectedFlowNode.id}
              />
            </div>
          )}
          <button
            type="button"
            onClick={() => onRemoveFlowNode(selectedFlowNode.id)}
            className="h-11 w-full rounded-full bg-[#ffebee] text-[13px] font-black text-[#c62828]"
          >
            删除这个节点
          </button>
        </div>
      </aside>
    );
  }

  if (selection.type === 'step' && selectedBranch && selectedStep) {
    return (
      <aside className={inspectorClassName}>
        <StepEditor
          branch={selectedBranch}
          step={selectedStep}
          stepIndex={selectedBranch.approvalSteps.findIndex((step) => step.id === selectedStep.id)}
          memberOptions={memberOptions}
          directory={directory}
          previewSubmitter={previewSubmitter}
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
      <aside className={inspectorClassName}>
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
                  <span className="mt-1 block text-[11px] font-bold text-medium-gray">
                    {getSupervisorDepthLabel(step.approverRule)}
                    {step.approverRule.type === 'specific_members' ? ` · ${getApprovalModeLabel(step.approvalMode)}` : ''}
                  </span>
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
      <aside className={inspectorClassName}>
        <InspectorHeader
          label="抄送"
          title="抄送配置"
          description="审批流程完成后，把结果同步给相关成员或部门。"
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
        </div>
      </aside>
    );
  }

  return (
    <aside className={inspectorClassName}>
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
  const [directory, setDirectory] = useState<OrganizationDirectory>({ departments: [], members: [] });
  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState<WorkflowVersion | null>(null);
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
  const conditionFieldOptionsForDraft = useMemo(
    () => getConditionFieldOptions(draft),
    [draft?.basic.moduleName, draft?.basic.approvalTypeName],
  );

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(''), 2600);
    return () => window.clearTimeout(timer);
  }, [message]);

  const ensureDefaultWorkflowTemplates = async (sourceTemplates: WorkflowTemplate[]) => {
    const templatesByScope = new Set(
      sourceTemplates.map((template) => getBusinessScopeKey(
        template.moduleName || template.draft?.basic?.moduleName,
        template.approvalTypeName || template.draft?.basic?.approvalTypeName,
      )),
    );
    const missingScopes = getBusinessScopeOptions().filter((scope) => !templatesByScope.has(scope.key));
    if (missingScopes.length === 0) return sourceTemplates;

    const createdTemplates: WorkflowTemplate[] = [];
    for (const scope of missingScopes) {
      const name = getGeneratedWorkflowName(scope);
      const created = await storage.createWorkflowTemplate({
        name,
        businessType: scope.businessType,
        organizationId: DEFAULT_ORG_ID,
        moduleName: scope.moduleName,
        approvalTypeName: scope.approvalTypeName,
      });
      const updated = await storage.updateWorkflowDraft(created.id, createDraft(name, scope));
      createdTemplates.push(updated);
    }

    return [...sourceTemplates, ...createdTemplates];
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [fetchedTemplates, nextDirectory] = await Promise.all([
        storage.getWorkflowTemplates(),
        storage.getOrganizationDirectory(),
      ]);
      const nextTemplates = await ensureDefaultWorkflowTemplates(fetchedTemplates);
      const normalizedTemplates = sortWorkflowTemplatesByBusinessScope(nextTemplates.map(normalizeTemplateForEditor));
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
        approvalSteps: [],
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

  const createFlowNode = (kind: FlowInsertKind, index: number, branchCount = 2): WorkflowNode => {
    if (kind === 'condition' || kind === 'ai-condition') {
      const isAiCondition = kind === 'ai-condition';
      const field = conditionFieldOptionsForDraft.find((option) => option.kind === 'number')?.value
        || conditionFieldOptionsForDraft[0]?.value
        || 'submitter.department';

      return {
        id: createId('flow-condition'),
        type: 'condition',
        title: isAiCondition ? 'AI 条件分化' : '条件分化',
        subtitle: isAiCondition ? 'AI 根据提示词选择 A/B 分支' : '按条件进入不同分支',
        conditionMode: isAiCondition ? 'ai' : 'rules',
        ...(isAiCondition ? { aiBranchRule: { prompt: '请根据申请表单内容判断应该进入哪个分支。' } } : {}),
        conditions: createConditionBranches(isAiCondition, branchCount, field),
      };
    }

    if (kind === 'cc') {
      return {
        id: createId('flow-cc'),
        type: 'cc',
        title: '抄送对象',
        subtitle: '流程到达这里时抄送',
        ccRule: defaultCcRule(),
      };
    }

    const step = defaultStep(index + 1);
    return {
      ...stepToFlowNode(step, index),
      id: createId('flow-approval'),
      title: `审批节点 ${index + 1}`,
    };
  };

  const insertFlowNodeInto = (
    nodes: WorkflowNode[],
    path: string[],
    index: number,
    nodeToInsert: WorkflowNode,
  ): WorkflowNode[] => {
    if (path.length === 0) {
      const nextNodes = [...nodes];
      nextNodes.splice(index, 0, nodeToInsert);
      return nextNodes;
    }

    const [branchId, ...restPath] = path;
    return nodes.map((node) => {
      if (node.type !== 'condition') return node;

      return {
        ...node,
        conditions: (node.conditions || []).map((condition) => {
          if (condition.id !== branchId) return condition;
          return {
            ...condition,
            nodes: insertFlowNodeInto(condition.nodes || [], restPath, index, nodeToInsert),
          };
        }),
      };
    });
  };

  const updateFlowNodeInTree = (
    nodes: WorkflowNode[],
    nodeId: string,
    patch: Partial<WorkflowNode>,
  ): WorkflowNode[] => nodes.map((node) => {
    if (node.id === nodeId) return { ...node, ...patch };
    if (node.type !== 'condition') return node;
    return {
      ...node,
      conditions: (node.conditions || []).map((condition) => ({
        ...condition,
        nodes: updateFlowNodeInTree(condition.nodes || [], nodeId, patch),
      })),
    };
  });

  const resizeFlowConditionNodeInTree = (
    nodes: WorkflowNode[],
    nodeId: string,
    branchCount: number,
    field: WorkflowConditionField,
  ): WorkflowNode[] => nodes.map((node) => {
    if (node.type === 'condition' && node.id === nodeId) {
      const isAiCondition = node.conditionMode === 'ai';
      return {
        ...node,
        conditions: resizeConditionBranches(node.conditions || [], isAiCondition, branchCount, field),
      };
    }
    if (node.type !== 'condition') return node;
    return {
      ...node,
      conditions: (node.conditions || []).map((condition) => ({
        ...condition,
        nodes: resizeFlowConditionNodeInTree(condition.nodes || [], nodeId, branchCount, field),
      })),
    };
  });

  const updateFlowBranchInTree = (
    nodes: WorkflowNode[],
    nodeId: string,
    branchId: string,
    updater: (branch: WorkflowConditionBranch) => WorkflowConditionBranch,
  ): WorkflowNode[] => nodes.map((node) => {
    if (node.type === 'condition' && node.id === nodeId) {
      return {
        ...node,
        conditions: (node.conditions || []).map((condition) => (
          condition.id === branchId ? updater(condition) : condition
        )),
      };
    }

    if (node.type !== 'condition') return node;
    return {
      ...node,
      conditions: (node.conditions || []).map((condition) => ({
        ...condition,
        nodes: updateFlowBranchInTree(condition.nodes || [], nodeId, branchId, updater),
      })),
    };
  });

  const removeFlowNodeFromTree = (nodes: WorkflowNode[], nodeId: string): WorkflowNode[] => nodes
    .filter((node) => node.id !== nodeId)
    .map((node) => {
      if (node.type !== 'condition') return node;
      return {
        ...node,
        conditions: (node.conditions || []).map((condition) => ({
          ...condition,
          nodes: removeFlowNodeFromTree(condition.nodes || [], nodeId),
        })),
      };
    });

  const syncFlowDraft = (current: WorkflowVersion, nextNodes: WorkflowNode[]): WorkflowVersion => ({
    ...current,
    flowMode: 'flexible',
    nodes: [startFlowNode(), ...nextNodes],
    branches: branchesFromFlowNodes(nextNodes),
    ccRule: collectFlowCcRule(nextNodes) || defaultCcRule(),
  });

  const insertFlowNode = (path: string[], index: number, kind: FlowInsertKind, branchCount?: number) => {
    const nextNode = createFlowNode(kind, index, branchCount);
    patchDraft((current) => {
      const currentNodes = flowNodesFromDraft({ ...current, flowMode: 'flexible' });
      const nextNodes = insertFlowNodeInto(currentNodes, path, index, nextNode);
      return syncFlowDraft(current, nextNodes);
    });
    setDesignerSelection({ type: 'flow-node', nodeId: nextNode.id });
  };

  const updateFlowNode = (nodeId: string, patch: Partial<WorkflowNode>) => {
    patchDraft((current) => {
      const currentNodes = flowNodesFromDraft({ ...current, flowMode: 'flexible' });
      const nextNodes = updateFlowNodeInTree(currentNodes, nodeId, patch);
      return syncFlowDraft(current, nextNodes);
    });
  };

  const updateFlowConditionBranchCount = (nodeId: string, branchCount: number) => {
    const field = conditionFieldOptionsForDraft.find((option) => option.kind === 'number')?.value
      || conditionFieldOptionsForDraft[0]?.value
      || 'submitter.department';
    patchDraft((current) => {
      const currentNodes = flowNodesFromDraft({ ...current, flowMode: 'flexible' });
      const resizedNodes = resizeFlowConditionNodeInTree(currentNodes, nodeId, branchCount, field);
      return syncFlowDraft(current, resizedNodes);
    });
  };

  const updateFlowBranch = (nodeId: string, branchId: string, patch: Partial<WorkflowConditionBranch>) => {
    patchDraft((current) => {
      const currentNodes = flowNodesFromDraft({ ...current, flowMode: 'flexible' });
      const nextNodes = updateFlowBranchInTree(currentNodes, nodeId, branchId, (branch) => ({
        ...branch,
        ...patch,
      }));
      return syncFlowDraft(current, nextNodes);
    });
  };

  const addFlowBranchCondition = (nodeId: string, branchId: string) => {
    const defaultField = conditionFieldOptionsForDraft[0]?.value || 'submitter.department';
    patchDraft((current) => {
      const currentNodes = flowNodesFromDraft({ ...current, flowMode: 'flexible' });
      const nextNodes = updateFlowBranchInTree(currentNodes, nodeId, branchId, (branch) => {
        const workflowConditions = [...(branch.workflowConditions || []), defaultCondition(defaultField)];
        return {
          ...branch,
          workflowConditions,
          expression: getFlowBranchExpression(workflowConditions),
        };
      });
      return syncFlowDraft(current, nextNodes);
    });
  };

  const removeFlowBranchCondition = (nodeId: string, branchId: string, conditionId: string) => {
    patchDraft((current) => {
      const currentNodes = flowNodesFromDraft({ ...current, flowMode: 'flexible' });
      const nextNodes = updateFlowBranchInTree(currentNodes, nodeId, branchId, (branch) => {
        const workflowConditions = (branch.workflowConditions || []).filter((condition) => condition.id !== conditionId);
        return {
          ...branch,
          workflowConditions,
          expression: getFlowBranchExpression(workflowConditions),
        };
      });
      return syncFlowDraft(current, nextNodes);
    });
  };

  const updateFlowBranchCondition = (nodeId: string, branchId: string, conditionId: string, patch: Partial<WorkflowCondition>) => {
    patchDraft((current) => {
      const currentNodes = flowNodesFromDraft({ ...current, flowMode: 'flexible' });
      const nextNodes = updateFlowBranchInTree(currentNodes, nodeId, branchId, (branch) => {
        const workflowConditions = (branch.workflowConditions || []).map((condition) => (
          condition.id === conditionId ? normalizeCondition({ ...condition, ...patch }) : condition
        ));
        return {
          ...branch,
          workflowConditions,
          expression: getFlowBranchExpression(workflowConditions),
        };
      });
      return syncFlowDraft(current, nextNodes);
    });
  };

  const removeFlowNode = (nodeId: string) => {
    patchDraft((current) => {
      const currentNodes = flowNodesFromDraft({ ...current, flowMode: 'flexible' });
      const nextNodes = removeFlowNodeFromTree(currentNodes, nodeId);
      return syncFlowDraft(current, nextNodes);
    });
    setDesignerSelection(submitDesignerSelection);
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
    const normalized = normalizeTemplateForEditor(saved);
    setTemplates((current) => current.map((template) => template.id === normalized.id ? normalized : template));
    setDraft(JSON.parse(JSON.stringify(normalized.draft)));
    return normalized;
  };

  const handleSave = async () => {
    if (!draft) return;
    setIsSaving(true);
    setMessage('');
    const nextValidation = validateDraft(prepareDraftForSave(draft));
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
    const nextValidation = validateDraft(prepareDraftForSave(draft));
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
      const normalized = normalizeTemplateForEditor(published);
      setTemplates((current) => current.map((template) => template.id === normalized.id ? normalized : template));
      setDraft(JSON.parse(JSON.stringify(normalized.draft)));
      setMessage('审批流已发布');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '发布失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleInitialize = async () => {
    if (!selectedTemplate || !draft) return;
    const scope = getBusinessScopeByNames(
      selectedTemplate.moduleName || draft.basic.moduleName,
      selectedTemplate.approvalTypeName || draft.basic.approvalTypeName,
    ) || {
      key: getBusinessScopeKey(draft.basic.moduleName, draft.basic.approvalTypeName),
      moduleName: draft.basic.moduleName,
      approvalTypeName: draft.basic.approvalTypeName,
      label: `${draft.basic.moduleName} / ${draft.basic.approvalTypeName}`,
      businessType: draft.businessType || selectedTemplate.businessType || 'general',
      fields: [],
    };

    const confirmed = window.confirm(`确认初始化「${scope.approvalTypeName}」审批流？当前草稿会被重置为空白流程。`);
    if (!confirmed) return;

    setIsSaving(true);
    setMessage('');
    try {
      const nextDraft = createDraft(getGeneratedWorkflowName(scope), scope);
      const updated = await storage.updateWorkflowDraft(selectedTemplate.id, nextDraft);
      const normalized = normalizeTemplateForEditor(updated);
      setTemplates((current) => current.map((template) => template.id === normalized.id ? normalized : template));
      setDraft(JSON.parse(JSON.stringify(normalized.draft)));
      setValidation(createValidationState());
      setDesignerSelection(submitDesignerSelection);
      setMessage('审批流已初始化');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '初始化失败');
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
  const flowNodes = draft ? flowNodesFromDraft(draft) : [];
  const selectedFlowNode = designerSelection.type === 'flow-node'
    ? findFlowNode(flowNodes, designerSelection.nodeId)
    : null;

  return (
    <div className="space-y-4 pb-16 animate-in fade-in duration-500">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[11px] font-black text-light-gray uppercase tracking-[0.2em]">Workflow Config</p>
          <h1 className="text-2xl font-black text-midnight-graphite tracking-tight">审批流配置</h1>
          <p className="hidden">配置模板、提交范围、条件分支、审批节点与抄送规则。</p>
        </div>
        <div className="hidden">
          <span className="px-3 py-1.5 rounded-full bg-white border border-border-silver text-[11px] font-black text-medium-gray">
            {templates.length} 个模板
          </span>
          <span className="px-3 py-1.5 rounded-full bg-[#e8f5e9] text-[#2e7d32] text-[11px] font-black">
            {templates.filter((template) => template.status === 'published').length} 个已发布
          </span>
        </div>
      </div>

      {message && (
        <div className="fixed right-5 top-5 z-[90] max-w-[360px] rounded-xl border border-border-silver bg-white px-4 py-3 text-[12px] font-bold text-midnight-graphite shadow-xl shadow-black/10">
          {formatWorkflowMessage(message)}
        </div>
      )}

      {!draft || !selectedTemplate ? (
        <section className="rounded-2xl border border-border-silver bg-white shadow-sm p-12 text-center text-[14px] font-bold text-medium-gray">
          请先选择或新建审批流。
        </section>
      ) : (
        <div className="space-y-6">
            <section className="rounded-xl border border-border-silver bg-white shadow-sm overflow-hidden">
              <div className="p-5 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-black", statusClasses[selectedTemplate.status])}>
                      {statusLabels[selectedTemplate.status]}
                    </span>
                    <span className="text-[12px] font-bold text-light-gray">
                      {getWorkflowMeta(draft.basic.moduleName, draft.version)}
                    </span>
                  </div>
                  <h2 className="text-[22px] font-black text-midnight-graphite tracking-tight truncate">
                    {getWorkflowTitle(draft.basic.moduleName, draft.basic.approvalTypeName)}
                  </h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="mr-1 min-w-[220px]">
                    <span className="sr-only">当前流程</span>
                    <select
                      className="input-field h-10 py-0 text-[12px] font-bold"
                      value={selectedId}
                      onChange={(event) => {
                        const template = templates.find((item) => item.id === event.target.value);
                        if (template) selectTemplate(template);
                      }}
                      disabled={templates.length === 0 || isSaving}
                    >
                      {templates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {getTemplateOptionLabel(template)}
                        </option>
                      ))}
                    </select>
                  </label>
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
                  <button
                    type="button"
                    onClick={handleInitialize}
                    disabled={isSaving}
                    className="h-10 px-4 rounded-full bg-white border border-border-silver text-midnight-graphite text-[12px] font-bold flex items-center gap-2 disabled:opacity-40"
                  >
                    <AlertCircle size={14} /> 初始化
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


            <WorkflowFlowDesigner
              draft={draft}
              directory={directory}
              submitPermission={submitPermission}
              ccRule={ccRule}
              branches={branches}
              validation={validation}
              selection={designerSelection}
              selectedFlowNode={selectedFlowNode}
              fieldOptions={conditionFieldOptionsForDraft}
              memberOptions={memberOptions}
              departmentOptions={departmentOptions}
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
              flowNodes={flowNodes}
              onInsertFlowNode={insertFlowNode}
              onUpdateFlowNode={updateFlowNode}
              onUpdateFlowConditionBranchCount={updateFlowConditionBranchCount}
              onUpdateFlowBranch={updateFlowBranch}
              onAddFlowBranchCondition={addFlowBranchCondition}
              onRemoveFlowBranchCondition={removeFlowBranchCondition}
              onUpdateFlowBranchCondition={updateFlowBranchCondition}
              onRemoveFlowNode={removeFlowNode}
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
                          {getConditionOperatorOptions(condition.field).map((option) => (
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
                        ) : isNumericConditionFieldValue(condition.field) && ['gt', 'gte'].includes(condition.operator) ? (
                          <input
                            className="input-field text-[13px] lg:col-span-2"
                            type="number"
                            value={condition.amountMin ?? ''}
                            onChange={(event) => updateCondition(branch.id, condition.id, { amountMin: event.target.value === '' ? undefined : Number(event.target.value) })}
                            placeholder="金额下限"
                          />
                        ) : isNumericConditionFieldValue(condition.field) && ['lt', 'lte'].includes(condition.operator) ? (
                          <input
                            className="input-field text-[13px] lg:col-span-2"
                            type="number"
                            value={condition.amountMax ?? ''}
                            onChange={(event) => updateCondition(branch.id, condition.id, { amountMax: event.target.value === '' ? undefined : Number(event.target.value) })}
                            placeholder="金额上限"
                          />
                        ) : isNumericConditionFieldValue(condition.field) ? (
                          <input
                            className="input-field text-[13px] lg:col-span-2"
                            type="number"
                            value={condition.value || ''}
                            onChange={(event) => updateCondition(branch.id, condition.id, { value: event.target.value })}
                            placeholder="条件值"
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
                                    ...(type === 'multi_supervisor' ? { supervisorDepth: 1 } : {}),
                                  },
                                  approvalMode: type === 'multi_supervisor' ? 'one_of' : step.approvalMode,
                                });
                              }}
                            >
                              <option value="specific_members">指定成员</option>
                              <option value="multi_supervisor">发起人的上级</option>
                            </select>
                            {step.approverRule.type === 'specific_members' ? (
                              <select
                                className="input-field text-[13px]"
                                value={step.approvalMode}
                                onChange={(event) => updateStep(branch.id, step.id, { approvalMode: event.target.value as ApprovalMode })}
                              >
                                <option value="one_of">多人任意一人通过</option>
                                <option value="all_of">所有人都要通过</option>
                              </select>
                            ) : (
                              <input
                                className="input-field text-[13px]"
                                type="number"
                                min={1}
                                max={20}
                                value={Math.max(1, Number(step.approverRule.supervisorDepth) || 1)}
                                onChange={(event) => updateStep(branch.id, step.id, {
                                  approverRule: {
                                    ...step.approverRule,
                                    supervisorDepth: Math.max(1, Math.min(20, Number(event.target.value) || 1)),
                                  },
                                  approvalMode: 'one_of',
                                })}
                              />
                            )}
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
              <div className="grid gap-4 lg:grid-cols-2">
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
              </div>
            </SectionCard>
            </div>

        </div>
      )}
    </div>
  );
}
