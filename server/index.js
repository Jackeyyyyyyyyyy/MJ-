import express from 'express';
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

app.use(express.json({ limit: '2mb' }));

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

app.get('/api/records', async (_req, res, next) => {
  try {
    res.json(await readRecords());
  } catch (error) {
    next(error);
  }
});

app.post('/api/records', async (req, res, next) => {
  try {
    const { moduleName, approvalTypeName, businessData, applicant } = req.body || {};

    if (!moduleName || !approvalTypeName || !businessData || !applicant) {
      return res.status(400).json({ error: 'missing required approval record fields' });
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

app.patch('/api/records/:id/status', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, approver, reason } = req.body || {};

    if (!validStatuses.has(status)) {
      return res.status(400).json({ error: 'invalid approval status' });
    }

    if (!approver) {
      return res.status(400).json({ error: 'missing approver' });
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

app.delete('/api/records', async (_req, res, next) => {
  try {
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
