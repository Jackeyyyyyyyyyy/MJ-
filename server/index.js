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
const users = {
  applicant: { username: 'applicant', role: 'applicant', name: '张申请', password: appPassword },
  approver: { username: 'approver', role: 'approver', name: '李审批', password: appPassword },
  boss: { username: 'boss', role: 'boss', name: '王老板', password: appPassword },
  developer: { username: 'developer', role: 'developer', name: '系统开发员', password: appPassword },
};

app.use(express.json({ limit: '2mb' }));

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
