import fs from 'node:fs/promises';
import path from 'node:path';

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

function getArgValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function normalizeText(value) {
  return String(value || '').trim();
}

function getBusinessKey(template) {
  const moduleName = normalizeText(
    template?.moduleName ||
    template?.draft?.basic?.moduleName ||
    template?.publishedVersion?.basic?.moduleName,
  );
  const approvalTypeName = normalizeText(
    template?.approvalTypeName ||
    template?.draft?.basic?.approvalTypeName ||
    template?.publishedVersion?.basic?.approvalTypeName,
  );

  if (!moduleName || !approvalTypeName) {
    return `__template__${normalizeText(template?.id) || Math.random().toString(16).slice(2)}`;
  }

  return `${moduleName}|||${approvalTypeName}`;
}

function getScopeKey(template) {
  const organizationId = normalizeText(
    template?.organizationId ||
    template?.draft?.organizationId ||
    template?.publishedVersion?.organizationId ||
    'default-org',
  );

  return `${organizationId}|||${getBusinessKey(template)}`;
}

function arrayLength(value) {
  return Array.isArray(value) ? value.length : 0;
}

function getVersionConfiguredWeight(version) {
  if (!version || typeof version !== 'object') return 0;

  const branches = Array.isArray(version.branches) ? version.branches : [];
  const approvalSteps = branches.reduce(
    (total, branch) => total + arrayLength(branch?.approvalSteps),
    0,
  );
  const branchConditions = branches.reduce(
    (total, branch) => total + arrayLength(branch?.conditions),
    0,
  );
  const flowNodes = (Array.isArray(version.nodes) ? version.nodes : [])
    .filter((node) => node?.type && node.type !== 'start')
    .length;
  const submitScope = arrayLength(version.submitPermission?.memberIds)
    + arrayLength(version.submitPermission?.departmentIds)
    + arrayLength(version.submitPermission?.excludedMemberIds);
  const ccScope = arrayLength(version.ccRule?.memberIds) + arrayLength(version.ccRule?.departmentIds);
  const processorScope = (version.processorRule?.enabled ? 4 : 0)
    + arrayLength(version.processorRule?.memberIds)
    + arrayLength(version.processorRule?.departmentIds);

  return (
    approvalSteps * 1000
    + flowNodes * 100
    + branchConditions * 50
    + submitScope * 20
    + ccScope * 10
    + processorScope * 25
    + arrayLength(version.formFields)
  );
}

function getTemplateScore(template) {
  return (
    (template?.publishedVersion ? 1_000_000 : 0)
    + (template?.status === 'published' ? 500_000 : 0)
    + (Number(template?.currentVersion) || 0) * 1000
    + getVersionConfiguredWeight(template?.publishedVersion) * 2
    + getVersionConfiguredWeight(template?.draft)
  );
}

function getTemplateTimestamp(template) {
  return Date.parse(template?.updatedAt || template?.draft?.savedAt || template?.createdAt || '') || 0;
}

function inferBusinessType(moduleName, approvalTypeName) {
  const text = `${moduleName}${approvalTypeName}`;
  if (text.includes('\u8bf7\u5047')) return 'leave';
  if (text.includes('\u62a5\u9500')) return 'reimbursement';
  if (/[\u91c7\u8d2d\u4ed8\u9884\u6b3e\u8d39\u8d44\u91d1\u5907\u7528\u91d1\u6210\u672c\u6536\u5165\u5229\u6da6\u4ef7\u683c]/.test(text)) return 'purchase';
  return 'general';
}

function createId(prefix, index) {
  return `${prefix}-${Date.now()}-${index}-${Math.random().toString(16).slice(2, 8)}`;
}

function createDefaultWorkflowTemplate(scope, index) {
  const now = new Date().toISOString();
  const name = `${scope.approvalTypeName}\u5ba1\u6279\u6d41`;
  const businessType = inferBusinessType(scope.moduleName, scope.approvalTypeName);
  const draft = {
    id: createId('draft', index),
    version: 1,
    status: 'draft',
    organizationId: 'default-org',
    businessType,
    basic: {
      name,
      moduleName: scope.moduleName,
      approvalTypeName: scope.approvalTypeName,
      visibleRange: 'all',
    },
    submitPermission: {
      type: 'all_members',
      memberIds: [],
      departmentIds: [],
      excludedMemberIds: [],
    },
    flowMode: 'flexible',
    branches: [{
      id: 'branch-default',
      name: 'Default Branch',
      isDefault: true,
      conditions: [],
      approvalSteps: [],
    }],
    ccRule: {
      timing: 'workflow_completed',
      memberIds: [],
      departmentIds: [],
    },
    processorRule: {
      timing: 'approval_completed',
      enabled: false,
      taskName: '\u529e\u7406\u4efb\u52a1',
      memberIds: [],
      departmentIds: [],
    },
    formFields: [],
    nodes: [
      { id: 'node-start', type: 'start', title: '\u53d1\u8d77\u4eba', subtitle: 'Applicant' },
    ],
    savedAt: now,
  };

  return {
    id: createId('workflow', index),
    name,
    organizationId: 'default-org',
    businessType,
    moduleName: scope.moduleName,
    approvalTypeName: scope.approvalTypeName,
    status: 'draft',
    currentVersion: 1,
    draft,
    createdAt: now,
    updatedAt: now,
    updatedBy: 'system',
  };
}

async function readSchemaScopes(dataDir) {
  const schemaFile = path.join(dataDir, 'approval-schema.json');
  const schema = JSON.parse(await fs.readFile(schemaFile, 'utf8'));
  const scopes = [];

  for (const module of Array.isArray(schema.modules) ? schema.modules : []) {
    for (const approvalType of Array.isArray(module.approvalTypes) ? module.approvalTypes : []) {
      const moduleName = normalizeText(module.name);
      const approvalTypeName = normalizeText(approvalType.name);
      if (moduleName && approvalTypeName) {
        scopes.push({
          moduleName,
          approvalTypeName,
          scopeKey: `default-org|||${moduleName}|||${approvalTypeName}`,
        });
      }
    }
  }

  return scopes;
}

function shouldPrefer(candidate, current) {
  const scoreDifference = getTemplateScore(candidate.template) - getTemplateScore(current.template);
  if (scoreDifference !== 0) return scoreDifference > 0;
  return getTemplateTimestamp(candidate.template) > getTemplateTimestamp(current.template);
}

function summarizeEntry(entry) {
  return {
    id: entry.template.id,
    name: entry.template.name,
    status: entry.template.status,
    currentVersion: entry.template.currentVersion,
    draftVersion: entry.template.draft?.version,
    publishedVersion: entry.template.publishedVersion?.version,
    hasPublished: Boolean(entry.template.publishedVersion),
    updatedAt: entry.template.updatedAt,
    score: getTemplateScore(entry.template),
  };
}

async function main() {
  await loadLocalEnvFile();

  const shouldWrite = process.argv.includes('--write');
  const shouldEnsureSchemaDefaults = process.argv.includes('--ensure-schema-defaults');
  const dataDir = path.resolve(
    getArgValue('--data-dir') ||
    process.env.RAILWAY_VOLUME_MOUNT_PATH ||
    process.env.DATA_DIR ||
    path.resolve(process.cwd(), 'data'),
  );
  const file = path.join(dataDir, 'workflow-templates.json');
  const content = await fs.readFile(file, 'utf8');
  const templates = JSON.parse(content);

  if (!Array.isArray(templates)) {
    throw new Error('workflow-templates.json must contain an array');
  }

  const entries = templates.map((template, index) => ({
    template,
    index,
    scopeKey: getScopeKey(template),
  }));
  const groups = new Map();
  const selected = new Map();

  for (const entry of entries) {
    const group = groups.get(entry.scopeKey) || [];
    group.push(entry);
    groups.set(entry.scopeKey, group);

    const current = selected.get(entry.scopeKey);
    if (!current || shouldPrefer(entry, current)) {
      selected.set(entry.scopeKey, entry);
    }
  }

  const keptIndexes = new Set(Array.from(selected.values(), (entry) => entry.index));
  const nextTemplates = templates.filter((_, index) => keptIndexes.has(index));
  const createdTemplates = [];

  if (shouldEnsureSchemaDefaults) {
    const schemaScopes = await readSchemaScopes(dataDir);
    const existingScopeKeys = new Set(nextTemplates.map(getScopeKey));

    schemaScopes.forEach((scope, index) => {
      if (existingScopeKeys.has(scope.scopeKey)) return;
      const template = createDefaultWorkflowTemplate(scope, index + 1);
      nextTemplates.push(template);
      createdTemplates.push(summarizeEntry({ template, index: templates.length + createdTemplates.length }));
      existingScopeKeys.add(scope.scopeKey);
    });
  }

  const duplicateGroups = Array.from(groups.entries()).filter(([, group]) => group.length > 1);
  const removedEntries = entries.filter((entry) => !keptIndexes.has(entry.index));
  const report = {
    mode: shouldWrite ? 'write' : 'dry-run',
    ensureSchemaDefaults: shouldEnsureSchemaDefaults,
    dataDir,
    file,
    before: templates.length,
    after: nextTemplates.length,
    removed: removedEntries.length,
    created: createdTemplates.length,
    duplicateGroups: duplicateGroups.length,
    createdTemplates,
    groups: duplicateGroups.map(([scopeKey, group]) => ({
      scopeKey,
      kept: summarizeEntry(selected.get(scopeKey)),
      removed: group.filter((entry) => !keptIndexes.has(entry.index)).map(summarizeEntry),
    })),
  };

  if (shouldWrite && (removedEntries.length > 0 || createdTemplates.length > 0)) {
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    const backupFile = path.join(dataDir, `workflow-templates.backup-${timestamp}.json`);
    const tempFile = `${file}.tmp`;

    await fs.writeFile(backupFile, content, 'utf8');
    await fs.writeFile(tempFile, `${JSON.stringify(nextTemplates, null, 2)}\n`, 'utf8');
    await fs.rename(tempFile, file);
    report.backupFile = backupFile;
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
