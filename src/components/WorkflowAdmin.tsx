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

const conditionFieldOptions: Array<{ value: WorkflowConditionField; label: string }> = [
  { value: 'amount', label: 'amount 金额' },
  { value: 'category', label: 'category 类别' },
  { value: 'project', label: 'project 项目' },
  { value: 'department', label: 'department 部门' },
];

const conditionOperatorOptions: Array<{ value: WorkflowConditionOperator; label: string }> = [
  { value: 'lte', label: '<= 小于等于' },
  { value: 'gt', label: '> 大于' },
  { value: 'between', label: '区间' },
  { value: 'eq', label: '= 等于' },
];

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

function getBusinessTypeMeta(type?: string) {
  return businessTypeOptions.find((item) => item.value === type) || businessTypeOptions[businessTypeOptions.length - 1];
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

function defaultCondition(): WorkflowCondition {
  return {
    id: createId('cond'),
    field: 'amount',
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

function createDraft(name: string, businessType: WorkflowBusinessType): WorkflowVersion {
  const meta = getBusinessTypeMeta(businessType);
  return prepareDraftForSave({
    id: createId('draft'),
    version: 1,
    status: 'draft',
    organizationId: DEFAULT_ORG_ID,
    businessType,
    basic: {
      name,
      moduleName: meta.moduleName,
      approvalTypeName: meta.approvalTypeName,
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
  const field = ['amount', 'category', 'project', 'department'].includes(String(condition?.field))
    ? condition?.field as WorkflowConditionField
    : 'amount';
  const operator = ['lte', 'gt', 'between', 'eq'].includes(String(condition?.operator))
    ? condition?.operator as WorkflowConditionOperator
    : 'lte';

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
  const businessType = getBusinessTypeMeta(draft.businessType).value;
  const meta = getBusinessTypeMeta(businessType);

  return {
    ...draft,
    organizationId: draft.organizationId || DEFAULT_ORG_ID,
    businessType,
    basic: {
      name: draft.basic?.name || '新审批流',
      moduleName: draft.basic?.moduleName || meta.moduleName,
      approvalTypeName: draft.basic?.approvalTypeName || meta.approvalTypeName,
      visibleRange: draft.basic?.visibleRange || 'all',
    },
    submitPermission: {
      ...defaultSubmitPermission(),
      ...(draft.submitPermission || {}),
      memberIds: draft.submitPermission?.memberIds || [],
      departmentIds: draft.submitPermission?.departmentIds || [],
      excludedMemberIds: draft.submitPermission?.excludedMemberIds || [],
    },
    branches: normalizeBranches(draft),
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

        if (condition.field === 'amount') {
          if (condition.operator === 'between') {
            if (!Number.isFinite(Number(condition.amountMin)) || !Number.isFinite(Number(condition.amountMax))) {
              addValidationError(state, 'branches', `${branchLabel} 金额区间必须填写有效数字`, branch.id);
            }
          } else if (condition.operator === 'lte' && !Number.isFinite(Number(condition.amountMax))) {
            addValidationError(state, 'branches', `${branchLabel} 金额上限必须填写有效数字`, branch.id);
          } else if (condition.operator === 'gt' && !Number.isFinite(Number(condition.amountMin))) {
            addValidationError(state, 'branches', `${branchLabel} 金额下限必须填写有效数字`, branch.id);
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
  const field = condition.field;
  if (field === 'amount') {
    if (condition.operator === 'between') return `amount > ${condition.amountMin ?? '?'} 且 <= ${condition.amountMax ?? '?'}`;
    if (condition.operator === 'gt') return `amount > ${condition.amountMin ?? '?'}`;
    if (condition.operator === 'lte') return `amount <= ${condition.amountMax ?? '?'}`;
    return `amount = ${condition.value || '?'}`;
  }

  const operator = conditionOperatorOptions.find((item) => item.value === condition.operator)?.label.split(' ')[0] || '=';
  return `${field} ${operator} ${condition.value || '?'}`;
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
  const [createBusinessType, setCreateBusinessType] = useState<WorkflowBusinessType>('general');
  const [createName, setCreateName] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [validation, setValidation] = useState<ValidationState>(createValidationState());

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

  const addBranch = () => {
    patchDraft((current) => {
      const branchCount = (current.branches || []).filter((branch) => !branch.isDefault).length + 1;
      const branches = current.branches || [defaultBranch()];
      const defaultIndex = branches.findIndex((branch) => branch.isDefault);
      const nextBranch: WorkflowBranch = {
        id: createId('branch'),
        name: `Branch ${branchCount}`,
        isDefault: false,
        conditions: [defaultCondition()],
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
  };

  const removeBranch = (branchId: string) => {
    patchDraft((current) => ({
      ...current,
      branches: (current.branches || []).filter((branch) => branch.isDefault || branch.id !== branchId),
    }));
  };

  const addStep = (branchId: string) => {
    patchDraft((current) => ({
      ...current,
      branches: (current.branches || []).map((branch) => (
        branch.id === branchId
          ? { ...branch, approvalSteps: [...branch.approvalSteps, defaultStep(branch.approvalSteps.length + 1)] }
          : branch
      )),
    }));
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
    const name = createName.trim() || `${getBusinessTypeMeta(createBusinessType).label}`;
    setIsSaving(true);
    setMessage('');
    try {
      const meta = getBusinessTypeMeta(createBusinessType);
      const created = await storage.createWorkflowTemplate({
        name,
        businessType: createBusinessType,
        organizationId: DEFAULT_ORG_ID,
        moduleName: meta.moduleName,
        approvalTypeName: meta.approvalTypeName,
      });
      const nextDraft = createDraft(name, createBusinessType);
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
            value={createBusinessType}
            onChange={(event) => setCreateBusinessType(event.target.value as WorkflowBusinessType)}
          >
            {businessTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
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

      <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
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
                      {getBusinessTypeMeta(template.businessType).label} · v{template.currentVersion || 1}
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
                      {getBusinessTypeMeta(draft.businessType).label}
                    </span>
                  </div>
                  <h2 className="mt-3 text-[24px] font-black text-midnight-graphite tracking-tight truncate">{draft.basic.name}</h2>
                  <p className="mt-1 text-[12px] font-bold text-medium-gray">
                    当前版本 v{draft.version || 1} · {draft.organizationId || DEFAULT_ORG_ID}
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
              <div className="grid gap-4 lg:grid-cols-2">
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
                    value={draft.businessType || 'general'}
                    onChange={(event) => {
                      const businessType = event.target.value as WorkflowBusinessType;
                      const meta = getBusinessTypeMeta(businessType);
                      patchDraft((current) => ({
                        ...current,
                        businessType,
                        basic: {
                          ...current.basic,
                          moduleName: meta.moduleName,
                          approvalTypeName: meta.approvalTypeName,
                        },
                      }));
                    }}
                  >
                    {businessTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-[12px] font-black text-light-gray uppercase tracking-wider">所属组织</span>
                  <input className="input-field text-[15px]" value="当前公司组织（default-org）" readOnly />
                </label>
                <label className="space-y-2">
                  <span className="text-[12px] font-black text-light-gray uppercase tracking-wider">版本状态</span>
                  <input className="input-field text-[15px]" value={`v${draft.version || 1} / ${statusLabels[selectedTemplate.status]}`} readOnly />
                </label>
              </div>
            </SectionCard>

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
                          onChange={(event) => updateCondition(branch.id, condition.id, { field: event.target.value as WorkflowConditionField })}
                        >
                          {conditionFieldOptions.map((option) => (
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
                        {condition.field === 'amount' && condition.operator === 'between' ? (
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
                        ) : condition.field === 'amount' && condition.operator === 'gt' ? (
                          <input
                            className="input-field text-[13px] lg:col-span-2"
                            type="number"
                            value={condition.amountMin ?? ''}
                            onChange={(event) => updateCondition(branch.id, condition.id, { amountMin: event.target.value === '' ? undefined : Number(event.target.value) })}
                            placeholder="金额下限"
                          />
                        ) : condition.field === 'amount' && condition.operator === 'lte' ? (
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
