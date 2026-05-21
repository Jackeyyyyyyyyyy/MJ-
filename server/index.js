import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 8080;
const dataDir =
  process.env.RAILWAY_VOLUME_MOUNT_PATH ||
  process.env.DATA_DIR ||
  path.resolve(process.cwd(), 'data');
const recordsFile = path.join(dataDir, 'approval-records.json');
const accountsFile = path.join(dataDir, 'approval-accounts.json');
const uploadsDir = path.join(dataDir, 'uploads');
const uploadsIndexFile = path.join(dataDir, 'approval-uploads.json');
const businessRecordsDir = path.join(dataDir, 'business-records');
const aiPromptConfigsFile = path.join(dataDir, 'ai-prompt-configs.json');
const aiAssistantConfigFile = path.join(dataDir, 'ai-assistant-config.json');
const workflowTemplatesFile = path.join(dataDir, 'workflow-templates.json');
const organizationFile = path.join(dataDir, 'organization-directory.json');
const STATUS_DRAFT = '\u8349\u7a3f';
const STATUS_PENDING = '\u5f85\u5ba1\u6279';
const STATUS_APPROVED = '\u5df2\u6279\u51c6';
const STATUS_REJECTED = '\u5df2\u62d2\u7edd';
const validStatuses = new Set([STATUS_DRAFT, STATUS_PENDING, STATUS_APPROVED, STATUS_REJECTED]);
const STEP_NOT_STARTED = 'not_started';
const STEP_PENDING = 'pending';
const STEP_APPROVED = 'approved';
const STEP_REJECTED = 'rejected';
const STEP_SKIPPED = 'skipped';
const DEFAULT_ORGANIZATION_ID = 'default-org';
const WORKFLOW_BUSINESS_TYPES = new Set(['reimbursement', 'purchase', 'leave', 'general']);
const WORKFLOW_CONDITION_FIELDS = new Set(['amount', 'category', 'project', 'department']);
const WORKFLOW_CONDITION_OPERATORS = new Set(['lte', 'gt', 'between', 'eq']);
const WORKFLOW_APPROVER_TYPES = new Set(['specific_members', 'department_manager', 'submitter_manager']);
const WORKFLOW_APPROVAL_MODES = new Set(['one_of', 'all_of']);
const LEGACY_ROLE_GROUP_MEMBERS = {
  'role-board': ['qin-an-tang'],
  'role-gm': ['fan-lu'],
  'role-finance': ['qian-lin', 'hu-ning-fei', 'ye-fei', 'wang-tumiao', 'jiang-hua'],
  'role-sales': ['yang-nan', 'hong-wei'],
  'role-admin': ['lin-jin-biao'],
  'role-warehouse': ['huang-song-yuan'],
  'role-ops': ['li-qi'],
  'role-assistant': ['qin-sheng'],
};
const managedRoles = new Set(['employee', 'boss']);
const defaultAiAssistantPrompt =
  '你是 MJ 审批系统的管理助手，只做只读分析。你负责总结审批风险、发现异常、解释待办优先级，并引用相关审批单。不得编造数据，不得替用户做审批决定，不得建议绕过流程。回答要先给简短结论，再列关键原因；如果涉及具体单据，请在 relatedRecordIds 中返回对应 recordId。';
const defaultAiPromptBase =
  '你是 MJ 审批风控助手。请只根据申请字段判断资料完整性、业务合理性和明显风险，输出“低/中/高风险：建议……”，不超过 45 字，不编造未提供信息。';
const defaultAiPromptFocus = {
  '班列|班列供应商变更': '核对班列名称、发车日期、供应商与服务模式变更是否合理。',
  '任务|线路询价': '核对班列信息是否完整、询价是否必要。',
  '任务|任务单费用': '对比标准价与填写价、费用类型和附件。',
  '资金|收入变更': '核对订单/箱号/客户与修改前后差异。',
  '资金|成本变更': '核对供应商、费用类型和成本变化。',
  '资金|批量删除': '核对收支类型与明细删除风险。',
  '资金|汇率转换': '核对币别、汇率和资金明细一致性。',
  '资金|付款申请': '核对付款对象、供应商/客户、业务明细和账单。',
  '资金|付款申请（线下）': '核对收款单位、审批单号和金额。',
  '资金|备用金申请（线下）': '核对用途合理性、收款单位和金额。',
  '资金|报销（线下）': '核对审批单号、收款单位和报销金额。',
  '资金|预付申请': '核对供应商、业务明细和预付账单。',
  '资金|转风控': '核对客户与明细是否存在风控迹象。',
  '资金|批量修改': '核对收支类型与明细变更范围。',
  '资金|营销折扣': '核对客户、订单、箱号与折扣合理性。',
  '资金|资金减免': '核对减免原因、收支类型和明细。',
  '资金|特价审批': '核对线路、箱型、口岸和申请利润。',
  '资金|利润审批': '核对钉钉单号、订单、客户、箱号与利润影响。',
  '客户|客户授权': '核对客户、公司、期限和授权类型。',
  '客户|资质授权': '核对公司名称与审批事项。',
  '客户|全程指定供应商': '核对客户、公司和指定线路必要性。',
  '客户|客户信息': '核对客户编号、审批类型和变更内容。',
  '客户|无合同校验': '核对场景、对象和内容风险。',
  '客户|资质审查': '核对客户资质、地域、投保说明和附件。',
  '供应商|报价': '核对供应商、服务、生效日期和报价信息。',
  '供应商|询价': '核对供应商与服务范围。',
  '供应商|供应商信息': '核对编号、审批类型和变更内容。',
  '供应商|无合同校验': '核对场景、对象和无合同风险。',
  '供应商|供应商授权': '核对供应商身份和授权期限。',
  '订单|项目货变更': '核对订单号与变更目标。',
  '订单|订单改签': '核对订单、箱号、变更内容和运费申请。',
  '订单|退运申请': '核对订单号、箱号和退运风险。',
  '提柜|用箱需求': '核对提箱点、还箱点、日期和箱型箱量。',
  '子账号|账号管理': '核对部门职位、角色、手机号和动作。',
  '子账号|权限申请': '核对部门、职位、角色和申请权限是否匹配。',
};

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`${name} environment variable is required.`);
    process.exit(1);
  }
  return value;
}

const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD?.trim() || requireEnv('APP_PASSWORD');
const superAdminUsername = process.env.SUPER_ADMIN_USERNAME?.trim() || 'developer';
const superAdminName = process.env.SUPER_ADMIN_NAME?.trim() || '超级管理员';
const authSecret = requireEnv('AUTH_SECRET');
const configuredTokenTtlMs = Number(process.env.AUTH_TOKEN_TTL_MS);
const tokenTtlMs =
  Number.isFinite(configuredTokenTtlMs) && configuredTokenTtlMs > 0
    ? configuredTokenTtlMs
    : 8 * 60 * 60 * 1000;
const configuredMaxUploadFileBytes = Number(process.env.MAX_UPLOAD_FILE_BYTES);
const maxUploadFileBytes =
  Number.isFinite(configuredMaxUploadFileBytes) && configuredMaxUploadFileBytes > 0
    ? configuredMaxUploadFileBytes
    : 10 * 1024 * 1024;
const configuredMaxUploadBatchBytes = Number(process.env.MAX_UPLOAD_BATCH_BYTES);
const maxUploadBatchBytes =
  Number.isFinite(configuredMaxUploadBatchBytes) && configuredMaxUploadBatchBytes > 0
    ? configuredMaxUploadBatchBytes
    : 20 * 1024 * 1024;
const superAdmin = {
  id: 'super-admin',
  username: superAdminUsername,
  role: 'developer',
  name: superAdminName,
  isSuperAdmin: true,
};

function normalizeRole(role) {
  const value = String(role || '').trim();
  if (value === 'applicant' || value === 'approver' || value === 'employee') return 'employee';
  if (value === 'boss') return 'boss';
  if (value === 'developer') return 'developer';
  return value;
}

function isManagedRole(role) {
  return managedRoles.has(normalizeRole(role));
}

const roleLabels = {
  employee: '员工',
  applicant: '员工',
  approver: '员工',
  boss: '老板',
  developer: '超管',
};

const rolePermissions = {
  employee: [
    { key: 'record:create', label: '创建申请' },
    { key: 'record:own:read', label: '查看本人申请' },
    { key: 'record:assigned:review', label: '处理分配给自己的审批' },
  ],
  boss: [
    { key: 'record:create', label: '创建申请' },
    { key: 'record:read:all', label: '查看全部申请' },
    { key: 'record:assigned:review', label: '处理分配给自己的审批' },
    { key: 'ai:assistant:read', label: '使用AI管理助手' },
  ],
  developer: [
    { key: 'record:read:all', label: '查看全部申请' },
    { key: 'record:review:all', label: '管理审批结果' },
    { key: 'perspective:switch', label: '切换业务视角' },
    { key: 'account:permissions:read', label: '管理账号权限' },
    { key: 'ai:prompts:write', label: '维护AI审批提示词' },
    { key: 'ai:assistant:read', label: '使用AI管理助手' },
    { key: 'ai:assistant:write', label: '维护AI助手提示词' },
  ],
};

app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '30mb' }));

function toPublicUser(user) {
  const role = normalizeRole(user.role);
  return {
    username: user.username,
    role,
    name: user.name,
  };
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

function toPublicAccount(account) {
  const role = normalizeRole(account.role);
  return {
    id: account.id,
    username: account.username,
    role,
    name: account.name,
    roleLabel: roleLabels[role] || role,
    permissions: rolePermissions[role] || [],
    canSwitchPerspective: role === 'developer',
    isSuperAdmin: role === 'developer',
    enabled: account.enabled !== false,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}

function sign(value) {
  return crypto.createHmac('sha256', authSecret).update(value).digest('base64url');
}

function createToken(user) {
  const expiresAt = Date.now() + tokenTtlMs;
  const publicUser = toPublicUser(user);
  const payload = Buffer.from(
    JSON.stringify({
      sub: publicUser.username,
      role: publicUser.role,
      name: publicUser.name,
      exp: expiresAt,
    }),
  ).toString('base64url');

  return {
    token: `${payload}.${sign(payload)}`,
    expiresAt,
  };
}

async function verifyToken(token) {
  const [payload, signature] = String(token || '').split('.');
  if (!payload || !signature) return null;

  const expected = sign(payload);
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);

  if (
    expectedBuffer.length !== signatureBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, signatureBuffer)
  ) {
    return null;
  }

  let session;
  try {
    session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  if (!session?.sub || !session?.exp || Date.now() > session.exp) {
    return null;
  }

  const user = await findAccount(session.sub);
  if (!user) return null;

  return toPublicUser(user);
}

async function authenticate(req, res, next) {
  let user = null;

  try {
    const authorization = req.get('authorization') || '';
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    user = match ? await verifyToken(match[1]) : null;

    if (user?.role === 'developer') {
      const impersonatedUsername = String(req.get('x-mj-impersonate') || '').trim();
      if (impersonatedUsername && impersonatedUsername !== user.username) {
        const impersonatedUser = await findAccount(impersonatedUsername);
        if (!impersonatedUser || normalizeRole(impersonatedUser.role) === 'developer') {
          return res.status(403).json({ error: 'invalid impersonated account' });
        }

        req.sessionUser = user;
        req.impersonatedUser = toPublicUser(impersonatedUser);
        user = req.impersonatedUser;
      }
    }
  } catch (error) {
    return next(error);
  }

  if (!user) {
    return res.status(401).json({ error: 'authentication required' });
  }

  req.sessionUser = req.sessionUser || user;
  req.user = user;
  next();
}

function requireRoles(...roles) {
  return (req, res, next) => {
    const userRole = normalizeRole(req.user?.role);
    const allowedRoles = roles.map(normalizeRole);
    if (userRole === 'developer' || allowedRoles.includes(userRole)) {
      return next();
    }

    return res.status(403).json({ error: 'permission denied' });
  };
}

function getBusinessKey(moduleName, approvalTypeName) {
  return crypto
    .createHash('sha1')
    .update(`${moduleName}\n${approvalTypeName}`)
    .digest('hex')
    .slice(0, 16);
}

function getPromptKey(moduleName, approvalTypeName) {
  return getBusinessKey(moduleName, approvalTypeName);
}

function getBusinessRecordFile(moduleName, approvalTypeName) {
  return path.join(businessRecordsDir, `${getBusinessKey(moduleName, approvalTypeName)}.json`);
}

async function ensureJsonArrayFile(file) {
  await fs.mkdir(path.dirname(file), { recursive: true });

  try {
    await fs.access(file);
  } catch {
    await fs.writeFile(file, '[]\n', 'utf8');
  }
}

async function readJsonArrayFile(file, label, options = {}) {
  if (options.optional) {
    try {
      await fs.access(file);
    } catch {
      return [];
    }
  } else {
    await ensureJsonArrayFile(file);
  }

  const content = await fs.readFile(file, 'utf8');
  if (!content.trim()) return [];

  const items = JSON.parse(content);
  if (!Array.isArray(items)) {
    throw new Error(`${label} file must contain an array`);
  }

  return items;
}

async function writeJsonArrayFile(file, items) {
  await ensureJsonArrayFile(file);
  const tempFile = `${file}.tmp`;
  await fs.writeFile(tempFile, `${JSON.stringify(items, null, 2)}\n`, 'utf8');
  await fs.rename(tempFile, file);
}

async function readJsonObjectFile(file, fallback = {}) {
  try {
    const content = await fs.readFile(file, 'utf8');
    if (!content.trim()) return { ...fallback };

    const data = JSON.parse(content);
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error(`${path.basename(file)} file must contain an object`);
    }

    return data;
  } catch (error) {
    if (error?.code === 'ENOENT') return { ...fallback };
    throw error;
  }
}

async function writeJsonObjectFile(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tempFile = `${file}.tmp`;
  await fs.writeFile(tempFile, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  await fs.rename(tempFile, file);
}

async function listBusinessRecordFiles() {
  try {
    const entries = await fs.readdir(businessRecordsDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map((entry) => path.join(businessRecordsDir, entry.name));
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
}

async function ensureUploadsIndexFile() {
  await fs.mkdir(uploadsDir, { recursive: true });

  try {
    await fs.access(uploadsIndexFile);
  } catch {
    await fs.writeFile(uploadsIndexFile, '[]\n', 'utf8');
  }
}

async function readUploads() {
  await ensureUploadsIndexFile();
  const content = await fs.readFile(uploadsIndexFile, 'utf8');

  if (!content.trim()) return [];

  const uploads = JSON.parse(content);
  if (!Array.isArray(uploads)) {
    throw new Error('approval uploads file must contain an array');
  }

  return uploads;
}

async function writeUploads(uploads) {
  await ensureUploadsIndexFile();
  const tempFile = `${uploadsIndexFile}.tmp`;
  await fs.writeFile(tempFile, `${JSON.stringify(uploads, null, 2)}\n`, 'utf8');
  await fs.rename(tempFile, uploadsIndexFile);
}

async function readRecords() {
  const legacyRecords = await readJsonArrayFile(recordsFile, 'approval records');
  const businessFiles = await listBusinessRecordFiles();
  const businessRecordGroups = await Promise.all(
    businessFiles.map((file) => readJsonArrayFile(file, 'business approval records', { optional: true })),
  );

  return [...legacyRecords, ...businessRecordGroups.flat()].sort((a, b) => {
    const left = Date.parse(b.createdAt || b.updatedAt || '') || 0;
    const right = Date.parse(a.createdAt || a.updatedAt || '') || 0;
    return left - right;
  });
}

async function writeRecords(records) {
  await writeJsonArrayFile(recordsFile, records);
}

function createSeedAccount(username, role, name) {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    username,
    role,
    name,
    passwordHash: hashPassword('123456'),
    enabled: true,
    createdAt: now,
    updatedAt: now,
  };
}

async function ensureAccountsFile() {
  await fs.mkdir(dataDir, { recursive: true });

  try {
    await fs.access(accountsFile);
  } catch {
    const seedAccounts = [
      createSeedAccount('applicant', 'employee', '张申请'),
      createSeedAccount('approver', 'employee', '李审批'),
      createSeedAccount('boss', 'boss', '王老板'),
    ];
    await fs.writeFile(accountsFile, `${JSON.stringify(seedAccounts, null, 2)}\n`, 'utf8');
  }
}

async function readAccounts() {
  await ensureAccountsFile();
  const content = await fs.readFile(accountsFile, 'utf8');

  if (!content.trim()) return [];

  const accounts = JSON.parse(content);
  if (!Array.isArray(accounts)) {
    throw new Error('approval accounts file must contain an array');
  }

  return accounts;
}

async function writeAccounts(accounts) {
  await ensureAccountsFile();
  const tempFile = `${accountsFile}.tmp`;
  await fs.writeFile(tempFile, `${JSON.stringify(accounts, null, 2)}\n`, 'utf8');
  await fs.rename(tempFile, accountsFile);
}

let writeQueue = Promise.resolve();
let uploadWriteQueue = Promise.resolve();
let accountWriteQueue = Promise.resolve();
let promptWriteQueue = Promise.resolve();
let assistantConfigWriteQueue = Promise.resolve();
let workflowWriteQueue = Promise.resolve();
let organizationWriteQueue = Promise.resolve();

function createBusinessRecord(record) {
  const operation = writeQueue.catch(() => undefined).then(async () => {
    const file = getBusinessRecordFile(record.moduleName, record.approvalTypeName);
    const records = await readJsonArrayFile(file, 'business approval records');
    records.unshift(record);
    await writeJsonArrayFile(file, records);
    return record;
  });

  writeQueue = operation.catch(() => undefined);
  return operation;
}

function updateRecordById(id, mutator) {
  const operation = writeQueue.catch(() => undefined).then(async () => {
    const files = [recordsFile, ...(await listBusinessRecordFiles())];

    for (const file of files) {
      const records = await readJsonArrayFile(file, 'approval records', { optional: true });
      const record = records.find((item) => item.id === id);

      if (record) {
        const result = await mutator(record, records);
        await writeJsonArrayFile(file, records);
        return result;
      }
    }

    const error = new Error('approval record not found');
    error.statusCode = 404;
    throw error;
  });

  writeQueue = operation.catch(() => undefined);
  return operation;
}

function clearRecordFiles() {
  const operation = writeQueue.catch(() => undefined).then(async () => {
    await writeRecords([]);
    const files = await listBusinessRecordFiles();
    await Promise.all(files.map((file) => writeJsonArrayFile(file, [])));
  });

  writeQueue = operation.catch(() => undefined);
  return operation;
}

function updateUploads(mutator) {
  const operation = uploadWriteQueue.catch(() => undefined).then(async () => {
    const uploads = await readUploads();
    const result = await mutator(uploads);
    await writeUploads(uploads);
    return result;
  });

  uploadWriteQueue = operation.catch(() => undefined);
  return operation;
}

function updateAccounts(mutator) {
  const operation = accountWriteQueue.catch(() => undefined).then(async () => {
    const accounts = await readAccounts();
    const result = await mutator(accounts);
    await writeAccounts(accounts);
    return result;
  });

  accountWriteQueue = operation.catch(() => undefined);
  return operation;
}

async function readPromptConfigs() {
  return readJsonArrayFile(aiPromptConfigsFile, 'AI prompt configs');
}

async function writePromptConfigs(configs) {
  await writeJsonArrayFile(aiPromptConfigsFile, configs);
}

function updatePromptConfigs(mutator) {
  const operation = promptWriteQueue.catch(() => undefined).then(async () => {
    const configs = await readPromptConfigs();
    const result = await mutator(configs);
    await writePromptConfigs(configs);
    return result;
  });

  promptWriteQueue = operation.catch(() => undefined);
  return operation;
}

async function readAiAssistantConfig() {
  const config = await readJsonObjectFile(aiAssistantConfigFile, {});
  return {
    prompt: String(config.prompt || defaultAiAssistantPrompt),
    updatedAt: config.updatedAt,
    updatedBy: config.updatedBy,
    isDefault: !config.prompt,
  };
}

function updateAiAssistantConfig(mutator) {
  const operation = assistantConfigWriteQueue.catch(() => undefined).then(async () => {
    const config = await readAiAssistantConfig();
    const result = await mutator(config);
    await writeJsonObjectFile(aiAssistantConfigFile, result);
    return result;
  });

  assistantConfigWriteQueue = operation.catch(() => undefined);
  return operation;
}

function createDefaultOrganizationDirectory() {
  return {
    departments: [
      { id: 'dept-board', name: '董事会', leaderIds: ['qin-an-tang'] },
      { id: 'dept-management', name: '总经办', parentId: 'dept-board', leaderIds: ['fan-lu'] },
      { id: 'dept-sales', name: '销售部', parentId: 'dept-management', leaderIds: ['yang-nan'] },
      { id: 'dept-finance', name: '财务部', parentId: 'dept-management', leaderIds: ['qian-lin'] },
      { id: 'dept-operations', name: '运营清关', parentId: 'dept-management', leaderIds: ['li-qi'] },
      { id: 'dept-admin', name: '行政人事', parentId: 'dept-management', leaderIds: ['lin-jin-biao'] },
      { id: 'dept-warehouse', name: '仓储物流', parentId: 'dept-management', leaderIds: ['huang-song-yuan'] },
    ],
    members: [
      { id: 'qin-an-tang', name: '秦安堂', departmentId: 'dept-board', title: '董事长', enabled: true },
      { id: 'fan-lu', name: '范璐', departmentId: 'dept-management', title: '总经理', supervisorId: 'qin-an-tang', enabled: true },
      { id: 'yang-nan', name: '杨宿南', departmentId: 'dept-sales', title: '业务一部负责人', supervisorId: 'fan-lu', enabled: true },
      { id: 'hong-wei', name: '洪伟', departmentId: 'dept-sales', title: '销售经理', supervisorId: 'yang-nan', enabled: true },
      { id: 'qian-lin', name: '钱琳', departmentId: 'dept-finance', title: '财务总监', supervisorId: 'fan-lu', enabled: true },
      { id: 'hu-ning-fei', name: '胡宁飞', departmentId: 'dept-finance', title: '财务助理', supervisorId: 'qian-lin', enabled: true },
      { id: 'ye-fei', name: '叶飞', departmentId: 'dept-finance', title: '审批人', supervisorId: 'qian-lin', enabled: true },
      { id: 'lin-jin-biao', name: '林金彪', departmentId: 'dept-admin', title: '行政人事', supervisorId: 'fan-lu', enabled: true },
      { id: 'huang-song-yuan', name: '黄松源', departmentId: 'dept-warehouse', title: '仓储负责人', supervisorId: 'fan-lu', enabled: true },
      { id: 'li-qi', name: '利祺', departmentId: 'dept-operations', title: '操作', supervisorId: 'fan-lu', enabled: true },
      { id: 'qin-sheng', name: '秦笙', departmentId: 'dept-management', title: '总助', supervisorId: 'fan-lu', enabled: true },
      { id: 'wang-tumiao', name: '王涂妙', departmentId: 'dept-finance', title: '财务专员', supervisorId: 'qian-lin', enabled: true },
      { id: 'jiang-hua', name: '姜华', departmentId: 'dept-finance', title: '财务专员', supervisorId: 'qian-lin', enabled: true },
    ],
    updatedAt: '2026-05-08T00:00:00.000Z',
  };
}

function createWorkflowId(prefix) {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
}

function createDefaultSubmitPermission() {
  return {
    type: 'all_members',
    memberIds: [],
    departmentIds: [],
    excludedMemberIds: [],
  };
}

function createDefaultCcRule() {
  return {
    timing: 'workflow_completed',
    memberIds: [],
    departmentIds: [],
  };
}

function getLegacyRoleGroupMemberIds(roleGroupId) {
  return LEGACY_ROLE_GROUP_MEMBERS[normalizeWorkflowText(roleGroupId)] || [];
}

function createDefaultApprovalStep(index = 1) {
  return {
    id: createWorkflowId('step'),
    name: `审批节点 ${index}`,
    approverRule: {
      type: 'specific_members',
      memberIds: [],
    },
    approvalMode: 'one_of',
    emptyApproverAction: 'block_submit',
  };
}

function createDefaultWorkflowBranch() {
  return {
    id: 'branch-default',
    name: 'Default Branch',
    isDefault: true,
    conditions: [],
    approvalSteps: [createDefaultApprovalStep(1)],
  };
}

function inferWorkflowBusinessType(value) {
  const normalized = normalizeWorkflowText(value).toLowerCase();
  return WORKFLOW_BUSINESS_TYPES.has(normalized) ? normalized : 'general';
}

function legacyRuleToApprovalStep(node, index = 0) {
  const rule = node?.rule || {};
  let approverRule = { type: 'specific_members', memberIds: [] };

  if (rule.type === 'specified') {
    approverRule = { type: 'specific_members', memberIds: Array.isArray(rule.memberIds) ? rule.memberIds : [] };
  } else if (rule.type === 'role') {
    approverRule = { type: 'specific_members', memberIds: getLegacyRoleGroupMemberIds(rule.roleGroupId) };
  } else if (rule.type === 'direct_supervisor') {
    approverRule = { type: 'submitter_manager' };
  } else if (rule.type === 'nth_supervisor' || rule.type === 'multi_supervisor') {
    approverRule = { type: 'submitter_manager' };
  }

  return {
    id: node?.id || createWorkflowId('step'),
    name: node?.title || `审批节点 ${index + 1}`,
    approverRule,
    approvalMode: 'one_of',
    emptyApproverAction: rule.emptyApproverAction === 'auto_pass' ? 'auto_pass' : 'block_submit',
  };
}

function approvalStepToLegacyNode(step, index = 0) {
  const rule = step?.approverRule || {};
  let legacyRule = { type: 'specified', memberIds: [], emptyApproverAction: step?.emptyApproverAction || 'block_submit' };

  if (rule.type === 'specific_members') {
    legacyRule = {
      type: 'specified',
      memberIds: Array.isArray(rule.memberIds) ? rule.memberIds : [],
      emptyApproverAction: step?.emptyApproverAction || 'block_submit',
    };
  } else if (rule.type === 'submitter_manager' || rule.type === 'department_manager') {
    legacyRule = {
      type: 'direct_supervisor',
      emptyApproverAction: step?.emptyApproverAction || 'block_submit',
    };
  }

  return {
    id: step?.id || createWorkflowId('node'),
    type: 'approver',
    title: step?.name || `审批节点 ${index + 1}`,
    subtitle: step?.approvalMode === 'all_of' ? '所有审批人都需通过' : '任一审批人通过即可',
    rule: legacyRule,
  };
}

function parseLegacyConditionExpression(expression, index = 0) {
  const text = normalizeWorkflowText(expression);
  const numbers = (text.match(/\d+(?:\.\d+)?/g) || []).map(Number);

  if (numbers.length >= 2) {
    return {
      id: createWorkflowId('cond'),
      field: 'amount',
      operator: 'between',
      amountMin: Math.min(numbers[0], numbers[1]),
      amountMax: Math.max(numbers[0], numbers[1]),
      expression: text,
    };
  }

  if (numbers.length === 1) {
    return {
      id: createWorkflowId('cond'),
      field: 'amount',
      operator: text.includes('>') ? 'gt' : 'lte',
      ...(text.includes('>') ? { amountMin: numbers[0] } : { amountMax: numbers[0] }),
      expression: text,
    };
  }

  return {
    id: createWorkflowId('cond'),
    field: 'amount',
    operator: index === 0 ? 'lte' : 'gt',
    expression: text,
  };
}

function normalizeApprovalStep(step, index = 0) {
  const rule = step?.approverRule || {};
  const isLegacyRoleRule = rule.type === 'role_based' || rule.type === 'role';
  const {
    roleGroupId: legacyRoleGroupId,
    roleGroupIds: _legacyRoleGroupIds,
    ...ruleWithoutRoleGroups
  } = rule;
  const ruleType = WORKFLOW_APPROVER_TYPES.has(rule.type) ? rule.type : 'specific_members';
  return {
    id: normalizeWorkflowText(step?.id) || createWorkflowId('step'),
    name: normalizeWorkflowText(step?.name) || `审批节点 ${index + 1}`,
    approverRule: {
      ...ruleWithoutRoleGroups,
      type: ruleType,
      memberIds: isLegacyRoleRule ? getLegacyRoleGroupMemberIds(legacyRoleGroupId) : Array.isArray(rule.memberIds) ? rule.memberIds : [],
      departmentIds: Array.isArray(rule.departmentIds) ? rule.departmentIds : [],
    },
    approvalMode: WORKFLOW_APPROVAL_MODES.has(step?.approvalMode) ? step.approvalMode : 'one_of',
    emptyApproverAction: step?.emptyApproverAction === 'auto_pass' ? 'auto_pass' : 'block_submit',
  };
}

function normalizeWorkflowCondition(condition, index = 0) {
  const field = normalizeWorkflowText(condition?.field) || 'submitter.department';
  const operator = WORKFLOW_CONDITION_OPERATORS.has(condition?.operator)
    ? condition.operator
    : isNumericWorkflowConditionField(field) ? 'lte' : 'eq';
  return {
    id: normalizeWorkflowText(condition?.id) || createWorkflowId('cond'),
    field,
    operator,
    ...(condition?.value ? { value: String(condition.value) } : {}),
    ...(Number.isFinite(Number(condition?.amountMin)) ? { amountMin: Number(condition.amountMin) } : {}),
    ...(Number.isFinite(Number(condition?.amountMax)) ? { amountMax: Number(condition.amountMax) } : {}),
    ...(condition?.expression ? { expression: String(condition.expression) } : {}),
  };
}

function normalizeWorkflowBranches(version) {
  if (Array.isArray(version?.branches) && version.branches.length > 0) {
    const branches = version.branches.map((branch, index) => ({
      id: normalizeWorkflowText(branch?.id) || createWorkflowId('branch'),
      name: normalizeWorkflowText(branch?.name) || (branch?.isDefault ? 'Default Branch' : `Branch ${index + 1}`),
      isDefault: Boolean(branch?.isDefault),
      conditions: Array.isArray(branch?.conditions)
        ? branch.conditions.map((condition, conditionIndex) => normalizeWorkflowCondition(condition, conditionIndex))
        : [],
      approvalSteps: Array.isArray(branch?.approvalSteps)
        ? branch.approvalSteps.map((step, stepIndex) => normalizeApprovalStep(step, stepIndex))
        : [],
    }));

    if (!branches.some((branch) => branch.isDefault)) {
      branches.push(createDefaultWorkflowBranch());
    }

    return branches;
  }

  const nodes = Array.isArray(version?.nodes) ? version.nodes : [];
  const branches = [];
  nodes
    .filter((node) => node?.type === 'condition')
    .flatMap((node) => Array.isArray(node.conditions) ? node.conditions : [])
    .forEach((condition, index) => {
      branches.push({
        id: normalizeWorkflowText(condition.id) || createWorkflowId('branch'),
        name: normalizeWorkflowText(condition.title) || `Branch ${index + 1}`,
        isDefault: false,
        conditions: [parseLegacyConditionExpression(condition.expression, index)],
        approvalSteps: (Array.isArray(condition.nodes) ? condition.nodes : [])
          .filter((node) => node?.type === 'approver')
          .map((node, stepIndex) => legacyRuleToApprovalStep(node, stepIndex)),
      });
    });

  const linearSteps = nodes
    .filter((node) => node?.type === 'approver')
    .map((node, index) => legacyRuleToApprovalStep(node, index));

  branches.push({
    id: 'branch-default',
    name: 'Default Branch',
    isDefault: true,
    conditions: [],
    approvalSteps: linearSteps.length > 0 ? linearSteps : [createDefaultApprovalStep(1)],
  });

  return branches;
}

function normalizeWorkflowDraft(draft) {
  const nextDraft = JSON.parse(JSON.stringify(draft || {}));
  const name = normalizeWorkflowText(nextDraft.basic?.name || nextDraft.name || '新审批流');
  const businessType = inferWorkflowBusinessType(nextDraft.businessType);
  const branches = normalizeWorkflowBranches(nextDraft);
  const defaultBranch = branches.find((branch) => branch.isDefault) || branches[branches.length - 1];
  const legacyNodes = [
    { id: 'node-start', type: 'start', title: '发起人', subtitle: 'Applicant' },
    ...((defaultBranch?.approvalSteps || []).map((step, index) => approvalStepToLegacyNode(step, index))),
  ];

  return {
    ...nextDraft,
    id: normalizeWorkflowText(nextDraft.id) || createWorkflowId('draft'),
    version: Number(nextDraft.version || 1),
    status: nextDraft.status || 'draft',
    organizationId: normalizeWorkflowText(nextDraft.organizationId) || DEFAULT_ORGANIZATION_ID,
    businessType,
    basic: {
      name,
      moduleName: normalizeWorkflowText(nextDraft.basic?.moduleName || nextDraft.moduleName || '审批流配置'),
      approvalTypeName: normalizeWorkflowText(nextDraft.basic?.approvalTypeName || nextDraft.approvalTypeName || businessType),
      visibleRange: normalizeWorkflowText(nextDraft.basic?.visibleRange || 'all'),
    },
    submitPermission: {
      ...createDefaultSubmitPermission(),
      ...(nextDraft.submitPermission || {}),
      memberIds: Array.isArray(nextDraft.submitPermission?.memberIds) ? nextDraft.submitPermission.memberIds : [],
      departmentIds: Array.isArray(nextDraft.submitPermission?.departmentIds) ? nextDraft.submitPermission.departmentIds : [],
      excludedMemberIds: Array.isArray(nextDraft.submitPermission?.excludedMemberIds) ? nextDraft.submitPermission.excludedMemberIds : [],
    },
    branches,
    ccRule: {
      ...createDefaultCcRule(),
      ...(nextDraft.ccRule || {}),
      memberIds: Array.isArray(nextDraft.ccRule?.memberIds) ? nextDraft.ccRule.memberIds : [],
      departmentIds: Array.isArray(nextDraft.ccRule?.departmentIds) ? nextDraft.ccRule.departmentIds : [],
      timing: 'workflow_completed',
    },
    formFields: Array.isArray(nextDraft.formFields) ? nextDraft.formFields : [],
    nodes: legacyNodes,
  };
}

function normalizeWorkflowTemplate(template) {
  const draft = normalizeWorkflowDraft(template?.draft || createDefaultWorkflowVersion('draft'));
  const publishedVersion = template?.publishedVersion ? normalizeWorkflowDraft(template.publishedVersion) : undefined;
  const organizationId = normalizeWorkflowText(template?.organizationId || draft.organizationId) || DEFAULT_ORGANIZATION_ID;
  const businessType = inferWorkflowBusinessType(template?.businessType || draft.businessType);

  return {
    ...template,
    id: normalizeWorkflowText(template?.id) || createWorkflowId('workflow'),
    name: normalizeWorkflowText(template?.name || draft.basic.name) || '新审批流',
    organizationId,
    businessType,
    moduleName: normalizeWorkflowText(template?.moduleName || draft.basic.moduleName) || '审批流配置',
    approvalTypeName: normalizeWorkflowText(template?.approvalTypeName || draft.basic.approvalTypeName) || businessType,
    status: ['draft', 'published', 'disabled'].includes(template?.status) ? template.status : 'draft',
    currentVersion: Number(template?.currentVersion || publishedVersion?.version || draft.version || 1),
    draft,
    ...(publishedVersion ? { publishedVersion } : {}),
  };
}

function isNumericWorkflowConditionField(field) {
  const normalizedField = normalizeWorkflowText(field);
  const label = normalizedField.startsWith('form:') ? normalizedField.slice(5) : normalizedField;
  return normalizedField === 'amount' || /金额|价格|费用|利润|汇率|数量|总额|时长|天数|小时|修改前|修改后/.test(label);
}

function validateWorkflowDraftForPublish(draft) {
  const errors = [];
  const name = normalizeWorkflowText(draft?.basic?.name);
  const submitPermission = draft?.submitPermission || {};
  const branches = Array.isArray(draft?.branches) ? draft.branches : [];
  const defaultBranch = branches.find((branch) => branch?.isDefault);

  if (!name) errors.push('审批流名称不能为空');

  const permissionType = submitPermission.type;
  const hasSubmitScope = permissionType === 'all_members' ||
    (permissionType === 'members' && Array.isArray(submitPermission.memberIds) && submitPermission.memberIds.length > 0) ||
    (permissionType === 'departments' && Array.isArray(submitPermission.departmentIds) && submitPermission.departmentIds.length > 0);
  if (!hasSubmitScope) errors.push('至少配置一个提交权限范围');
  if (!defaultBranch) errors.push('必须包含 default branch');

  branches.forEach((branch, branchIndex) => {
    const branchName = branch?.name || `Branch ${branchIndex + 1}`;
    if (!Array.isArray(branch.approvalSteps) || branch.approvalSteps.length === 0) {
      errors.push(`${branchName} 至少需要一个审批节点`);
    }

    if (!branch.isDefault) {
      if (!Array.isArray(branch.conditions) || branch.conditions.length === 0) {
        errors.push(`${branchName} 必须配置条件`);
      }

      (branch.conditions || []).forEach((condition) => {
        if (!condition?.field || !condition?.operator) {
          errors.push(`${branchName} 条件不完整`);
          return;
        }

        if (isNumericWorkflowConditionField(condition.field)) {
          if (condition.operator === 'between') {
            if (!Number.isFinite(Number(condition.amountMin)) || !Number.isFinite(Number(condition.amountMax))) {
              errors.push(`${branchName} 数值区间必须填写有效数字`);
            }
          } else if (condition.operator === 'lte' && !Number.isFinite(Number(condition.amountMax))) {
            errors.push(`${branchName} 数值上限必须填写有效数字`);
          } else if (condition.operator === 'gt' && !Number.isFinite(Number(condition.amountMin))) {
            errors.push(`${branchName} 数值下限必须填写有效数字`);
          }
        } else if (!normalizeWorkflowText(condition.value)) {
          errors.push(`${branchName} 条件值不能为空`);
        }
      });
    }

    (branch.approvalSteps || []).forEach((step, stepIndex) => {
      const stepLabel = `${branchName} / Step ${stepIndex + 1}`;
      const rule = step?.approverRule || {};
      if (!WORKFLOW_APPROVER_TYPES.has(rule.type)) {
        errors.push(`${stepLabel} 必须配置审批人规则`);
      } else if (rule.type === 'specific_members' && (!Array.isArray(rule.memberIds) || rule.memberIds.length === 0)) {
        errors.push(`${stepLabel} 必须选择指定成员`);
      }
    });
  });

  return errors;
}

function createDefaultWorkflowVersion(status = 'draft') {
  const baseNodes = [
    {
      id: 'node-supervisor',
      type: 'approver',
      title: '直接主管',
      subtitle: '从直接主管到第4级主管',
      rule: { type: 'multi_supervisor', supervisorDepth: 4, emptyApproverAction: 'auto_pass' },
    },
    {
      id: 'node-finance-director',
      type: 'approver',
      title: '财务总监',
      subtitle: '钱琳',
      rule: { type: 'specified', memberIds: ['qian-lin'], emptyApproverAction: 'block_submit' },
    },
    {
      id: 'node-finance-approval',
      type: 'approver',
      title: '审批人',
      subtitle: '叶飞',
      rule: { type: 'specified', memberIds: ['ye-fei'], emptyApproverAction: 'block_submit' },
    },
    {
      id: 'node-gm-countersign',
      type: 'approver',
      title: '总经理',
      subtitle: '总经理会签',
      rule: { type: 'specified', memberIds: ['fan-lu'], emptyApproverAction: 'block_submit' },
    },
  ];

  const branchRanges = [
    ['cond-1', '条件1', '付款总额 <= 10000'],
    ['cond-2', '条件2', '10000 < 付款总额 <= 50000'],
    ['cond-3', '条件3', '50000 < 付款总额 <= 200000'],
    ['cond-4', '条件4', '付款总额 > 200000'],
  ];

  return {
    id: `version-${status}-1`,
    version: 1,
    status,
    organizationId: DEFAULT_ORGANIZATION_ID,
    businessType: 'purchase',
    basic: {
      name: '预付款申请',
      moduleName: '资金',
      approvalTypeName: '预付款申请',
      visibleRange: '全公司',
    },
    submitPermission: createDefaultSubmitPermission(),
    branches: [
      ...branchRanges.map(([id, title, expression], index) => ({
        id,
        name: title,
        isDefault: false,
        conditions: [parseLegacyConditionExpression(expression, index)],
        approvalSteps: baseNodes.map((node, stepIndex) => legacyRuleToApprovalStep({
          ...node,
          id: `${node.id}-${index + 1}`,
        }, stepIndex)),
      })),
      {
        id: 'branch-default',
        name: 'Default Branch',
        isDefault: true,
        conditions: [],
        approvalSteps: [
          legacyRuleToApprovalStep({
            id: 'node-chairman',
            type: 'approver',
            title: '董事长',
            subtitle: '董事长会签',
            rule: { type: 'specified', memberIds: ['qin-an-tang'], emptyApproverAction: 'block_submit' },
          }, 0),
        ],
      },
    ],
    ccRule: {
      timing: 'workflow_completed',
      memberIds: ['qin-sheng', 'wang-tumiao', 'jiang-hua', 'qian-lin'],
      departmentIds: [],
    },
    formFields: [
      { id: 'field-vendor', label: '供应商', type: 'text', required: true },
      { id: 'field-currency', label: '币种', type: 'select', required: true },
      { id: 'field-amount', label: '付款总额', type: 'money', required: true },
      { id: 'field-account', label: '预付账单编号', type: 'text', required: true },
      { id: 'field-attachment', label: '附件', type: 'attachment', required: false },
    ],
    nodes: [
      { id: 'node-start', type: 'start', title: '发起人', subtitle: '金华魔术信息科技有限公司' },
      {
        id: 'node-amount-conditions',
        type: 'condition',
        title: '金额条件',
        subtitle: '按付款总额自动分支',
        conditions: branchRanges.map(([id, title, expression], index) => ({
          id,
          title,
          expression,
          priority: index + 1,
          nodes: baseNodes.map((node) => ({
            ...node,
            id: `${node.id}-${index + 1}`,
          })),
        })),
      },
      {
        id: 'node-chairman',
        type: 'approver',
        title: '董事长',
        subtitle: '董事长会签',
        rule: { type: 'specified', memberIds: ['qin-an-tang'], emptyApproverAction: 'block_submit' },
      },
      {
        id: 'node-copy',
        type: 'cc',
        title: '抄送对象',
        subtitle: '秦笙、王涂妙、姜华、钱琳',
        rule: { type: 'specified', memberIds: ['qin-sheng', 'wang-tumiao', 'jiang-hua', 'qian-lin'] },
      },
    ],
    advanced: {
      allowWithdraw: true,
      allowTransfer: true,
      enablePrint: true,
      autoArchive: true,
    },
    savedAt: '2026-05-08T00:00:00.000Z',
  };
}

function createDefaultWorkflowTemplate() {
  const draft = createDefaultWorkflowVersion('draft');
  return {
    id: 'workflow-prepayment',
    name: draft.basic.name,
    organizationId: draft.organizationId,
    businessType: draft.businessType,
    moduleName: draft.basic.moduleName,
    approvalTypeName: draft.basic.approvalTypeName,
    status: 'draft',
    currentVersion: 1,
    draft,
    updatedAt: draft.savedAt,
  };
}

async function readWorkflowTemplates() {
  const templates = await readJsonArrayFile(workflowTemplatesFile, 'workflow templates', { optional: true });
  return (templates.length > 0 ? templates : [createDefaultWorkflowTemplate()]).map(normalizeWorkflowTemplate);
}

async function writeWorkflowTemplates(templates) {
  await writeJsonArrayFile(workflowTemplatesFile, templates);
}

function updateWorkflowTemplates(mutator) {
  const operation = workflowWriteQueue.catch(() => undefined).then(async () => {
    const templates = await readWorkflowTemplates();
    const result = await mutator(templates);
    await writeWorkflowTemplates(templates);
    return result;
  });

  workflowWriteQueue = operation.catch(() => undefined);
  return operation;
}

async function readOrganizationDirectory() {
  const directory = await readJsonObjectFile(organizationFile, {});
  if (
    !Array.isArray(directory.departments) ||
    !Array.isArray(directory.members)
  ) {
    return createDefaultOrganizationDirectory();
  }

  return {
    ...normalizeOrganizationDirectoryInput({
      departments: directory.departments,
      members: directory.members,
    }),
    ...(directory.updatedAt ? { updatedAt: directory.updatedAt } : {}),
  };
}

function assertUniqueIds(items, label) {
  const seen = new Set();
  items.forEach((item) => {
    if (!item.id) {
      throw createHttpError(`${label} id is required`, 400);
    }

    if (seen.has(item.id)) {
      throw createHttpError(`duplicate ${label} id: ${item.id}`, 400);
    }

    seen.add(item.id);
  });
}

function hasParentCycle(items, id, parentKey) {
  const itemsById = new Map(items.map((item) => [item.id, item]));
  const seen = new Set();
  let current = itemsById.get(id);

  while (current?.[parentKey]) {
    if (seen.has(current.id)) return true;
    seen.add(current.id);
    current = itemsById.get(current[parentKey]);
  }

  return false;
}

function normalizeOrganizationMemberTitle(member) {
  const title = normalizeWorkflowText(member?.title);
  if (title !== '抄送人') return title;
  if (member?.id === 'qin-sheng') return '总助';
  if (member?.departmentId === 'dept-finance') return '财务专员';
  return '成员';
}

function normalizeOrganizationDirectoryInput({ departments, members }) {
  const normalizedDepartments = departments.map((department) => ({
    id: normalizeWorkflowText(department?.id),
    name: normalizeWorkflowText(department?.name),
    ...(normalizeWorkflowText(department?.parentId) ? { parentId: normalizeWorkflowText(department.parentId) } : {}),
    leaderIds: Array.isArray(department?.leaderIds)
      ? department.leaderIds.map(normalizeWorkflowText).filter(Boolean)
      : [],
  }));
  const normalizedMembers = members.map((member) => ({
    id: normalizeWorkflowText(member?.id),
    name: normalizeWorkflowText(member?.name),
    ...(normalizeWorkflowText(member?.accountUsername) ? { accountUsername: normalizeWorkflowText(member.accountUsername) } : {}),
    departmentId: normalizeWorkflowText(member?.departmentId),
    title: normalizeOrganizationMemberTitle(member),
    ...(normalizeWorkflowText(member?.supervisorId) ? { supervisorId: normalizeWorkflowText(member.supervisorId) } : {}),
    enabled: member?.enabled !== false,
  }));

  const directory = {
    departments: normalizedDepartments,
    members: normalizedMembers,
  };

  validateOrganizationDirectory(directory);
  return directory;
}

function validateOrganizationDirectory(directory) {
  assertUniqueIds(directory.departments, 'department');
  assertUniqueIds(directory.members, 'member');

  const departmentIds = new Set(directory.departments.map((department) => department.id));
  const memberIds = new Set(directory.members.map((member) => member.id));
  const accountUsernames = new Map();

  directory.departments.forEach((department) => {
    if (!department.name) {
      throw createHttpError('department name is required', 400);
    }

    if (department.parentId) {
      if (!departmentIds.has(department.parentId)) {
        throw createHttpError(`department parent does not exist: ${department.name}`, 400);
      }

      if (department.parentId === department.id || hasParentCycle(directory.departments, department.id, 'parentId')) {
        throw createHttpError(`department hierarchy has a cycle: ${department.name}`, 400);
      }
    }

    (department.leaderIds || []).forEach((leaderId) => {
      if (!memberIds.has(leaderId)) {
        throw createHttpError(`department leader does not exist: ${department.name}`, 400);
      }
    });
  });

  directory.members.forEach((member) => {
    if (!member.name) {
      throw createHttpError('member name is required', 400);
    }

    if (!departmentIds.has(member.departmentId)) {
      throw createHttpError(`member must belong to a valid department: ${member.name}`, 400);
    }

    if (member.supervisorId) {
      if (!memberIds.has(member.supervisorId)) {
        throw createHttpError(`member supervisor does not exist: ${member.name}`, 400);
      }

      if (member.supervisorId === member.id || hasParentCycle(directory.members, member.id, 'supervisorId')) {
        throw createHttpError(`member reporting line has a cycle: ${member.name}`, 400);
      }
    }

    if (member.accountUsername) {
      const previousOwner = accountUsernames.get(member.accountUsername);
      if (previousOwner) {
        throw createHttpError(`account is bound to multiple members: ${member.accountUsername}`, 400);
      }
      accountUsernames.set(member.accountUsername, member.id);
    }
  });
}

function updateOrganizationDirectory(mutator) {
  const operation = organizationWriteQueue.catch(() => undefined).then(async () => {
    const directory = await readOrganizationDirectory();
    const result = await mutator(directory);
    await writeJsonObjectFile(organizationFile, result);
    return result;
  });

  organizationWriteQueue = operation.catch(() => undefined);
  return operation;
}

function createHttpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeWorkflowText(value) {
  return String(value || '').trim();
}

function getPublishedVersion(template) {
  if (template?.status !== 'published') return null;
  if (!template.publishedVersion || template.publishedVersion.status === 'disabled') return null;
  return template.publishedVersion;
}

async function findPublishedWorkflow(moduleName, approvalTypeName) {
  const templates = await readWorkflowTemplates();
  return templates.find((template) => {
    const version = getPublishedVersion(template);
    return version &&
      normalizeWorkflowText(version.basic?.moduleName || template.moduleName) === normalizeWorkflowText(moduleName) &&
      normalizeWorkflowText(version.basic?.approvalTypeName || template.approvalTypeName) === normalizeWorkflowText(approvalTypeName);
  }) || null;
}

function parseWorkflowNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return undefined;

  const normalized = value.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  if (!normalized) return undefined;

  const number = Number(normalized[0]);
  return Number.isFinite(number) ? number : undefined;
}

function normalizeComparableText(value) {
  return normalizeWorkflowText(value).toLowerCase();
}

function findBusinessDataValue(businessData, aliases) {
  if (!businessData || typeof businessData !== 'object') return undefined;

  const entries = Object.entries(businessData);
  const normalizedAliases = aliases.map(normalizeComparableText).filter(Boolean);
  const exact = entries.find(([key]) => normalizedAliases.includes(normalizeComparableText(key)));
  if (exact) return exact[1];

  const loose = entries.find(([key]) => {
    const normalizedKey = normalizeComparableText(key);
    return normalizedAliases.some((alias) => normalizedKey.includes(alias));
  });

  return loose?.[1];
}

function getWorkflowConditionValue(condition, context) {
  const { businessData, applicantMember, directory } = context || {};
  const field = normalizeWorkflowText(condition?.field);

  if (field.startsWith('form:')) {
    const formFieldName = field.slice(5);
    return findBusinessDataValue(businessData, [formFieldName]);
  }

  if (field === 'submitter.member') {
    return applicantMember
      ? `${applicantMember.id || ''} ${applicantMember.name || ''} ${applicantMember.accountUsername || ''}`
      : undefined;
  }

  if (field === 'submitter.department') {
    const department = (directory?.departments || []).find((item) => item.id === applicantMember?.departmentId);
    return department ? `${department.id} ${department.name}` : applicantMember?.departmentId;
  }

  if (field === 'amount') {
    return findBusinessDataValue(businessData, ['amount', '金额', '付款总额', '付款金额', '报销金额', '填写价格', '标准价格', '申请利润']);
  }

  if (field === 'category') {
    return findBusinessDataValue(businessData, ['category', '类别', '类型', '费用类型', '审批类型', '收支类型']);
  }

  if (field === 'project') {
    return findBusinessDataValue(businessData, ['project', '项目', '订单号', '任务单', '班列', '线路', '业务明细']);
  }

  if (field === 'department') {
    const businessDepartment = findBusinessDataValue(businessData, ['department', '部门', '所属部门']);
    if (businessDepartment) return businessDepartment;

    const department = (directory?.departments || []).find((item) => item.id === applicantMember?.departmentId);
    return department ? `${department.id} ${department.name}` : applicantMember?.departmentId;
  }

  return findBusinessDataValue(businessData, [field]);
}

function workflowConditionMatches(condition, context) {
  const actualValue = getWorkflowConditionValue(condition, context);
  const actualNumber = parseWorkflowNumber(actualValue);

  if (isNumericWorkflowConditionField(condition.field) || actualNumber !== undefined) {
    if (condition.operator === 'between') {
      return actualNumber !== undefined
        && actualNumber > Number(condition.amountMin)
        && actualNumber <= Number(condition.amountMax);
    }
    if (condition.operator === 'gt') {
      return actualNumber !== undefined && actualNumber > Number(condition.amountMin);
    }
    if (condition.operator === 'lte') {
      return actualNumber !== undefined && actualNumber <= Number(condition.amountMax);
    }
  }

  const expected = normalizeComparableText(condition.value);
  const actual = normalizeComparableText(actualValue);
  if (!expected || !actual) return false;

  return condition.operator === 'eq'
    ? actual === expected || actual.includes(expected)
    : actual.includes(expected);
}

function selectWorkflowBranch(version, context) {
  const branches = Array.isArray(version?.branches) ? version.branches : [];
  if (branches.length === 0) return null;

  const defaultBranch = branches.find((branch) => branch?.isDefault) || null;
  const matchedBranch = branches.find((branch) => (
    !branch?.isDefault
    && Array.isArray(branch.conditions)
    && branch.conditions.length > 0
    && branch.conditions.every((condition) => workflowConditionMatches(condition, context))
  ));

  return matchedBranch || defaultBranch || branches[0];
}

function getLinearApproverNodes(version, context = {}) {
  const selectedBranch = selectWorkflowBranch(version, context);
  if (selectedBranch) {
    return (selectedBranch.approvalSteps || []).map((step, index) => approvalStepToLegacyNode(step, index));
  }

  return Array.isArray(version?.nodes)
    ? version.nodes.filter((node) => node?.type === 'approver')
    : [];
}

function findMemberByAccount(directory, username) {
  return (directory.members || []).find((member) => (
    member.enabled !== false &&
    normalizeWorkflowText(member.accountUsername).toLowerCase() === normalizeWorkflowText(username).toLowerCase()
  )) || null;
}

function findMemberById(directory, memberId) {
  return (directory.members || []).find((member) => member.id === memberId && member.enabled !== false) || null;
}

function toApproverSnapshot(member) {
  return {
    memberId: member.id,
    name: member.name,
    accountUsername: member.accountUsername,
  };
}

function toCcRecipientSnapshot(member) {
  return {
    memberId: member.id,
    name: member.name,
    ...(member.accountUsername ? { accountUsername: member.accountUsername } : {}),
  };
}

function uniqueMembers(members) {
  const seen = new Set();
  return members.filter((member) => {
    if (!member || seen.has(member.id)) return false;
    seen.add(member.id);
    return true;
  });
}

function getSupervisorAtLevel(directory, member, level) {
  let current = member;
  const targetLevel = Math.max(1, Number(level) || 1);

  for (let index = 0; index < targetLevel; index += 1) {
    if (!current?.supervisorId) return null;
    current = findMemberById(directory, current.supervisorId);
  }

  return current || null;
}

function getSupervisorChain(directory, member, depth) {
  const supervisors = [];
  let current = member;
  const maxDepth = Math.max(1, Number(depth) || 1);

  for (let index = 0; index < maxDepth; index += 1) {
    const supervisor = getSupervisorAtLevel(directory, current, 1);
    if (!supervisor) break;
    supervisors.push(supervisor);
    current = supervisor;
  }

  return supervisors;
}

function resolveApproversForRule(rule, directory, applicantMember) {
  const approverRule = rule || { type: 'specified', memberIds: [] };
  let members = [];

  if (approverRule.type === 'specified') {
    members = (approverRule.memberIds || []).map((memberId) => findMemberById(directory, memberId)).filter(Boolean);
  } else if (approverRule.type === 'role') {
    members = getLegacyRoleGroupMemberIds(approverRule.roleGroupId).map((memberId) => findMemberById(directory, memberId)).filter(Boolean);
  } else if (approverRule.type === 'direct_supervisor') {
    if (!applicantMember) {
      throw createHttpError('Cannot resolve direct supervisor because applicant is not bound to organization.', 400);
    }
    members = [getSupervisorAtLevel(directory, applicantMember, 1)].filter(Boolean);
  } else if (approverRule.type === 'nth_supervisor') {
    if (!applicantMember) {
      throw createHttpError('Cannot resolve supervisor because applicant is not bound to organization.', 400);
    }
    members = [getSupervisorAtLevel(directory, applicantMember, approverRule.supervisorLevel || 1)].filter(Boolean);
  } else if (approverRule.type === 'multi_supervisor') {
    if (!applicantMember) {
      throw createHttpError('Cannot resolve supervisor chain because applicant is not bound to organization.', 400);
    }
    members = getSupervisorChain(directory, applicantMember, approverRule.supervisorDepth || 1);
  }

  return uniqueMembers(members).filter((member) => normalizeWorkflowText(member.accountUsername));
}

function resolveCcRecipientsForRule(ccRule, directory) {
  const rule = ccRule || createDefaultCcRule();
  const members = [];
  const departmentIds = new Set(Array.isArray(rule.departmentIds) ? rule.departmentIds : []);

  (Array.isArray(rule.memberIds) ? rule.memberIds : []).forEach((memberId) => {
    members.push(findMemberById(directory, memberId));
  });

  if (departmentIds.size > 0) {
    (directory.members || []).forEach((member) => {
      if (member.enabled !== false && departmentIds.has(member.departmentId)) {
        members.push(member);
      }
    });
  }

  return uniqueMembers(members).map(toCcRecipientSnapshot);
}

function createWorkflowStep(node, order, approvers, status = STEP_NOT_STARTED, comment) {
  return {
    stepId: node.id || `step-${order}`,
    name: node.title || `Step ${order}`,
    order,
    approvers: approvers.map(toApproverSnapshot),
    status,
    ...(comment ? { comment } : {}),
  };
}

async function createWorkflowInstanceForRecord({ moduleName, approvalTypeName, applicantUsername, businessData }) {
  const template = await findPublishedWorkflow(moduleName, approvalTypeName);
  if (!template) {
    throw createHttpError('No published approval workflow matches this business type. Please ask an administrator to configure and publish one.', 400);
  }

  const version = getPublishedVersion(template);
  const directory = await readOrganizationDirectory();
  const applicantMember = findMemberByAccount(directory, applicantUsername);
  const ccRecipients = resolveCcRecipientsForRule(version.ccRule, directory);
  const nodes = getLinearApproverNodes(version, { businessData, directory, applicantMember });
  if (nodes.length === 0) {
    throw createHttpError('The matched approval workflow has no linear approval steps.', 400);
  }

  const steps = [];

  nodes.forEach((node, index) => {
    const rule = node.rule || {};
    const approvers = resolveApproversForRule(rule, directory, applicantMember);

    if (approvers.length === 0) {
      if (rule.emptyApproverAction === 'auto_pass') {
        steps.push(createWorkflowStep(node, index, [], STEP_SKIPPED, 'No approver was resolved; step was skipped automatically.'));
        return;
      }

      throw createHttpError(`No approver can be resolved for workflow step: ${node.title || index + 1}.`, 400);
    }

    steps.push(createWorkflowStep(node, index, approvers));
  });

  const firstPendingIndex = steps.findIndex((step) => step.status === STEP_NOT_STARTED);
  if (firstPendingIndex >= 0) {
    steps[firstPendingIndex].status = STEP_PENDING;
  }

  return {
    instance: {
      workflowId: template.id,
      workflowName: version.basic?.name || template.name,
      workflowVersion: Number(version.version || template.currentVersion || 1),
      currentStepIndex: firstPendingIndex,
      steps,
    },
    ccRecipients,
    initialStatus: firstPendingIndex >= 0 ? STATUS_PENDING : STATUS_APPROVED,
  };
}

function getCurrentWorkflowStep(record) {
  const instance = record?.workflowInstance;
  if (!instance || !Array.isArray(instance.steps)) return null;
  const currentStep = instance.steps[Number(instance.currentStepIndex)];
  return currentStep?.status === STEP_PENDING ? currentStep : null;
}

function canUserApproveRecord(user, record) {
  if (!user || record?.status !== STATUS_PENDING) return false;

  const currentStep = getCurrentWorkflowStep(record);
  if (!record.workflowInstance) {
    return ['boss', 'developer'].includes(normalizeRole(user.role));
  }

  if (!currentStep) return false;
  return (currentStep.approvers || []).some((approver) => (
    normalizeWorkflowText(approver.accountUsername).toLowerCase() === normalizeWorkflowText(user.username).toLowerCase()
  ));
}

function hasUserHandledWorkflowRecord(user, record) {
  if (!user || !record?.workflowInstance?.steps) return false;

  return record.workflowInstance.steps.some((step) => (
    normalizeWorkflowText(step.actedByAccountUsername).toLowerCase() === normalizeWorkflowText(user.username).toLowerCase()
  ));
}

function isWorkflowClosed(record) {
  return [STATUS_APPROVED, STATUS_REJECTED].includes(record?.status);
}

function hasUserCcAccess(user, record) {
  if (!user || !isWorkflowClosed(record)) return false;

  return (record.ccRecipients || []).some((recipient) => (
    normalizeWorkflowText(recipient.accountUsername).toLowerCase() === normalizeWorkflowText(user.username).toLowerCase()
  ));
}

function canUserSeeRecord(user, record) {
  const role = normalizeRole(user?.role);
  if (role === 'boss' || role === 'developer') return true;
  if (!user) return false;

  return (
    record.applicant === user.name
    || record.approver === user.name
    || canUserApproveRecord(user, record)
    || hasUserHandledWorkflowRecord(user, record)
    || hasUserCcAccess(user, record)
  );
}

function appendApprovalLog(record, action, user, details, step) {
  record.logs = [
    ...(record.logs || []),
    {
      ...createLog(action, user.name),
      details,
      ...(step ? { stepId: step.stepId, stepName: step.name } : {}),
    },
  ];
}

function getCcRecipientNames(record) {
  return (record.ccRecipients || [])
    .map((recipient) => recipient.name)
    .filter(Boolean)
    .join('、');
}

function appendCcLog(record, user) {
  const recipientNames = getCcRecipientNames(record);
  if (!recipientNames) return;
  appendApprovalLog(record, '抄送', user, `流程结束，已同步给：${recipientNames}`);
}

function getActingApprover(user, step) {
  return (step.approvers || []).find((approver) => (
    normalizeWorkflowText(approver.accountUsername).toLowerCase() === normalizeWorkflowText(user.username).toLowerCase()
  )) || null;
}

function advanceWorkflowRecord(record, user, status, reason) {
  const currentStep = getCurrentWorkflowStep(record);
  if (!currentStep) {
    throw createHttpError('approval record has no pending workflow step', 409);
  }

  const actingApprover = getActingApprover(user, currentStep);
  if (!actingApprover) {
    throw createHttpError('current user is not an approver for this workflow step', 403);
  }

  const now = new Date().toISOString();
  const comment = String(reason || '').trim();
  currentStep.actedByMemberId = actingApprover.memberId;
  currentStep.actedByName = user.name;
  currentStep.actedByAccountUsername = user.username;
  currentStep.actedAt = now;
  currentStep.comment = status === STATUS_REJECTED ? comment : (comment || 'Approved');

  record.updatedAt = now;
  record.approver = user.name;

  if (status === STATUS_REJECTED) {
    currentStep.status = STEP_REJECTED;
    record.status = STATUS_REJECTED;
    record.rejectedAt = now;
    record.rejectReason = comment;
    appendApprovalLog(record, '\u62d2\u7edd', user, comment, currentStep);
    appendCcLog(record, user);
    return record;
  }

  currentStep.status = STEP_APPROVED;
  appendApprovalLog(record, '\u6279\u51c6', user, `${currentStep.name} approved`, currentStep);

  const nextStepIndex = record.workflowInstance.steps.findIndex((step) => step.status === STEP_NOT_STARTED);
  if (nextStepIndex >= 0) {
    record.workflowInstance.steps[nextStepIndex].status = STEP_PENDING;
    record.workflowInstance.currentStepIndex = nextStepIndex;
    appendApprovalLog(record, '\u6d41\u7a0b\u63a8\u8fdb', user, `Moved to ${record.workflowInstance.steps[nextStepIndex].name}`, record.workflowInstance.steps[nextStepIndex]);
  } else {
    record.workflowInstance.currentStepIndex = -1;
    record.status = STATUS_APPROVED;
    record.approvedAt = now;
    appendApprovalLog(record, '\u5b8c\u6210', user, 'Workflow approved', currentStep);
    appendCcLog(record, user);
  }

  return record;
}

async function findAccount(username) {
  if (username === superAdmin.username) return superAdmin;

  const accounts = await readAccounts();
  return accounts.find((account) => account.username === username && account.enabled !== false) || null;
}

function sanitizeUploadName(name) {
  const baseName = path.basename(String(name || 'attachment'));
  return baseName.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').slice(0, 180) || 'attachment';
}

function getUploadBase64(data) {
  const value = String(data || '');
  const commaIndex = value.indexOf(',');
  return commaIndex >= 0 ? value.slice(commaIndex + 1) : value;
}

function createLog(action, user, details) {
  return {
    action,
    user,
    time: new Date().toISOString(),
    details,
  };
}

function getDefaultAiPrompt(moduleName, approvalTypeName) {
  const focus =
    defaultAiPromptFocus[`${moduleName}|${approvalTypeName}`] ||
    `围绕“${moduleName}/${approvalTypeName}”核对字段完整性、业务合理性和明显风险。`;

  return `${defaultAiPromptBase}\n业务关注点：${focus}\n输出要求：只输出一行，不要解释过程。`;
}

function toAiPromptConfig(moduleName, approvalTypeName, savedConfig) {
  return {
    key: getPromptKey(moduleName, approvalTypeName),
    moduleName,
    approvalTypeName,
    prompt: savedConfig?.prompt || getDefaultAiPrompt(moduleName, approvalTypeName),
    updatedAt: savedConfig?.updatedAt,
    updatedBy: savedConfig?.updatedBy,
    isDefault: !savedConfig,
  };
}

async function getAiPromptConfig(moduleName, approvalTypeName) {
  const configs = await readPromptConfigs();
  const key = getPromptKey(moduleName, approvalTypeName);
  const savedConfig = configs.find((config) => config.key === key);
  return toAiPromptConfig(moduleName, approvalTypeName, savedConfig);
}

function isAttachmentList(value) {
  return Array.isArray(value) && value.every((item) => {
    return !!item && typeof item === 'object' && 'name' in item && 'type' in item;
  });
}

function sanitizeForAi(value) {
  if (isAttachmentList(value)) {
    return {
      附件数量: value.length,
      附件: value.map((attachment) => ({
        name: String(attachment.name || ''),
        type: String(attachment.type || ''),
      })),
    };
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map(sanitizeForAi);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !['data', 'url', 'storedName', 'uploadedBy'].includes(key))
        .map(([key, item]) => [key, sanitizeForAi(item)]),
    );
  }

  return value;
}

function limitText(value, maxLength = 5000) {
  const text = String(value || '').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function normalizeAiSuggestionText(rawText) {
  let displayText = String(rawText || '')
    .replace(/^[\s"'“”]+|[\s"'“”]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!displayText) {
    throw new Error('empty AI suggestion');
  }

  if (!/(低|中|高)风险/.test(displayText)) {
    displayText = `中风险：${displayText.replace(/^建议[:：]?/, '建议')}`;
  }

  if (displayText.length > 90) {
    displayText = `${displayText.slice(0, 89)}…`;
  }

  return displayText;
}

function parseAiSuggestion(rawText) {
  const rawResponseText = String(rawText || '');
  const displayText = normalizeAiSuggestionText(rawText);
  const riskMatch = displayText.match(/(低|中|高)风险/);
  const riskLevel = riskMatch ? `${riskMatch[1]}风险` : undefined;
  const advice = displayText.replace(/^(低|中|高)风险[:：]?\s*/, '').trim();

  return {
    status: 'generated',
    riskLevel,
    advice,
    displayText,
    rawText: rawResponseText,
    generatedAt: new Date().toISOString(),
  };
}

function toPublicRecord(record, user) {
  return {
    ...record,
    currentUserCanApprove: canUserApproveRecord(user, record),
    currentUserHasApproved: hasUserHandledWorkflowRecord(user, record) || record.approver === user?.name,
    currentUserIsCc: hasUserCcAccess(user, record),
    ...(record.aiSuggestion && user?.role !== 'developer'
      ? { aiSuggestion: (({ rawText, ...aiSuggestion }) => aiSuggestion)(record.aiSuggestion) }
      : {}),
  };
}

async function generateAiSuggestion({ moduleName, approvalTypeName, applicant, businessData }) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const apiBase = process.env.OPENAI_API_BASE?.trim();
  const model = process.env.OPENAI_MODEL?.trim();

  if (!apiKey || !apiBase || !model) {
    return {
      status: 'skipped',
      displayText: 'AI建议未启用',
      generatedAt: new Date().toISOString(),
      error: 'missing AI environment variables',
    };
  }

  const promptConfig = await getAiPromptConfig(moduleName, approvalTypeName);
  const controller = new AbortController();
  const configuredTimeout = Number(process.env.AI_REQUEST_TIMEOUT_MS);
  const timeoutMs =
    Number.isFinite(configuredTimeout) && configuredTimeout > 0
      ? configuredTimeout
      : 12000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const businessPayload = JSON.stringify(sanitizeForAi(businessData), null, 2);
    const response = await fetch(`${apiBase.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: promptConfig.prompt,
          },
          {
            role: 'user',
            content: limitText(
              [
                `业务模块：${moduleName}`,
                `审批类型：${approvalTypeName}`,
                `申请人：${applicant}`,
                '业务字段：',
                businessPayload,
              ].join('\n'),
            ),
          },
        ],
        temperature: 0.2,
        max_tokens: 120,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`AI request failed: ${response.status}`);
    }

    const body = await response.json();
    const message = body?.choices?.[0]?.message?.content;
    return parseAiSuggestion(message);
  } catch (error) {
    return {
      status: 'failed',
      displayText: 'AI建议生成失败',
      generatedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message.slice(0, 160) : 'AI request failed',
    };
  } finally {
    clearTimeout(timeout);
  }
}

function createGeneratingAiSuggestion() {
  return {
    status: 'generating',
    displayText: 'AI建议生成中',
    generatedAt: new Date().toISOString(),
  };
}

function scheduleAiSuggestionGeneration(record) {
  void generateAiSuggestion({
    moduleName: record.moduleName,
    approvalTypeName: record.approvalTypeName,
    applicant: record.applicant,
    businessData: record.businessData,
  })
    .then((aiSuggestion) => updateRecordById(record.id, (currentRecord) => {
      currentRecord.aiSuggestion = aiSuggestion;
      return currentRecord;
    }))
    .catch((error) => {
      console.error('AI suggestion background generation failed:', error);
    });
}

function isAiConfigured() {
  return Boolean(
    process.env.OPENAI_API_KEY?.trim() &&
    process.env.OPENAI_API_BASE?.trim() &&
    process.env.OPENAI_MODEL?.trim()
  );
}

function getRiskRank(record) {
  const text = `${record.aiSuggestion?.riskLevel || ''} ${record.aiSuggestion?.displayText || ''}`;
  if (text.includes('高风险')) return 3;
  if (text.includes('中风险')) return 2;
  if (text.includes('低风险')) return 1;
  return 0;
}

function stringifyBusinessValue(value) {
  if (isAttachmentList(value)) {
    return `附件${value.length}个：${value.map((attachment) => attachment.name).join('、')}`;
  }

  if (value && typeof value === 'object') {
    return JSON.stringify(sanitizeForAi(value));
  }

  return String(value ?? '');
}

function summarizeBusinessData(businessData) {
  return Object.fromEntries(
    Object.entries(businessData || {})
      .slice(0, 8)
      .map(([key, value]) => [key, stringifyBusinessValue(value).slice(0, 180)]),
  );
}

function toAssistantRecord(record) {
  return {
    id: record.id,
    moduleName: record.moduleName,
    approvalTypeName: record.approvalTypeName,
    status: record.status,
    applicant: record.applicant,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    approver: record.approver,
    rejectReason: record.rejectReason,
    aiSuggestion: record.aiSuggestion
      ? {
          status: record.aiSuggestion.status,
          riskLevel: record.aiSuggestion.riskLevel,
          displayText: record.aiSuggestion.displayText,
        }
      : null,
    businessData: summarizeBusinessData(record.businessData),
  };
}

function buildOverview(records) {
  const today = new Date().toISOString().slice(0, 10);
  const summary = records.reduce(
    (current, record) => {
      current.total += 1;
      if (record.status === '待审批') current.pending += 1;
      if (record.status === '已批准') current.approved += 1;
      if (record.status === '已拒绝') current.rejected += 1;
      if (String(record.createdAt || '').startsWith(today)) current.today += 1;
      if (getRiskRank(record) === 3) current.highRisk += 1;
      if (['failed', 'generating', 'skipped'].includes(record.aiSuggestion?.status)) current.aiAttention += 1;
      return current;
    },
    { total: 0, pending: 0, approved: 0, rejected: 0, today: 0, highRisk: 0, aiAttention: 0 },
  );

  const moduleMap = new Map();
  const applicantMap = new Map();
  records.forEach((record) => {
    const moduleStat = moduleMap.get(record.moduleName) || { moduleName: record.moduleName, total: 0, pending: 0, highRisk: 0 };
    moduleStat.total += 1;
    if (record.status === '待审批') moduleStat.pending += 1;
    if (getRiskRank(record) === 3) moduleStat.highRisk += 1;
    moduleMap.set(record.moduleName, moduleStat);

    applicantMap.set(record.applicant, (applicantMap.get(record.applicant) || 0) + 1);
  });

  const sortedRecords = [...records].sort((left, right) => {
    const riskDelta = getRiskRank(right) - getRiskRank(left);
    if (riskDelta !== 0) return riskDelta;
    return (Date.parse(right.createdAt || '') || 0) - (Date.parse(left.createdAt || '') || 0);
  });

  return {
    aiEnabled: isAiConfigured(),
    summary,
    highRiskRecords: sortedRecords.filter((record) => getRiskRank(record) === 3).slice(0, 6).map(toAssistantRecord),
    aiAttentionRecords: sortedRecords
      .filter((record) => ['failed', 'generating', 'skipped'].includes(record.aiSuggestion?.status))
      .slice(0, 6)
      .map(toAssistantRecord),
    priorityRecords: sortedRecords
      .filter((record) => record.status === '待审批')
      .slice(0, 8)
      .map(toAssistantRecord),
    moduleStats: [...moduleMap.values()].sort((left, right) => right.pending - left.pending || right.total - left.total),
    topApplicants: [...applicantMap.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 5),
  };
}

function parseAssistantJson(rawText) {
  const text = String(rawText || '').trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const jsonText = fenced ? fenced[1] : text;
  const start = jsonText.indexOf('{');
  const end = jsonText.lastIndexOf('}');

  if (start >= 0 && end > start) {
    try {
      return JSON.parse(jsonText.slice(start, end + 1));
    } catch {
      // Fall through to plain text handling.
    }
  }

  return { answer: text || 'AI助手没有返回有效内容。', relatedRecordIds: [] };
}

function getRelatedRecordIds(answer, records) {
  const explicitIds = Array.isArray(answer.relatedRecordIds) ? answer.relatedRecordIds : [];
  const textIds = String(answer.answer || '').match(/APP-\d+/g) || [];
  const allowedIds = new Set(records.map((record) => record.id));
  return [...new Set([...explicitIds, ...textIds].map(String))]
    .filter((id) => allowedIds.has(id))
    .slice(0, 8);
}

async function askAiAssistant(question, records) {
  if (!isAiConfigured()) {
    return {
      enabled: false,
      answer: 'AI助手暂未启用，请先配置 OPENAI_API_KEY、OPENAI_API_BASE 和 OPENAI_MODEL。',
      relatedRecords: [],
    };
  }

  const apiKey = process.env.OPENAI_API_KEY.trim();
  const apiBase = process.env.OPENAI_API_BASE.trim();
  const model = process.env.OPENAI_MODEL.trim();
  const config = await readAiAssistantConfig();
  const overview = buildOverview(records);
  const recordPayload = records.map(toAssistantRecord);
  const controller = new AbortController();
  const configuredTimeout = Number(process.env.AI_REQUEST_TIMEOUT_MS);
  const timeoutMs =
    Number.isFinite(configuredTimeout) && configuredTimeout > 0
      ? configuredTimeout
      : 12000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${apiBase.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: `${config.prompt}\n请只返回 JSON：{"answer":"中文回答","relatedRecordIds":["APP-..."]}。relatedRecordIds 只能使用输入数据里真实存在的 id。`,
          },
          {
            role: 'user',
            content: limitText(
              JSON.stringify({
                question,
                overview,
                records: recordPayload,
              }, null, 2),
              22000,
            ),
          },
        ],
        temperature: 0.2,
        max_tokens: 900,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`AI assistant request failed: ${response.status}`);
    }

    const body = await response.json();
    const parsed = parseAssistantJson(body?.choices?.[0]?.message?.content);
    const relatedRecordIds = getRelatedRecordIds(parsed, records);
    const relatedRecords = relatedRecordIds
      .map((id) => records.find((record) => record.id === id))
      .filter(Boolean)
      .map(toAssistantRecord);

    return {
      enabled: true,
      answer: String(parsed.answer || 'AI助手没有返回有效内容。').trim(),
      relatedRecords,
    };
  } finally {
    clearTimeout(timeout);
  }
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    dataDir,
  });
});

app.get('/api/workflow-templates', authenticate, requireRoles('developer'), async (_req, res, next) => {
  try {
    res.json(await readWorkflowTemplates());
  } catch (error) {
    next(error);
  }
});

app.post('/api/workflow-templates', authenticate, requireRoles('developer'), async (req, res, next) => {
  try {
    const name = normalizeWorkflowText(req.body?.name);
    const organizationId = normalizeWorkflowText(req.body?.organizationId) || DEFAULT_ORGANIZATION_ID;
    const businessType = inferWorkflowBusinessType(req.body?.businessType);
    const moduleName = normalizeWorkflowText(req.body?.moduleName) || '审批流配置';
    const approvalTypeName = normalizeWorkflowText(req.body?.approvalTypeName) || businessType;

    if (!name || !businessType) {
      return res.status(400).json({ error: 'missing workflow template fields' });
    }

    const now = new Date().toISOString();
    const template = await updateWorkflowTemplates((templates) => {
      const duplicated = templates.some((item) => (
        normalizeWorkflowText(item.organizationId) === organizationId &&
        normalizeWorkflowText(item.moduleName || item.draft?.basic?.moduleName) === moduleName &&
        normalizeWorkflowText(item.approvalTypeName || item.draft?.basic?.approvalTypeName) === approvalTypeName &&
        item.status === 'published'
      ));

      if (duplicated) {
        throw createHttpError('published workflow template already exists for this organization and approval type', 409);
      }

      const draft = normalizeWorkflowDraft({
        id: `draft-${Date.now()}`,
        version: 1,
        status: 'draft',
        organizationId,
        businessType,
        basic: {
          name,
          moduleName,
          approvalTypeName,
          visibleRange: 'all',
        },
        submitPermission: createDefaultSubmitPermission(),
        branches: [createDefaultWorkflowBranch()],
        ccRule: createDefaultCcRule(),
        formFields: [],
        nodes: [
          {
            id: 'node-start',
            type: 'start',
            title: '\u53d1\u8d77\u4eba',
            subtitle: 'Applicant',
          },
        ],
        savedAt: now,
        savedBy: req.user.name,
      });

      const nextTemplate = {
        id: `workflow-${Date.now()}`,
        name,
        organizationId,
        businessType,
        moduleName,
        approvalTypeName,
        status: 'draft',
        currentVersion: 1,
        draft,
        createdAt: now,
        updatedAt: now,
        updatedBy: req.user.name,
      };

      templates.unshift(nextTemplate);
      return nextTemplate;
    });

    res.status(201).json(template);
  } catch (error) {
    next(error);
  }
});

app.get('/api/workflow-templates/:id', authenticate, requireRoles('developer'), async (req, res, next) => {
  try {
    const templates = await readWorkflowTemplates();
    const template = templates.find((item) => item.id === req.params.id);

    if (!template) {
      return res.status(404).json({ error: 'workflow template not found' });
    }

    res.json(template);
  } catch (error) {
    next(error);
  }
});

app.delete('/api/workflow-templates/:id', authenticate, requireRoles('developer'), async (req, res, next) => {
  try {
    await updateWorkflowTemplates((templates) => {
      const index = templates.findIndex((item) => item.id === req.params.id);

      if (index < 0) {
        throw createHttpError('workflow template not found', 404);
      }

      templates.splice(index, 1);
      return null;
    });

    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.patch('/api/workflow-templates/:id/draft', authenticate, requireRoles('developer'), async (req, res, next) => {
  try {
    const draft = req.body?.draft;

    if (!draft || !Array.isArray(draft.nodes) || !draft.basic?.name) {
      return res.status(400).json({ error: 'missing workflow draft' });
    }

    const now = new Date().toISOString();
    const template = await updateWorkflowTemplates((templates) => {
      const existing = templates.find((item) => item.id === req.params.id);

      if (!existing) {
        const error = new Error('workflow template not found');
        error.statusCode = 404;
        throw error;
      }

      const nextDraft = normalizeWorkflowDraft(draft);
      const publishedVersion = Number(existing.publishedVersion?.version || 0);
      const draftVersion = Number(nextDraft.version || 1);

      nextDraft.id = nextDraft.id || `draft-${Date.now()}`;
      nextDraft.version = publishedVersion > 0 && draftVersion <= publishedVersion ? publishedVersion + 1 : draftVersion;
      nextDraft.status = 'draft';
      nextDraft.savedAt = now;
      nextDraft.savedBy = req.user.name;

      existing.name = String(nextDraft.basic.name || existing.name);
      existing.organizationId = String(nextDraft.organizationId || existing.organizationId || DEFAULT_ORGANIZATION_ID);
      existing.businessType = inferWorkflowBusinessType(nextDraft.businessType || existing.businessType);
      existing.moduleName = String(nextDraft.basic.moduleName || existing.moduleName);
      existing.approvalTypeName = String(nextDraft.basic.approvalTypeName || existing.approvalTypeName);
      existing.status = 'draft';
      existing.draft = nextDraft;
      existing.updatedAt = now;
      existing.updatedBy = req.user.name;

      return existing;
    });

    res.json(template);
  } catch (error) {
    next(error);
  }
});

app.post('/api/workflow-templates/:id/publish', authenticate, requireRoles('developer'), async (req, res, next) => {
  try {
    const now = new Date().toISOString();
    const template = await updateWorkflowTemplates((templates) => {
      const existing = templates.find((item) => item.id === req.params.id);

      if (!existing) {
        const error = new Error('workflow template not found');
        error.statusCode = 404;
        throw error;
      }

      const published = normalizeWorkflowDraft(existing.draft);
      const validationErrors = validateWorkflowDraftForPublish(published);
      if (validationErrors.length > 0) {
        throw createHttpError(validationErrors.join('；'), 400);
      }

      const duplicate = templates.find((item) => (
        item.id !== existing.id &&
        item.status === 'published' &&
        normalizeWorkflowText(item.organizationId) === normalizeWorkflowText(published.organizationId) &&
        normalizeWorkflowText(item.moduleName || item.publishedVersion?.basic?.moduleName || item.draft?.basic?.moduleName) === normalizeWorkflowText(published.basic?.moduleName) &&
        normalizeWorkflowText(item.approvalTypeName || item.publishedVersion?.basic?.approvalTypeName || item.draft?.basic?.approvalTypeName) === normalizeWorkflowText(published.basic?.approvalTypeName)
      ));

      if (duplicate) {
        throw createHttpError('同一组织和具体业务已经存在已发布审批流，请先停用原流程。', 409);
      }

      published.status = 'published';
      published.publishedAt = now;
      published.savedAt = existing.draft.savedAt || now;
      published.savedBy = existing.draft.savedBy || req.user.name;

      existing.publishedVersion = published;
      existing.status = 'published';
      existing.name = published.basic.name;
      existing.organizationId = published.organizationId;
      existing.businessType = published.businessType;
      existing.moduleName = published.basic.moduleName;
      existing.approvalTypeName = published.basic.approvalTypeName;
      existing.currentVersion = Number(published.version || existing.currentVersion || 1);
      existing.updatedAt = now;
      existing.updatedBy = req.user.name;

      return existing;
    });

    res.json(template);
  } catch (error) {
    next(error);
  }
});

app.post('/api/workflow-templates/:id/duplicate', authenticate, requireRoles('developer'), async (req, res, next) => {
  try {
    const now = new Date().toISOString();
    const template = await updateWorkflowTemplates((templates) => {
      const existing = templates.find((item) => item.id === req.params.id);

      if (!existing) {
        throw createHttpError('workflow template not found', 404);
      }

      const sourceDraft = normalizeWorkflowDraft(existing.draft || existing.publishedVersion);
      const name = `${existing.name || sourceDraft.basic.name} 副本`;
      const draft = normalizeWorkflowDraft({
        ...sourceDraft,
        id: createWorkflowId('draft'),
        version: 1,
        status: 'draft',
        basic: {
          ...sourceDraft.basic,
          name,
        },
        savedAt: now,
        savedBy: req.user.name,
      });

      const copy = {
        id: createWorkflowId('workflow'),
        name,
        organizationId: draft.organizationId || DEFAULT_ORGANIZATION_ID,
        businessType: draft.businessType || 'general',
        moduleName: draft.basic.moduleName,
        approvalTypeName: draft.basic.approvalTypeName,
        status: 'draft',
        currentVersion: 1,
        draft,
        createdAt: now,
        updatedAt: now,
        updatedBy: req.user.name,
      };

      templates.unshift(copy);
      return copy;
    });

    res.status(201).json(template);
  } catch (error) {
    next(error);
  }
});

app.patch('/api/workflow-templates/:id/status', authenticate, requireRoles('developer'), async (req, res, next) => {
  try {
    const status = normalizeWorkflowText(req.body?.status);
    if (!['draft', 'published', 'disabled'].includes(status)) {
      return res.status(400).json({ error: 'invalid workflow status' });
    }

    const template = await updateWorkflowTemplates((templates) => {
      const existing = templates.find((item) => item.id === req.params.id);

      if (!existing) {
        throw createHttpError('workflow template not found', 404);
      }

      if (status === 'published' && !existing.publishedVersion) {
        throw createHttpError('workflow must be published before it can be enabled', 400);
      }

      if (status === 'published') {
        const version = normalizeWorkflowDraft(existing.publishedVersion);
        const duplicate = templates.find((item) => (
          item.id !== existing.id &&
          item.status === 'published' &&
          normalizeWorkflowText(item.organizationId) === normalizeWorkflowText(version.organizationId) &&
          normalizeWorkflowText(item.moduleName || item.publishedVersion?.basic?.moduleName || item.draft?.basic?.moduleName) === normalizeWorkflowText(version.basic?.moduleName) &&
          normalizeWorkflowText(item.approvalTypeName || item.publishedVersion?.basic?.approvalTypeName || item.draft?.basic?.approvalTypeName) === normalizeWorkflowText(version.basic?.approvalTypeName)
        ));

        if (duplicate) {
          throw createHttpError('同一组织和具体业务已经存在已发布审批流，请先停用原流程。', 409);
        }
      }

      existing.status = status;
      existing.updatedAt = new Date().toISOString();
      existing.updatedBy = req.user.name;
      return existing;
    });

    res.json(template);
  } catch (error) {
    next(error);
  }
});

app.get('/api/organization', authenticate, requireRoles('developer'), async (_req, res, next) => {
  try {
    res.json(await readOrganizationDirectory());
  } catch (error) {
    next(error);
  }
});

app.put('/api/organization', authenticate, requireRoles('developer'), async (req, res, next) => {
  try {
    const { departments, members } = req.body || {};

    if (!Array.isArray(departments) || !Array.isArray(members)) {
      return res.status(400).json({ error: 'missing organization directory' });
    }

    const nextDirectory = normalizeOrganizationDirectoryInput({ departments, members });
    const directory = await updateOrganizationDirectory(() => ({
      ...nextDirectory,
      updatedAt: new Date().toISOString(),
    }));

    res.json(directory);
  } catch (error) {
    next(error);
  }
});

app.get('/api/ai-prompts', authenticate, requireRoles('developer'), async (req, res, next) => {
  try {
    const moduleName = String(req.query?.moduleName || '').trim();
    const approvalTypeName = String(req.query?.approvalTypeName || '').trim();

    if (!moduleName || !approvalTypeName) {
      return res.status(400).json({ error: 'missing AI prompt target' });
    }

    res.json(await getAiPromptConfig(moduleName, approvalTypeName));
  } catch (error) {
    next(error);
  }
});

app.patch('/api/ai-prompts', authenticate, requireRoles('developer'), async (req, res, next) => {
  try {
    const moduleName = String(req.body?.moduleName || '').trim();
    const approvalTypeName = String(req.body?.approvalTypeName || '').trim();
    const prompt = String(req.body?.prompt || '').trim();

    if (!moduleName || !approvalTypeName || !prompt) {
      return res.status(400).json({ error: 'missing AI prompt fields' });
    }

    const key = getPromptKey(moduleName, approvalTypeName);
    const now = new Date().toISOString();
    const config = await updatePromptConfigs((configs) => {
      const existing = configs.find((item) => item.key === key);

      if (existing) {
        existing.moduleName = moduleName;
        existing.approvalTypeName = approvalTypeName;
        existing.prompt = prompt;
        existing.updatedAt = now;
        existing.updatedBy = req.user.name;
        return existing;
      }

      const nextConfig = {
        key,
        moduleName,
        approvalTypeName,
        prompt,
        updatedAt: now,
        updatedBy: req.user.name,
      };
      configs.unshift(nextConfig);
      return nextConfig;
    });

    res.json({ ...config, isDefault: false });
  } catch (error) {
    next(error);
  }
});

app.get('/api/ai-assistant/overview', authenticate, requireRoles('boss'), async (_req, res, next) => {
  try {
    const records = await readRecords();
    res.json(buildOverview(records));
  } catch (error) {
    next(error);
  }
});

app.post('/api/ai-assistant/chat', authenticate, requireRoles('boss'), async (req, res, next) => {
  try {
    const question = String(req.body?.question || '').trim();

    if (!question) {
      return res.status(400).json({ error: 'missing assistant question' });
    }

    const records = await readRecords();

    try {
      res.json(await askAiAssistant(question, records));
    } catch (error) {
      res.json({
        enabled: isAiConfigured(),
        answer: error instanceof Error ? `AI助手暂时无法回答：${error.message}` : 'AI助手暂时无法回答，请稍后再试。',
        relatedRecords: [],
      });
    }
  } catch (error) {
    next(error);
  }
});

app.get('/api/ai-assistant/prompt', authenticate, requireRoles('developer'), async (_req, res, next) => {
  try {
    res.json(await readAiAssistantConfig());
  } catch (error) {
    next(error);
  }
});

app.patch('/api/ai-assistant/prompt', authenticate, requireRoles('developer'), async (req, res, next) => {
  try {
    const prompt = String(req.body?.prompt || '').trim();

    if (!prompt) {
      return res.status(400).json({ error: 'missing AI assistant prompt' });
    }

    const now = new Date().toISOString();
    const config = await updateAiAssistantConfig(() => ({
      prompt,
      updatedAt: now,
      updatedBy: req.user.name,
      isDefault: false,
    }));

    res.json(config);
  } catch (error) {
    next(error);
  }
});

app.get('/api/accounts', authenticate, requireRoles('developer'), async (_req, res, next) => {
  try {
    const accounts = await readAccounts();
    res.json([
      toPublicAccount(superAdmin),
      ...accounts.map(toPublicAccount),
    ]);
  } catch (error) {
    next(error);
  }
});

app.post('/api/accounts', authenticate, requireRoles('developer'), async (req, res, next) => {
  try {
    const username = String(req.body?.username || '').trim();
    const name = String(req.body?.name || '').trim();
    const role = normalizeRole(req.body?.role);
    const password = String(req.body?.password || '123456');

    if (!username || !name || !isManagedRole(role)) {
      return res.status(400).json({ error: 'missing or invalid account fields' });
    }

    if (username === superAdmin.username) {
      return res.status(409).json({ error: 'username already exists' });
    }

    const account = await updateAccounts((accounts) => {
      if (accounts.some((item) => item.username === username)) {
        const error = new Error('username already exists');
        error.statusCode = 409;
        throw error;
      }

      const now = new Date().toISOString();
      const newAccount = {
        id: crypto.randomUUID(),
        username,
        name,
        role,
        passwordHash: hashPassword(password || '123456'),
        enabled: true,
        createdAt: now,
        updatedAt: now,
      };

      accounts.unshift(newAccount);
      return newAccount;
    });

    res.status(201).json(toPublicAccount(account));
  } catch (error) {
    next(error);
  }
});

app.patch('/api/accounts/:id', authenticate, requireRoles('developer'), async (req, res, next) => {
  try {
    const { id } = req.params;

    if (id === superAdmin.id) {
      return res.status(400).json({ error: 'super admin is managed by environment variables' });
    }

    const updatedAccount = await updateAccounts((accounts) => {
      const account = accounts.find((item) => item.id === id);
      if (!account) {
        const error = new Error('account not found');
        error.statusCode = 404;
        throw error;
      }

      const nextUsername = req.body?.username === undefined ? account.username : String(req.body.username || '').trim();
      const nextName = req.body?.name === undefined ? account.name : String(req.body.name || '').trim();
      const nextRole = normalizeRole(req.body?.role === undefined ? account.role : req.body.role);

      if (!nextUsername || !nextName || !isManagedRole(nextRole)) {
        const error = new Error('missing or invalid account fields');
        error.statusCode = 400;
        throw error;
      }

      if (
        nextUsername === superAdmin.username ||
        accounts.some((item) => item.id !== id && item.username === nextUsername)
      ) {
        const error = new Error('username already exists');
        error.statusCode = 409;
        throw error;
      }

      account.username = nextUsername;
      account.name = nextName;
      account.role = nextRole;
      account.enabled = req.body?.enabled === undefined ? account.enabled !== false : Boolean(req.body.enabled);

      if (req.body?.password !== undefined) {
        const password = String(req.body.password || '');
        if (password.length < 1) {
          const error = new Error('password is required');
          error.statusCode = 400;
          throw error;
        }
        account.passwordHash = hashPassword(password);
      }

      account.updatedAt = new Date().toISOString();
      return account;
    });

    res.json(toPublicAccount(updatedAccount));
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    const loginName = String(username || '').trim();
    let user = null;

    if (loginName === superAdmin.username && password === superAdminPassword) {
      user = superAdmin;
    } else {
      const accounts = await readAccounts();
      const account = accounts.find((item) => item.username === loginName && item.enabled !== false);
      if (account && verifyPassword(password, account.passwordHash)) {
        user = account;
      }
    }

    if (!user) {
      return res.status(401).json({ error: 'invalid username or password' });
    }

    const session = createToken(user);
    res.json({
      user: toPublicUser(user),
      ...session,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/uploads', authenticate, requireRoles('employee', 'boss'), async (req, res, next) => {
  try {
    const { files } = req.body || {};

    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'missing upload files' });
    }

    let totalBytes = 0;
    const savedUploads = [];

    await fs.mkdir(uploadsDir, { recursive: true });

    for (const file of files) {
      const originalName = sanitizeUploadName(file?.name);
      const base64 = getUploadBase64(file?.data);
      const buffer = Buffer.from(base64, 'base64');
      const declaredSize = Number(file?.size || buffer.length);

      if (!base64 || buffer.length === 0) {
        return res.status(400).json({ error: `empty upload file: ${originalName}` });
      }

      if (buffer.length > maxUploadFileBytes) {
        return res.status(413).json({ error: `file is too large: ${originalName}` });
      }

      totalBytes += buffer.length;
      if (totalBytes > maxUploadBatchBytes) {
        return res.status(413).json({ error: 'upload batch is too large' });
      }

      if (Number.isFinite(declaredSize) && Math.abs(declaredSize - buffer.length) > 2) {
        return res.status(400).json({ error: `invalid upload file size: ${originalName}` });
      }

      const id = crypto.randomUUID();
      const extension = path.extname(originalName).slice(0, 24);
      const storedName = `${id}${extension}`;
      await fs.writeFile(path.join(uploadsDir, storedName), buffer);

      savedUploads.push({
        id,
        name: originalName,
        type: String(file?.type || 'application/octet-stream'),
        size: buffer.length,
        storedName,
        uploadedAt: new Date().toISOString(),
        uploadedBy: req.user.name,
        url: `/api/uploads/${id}`,
      });
    }

    const publicUploads = await updateUploads((uploads) => {
      uploads.unshift(...savedUploads);
      return savedUploads.map(({ storedName, uploadedBy, ...upload }) => upload);
    });

    res.status(201).json(publicUploads);
  } catch (error) {
    next(error);
  }
});

app.get('/api/uploads/:id', authenticate, async (req, res, next) => {
  try {
    const uploads = await readUploads();
    const upload = uploads.find((item) => item.id === req.params.id);

    if (!upload) {
      return res.status(404).json({ error: 'upload file not found' });
    }

    const uploadRoot = path.resolve(uploadsDir);
    const filePath = path.resolve(uploadRoot, upload.storedName);
    if (!filePath.startsWith(`${uploadRoot}${path.sep}`)) {
      return res.status(400).json({ error: 'invalid upload file path' });
    }

    const disposition = req.query.disposition === 'inline' ? 'inline' : 'attachment';
    const asciiName = String(upload.name || 'attachment').replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '');
    res.setHeader('Content-Type', upload.type || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `${disposition}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(upload.name || 'attachment')}`,
    );
    res.sendFile(filePath, (error) => {
      if (error) next(error);
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/records', authenticate, async (req, res, next) => {
  try {
    const records = await readRecords();
    const visibleRecords = records.filter((record) => canUserSeeRecord(req.user, record));

    res.json(visibleRecords.map((record) => toPublicRecord(record, req.user)));
  } catch (error) {
    next(error);
  }
});

app.post('/api/records', authenticate, requireRoles('employee', 'boss'), async (req, res, next) => {
  try {
    const { moduleName, approvalTypeName, businessData, applicant } = req.body || {};

    if (!moduleName || !approvalTypeName || !businessData || !applicant) {
      return res.status(400).json({ error: 'missing required approval record fields' });
    }

    if (normalizeRole(req.user.role) !== 'developer' && applicant !== req.user.name) {
      return res.status(403).json({ error: 'applicant does not match current user' });
    }

    const now = new Date().toISOString();
    const workflow = await createWorkflowInstanceForRecord({
      moduleName,
      approvalTypeName,
      applicantUsername: req.user.username,
      businessData,
    });
    const record = await createBusinessRecord({
      id: `APP-${Date.now()}`,
      moduleName,
      approvalTypeName,
      businessData,
      status: workflow.initialStatus,
      applicant,
      workflowInstance: workflow.instance,
      ccRecipients: workflow.ccRecipients,
      aiSuggestion: createGeneratingAiSuggestion(),
      createdAt: now,
      updatedAt: now,
      ...(workflow.initialStatus === STATUS_APPROVED ? { approvedAt: now } : {}),
      logs: [
        createLog('\u53d1\u8d77\u7533\u8bf7', applicant, '\u63d0\u4ea4\u4e86\u5ba1\u6279\u5355'),
        createLog('\u5339\u914d\u5ba1\u6279\u6d41', 'system', `Matched workflow: ${workflow.instance.workflowName} v${workflow.instance.workflowVersion}`),
        ...(workflow.initialStatus === STATUS_APPROVED && workflow.ccRecipients.length > 0
          ? [createLog('抄送', 'system', `流程结束，已同步给：${workflow.ccRecipients.map((recipient) => recipient.name).join('、')}`)]
          : []),
      ],
    });

    res.status(201).json(toPublicRecord(record, req.user));
    scheduleAiSuggestionGeneration(record);
  } catch (error) {
    next(error);
  }
});

app.patch('/api/records/:id/status', authenticate, requireRoles('employee', 'boss'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, approver, reason } = req.body || {};

    if (!validStatuses.has(status) || ![STATUS_APPROVED, STATUS_REJECTED].includes(status)) {
      return res.status(400).json({ error: 'invalid approval status' });
    }

    if (approver && normalizeRole(req.user.role) !== 'developer' && approver !== req.user.name) {
      return res.status(403).json({ error: 'approver does not match current user' });
    }

    if (status === STATUS_REJECTED && !String(reason || '').trim()) {
      return res.status(400).json({ error: 'reject reason is required' });
    }

    const updatedRecord = await updateRecordById(id, (record) => {
      if (record.status !== STATUS_PENDING) {
        const error = new Error('approval record has already been processed');
        error.statusCode = 409;
        throw error;
      }

      if (record.workflowInstance) {
        return advanceWorkflowRecord(record, req.user, status, reason);
      }

      const now = new Date().toISOString();
      record.status = status;
      record.updatedAt = now;
      record.approver = approver || req.user.name;

      if (status === STATUS_APPROVED) {
        record.approvedAt = now;
      } else if (status === STATUS_REJECTED) {
        record.rejectedAt = now;
        record.rejectReason = String(reason).trim();
      }

      record.logs = [
        ...(record.logs || []),
        createLog(
          status === STATUS_APPROVED ? '\u6279\u51c6' : '\u62d2\u7edd',
          approver || req.user.name,
          status === STATUS_APPROVED ? '\u5ba1\u6279\u901a\u8fc7' : String(reason).trim(),
        ),
      ];

      return record;
    });

    res.json(toPublicRecord(updatedRecord, req.user));
  } catch (error) {
    next(error);
  }
});

app.delete('/api/records', authenticate, requireRoles('developer'), async (_req, res, next) => {
  try {
    await clearRecordFiles();

    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'api route not found' });
});

const distDir = path.resolve(__dirname, '..', 'dist');
app.use(express.static(distDir));
app.get('*', (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(error.statusCode || 500).json({
    error: error.message || 'internal server error',
  });
});

app.listen(port, () => {
  console.log(`MJ approval server listening on ${port}`);
  console.log(`Persistent data path: ${recordsFile}`);
});
