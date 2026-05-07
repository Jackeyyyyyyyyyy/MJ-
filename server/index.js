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
const validStatuses = new Set(['草稿', '待审批', '已批准', '已拒绝']);
const managedRoles = new Set(['applicant', 'approver', 'boss']);
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
  applicant: '申请人',
  approver: '审批人',
  boss: '管理员',
  developer: '超级管理员',
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
  ],
  developer: [
    { key: 'record:read:all', label: '查看全部申请' },
    { key: 'record:review:all', label: '管理审批结果' },
    { key: 'perspective:switch', label: '切换业务视角' },
    { key: 'account:permissions:read', label: '管理账号权限' },
    { key: 'ai:prompts:write', label: '维护AI审批提示词' },
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
  } catch (error) {
    return next(error);
  }

  if (!user) {
    return res.status(401).json({ error: 'authentication required' });
  }

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
  const displayText = normalizeAiSuggestionText(rawText);
  const riskMatch = displayText.match(/(低|中|高)风险/);
  const riskLevel = riskMatch ? `${riskMatch[1]}风险` : undefined;
  const advice = displayText.replace(/^(低|中|高)风险[:：]?\s*/, '').trim();

  return {
    status: 'generated',
    riskLevel,
    advice,
    displayText,
    generatedAt: new Date().toISOString(),
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

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    dataDir,
  });
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
      return res.json(records.filter((record) => record.applicant === req.user.name));
    }

    res.json(records);
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
    const aiSuggestion = await generateAiSuggestion({
      moduleName,
      approvalTypeName,
      applicant,
      businessData,
    });
    const record = await createBusinessRecord({
      id: `APP-${Date.now()}`,
      moduleName,
      approvalTypeName,
      businessData,
      status: '待审批',
      applicant,
      aiSuggestion,
      createdAt: now,
      updatedAt: now,
      logs: [
        createLog('发起申请', applicant, '提交了审批单'),
      ],
    });

    res.status(201).json(record);
  } catch (error) {
    next(error);
  }
});

app.patch('/api/records/:id/status', authenticate, requireRoles('approver', 'boss'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, approver, reason } = req.body || {};

    if (!validStatuses.has(status)) {
      return res.status(400).json({ error: 'invalid approval status' });
    }

    if (!approver) {
      return res.status(400).json({ error: 'missing approver' });
    }

    if (req.user.role !== 'developer' && approver !== req.user.name) {
      return res.status(403).json({ error: 'approver does not match current user' });
    }

    if (status === '已拒绝' && !String(reason || '').trim()) {
      return res.status(400).json({ error: 'reject reason is required' });
    }

    const updatedRecord = await updateRecordById(id, (record) => {
      if (record.status !== '待审批') {
        const error = new Error('approval record has already been processed');
        error.statusCode = 409;
        throw error;
      }

      const now = new Date().toISOString();
      record.status = status;
      record.updatedAt = now;
      record.approver = approver;

      if (status === '已批准') {
        record.approvedAt = now;
      } else if (status === '已拒绝') {
        record.rejectedAt = now;
        record.rejectReason = String(reason).trim();
      }

      record.logs = [
        ...(record.logs || []),
        createLog(
          status === '已批准' ? '批准' : '拒绝',
          approver,
          status === '已批准' ? '审批通过' : String(reason).trim(),
        ),
      ];

      return record;
    });

    res.json(updatedRecord);
  } catch (error) {
    next(error);
  }
});

app.delete('/api/records', authenticate, requireRoles('boss'), async (_req, res, next) => {
  try {
    if (process.env.ENABLE_RECORD_DELETE !== 'true') {
      return res.status(403).json({ error: 'record deletion is disabled' });
    }

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
