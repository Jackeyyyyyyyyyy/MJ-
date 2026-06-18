import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_ORG_ID = 'default-org';

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

function normalizeStringList(items) {
  return [...new Set(
    (Array.isArray(items) ? items : [])
      .map((item) => normalizeText(item))
      .filter(Boolean),
  )];
}

function normalizeConfiguredFields(items, businessFields) {
  const fieldSet = new Set(businessFields);
  return normalizeStringList(items).filter((field) => fieldSet.has(field));
}

function normalizeSelectFields(items, businessFields) {
  const fieldSet = new Set(businessFields);
  const byField = new Map();

  (Array.isArray(items) ? items : []).forEach((item) => {
    const field = normalizeText(item?.field);
    if (!field || !fieldSet.has(field)) return;

    const options = normalizeStringList(item?.options);
    if (options.length > 0) byField.set(field, { field, options });
  });

  return Array.from(byField.values());
}

function normalizeDetailFields(items, businessFields) {
  const fieldSet = new Set(businessFields);
  const byField = new Map();

  (Array.isArray(items) ? items : []).forEach((item) => {
    const field = normalizeText(item?.field);
    if (!field || !fieldSet.has(field)) return;

    const columns = normalizeStringList(item?.columns);
    if (columns.length > 0) byField.set(field, { field, columns });
  });

  return Array.from(byField.values());
}

function isDateBusinessField(field) {
  return field.includes('日期') || field.includes('时间');
}

function isAmountBusinessField(field) {
  return /金额|价格|费用|利润|总额/.test(field);
}

function inferBusinessType(moduleName, approvalTypeName) {
  const text = `${moduleName}${approvalTypeName}`;
  if (text.includes('请假')) return 'leave';
  if (text.includes('报销')) return 'reimbursement';
  if (/[采购付预款费资金备用金成本收入利润价格]/.test(text)) return 'purchase';
  return 'general';
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function getBusinessKey(moduleName, approvalTypeName) {
  return `${normalizeText(moduleName)}|||${normalizeText(approvalTypeName)}`;
}

function normalizeForm(input, schemaCommonFields) {
  const moduleName = normalizeText(input?.moduleName);
  const approvalTypeName = normalizeText(input?.approvalTypeName);
  const businessFields = normalizeStringList(input?.businessFields);

  if (!moduleName || !approvalTypeName || businessFields.length === 0) {
    throw new Error('每个表单都必须包含 moduleName、approvalTypeName 和 businessFields');
  }

  return {
    name: approvalTypeName,
    businessFields,
    amountFields: normalizeConfiguredFields(
      Array.isArray(input?.amountFields) ? input.amountFields : businessFields.filter(isAmountBusinessField),
      businessFields,
    ),
    fileFields: normalizeConfiguredFields(input?.fileFields, businessFields),
    dateFields: normalizeConfiguredFields(
      Array.isArray(input?.dateFields) ? input.dateFields : businessFields.filter(isDateBusinessField),
      businessFields,
    ),
    optionalFields: normalizeConfiguredFields(input?.optionalFields, businessFields),
    multilineFields: normalizeConfiguredFields(input?.multilineFields, businessFields),
    memberFields: normalizeConfiguredFields(input?.memberFields, businessFields),
    departmentFields: normalizeConfiguredFields(input?.departmentFields, businessFields),
    selectFields: normalizeSelectFields(input?.selectFields, businessFields),
    detailFields: normalizeDetailFields(input?.detailFields, businessFields),
    visibleToUsers: input?.visibleToUsers !== false,
    commonFields: normalizeStringList(input?.commonFields).length > 0
      ? normalizeStringList(input.commonFields)
      : schemaCommonFields,
    ...(normalizeText(input?.notes) ? { notes: normalizeText(input.notes) } : {}),
  };
}

function upsertForm(schema, input) {
  const moduleName = normalizeText(input?.moduleName);
  const form = normalizeForm(input, schema.commonFields);
  let module = schema.modules.find((item) => item.name === moduleName);
  if (!module) {
    module = { name: moduleName, approvalTypes: [] };
    schema.modules.push(module);
  }

  const index = module.approvalTypes.findIndex((item) => item.name === form.name);
  if (index >= 0) {
    module.approvalTypes[index] = {
      ...module.approvalTypes[index],
      ...form,
      commonFields: form.commonFields.length > 0 ? form.commonFields : module.approvalTypes[index].commonFields,
    };
    return 'updated';
  }

  module.approvalTypes.push(form);
  return 'created';
}

function defaultSubmitPermission() {
  return {
    type: 'all_members',
    memberIds: [],
    departmentIds: [],
    excludedMemberIds: [],
  };
}

function defaultBranch() {
  return {
    id: 'branch-default',
    name: '默认分支',
    isDefault: true,
    conditionMode: 'rules',
    conditions: [],
    approvalSteps: [],
  };
}

function createWorkflowDraft(input) {
  const moduleName = normalizeText(input?.moduleName);
  const approvalTypeName = normalizeText(input?.approvalTypeName);
  if (!moduleName || !approvalTypeName) {
    throw new Error('每个审批流都必须包含 moduleName 和 approvalTypeName');
  }

  const draft = input?.draft && typeof input.draft === 'object' ? input.draft : input;
  return {
    id: normalizeText(draft.id) || createId('version'),
    version: Number(draft.version || input?.version || 1),
    status: input?.status === 'published' ? 'published' : 'draft',
    organizationId: normalizeText(input?.organizationId || draft.organizationId) || DEFAULT_ORG_ID,
    businessType: input?.businessType || draft.businessType || inferBusinessType(moduleName, approvalTypeName),
    basic: {
      name: normalizeText(draft.basic?.name || input?.name) || `${approvalTypeName}审批流`,
      moduleName,
      approvalTypeName,
      visibleRange: normalizeText(draft.basic?.visibleRange) || '全员可见',
    },
    submitPermission: draft.submitPermission || input?.submitPermission || defaultSubmitPermission(),
    branches: Array.isArray(draft.branches) && draft.branches.length > 0 ? draft.branches : [defaultBranch()],
    ccRule: draft.ccRule || input?.ccRule || { timing: 'workflow_completed', memberIds: [], departmentIds: [] },
    processorRule: draft.processorRule || input?.processorRule || {
      timing: 'approval_completed',
      enabled: false,
      taskName: '办理任务',
      memberIds: [],
      departmentIds: [],
    },
    formFields: Array.isArray(draft.formFields) ? draft.formFields : [],
    flowMode: draft.flowMode || 'flexible',
    nodes: Array.isArray(draft.nodes) && draft.nodes.length > 0
      ? draft.nodes
      : [{ id: 'start', type: 'start', title: '发起人', subtitle: '提交审批' }],
    savedAt: new Date().toISOString(),
    savedBy: 'config-import',
  };
}

function upsertWorkflow(templates, input) {
  const moduleName = normalizeText(input?.moduleName || input?.draft?.basic?.moduleName);
  const approvalTypeName = normalizeText(input?.approvalTypeName || input?.draft?.basic?.approvalTypeName);
  const organizationId = normalizeText(input?.organizationId || input?.draft?.organizationId) || DEFAULT_ORG_ID;
  const draft = createWorkflowDraft({ ...input, moduleName, approvalTypeName, organizationId });
  const scopeKey = `${organizationId}|||${getBusinessKey(moduleName, approvalTypeName)}`;

  const index = templates.findIndex((template) => {
    const templateOrganizationId = normalizeText(
      template.organizationId || template.draft?.organizationId || template.publishedVersion?.organizationId,
    ) || DEFAULT_ORG_ID;
    return `${templateOrganizationId}|||${getBusinessKey(
      template.moduleName || template.draft?.basic?.moduleName || template.publishedVersion?.basic?.moduleName,
      template.approvalTypeName || template.draft?.basic?.approvalTypeName || template.publishedVersion?.basic?.approvalTypeName,
    )}` === scopeKey;
  });

  const now = new Date().toISOString();
  const nextTemplate = {
    id: index >= 0 ? templates[index].id : createId('template'),
    name: draft.basic.name,
    organizationId,
    businessType: draft.businessType,
    moduleName,
    approvalTypeName,
    status: input?.status === 'published' ? 'published' : 'draft',
    currentVersion: draft.version,
    draft,
    ...(input?.status === 'published' ? { publishedVersion: { ...draft, publishedAt: now } } : {}),
    createdAt: index >= 0 ? templates[index].createdAt : now,
    updatedAt: now,
    updatedBy: 'config-import',
  };

  if (index >= 0) {
    templates[index] = nextTemplate;
    return 'updated';
  }

  templates.push(nextTemplate);
  return 'created';
}

async function readBundledSchema() {
  const sourceFile = path.resolve(process.cwd(), 'src', 'approvalSchema.ts');
  const content = await fs.readFile(sourceFile, 'utf8');
  const match = content.match(/export\s+const\s+approvalSchema\s*:\s*Schema\s*=\s*([\s\S]*?);\s*(?:export\s+function|$)/);
  if (!match?.[1]) throw new Error('找不到内置 approvalSchema');
  return JSON.parse(match[1]);
}

async function readJsonFile(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT' && fallback !== undefined) return fallback;
    throw error;
  }
}

async function backupIfExists(file) {
  try {
    await fs.access(file);
  } catch {
    return null;
  }

  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const backupFile = `${file}.backup-${timestamp}`;
  await fs.copyFile(file, backupFile);
  return backupFile;
}

async function main() {
  await loadLocalEnvFile();

  const configFile = path.resolve(process.cwd(), getArgValue('--config') || 'approval-import.json');
  const dataDir = path.resolve(
    getArgValue('--data-dir') ||
    process.env.RAILWAY_VOLUME_MOUNT_PATH ||
    process.env.DATA_DIR ||
    path.resolve(process.cwd(), 'data'),
  );
  const schemaFile = path.join(dataDir, 'approval-schema.json');
  const workflowFile = path.join(dataDir, 'workflow-templates.json');
  const config = await readJsonFile(configFile);

  const schema = await readJsonFile(schemaFile, await readBundledSchema());
  schema.systemName = normalizeText(schema.systemName) || 'MJ审批';
  schema.commonFields = normalizeStringList(schema.commonFields).length > 0
    ? normalizeStringList(schema.commonFields)
    : ['状态', '发起人', '发起时间', '操作'];
  schema.modules = Array.isArray(schema.modules) ? schema.modules : [];

  const formResults = { created: 0, updated: 0 };
  (Array.isArray(config.forms) ? config.forms : []).forEach((form) => {
    formResults[upsertForm(schema, form)] += 1;
  });

  const templates = await readJsonFile(workflowFile, []);
  const workflowResults = { created: 0, updated: 0 };
  (Array.isArray(config.workflows) ? config.workflows : []).forEach((workflow) => {
    workflowResults[upsertWorkflow(templates, workflow)] += 1;
  });

  await fs.mkdir(dataDir, { recursive: true });
  const backups = [
    await backupIfExists(schemaFile),
    await backupIfExists(workflowFile),
  ].filter(Boolean);
  await fs.writeFile(schemaFile, `${JSON.stringify(schema, null, 2)}\n`, 'utf8');
  await fs.writeFile(workflowFile, `${JSON.stringify(templates, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify({
    dataDir,
    forms: formResults,
    workflows: workflowResults,
    backups,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
