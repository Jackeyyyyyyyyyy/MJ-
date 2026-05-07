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
const uploadsDir = path.join(dataDir, 'uploads');
const uploadsIndexFile = path.join(dataDir, 'approval-uploads.json');
const validStatuses = new Set(['草稿', '待审批', '已批准', '已拒绝']);

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`${name} environment variable is required.`);
    process.exit(1);
  }
  return value;
}

const appPassword = requireEnv('APP_PASSWORD');
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
const users = {
  applicant: { username: 'applicant', role: 'applicant', name: '张申请', password: appPassword },
  approver: { username: 'approver', role: 'approver', name: '李审批', password: appPassword },
  boss: { username: 'boss', role: 'boss', name: '王老板', password: appPassword },
  developer: { username: 'developer', role: 'developer', name: '超级管理员', password: appPassword },
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

function verifyToken(token) {
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

  const user = users[session.sub];
  if (!user) return null;

  return toPublicUser(user);
}

function authenticate(req, res, next) {
  const authorization = req.get('authorization') || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const user = match ? verifyToken(match[1]) : null;

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

async function ensureDataFile() {
  await fs.mkdir(dataDir, { recursive: true });

  try {
    await fs.access(recordsFile);
  } catch {
    await fs.writeFile(recordsFile, '[]\n', 'utf8');
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
  await ensureDataFile();
  const content = await fs.readFile(recordsFile, 'utf8');

  if (!content.trim()) return [];

  const records = JSON.parse(content);
  if (!Array.isArray(records)) {
    throw new Error('approval records file must contain an array');
  }

  return records;
}

async function writeRecords(records) {
  await ensureDataFile();
  const tempFile = `${recordsFile}.tmp`;
  await fs.writeFile(tempFile, `${JSON.stringify(records, null, 2)}\n`, 'utf8');
  await fs.rename(tempFile, recordsFile);
}

let writeQueue = Promise.resolve();
let uploadWriteQueue = Promise.resolve();

function updateRecords(mutator) {
  const operation = writeQueue.catch(() => undefined).then(async () => {
    const records = await readRecords();
    const result = await mutator(records);
    await writeRecords(records);
    return result;
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

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    dataDir,
  });
});

app.get('/api/accounts', authenticate, requireRoles('developer'), (_req, res) => {
  res.json(Object.values(users).map(({ password, ...user }) => ({
    ...user,
    roleLabel: roleLabels[user.role] || user.role,
    permissions: rolePermissions[user.role] || [],
    canSwitchPerspective: user.role === 'developer',
  })));
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  const user = users[String(username || '').trim()];

  if (!user || password !== user.password) {
    return res.status(401).json({ error: 'invalid username or password' });
  }

  const session = createToken(user);
  res.json({
    user: toPublicUser(user),
    ...session,
  });
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

    const record = await updateRecords((records) => {
      const now = new Date().toISOString();
      const newRecord = {
        id: `APP-${Date.now()}`,
        moduleName,
        approvalTypeName,
        businessData,
        status: '待审批',
        applicant,
        createdAt: now,
        updatedAt: now,
        logs: [
          createLog('发起申请', applicant, '提交了审批单'),
        ],
      };

      records.unshift(newRecord);
      return newRecord;
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

    const updatedRecord = await updateRecords((records) => {
      const record = records.find((item) => item.id === id);

      if (!record) {
        const error = new Error('approval record not found');
        error.statusCode = 404;
        throw error;
      }

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

    await updateRecords((records) => {
      records.splice(0, records.length);
      return null;
    });

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
