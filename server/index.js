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
const managedRoles = new Set(['applicant', 'approver', 'boss']);
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

const roleLabels = {
  applicant: '申请',
  approver: '审批',
  boss: '老板',
  developer: '超管',
};

const rolePermissions = {
  applicant: [
    { key: 'record:create', label: '创建申请' },
    { key: 'record:own:read', label: '查看本人申请' },
  ],
  approver: [
    { key: 'record:read', label: '查看审批记录' },
    { key: 'record:review', label: '审批处理' },
  ],
  boss: [
    { key: 'record:read:all', label: '查看全部申请' },
    { key: 'record:review:all', label: '管理审批结果' },
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
  return {
    username: user.username,
    role: user.role,
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
  return {
    id: account.id,
    username: account.username,
    role: account.role,
    name: account.name,
    roleLabel: roleLabels[account.role] || account.role,
    permissions: rolePermissions[account.role] || [],
    canSwitchPerspective: account.role === 'developer',
    isSuperAdmin: account.role === 'developer',
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
  const payload = Buffer.from(
    JSON.stringify({
      sub: user.username,
      role: user.role,
      name: user.name,
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
        if (!impersonatedUser || impersonatedUser.role === 'developer') {
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
    if (req.user?.role === 'developer' || roles.includes(req.user?.role)) {
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
      createSeedAccount('applicant', 'applicant', '张申请'),
      createSeedAccount('approver', 'approver', '李审批'),
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
      { id: 'qin-an-tang', name: '秦安堂', departmentId: 'dept-board', title: '董事长', roleGroupIds: ['role-board'], enabled: true },
      { id: 'fan-lu', name: '范璐', departmentId: 'dept-management', title: '总经理', supervisorId: 'qin-an-tang', roleGroupIds: ['role-gm'], enabled: true },
      { id: 'yang-nan', name: '杨宿南', departmentId: 'dept-sales', title: '业务一部负责人', supervisorId: 'fan-lu', roleGroupIds: ['role-sales'], enabled: true },
      { id: 'hong-wei', name: '洪伟', departmentId: 'dept-sales', title: '销售经理', supervisorId: 'yang-nan', roleGroupIds: ['role-sales'], enabled: true },
      { id: 'qian-lin', name: '钱琳', departmentId: 'dept-finance', title: '财务总监', supervisorId: 'fan-lu', roleGroupIds: ['role-finance'], enabled: true },
      { id: 'hu-ning-fei', name: '胡宁飞', departmentId: 'dept-finance', title: '财务助理', supervisorId: 'qian-lin', roleGroupIds: ['role-finance'], enabled: true },
      { id: 'ye-fei', name: '叶飞', departmentId: 'dept-finance', title: '审批人', supervisorId: 'qian-lin', roleGroupIds: ['role-finance'], enabled: true },
      { id: 'lin-jin-biao', name: '林金彪', departmentId: 'dept-admin', title: '行政人事', supervisorId: 'fan-lu', roleGroupIds: ['role-admin'], enabled: true },
      { id: 'huang-song-yuan', name: '黄松源', departmentId: 'dept-warehouse', title: '仓储负责人', supervisorId: 'fan-lu', roleGroupIds: ['role-warehouse'], enabled: true },
      { id: 'li-qi', name: '利祺', departmentId: 'dept-operations', title: '操作', supervisorId: 'fan-lu', roleGroupIds: ['role-ops'], enabled: true },
      { id: 'qin-sheng', name: '秦笙', departmentId: 'dept-management', title: '抄送人', supervisorId: 'fan-lu', roleGroupIds: ['role-assistant'], enabled: true },
      { id: 'wang-tumiao', name: '王涂妙', departmentId: 'dept-finance', title: '抄送人', supervisorId: 'qian-lin', roleGroupIds: ['role-finance'], enabled: true },
      { id: 'jiang-hua', name: '姜华', departmentId: 'dept-finance', title: '抄送人', supervisorId: 'qian-lin', roleGroupIds: ['role-finance'], enabled: true },
    ],
    roleGroups: [
      { id: 'role-board', name: '董事长', memberIds: ['qin-an-tang'] },
      { id: 'role-gm', name: '总经理', memberIds: ['fan-lu'] },
      { id: 'role-finance', name: '财务', memberIds: ['qian-lin', 'hu-ning-fei', 'ye-fei', 'wang-tumiao', 'jiang-hua'] },
      { id: 'role-sales', name: '销售', memberIds: ['yang-nan', 'hong-wei'] },
      { id: 'role-admin', name: '行政人事', memberIds: ['lin-jin-biao'] },
      { id: 'role-warehouse', name: '仓储物流', memberIds: ['huang-song-yuan'] },
      { id: 'role-ops', name: '操作', memberIds: ['li-qi'] },
      { id: 'role-assistant', name: '总助/抄送', memberIds: ['qin-sheng'] },
    ],
    updatedAt: '2026-05-08T00:00:00.000Z',
  };
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
      rule: { type: 'role', roleGroupId: 'role-gm', emptyApproverAction: 'block_submit' },
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
    basic: {
      name: '预付款申请',
      moduleName: '资金',
      approvalTypeName: '预付款申请',
      visibleRange: '全公司',
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
        rule: { type: 'role', roleGroupId: 'role-board', emptyApproverAction: 'block_submit' },
      },
      {
        id: 'node-copy',
        type: 'cc',
        title: '抄送人',
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
  return templates.length > 0 ? templates : [createDefaultWorkflowTemplate()];
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
    !Array.isArray(directory.members) ||
    !Array.isArray(directory.roleGroups)
  ) {
    return createDefaultOrganizationDirectory();
  }

  return directory;
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

function getLinearApproverNodes(version) {
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

function uniqueMembers(members) {
  const seen = new Set();
  return members.filter((member) => {
    if (!member || seen.has(member.id)) return false;
    seen.add(member.id);
    return true;
  });
}

function getRoleGroupMembers(directory, roleGroupId) {
  const roleGroup = (directory.roleGroups || []).find((item) => item.id === roleGroupId);
  const memberIds = new Set([
    ...(roleGroup?.memberIds || []),
    ...(directory.members || [])
      .filter((member) => Array.isArray(member.roleGroupIds) && member.roleGroupIds.includes(roleGroupId))
      .map((member) => member.id),
  ]);

  return uniqueMembers([...memberIds].map((memberId) => findMemberById(directory, memberId)).filter(Boolean));
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
    members = getRoleGroupMembers(directory, approverRule.roleGroupId);
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

async function createWorkflowInstanceForRecord({ moduleName, approvalTypeName, applicantUsername }) {
  const template = await findPublishedWorkflow(moduleName, approvalTypeName);
  if (!template) {
    throw createHttpError('No published approval workflow matches this business type. Please ask an administrator to configure and publish one.', 400);
  }

  const version = getPublishedVersion(template);
  const nodes = getLinearApproverNodes(version);
  if (nodes.length === 0) {
    throw createHttpError('The matched approval workflow has no linear approval steps.', 400);
  }

  const directory = await readOrganizationDirectory();
  const applicantMember = findMemberByAccount(directory, applicantUsername);
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
    return ['approver', 'boss', 'developer'].includes(user.role);
  }

  if (!currentStep) return false;
  return (currentStep.approvers || []).some((approver) => (
    normalizeWorkflowText(approver.accountUsername).toLowerCase() === normalizeWorkflowText(user.username).toLowerCase()
  ));
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
    const moduleName = normalizeWorkflowText(req.body?.moduleName);
    const approvalTypeName = normalizeWorkflowText(req.body?.approvalTypeName);

    if (!name || !moduleName || !approvalTypeName) {
      return res.status(400).json({ error: 'missing workflow template fields' });
    }

    const now = new Date().toISOString();
    const template = await updateWorkflowTemplates((templates) => {
      const duplicated = templates.some((item) => (
        normalizeWorkflowText(item.moduleName) === moduleName &&
        normalizeWorkflowText(item.approvalTypeName) === approvalTypeName &&
        item.status !== 'disabled'
      ));

      if (duplicated) {
        throw createHttpError('workflow template already exists for this business type', 409);
      }

      const draft = {
        id: `draft-${Date.now()}`,
        version: 1,
        status: 'draft',
        basic: {
          name,
          moduleName,
          approvalTypeName,
          visibleRange: 'all',
        },
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
      };

      const nextTemplate = {
        id: `workflow-${Date.now()}`,
        name,
        moduleName,
        approvalTypeName,
        status: 'draft',
        currentVersion: 1,
        draft,
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

      const nextDraft = JSON.parse(JSON.stringify(draft));
      const publishedVersion = Number(existing.publishedVersion?.version || 0);
      const draftVersion = Number(nextDraft.version || 1);

      nextDraft.id = nextDraft.id || `draft-${Date.now()}`;
      nextDraft.version = publishedVersion > 0 && draftVersion <= publishedVersion ? publishedVersion + 1 : draftVersion;
      nextDraft.status = 'draft';
      nextDraft.savedAt = now;
      nextDraft.savedBy = req.user.name;

      existing.name = String(nextDraft.basic.name || existing.name);
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

      const published = JSON.parse(JSON.stringify(existing.draft));
      if (getLinearApproverNodes(published).length === 0) {
        throw createHttpError('workflow must contain at least one linear approval step before publishing', 400);
      }
      published.status = 'published';
      published.publishedAt = now;
      published.savedAt = existing.draft.savedAt || now;
      published.savedBy = existing.draft.savedBy || req.user.name;

      existing.publishedVersion = published;
      existing.status = 'published';
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
    const { departments, members, roleGroups } = req.body || {};

    if (!Array.isArray(departments) || !Array.isArray(members) || !Array.isArray(roleGroups)) {
      return res.status(400).json({ error: 'missing organization directory' });
    }

    const directory = await updateOrganizationDirectory(() => ({
      departments,
      members,
      roleGroups,
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
    const role = String(req.body?.role || '').trim();
    const password = String(req.body?.password || '123456');

    if (!username || !name || !managedRoles.has(role)) {
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
      const nextRole = req.body?.role === undefined ? account.role : String(req.body.role || '').trim();

      if (!nextUsername || !nextName || !managedRoles.has(nextRole)) {
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

app.post('/api/uploads', authenticate, requireRoles('applicant'), async (req, res, next) => {
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

    if (req.user.role === 'applicant') {
      return res.json(
        records
          .filter((record) => record.applicant === req.user.name)
          .map((record) => toPublicRecord(record, req.user)),
      );
    }

    res.json(records.map((record) => toPublicRecord(record, req.user)));
  } catch (error) {
    next(error);
  }
});

app.post('/api/records', authenticate, requireRoles('applicant'), async (req, res, next) => {
  try {
    const { moduleName, approvalTypeName, businessData, applicant } = req.body || {};

    if (!moduleName || !approvalTypeName || !businessData || !applicant) {
      return res.status(400).json({ error: 'missing required approval record fields' });
    }

    if (req.user.role !== 'developer' && applicant !== req.user.name) {
      return res.status(403).json({ error: 'applicant does not match current user' });
    }

    const now = new Date().toISOString();
    const workflow = await createWorkflowInstanceForRecord({
      moduleName,
      approvalTypeName,
      applicantUsername: req.user.username,
    });
    const record = await createBusinessRecord({
      id: `APP-${Date.now()}`,
      moduleName,
      approvalTypeName,
      businessData,
      status: workflow.initialStatus,
      applicant,
      workflowInstance: workflow.instance,
      aiSuggestion: createGeneratingAiSuggestion(),
      createdAt: now,
      updatedAt: now,
      ...(workflow.initialStatus === STATUS_APPROVED ? { approvedAt: now } : {}),
      logs: [
        createLog('\u53d1\u8d77\u7533\u8bf7', applicant, '\u63d0\u4ea4\u4e86\u5ba1\u6279\u5355'),
        createLog('\u5339\u914d\u5ba1\u6279\u6d41', 'system', `Matched workflow: ${workflow.instance.workflowName} v${workflow.instance.workflowVersion}`),
      ],
    });

    res.status(201).json(toPublicRecord(record, req.user));
    scheduleAiSuggestionGeneration(record);
  } catch (error) {
    next(error);
  }
});

app.patch('/api/records/:id/status', authenticate, requireRoles('approver', 'boss'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, approver, reason } = req.body || {};

    if (!validStatuses.has(status) || ![STATUS_APPROVED, STATUS_REJECTED].includes(status)) {
      return res.status(400).json({ error: 'invalid approval status' });
    }

    if (approver && req.user.role !== 'developer' && approver !== req.user.name) {
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
