import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_ORGANIZATION_ID = 'default-org';
const MODULE_NAME = '出勤休假';
const DEFAULT_PASSWORD = '123456';
const STATUS_PENDING = '待审批';
const STATUS_APPROVED = '已批准';
const STATUS_REJECTED = '已拒绝';
const STEP_NOT_STARTED = 'not_started';
const STEP_PENDING = 'pending';
const STEP_APPROVED = 'approved';
const STEP_REJECTED = 'rejected';

const demoDepartments = [
  { id: 'dept-demo-attendance', name: '出勤休假模拟部' },
  { id: 'dept-demo-attendance-product', name: '产品研发组', parentId: 'dept-demo-attendance', managerMemberIds: ['demo-leave-07'] },
  { id: 'dept-demo-attendance-ops', name: '客户运营组', parentId: 'dept-demo-attendance', managerMemberIds: ['demo-leave-08'] },
  { id: 'dept-demo-attendance-hr', name: '人事行政组', parentId: 'dept-demo-attendance', managerMemberIds: ['demo-leave-09'] },
];

const demoAccounts = [
  { username: 'leave01', name: '周一航', role: 'employee', memberId: 'demo-leave-01', departmentId: 'dept-demo-attendance-product', title: '前端工程师', supervisorId: 'demo-leave-07' },
  { username: 'leave02', name: '赵小雨', role: 'employee', memberId: 'demo-leave-02', departmentId: 'dept-demo-attendance-product', title: '后端工程师', supervisorId: 'demo-leave-07' },
  { username: 'leave03', name: '陈思源', role: 'employee', memberId: 'demo-leave-03', departmentId: 'dept-demo-attendance-product', title: '产品专员', supervisorId: 'demo-leave-07' },
  { username: 'leave04', name: '王可', role: 'employee', memberId: 'demo-leave-04', departmentId: 'dept-demo-attendance-ops', title: '运营专员', supervisorId: 'demo-leave-08' },
  { username: 'leave05', name: '李明达', role: 'employee', memberId: 'demo-leave-05', departmentId: 'dept-demo-attendance-ops', title: '客户经理', supervisorId: 'demo-leave-08' },
  { username: 'leave06', name: '孙佳琪', role: 'employee', memberId: 'demo-leave-06', departmentId: 'dept-demo-attendance-ops', title: '实施顾问', supervisorId: 'demo-leave-08' },
  { username: 'leave07', name: '郑主管', role: 'employee', memberId: 'demo-leave-07', departmentId: 'dept-demo-attendance-product', title: '研发主管', supervisorId: 'demo-leave-08' },
  { username: 'leave08', name: '何经理', role: 'employee', memberId: 'demo-leave-08', departmentId: 'dept-demo-attendance-ops', title: '部门经理', supervisorId: 'demo-leave-10' },
  { username: 'leave09', name: '唐人事', role: 'employee', memberId: 'demo-leave-09', departmentId: 'dept-demo-attendance-hr', title: '人事专员', supervisorId: 'demo-leave-10', isAdmin: true },
  { username: 'leave10', name: '吴总', role: 'boss', memberId: 'demo-leave-10', departmentId: 'dept-demo-attendance', title: '总经理', isAdmin: true },
];

const applicantAccounts = demoAccounts.slice(0, 6);
const workflowApprovers = {
  hr: 'demo-leave-09',
  boss: 'demo-leave-10',
};

const legacyGeneratedTypeNames = ['请假申请', '加班申请', '外出申请', '出差申请'];

const approvalTypes = [
  {
    key: 'leave',
    name: '请假',
    businessFields: ['请假类型', '开始时间', '结束时间', '时长', '请假事由', '职务代理人', '图片'],
    attachmentFields: ['图片'],
    memberFields: ['职务代理人'],
    dateFields: ['开始时间', '结束时间'],
    dateTimeFields: ['开始时间', '结束时间'],
    optionalFields: ['图片'],
    multilineFields: ['请假事由'],
    selectFields: [
      { field: '请假类型', options: ['事假', '病假', '年假', '调休', '婚假', '产假', '陪产假', '丧假', '其他'] },
    ],
    durationFields: [
      { field: '时长', startField: '开始时间', endField: '结束时间', unit: 'hours' },
    ],
    defaultBranchName: '24小时以内请假',
    conditionField: 'form:时长',
    threshold: 24,
    longBranchName: '超过24小时请假',
    metricField: '时长',
  },
  {
    key: 'overtime',
    name: '加班',
    businessFields: ['加班原因', '加班人', '开始时间', '结束时间', '时长', '加班补偿'],
    memberFields: ['加班人'],
    dateFields: ['开始时间', '结束时间'],
    dateTimeFields: ['开始时间', '结束时间'],
    multilineFields: ['加班原因'],
    selectFields: [
      { field: '加班补偿', options: ['调休', '加班费', '无'] },
    ],
    durationFields: [
      { field: '时长', startField: '开始时间', endField: '结束时间', unit: 'hours' },
    ],
    defaultBranchName: '4小时以内加班',
    conditionField: 'form:时长',
    threshold: 4,
    longBranchName: '超过4小时加班',
    metricField: '时长',
  },
  {
    key: 'punch-correction',
    name: '补卡申请',
    businessFields: ['申请部门', '补卡日期', '补卡时间', '补卡类型', '补卡原因'],
    departmentFields: ['申请部门'],
    dateFields: ['补卡日期'],
    dateTimeFields: ['补卡时间'],
    multilineFields: ['补卡原因'],
    selectFields: [
      { field: '补卡类型', options: ['上班卡', '下班卡', '外勤卡'] },
    ],
    defaultBranchName: '补卡默认流程',
  },
  {
    key: 'field-work',
    name: '外出',
    businessFields: ['开始时间', '结束时间', '时长', '外出事由', '图片'],
    attachmentFields: ['图片'],
    dateFields: ['开始时间', '结束时间'],
    dateTimeFields: ['开始时间', '结束时间'],
    optionalFields: ['图片'],
    multilineFields: ['外出事由'],
    durationFields: [
      { field: '时长', startField: '开始时间', endField: '结束时间', unit: 'hours' },
    ],
    defaultBranchName: '4小时以内外出',
    conditionField: 'form:时长',
    threshold: 4,
    longBranchName: '超过4小时外出',
    metricField: '时长',
  },
  {
    key: 'business-trip',
    name: '出差',
    businessFields: ['出行方式', '出差事由', '行程', '同行人'],
    memberFields: ['同行人'],
    multilineFields: ['出差事由'],
    selectFields: [
      { field: '出行方式', options: ['私车公用', '开公司车', '其他'] },
    ],
    detailFields: [
      {
        field: '行程',
        columns: [
          { name: '交通工具', type: 'select', options: ['飞机', '火车', '汽车', '自驾', '其他'] },
          { name: '单程往返', type: 'select', options: ['单程', '往返'] },
          { name: '出发城市', type: 'text' },
          { name: '目的城市', type: 'text' },
          { name: '开始时间', type: 'datetime' },
          { name: '结束时间', type: 'datetime' },
          { name: '时长', type: 'number', unit: 'hours' },
        ],
      },
    ],
    defaultBranchName: '24小时以内出差',
    conditionField: 'form:时长',
    threshold: 24,
    longBranchName: '超过24小时出差',
    metricField: '时长',
  },
];

async function loadLocalEnvFile() {
  const envFile = path.resolve(process.cwd(), '.env.local');

  try {
    const content = await fs.readFile(envFile, 'utf8');
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;

      const equalsIndex = line.indexOf('=');
      if (equalsIndex < 1) continue;

      const name = line.slice(0, equalsIndex).trim();
      let value = line.slice(equalsIndex + 1).trim();
      if (!name || process.env[name] !== undefined) continue;

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      process.env[name] = value;
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

function getDataDir() {
  return path.resolve(
    process.env.RAILWAY_VOLUME_MOUNT_PATH ||
    process.env.DATA_DIR ||
    path.resolve(process.cwd(), 'data'),
  );
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('base64url')) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString('base64url');
  return `${salt}:${hash}`;
}

function verifyPassword(password, passwordHash) {
  const [salt, expected] = String(passwordHash || '').split(':');
  if (!salt || !expected) return false;

  const actual = crypto.scryptSync(String(password), salt, 64).toString('base64url');
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);

  return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

function getBusinessKey(moduleName, approvalTypeName) {
  return crypto
    .createHash('sha1')
    .update(`${moduleName}\n${approvalTypeName}`)
    .digest('hex')
    .slice(0, 16);
}

async function readJson(file, fallback) {
  try {
    const content = await fs.readFile(file, 'utf8');
    if (!content.trim()) return structuredClone(fallback);
    return JSON.parse(content.replace(/^\uFEFF/, ''));
  } catch (error) {
    if (error?.code === 'ENOENT') return structuredClone(fallback);
    throw error;
  }
}

async function writeJson(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tempFile = `${file}.tmp`;
  await fs.writeFile(tempFile, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  await fs.rename(tempFile, file);
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
}

function isoAt(dayOffset, hour = 9, minute = 0) {
  const date = new Date(Date.UTC(2026, 5, 1 + dayOffset, hour, minute, 0));
  return date.toISOString();
}

function dateOnly(dayOffset) {
  return isoAt(dayOffset).slice(0, 10);
}

function localDateTime(dayOffset, hour, minute = 0) {
  return `${dateOnly(dayOffset)}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function upsertBy(items, key, nextItem) {
  const index = items.findIndex((item) => item[key] === nextItem[key]);
  if (index >= 0) {
    items[index] = { ...items[index], ...nextItem };
    return 'updated';
  }
  items.push(nextItem);
  return 'created';
}

function getDepartmentName(directory, departmentId) {
  return directory.departments.find((department) => department.id === departmentId)?.name || departmentId;
}

function getMemberById(directory, memberId) {
  return directory.members.find((member) => member.id === memberId) || null;
}

function getSupervisorChain(directory, member, depth) {
  const supervisors = [];
  let current = member;
  for (let level = 1; level <= depth; level += 1) {
    const supervisor = current?.supervisorId ? getMemberById(directory, current.supervisorId) : null;
    if (!supervisor) break;
    supervisors.push({ level, member: supervisor });
    current = supervisor;
  }
  return supervisors;
}

function toApproverSnapshot(member, status = 'pending') {
  return {
    memberId: member.id,
    name: member.name,
    ...(member.accountUsername ? { accountUsername: member.accountUsername } : {}),
    status,
  };
}

function getWorkflowScopeKey(template) {
  const version = template?.publishedVersion || template?.draft || {};
  const basic = version.basic || {};
  return [
    template?.organizationId || version.organizationId || DEFAULT_ORGANIZATION_ID,
    template?.moduleName || basic.moduleName,
    template?.approvalTypeName || basic.approvalTypeName,
  ].join('|||');
}

function createApprovalStep(id, name, approverRule, approvalMode = 'one_of') {
  return {
    id,
    name,
    approverRule,
    approvalMode,
    emptyApproverAction: 'block_submit',
    emptyApproverMemberIds: [],
  };
}

function createWorkflowBranches(typeConfig) {
  const defaultSteps = [
    createApprovalStep('step-direct-manager', '直属主管审批', { type: 'multi_supervisor', supervisorDepth: 1 }),
  ];

  if (typeConfig.key !== 'punch-correction') {
    defaultSteps.push(createApprovalStep('step-hr-review', '人事复核', { type: 'specific_members', memberIds: [workflowApprovers.hr] }));
  } else {
    defaultSteps[0] = createApprovalStep('step-hr-review', '人事复核', { type: 'specific_members', memberIds: [workflowApprovers.hr] });
  }

  const branches = [];
  if (typeConfig.conditionField && Number.isFinite(typeConfig.threshold)) {
    branches.push({
      id: `branch-${typeConfig.key}-long`,
      name: typeConfig.longBranchName,
      isDefault: false,
      conditionMode: 'rules',
      conditions: [
        {
          id: `cond-${typeConfig.key}-long`,
          field: typeConfig.conditionField,
          operator: 'gt',
          amountMin: typeConfig.threshold,
          expression: `${typeConfig.conditionField} > ${typeConfig.threshold}`,
        },
      ],
      approvalSteps: [
        createApprovalStep('step-direct-manager', '直属主管审批', { type: 'multi_supervisor', supervisorDepth: 1 }),
        createApprovalStep('step-department-manager', '部门经理审批', { type: 'multi_supervisor', supervisorLevels: '2' }),
        createApprovalStep('step-hr-review', '人事复核', { type: 'specific_members', memberIds: [workflowApprovers.hr] }),
        createApprovalStep('step-boss-approval', '总经理审批', { type: 'specific_members', memberIds: [workflowApprovers.boss] }),
      ],
    });
  }

  branches.push({
    id: 'branch-default',
    name: typeConfig.defaultBranchName,
    isDefault: true,
    conditionMode: 'rules',
    conditions: [],
    approvalSteps: defaultSteps,
  });

  return branches;
}

function createWorkflowTemplate(typeConfig, previousTemplate) {
  const now = new Date().toISOString();
  const templateId = previousTemplate?.id || `workflow-demo-${typeConfig.key}`;
  const version = {
    id: previousTemplate?.publishedVersion?.id || previousTemplate?.draft?.id || `version-demo-${typeConfig.key}-1`,
    version: 1,
    status: 'published',
    organizationId: DEFAULT_ORGANIZATION_ID,
    businessType: 'leave',
    basic: {
      name: `${typeConfig.name}审批流`,
      moduleName: MODULE_NAME,
      approvalTypeName: typeConfig.name,
      visibleRange: '全员可见',
    },
    submitPermission: {
      type: 'all_members',
      memberIds: [],
      departmentIds: [],
      excludedMemberIds: [],
    },
    branches: createWorkflowBranches(typeConfig),
    ccRule: {
      timing: 'workflow_completed',
      memberIds: [workflowApprovers.hr],
      departmentIds: [],
    },
    processorRule: {
      timing: 'approval_completed',
      enabled: false,
      taskName: '归档办理',
      memberIds: [],
      departmentIds: [],
    },
    formFields: typeConfig.businessFields.map((field, index) => ({
      id: `field-${typeConfig.key}-${index + 1}`,
      label: field,
      type: typeConfig.amountFields?.includes(field)
        ? 'money'
        : typeConfig.dateTimeFields?.includes(field)
          ? 'datetime'
          : typeConfig.dateFields?.includes(field)
            ? 'date'
            : typeConfig.multilineFields?.includes(field)
              ? 'multiline'
              : typeConfig.selectFields?.some((item) => item.field === field)
                ? 'select'
                : 'text',
      required: !(typeConfig.optionalFields || []).includes(field),
    })),
    flowMode: 'flexible',
    nodes: [
      { id: 'node-start', type: 'start', title: '发起人', subtitle: '提交审批' },
    ],
    savedAt: now,
    savedBy: 'attendance-leave-demo-seed',
    publishedAt: now,
  };

  return {
    id: templateId,
    name: version.basic.name,
    organizationId: DEFAULT_ORGANIZATION_ID,
    businessType: 'leave',
    moduleName: MODULE_NAME,
    approvalTypeName: typeConfig.name,
    status: 'published',
    currentVersion: 1,
    draft: version,
    publishedVersion: version,
    createdAt: previousTemplate?.createdAt || now,
    updatedAt: now,
    updatedBy: 'attendance-leave-demo-seed',
  };
}

function selectBranch(typeConfig, businessData) {
  const branches = createWorkflowBranches(typeConfig);
  const defaultBranch = branches.find((branch) => branch.isDefault) || branches[branches.length - 1];
  if (!typeConfig.metricField) return defaultBranch;

  const metricValue = Number(findBusinessMetricValue(businessData, typeConfig.metricField));
  if (Number.isFinite(metricValue) && metricValue > typeConfig.threshold) {
    return branches.find((branch) => !branch.isDefault) || defaultBranch;
  }
  return defaultBranch;
}

function findBusinessMetricValue(value, fieldName) {
  if (!value || !fieldName) return undefined;
  if (Array.isArray(value)) {
    for (const item of value) {
      const match = findBusinessMetricValue(item, fieldName);
      if (match !== undefined) return match;
    }
    return undefined;
  }
  if (typeof value !== 'object') return undefined;
  if (value[fieldName] !== undefined) return value[fieldName];
  for (const item of Object.values(value)) {
    const match = findBusinessMetricValue(item, fieldName);
    if (match !== undefined) return match;
  }
  return undefined;
}

function resolveStepApprovers(step, directory, applicantMember) {
  const rule = step.approverRule || {};
  if (rule.type === 'specific_members') {
    return (rule.memberIds || []).map((memberId) => getMemberById(directory, memberId)).filter(Boolean);
  }
  if (rule.type === 'multi_supervisor') {
    const explicitLevels = String(rule.supervisorLevels || '')
      .split(/[,\s，、]+/)
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0);
    const depth = Math.max(1, Number(rule.supervisorDepth) || Math.max(...explicitLevels, 1));
    const supervisors = getSupervisorChain(directory, applicantMember, depth);
    const targetLevels = explicitLevels.length > 0 ? explicitLevels : [1];
    return supervisors.filter((item) => targetLevels.includes(item.level)).map((item) => item.member);
  }
  return [];
}

function createWorkflowInstance(typeConfig, directory, applicantAccount, businessData, scenario, recordIndex) {
  const applicantMember = getMemberById(directory, applicantAccount.memberId);
  const branch = selectBranch(typeConfig, businessData);
  const workflowId = `workflow-demo-${typeConfig.key}`;
  const steps = [];

  for (const approvalStep of branch.approvalSteps) {
    const approvers = resolveStepApprovers(approvalStep, directory, applicantMember);
    if (approvers.length === 0) continue;

    steps.push({
      stepId: approvalStep.id,
      stepType: 'approver',
      name: approvalStep.name,
      order: steps.length,
      approvalMode: approvalStep.approvalMode || 'one_of',
      approvers: approvers.map((approver) => toApproverSnapshot(approver)),
      status: STEP_NOT_STARTED,
    });
  }

  const actedAtBase = recordIndex * 2;
  const approveStep = (step, actionIndex) => {
    const approver = step.approvers[0];
    const actedAt = isoAt(actedAtBase + actionIndex, 10 + actionIndex);
    approver.status = 'approved';
    approver.actedAt = actedAt;
    approver.comment = '模拟审批通过';
    step.status = STEP_APPROVED;
    step.actedByMemberId = approver.memberId;
    step.actedByName = approver.name;
    step.actedByAccountUsername = approver.accountUsername;
    step.actedAt = actedAt;
    step.comment = '模拟审批通过';
  };

  if (scenario === 'approved') {
    steps.forEach(approveStep);
    return {
      workflowInstance: {
        workflowId,
        workflowName: `${typeConfig.name}审批流`,
        workflowVersion: 1,
        currentStepIndex: -1,
        steps,
      },
      status: STATUS_APPROVED,
      approvedAt: steps.at(-1)?.actedAt || isoAt(recordIndex, 12),
      approver: steps.at(-1)?.actedByName,
    };
  }

  if (scenario === 'rejected') {
    const rejectedIndex = steps.length > 1 && recordIndex % 2 === 0 ? 1 : 0;
    steps.slice(0, rejectedIndex).forEach(approveStep);
    const rejectedStep = steps[rejectedIndex] || steps[0];
    const rejectedApprover = rejectedStep.approvers[0];
    const rejectedAt = isoAt(actedAtBase + rejectedIndex + 1, 11);
    rejectedApprover.status = 'rejected';
    rejectedApprover.actedAt = rejectedAt;
    rejectedApprover.comment = '模拟驳回：申请理由或时长需要补充说明';
    rejectedStep.status = STEP_REJECTED;
    rejectedStep.actedByMemberId = rejectedApprover.memberId;
    rejectedStep.actedByName = rejectedApprover.name;
    rejectedStep.actedByAccountUsername = rejectedApprover.accountUsername;
    rejectedStep.actedAt = rejectedAt;
    rejectedStep.comment = rejectedApprover.comment;
    steps.slice(rejectedIndex + 1).forEach((step) => {
      step.status = STEP_NOT_STARTED;
    });

    return {
      workflowInstance: {
        workflowId,
        workflowName: `${typeConfig.name}审批流`,
        workflowVersion: 1,
        currentStepIndex: rejectedIndex,
        steps,
      },
      status: STATUS_REJECTED,
      rejectedAt,
      rejectReason: rejectedApprover.comment,
      approver: rejectedApprover.name,
    };
  }

  const pendingIndex = Math.min(recordIndex % Math.max(steps.length, 1), Math.max(steps.length - 1, 0));
  steps.slice(0, pendingIndex).forEach(approveStep);
  const pendingStep = steps[pendingIndex] || steps[0];
  pendingStep.status = STEP_PENDING;

  return {
    workflowInstance: {
      workflowId,
      workflowName: `${typeConfig.name}审批流`,
      workflowVersion: 1,
      currentStepIndex: pendingIndex,
      steps,
    },
    status: STATUS_PENDING,
    approver: steps[pendingIndex - 1]?.actedByName,
  };
}

function getScenario(index) {
  if (index <= 4) return 'approved';
  if (index <= 8) return 'pending';
  return 'rejected';
}

function createBusinessData(typeConfig, directory, applicantAccount, index) {
  const departmentName = getDepartmentName(directory, applicantAccount.departmentId);
  const handover = demoAccounts[(index + 1) % applicantAccounts.length];
  const day = 2 + index;

  if (typeConfig.key === 'leave') {
    const leaveTypes = typeConfig.selectFields[0].options;
    const hours = [8, 16, 4, 24, 32, 40, 8, 16, 48, 24][index - 1];
    return {
      请假类型: leaveTypes[(index - 1) % leaveTypes.length],
      开始时间: localDateTime(day, 9),
      结束时间: localDateTime(day + Math.ceil(hours / 8) - 1, hours <= 4 ? 13 : 18),
      时长: hours,
      请假事由: ['家庭事务', '身体不适', '调休安排', '婚育相关', '返乡探亲'][index % 5],
      职务代理人: handover.name,
      图片: index % 3 === 0 ? '已上传病历或证明截图（模拟）' : '',
    };
  }

  if (typeConfig.key === 'overtime') {
    const hours = [2, 3, 4, 1.5, 5, 6, 2.5, 3.5, 7, 4.5][index - 1];
    return {
      加班原因: ['版本发布支持', '客户上线保障', '月度结算处理', '紧急缺陷修复'][index % 4],
      加班人: applicantAccount.name,
      开始时间: localDateTime(day, 18, 30),
      结束时间: localDateTime(day, 18 + Math.floor(hours), hours % 1 ? 30 : 0),
      时长: hours,
      加班补偿: index % 2 === 0 ? '加班费' : '调休',
    };
  }

  if (typeConfig.key === 'punch-correction') {
    return {
      申请部门: departmentName,
      补卡日期: dateOnly(day),
      补卡时间: localDateTime(day, index % 2 === 0 ? 18 : 9, index % 2 === 0 ? 5 : 2),
      补卡类型: ['上班卡', '下班卡', '外勤卡'][index % 3],
      补卡原因: ['忘记打卡', '外勤拜访客户', '门禁异常', '网络故障'][index % 4],
    };
  }

  if (typeConfig.key === 'field-work') {
    const hours = [1, 2, 3, 4, 5, 6, 2.5, 3.5, 7, 4.5][index - 1];
    return {
      开始时间: localDateTime(day, 10),
      结束时间: localDateTime(day, 10 + Math.floor(hours), hours % 1 ? 30 : 0),
      时长: hours,
      外出事由: ['客户沟通', '合同资料递交', '现场问题确认', '业务培训'][index % 4],
      图片: index % 3 === 0 ? '已上传外出证明截图（模拟）' : '',
    };
  }

  const hours = [8, 16, 24, 8, 32, 40, 16, 24, 48, 32][index - 1];
  const travelModes = typeConfig.selectFields[0].options;
  const cities = ['上海', '杭州', '南京', '苏州', '宁波'];
  return {
    出行方式: travelModes[(index - 1) % travelModes.length],
    出差事由: ['客户项目启动', '供应商现场评审', '区域业务复盘', '实施交付支持'][index % 4],
    行程: [
      {
        交通工具: ['飞机', '火车', '汽车', '自驾', '其他'][index % 5],
        单程往返: index % 2 === 0 ? '往返' : '单程',
        出发城市: cities[(index + 1) % cities.length],
        目的城市: cities[index % cities.length],
        开始时间: localDateTime(day, 9),
        结束时间: localDateTime(day + Math.ceil(hours / 8) - 1, 18),
        时长: hours,
      },
    ],
    同行人: index % 2 === 0 ? handover.name : '',
  };
}

function createLogs(record, workflowResult) {
  const logs = [
    {
      action: '发起申请',
      user: record.applicant,
      time: record.createdAt,
      details: '提交了审批单（本地模拟）',
    },
    {
      action: '匹配审批流',
      user: 'system',
      time: record.createdAt,
      details: `Matched workflow: ${record.workflowInstance.workflowName} v${record.workflowInstance.workflowVersion}`,
    },
  ];

  record.workflowInstance.steps.forEach((step) => {
    if (step.status === STEP_APPROVED) {
      logs.push({
        action: '批准',
        user: step.actedByName,
        time: step.actedAt,
        details: `${step.actedByName} 审批通过 ${step.name}`,
        stepId: step.stepId,
        stepName: step.name,
      });
    }
    if (step.status === STEP_REJECTED) {
      logs.push({
        action: '拒绝',
        user: step.actedByName,
        time: step.actedAt,
        details: workflowResult.rejectReason,
        stepId: step.stepId,
        stepName: step.name,
      });
    }
  });

  if (record.status === STATUS_APPROVED) {
    logs.push({
      action: '抄送',
      user: 'system',
      time: record.approvedAt || record.updatedAt,
      details: '流程结束，已同步给：唐人事',
    });
  }

  return logs.filter((log) => log.time);
}

function createRecord(typeConfig, directory, applicantAccount, index) {
  const businessData = createBusinessData(typeConfig, directory, applicantAccount, index);
  const workflowResult = createWorkflowInstance(typeConfig, directory, applicantAccount, businessData, getScenario(index), index);
  const createdAt = isoAt(index + approvalTypes.findIndex((type) => type.key === typeConfig.key) * 3, 8, 30);
  const updatedAt = workflowResult.rejectedAt || workflowResult.approvedAt || isoAt(index + 20, 9, 15);
  const record = {
    id: `DEMO-ATTENDANCE-${typeConfig.key.toUpperCase()}-${String(index).padStart(2, '0')}`,
    moduleName: MODULE_NAME,
    approvalTypeName: typeConfig.name,
    businessData,
    status: workflowResult.status,
    applicant: applicantAccount.name,
    applicantUsername: applicantAccount.username,
    workflowInstance: workflowResult.workflowInstance,
    ccRecipients: [
      { memberId: workflowApprovers.hr, name: '唐人事', accountUsername: 'leave09' },
    ],
    aiSuggestion: {
      status: 'generated',
      riskLevel: '低风险',
      advice: '模拟数据字段完整，审批路径正常。',
      displayText: '低风险：模拟数据字段完整，审批路径正常。',
      generatedAt: updatedAt,
    },
    createdAt,
    updatedAt,
    ...(workflowResult.approver ? { approver: workflowResult.approver } : {}),
    ...(workflowResult.approvedAt ? { approvedAt: workflowResult.approvedAt } : {}),
    ...(workflowResult.rejectedAt ? { rejectedAt: workflowResult.rejectedAt } : {}),
    ...(workflowResult.rejectReason ? { rejectReason: workflowResult.rejectReason } : {}),
  };
  record.logs = createLogs(record, workflowResult);
  return record;
}

async function seedAccounts(accountsFile) {
  const accounts = await readJson(accountsFile, []);
  let created = 0;
  let updated = 0;

  for (const demo of demoAccounts) {
    const now = new Date().toISOString();
    const existing = accounts.find((account) => account.username === demo.username);
    if (!existing) {
      accounts.push({
        id: crypto.randomUUID(),
        username: demo.username,
        role: demo.role,
        name: demo.name,
        passwordHash: hashPassword(DEFAULT_PASSWORD),
        enabled: true,
        createdAt: now,
        updatedAt: now,
      });
      created += 1;
      continue;
    }

    let changed = false;
    if (existing.role !== demo.role) {
      existing.role = demo.role;
      changed = true;
    }
    if (existing.name !== demo.name) {
      existing.name = demo.name;
      changed = true;
    }
    if (existing.enabled === false) {
      existing.enabled = true;
      changed = true;
    }
    if (!verifyPassword(DEFAULT_PASSWORD, existing.passwordHash)) {
      existing.passwordHash = hashPassword(DEFAULT_PASSWORD);
      changed = true;
    }
    if (changed) {
      existing.updatedAt = now;
      updated += 1;
    }
  }

  await writeJson(accountsFile, accounts);
  return { created, updated, total: demoAccounts.length };
}

async function seedOrganization(organizationFile) {
  const directory = await readJson(organizationFile, { departments: [], members: [] });
  directory.departments = Array.isArray(directory.departments) ? directory.departments : [];
  directory.members = Array.isArray(directory.members) ? directory.members : [];

  const rootDepartment = directory.departments.find((department) => !department.parentId);
  let departmentsCreated = 0;
  let departmentsUpdated = 0;
  let membersCreated = 0;
  let membersUpdated = 0;

  for (const department of demoDepartments) {
    const nextDepartment = {
      ...department,
      ...(department.id === 'dept-demo-attendance' && rootDepartment?.id && rootDepartment.id !== department.id
        ? { parentId: rootDepartment.id }
        : {}),
    };
    const result = upsertBy(directory.departments, 'id', nextDepartment);
    if (result === 'created') departmentsCreated += 1;
    else departmentsUpdated += 1;
  }

  for (const account of demoAccounts) {
    const nextMember = {
      id: account.memberId,
      name: account.name,
      accountUsername: account.username,
      departmentId: account.departmentId,
      title: account.title,
      ...(account.supervisorId ? { supervisorId: account.supervisorId } : {}),
      ...(account.isAdmin ? { isAdmin: true } : {}),
      enabled: true,
    };
    const result = upsertBy(directory.members, 'id', nextMember);
    if (result === 'created') membersCreated += 1;
    else membersUpdated += 1;
  }

  directory.updatedAt = new Date().toISOString();
  await writeJson(organizationFile, directory);

  return {
    departments: { created: departmentsCreated, updated: departmentsUpdated },
    members: { created: membersCreated, updated: membersUpdated },
    directory,
  };
}

async function readSchemaSummary(schemaFile) {
  const schema = await readJson(schemaFile, { modules: [] });
  const module = Array.isArray(schema.modules)
    ? schema.modules.find((item) => item.name === MODULE_NAME)
    : null;
  const availableTypes = Array.isArray(module?.approvalTypes)
    ? module.approvalTypes.map((item) => item.name)
    : [];
  const configuredTypes = approvalTypes.map((item) => item.name);

  return {
    changed: false,
    availableTypes: configuredTypes.filter((name) => availableTypes.includes(name)),
    missingTypes: configuredTypes.filter((name) => !availableTypes.includes(name)),
    total: configuredTypes.length,
  };
}

async function seedWorkflows(workflowFile) {
  const templates = await readJson(workflowFile, []);
  let created = 0;
  let updated = 0;

  for (const typeConfig of approvalTypes) {
    const scopeKey = [DEFAULT_ORGANIZATION_ID, MODULE_NAME, typeConfig.name].join('|||');
    const index = templates.findIndex((template) => getWorkflowScopeKey(template) === scopeKey);
    const template = createWorkflowTemplate(typeConfig, index >= 0 ? templates[index] : null);
    if (index >= 0) {
      templates[index] = template;
      updated += 1;
    } else {
      templates.push(template);
      created += 1;
    }
  }

  await writeJson(workflowFile, templates);
  return { created, updated, total: approvalTypes.length };
}

async function seedRecords(dataDir, directory) {
  const businessRecordsDir = path.join(dataDir, 'business-records');
  await fs.mkdir(businessRecordsDir, { recursive: true });
  const results = [];

  for (const typeConfig of approvalTypes) {
    const file = path.join(businessRecordsDir, `${getBusinessKey(MODULE_NAME, typeConfig.name)}.json`);
    const existingRecords = await readJson(file, []);
    const otherRecords = existingRecords.filter((record) => !String(record.id || '').startsWith(`DEMO-ATTENDANCE-${typeConfig.key.toUpperCase()}-`));
    const demoRecords = Array.from({ length: 10 }, (_, index) => {
      const applicant = applicantAccounts[index % applicantAccounts.length];
      return createRecord(typeConfig, directory, applicant, index + 1);
    });
    const nextRecords = [...demoRecords, ...otherRecords].sort((left, right) => (
      (Date.parse(right.createdAt || right.updatedAt || '') || 0) -
      (Date.parse(left.createdAt || left.updatedAt || '') || 0)
    ));
    await writeJson(file, nextRecords);
    results.push({
      approvalTypeName: typeConfig.name,
      file,
      records: demoRecords.length,
    });
  }

  return {
    total: results.reduce((sum, item) => sum + item.records, 0),
    byType: results,
  };
}

async function main() {
  await loadLocalEnvFile();
  const dataDir = getDataDir();
  const accountsFile = path.join(dataDir, 'approval-accounts.json');
  const organizationFile = path.join(dataDir, 'organization-directory.json');
  const schemaFile = path.join(dataDir, 'approval-schema.json');
  const workflowFile = path.join(dataDir, 'workflow-templates.json');

  const accounts = await seedAccounts(accountsFile);
  const organization = await seedOrganization(organizationFile);
  const schema = await readSchemaSummary(schemaFile);
  const workflows = await seedWorkflows(workflowFile);
  const records = await seedRecords(dataDir, organization.directory);

  console.log(JSON.stringify({
    dataDir,
    moduleName: MODULE_NAME,
    defaultPassword: DEFAULT_PASSWORD,
    accounts,
    organization: {
      departments: organization.departments,
      members: organization.members,
    },
    schema,
    workflows,
    records: {
      total: records.total,
      byType: records.byType.map(({ approvalTypeName, records }) => ({ approvalTypeName, records })),
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
