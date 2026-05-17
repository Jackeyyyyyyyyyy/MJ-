import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Plus, Save, Workflow, XCircle } from 'lucide-react';
import { approvalSchema } from '../approvalSchema';
import { storage } from '../storage';
import { ApproverRule, OrganizationDirectory, WorkflowNode, WorkflowTemplate, WorkflowVersion } from '../types';

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function createDraft(name: string, moduleName: string, approvalTypeName: string): WorkflowVersion {
  return {
    id: createId('draft'),
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
        title: '发起人',
        subtitle: 'Applicant',
      },
    ],
  };
}

function getApproverNodes(draft: WorkflowVersion | null) {
  return draft?.nodes.filter((node) => node.type === 'approver') || [];
}

function withApproverNodes(draft: WorkflowVersion, steps: WorkflowNode[]) {
  const startNode = draft.nodes.find((node) => node.type === 'start') || {
    id: 'node-start',
    type: 'start' as const,
    title: '发起人',
    subtitle: 'Applicant',
  };

  return {
    ...draft,
    nodes: [startNode, ...steps],
  };
}

function defaultRule(): ApproverRule {
  return {
    type: 'specified',
    memberIds: [],
    emptyApproverAction: 'block_submit',
  };
}

export default function WorkflowAdmin() {
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [directory, setDirectory] = useState<OrganizationDirectory>({ departments: [], members: [], roleGroups: [] });
  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState<WorkflowVersion | null>(null);
  const [createModule, setCreateModule] = useState(approvalSchema.modules[0]?.name || '');
  const [createType, setCreateType] = useState(approvalSchema.modules[0]?.approvalTypes[0]?.name || '');
  const [createName, setCreateName] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const selectedTemplate = templates.find((template) => template.id === selectedId) || null;
  const approverSteps = getApproverNodes(draft);
  const selectedModule = approvalSchema.modules.find((module) => module.name === createModule);

  const enabledMembers = useMemo(
    () => directory.members.filter((member) => member.enabled !== false),
    [directory.members],
  );

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [nextTemplates, nextDirectory] = await Promise.all([
        storage.getWorkflowTemplates(),
        storage.getOrganizationDirectory(),
      ]);
      setTemplates(nextTemplates);
      setDirectory(nextDirectory);
      const nextSelected = nextTemplates[0] || null;
      setSelectedId(nextSelected?.id || '');
      setDraft(nextSelected ? JSON.parse(JSON.stringify(nextSelected.draft)) : null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (!selectedModule?.approvalTypes.some((type) => type.name === createType)) {
      setCreateType(selectedModule?.approvalTypes[0]?.name || '');
    }
  }, [createModule, createType, selectedModule]);

  const selectTemplate = (template: WorkflowTemplate) => {
    setSelectedId(template.id);
    setDraft(JSON.parse(JSON.stringify(template.draft)));
    setMessage('');
  };

  const handleCreate = async () => {
    const name = createName.trim() || `${createModule}-${createType}`;
    setMessage('');
    try {
      const created = await storage.createWorkflowTemplate({ name, moduleName: createModule, approvalTypeName: createType });
      const nextDraft = createDraft(name, createModule, createType);
      const updated = await storage.updateWorkflowDraft(created.id, nextDraft);
      setTemplates((current) => [updated, ...current]);
      setSelectedId(updated.id);
      setDraft(JSON.parse(JSON.stringify(updated.draft)));
      setCreateName('');
      setMessage('审批流已创建，请配置步骤后发布。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '创建失败');
    }
  };

  const saveDraft = async () => {
    if (!selectedTemplate || !draft) return null;
    const saved = await storage.updateWorkflowDraft(selectedTemplate.id, draft);
    setTemplates((current) => current.map((template) => template.id === saved.id ? saved : template));
    setDraft(JSON.parse(JSON.stringify(saved.draft)));
    return saved;
  };

  const handleSave = async () => {
    setMessage('');
    try {
      await saveDraft();
      setMessage('草稿已保存');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败');
    }
  };

  const handlePublish = async () => {
    if (!selectedTemplate) return;
    setMessage('');
    try {
      await saveDraft();
      const published = await storage.publishWorkflowTemplate(selectedTemplate.id);
      setTemplates((current) => current.map((template) => template.id === published.id ? published : template));
      setDraft(JSON.parse(JSON.stringify(published.draft)));
      setMessage('审批流已发布');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '发布失败');
    }
  };

  const handleStatusChange = async (status: WorkflowTemplate['status']) => {
    if (!selectedTemplate) return;
    setMessage('');
    try {
      const updated = await storage.setWorkflowTemplateStatus(selectedTemplate.id, status);
      setTemplates((current) => current.map((template) => template.id === updated.id ? updated : template));
      setMessage(status === 'disabled' ? '审批流已禁用' : '审批流已启用');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '状态更新失败');
    }
  };

  const patchDraft = (patch: Partial<WorkflowVersion>) => {
    setDraft((current) => current ? { ...current, ...patch } : current);
  };

  const patchBasic = (patch: Partial<WorkflowVersion['basic']>) => {
    setDraft((current) => current ? { ...current, basic: { ...current.basic, ...patch } } : current);
  };

  const addStep = () => {
    setDraft((current) => {
      if (!current) return current;
      const steps = getApproverNodes(current);
      const nextStep: WorkflowNode = {
        id: createId('step'),
        type: 'approver',
        title: `审批步骤 ${steps.length + 1}`,
        subtitle: '',
        rule: defaultRule(),
      };
      return withApproverNodes(current, [...steps, nextStep]);
    });
  };

  const updateStep = (stepId: string, patch: Partial<WorkflowNode>) => {
    setDraft((current) => {
      if (!current) return current;
      const steps = getApproverNodes(current).map((step) => (
        step.id === stepId ? { ...step, ...patch } : step
      ));
      return withApproverNodes(current, steps);
    });
  };

  const removeStep = (stepId: string) => {
    setDraft((current) => {
      if (!current) return current;
      return withApproverNodes(current, getApproverNodes(current).filter((step) => step.id !== stepId));
    });
  };

  const updateStepRule = (step: WorkflowNode, patch: Partial<ApproverRule>) => {
    updateStep(step.id, {
      rule: {
        ...defaultRule(),
        ...(step.rule || {}),
        ...patch,
      },
    });
  };

  if (isLoading) {
    return <div className="text-[15px] font-bold text-medium-gray">正在加载审批流配置...</div>;
  }

  return (
    <div className="space-y-8 pb-32 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <p className="text-[11px] font-black text-light-gray uppercase tracking-[0.2em]">Workflow Admin</p>
        <h1 className="text-2xl font-black text-midnight-graphite tracking-tight">审批流配置</h1>
        <p className="text-[14px] font-medium text-medium-gray">MVP 仅支持线性审批步骤。发布后，新申请会按业务模块和审批类型自动匹配。</p>
      </div>

      {message && (
        <div className="rounded-2xl border border-border-silver bg-white px-5 py-4 text-[13px] font-bold text-midnight-graphite">
          {message}
        </div>
      )}

      <section className="rounded-2xl border border-border-silver bg-white shadow-sm p-5">
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_auto]">
          <select className="input-field" value={createModule} onChange={(event) => setCreateModule(event.target.value)}>
            {approvalSchema.modules.map((module) => (
              <option key={module.name} value={module.name}>{module.name}</option>
            ))}
          </select>
          <select className="input-field" value={createType} onChange={(event) => setCreateType(event.target.value)}>
            {selectedModule?.approvalTypes.map((type) => (
              <option key={type.name} value={type.name}>{type.name}</option>
            ))}
          </select>
          <input
            className="input-field"
            value={createName}
            onChange={(event) => setCreateName(event.target.value)}
            placeholder="流程名称（可选）"
          />
          <button onClick={handleCreate} className="h-11 px-5 rounded-full bg-black text-white text-[13px] font-bold flex items-center justify-center gap-2">
            <Plus size={15} />新建流程
          </button>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <section className="rounded-2xl border border-border-silver bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border-silver flex items-center gap-3">
            <Workflow size={17} />
            <h2 className="text-[16px] font-black">流程列表</h2>
          </div>
          <div className="divide-y divide-border-silver">
            {templates.map((template) => (
              <button
                key={template.id}
                onClick={() => selectTemplate(template)}
                className={`w-full text-left p-5 transition-colors ${selectedId === template.id ? 'bg-lightest-gray-background' : 'hover:bg-canvas-white'}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[14px] font-black text-midnight-graphite">{template.name}</p>
                  <span className="text-[10px] font-black uppercase text-medium-gray">{template.status}</span>
                </div>
                <p className="mt-1 text-[12px] font-bold text-medium-gray">{template.moduleName} / {template.approvalTypeName}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-border-silver bg-white shadow-sm overflow-hidden">
          {!draft || !selectedTemplate ? (
            <div className="p-12 text-center text-[14px] font-bold text-medium-gray">请先选择或新建审批流</div>
          ) : (
            <div>
              <div className="p-6 border-b border-border-silver space-y-4">
                <div className="grid gap-4 lg:grid-cols-3">
                  <input
                    className="input-field"
                    value={draft.basic.name}
                    onChange={(event) => {
                      patchBasic({ name: event.target.value });
                      patchDraft({ id: draft.id });
                    }}
                    placeholder="流程名称"
                  />
                  <input className="input-field" value={draft.basic.moduleName} readOnly />
                  <input className="input-field" value={draft.basic.approvalTypeName} readOnly />
                </div>
                <div className="flex flex-wrap gap-3">
                  <button onClick={handleSave} className="h-10 px-4 rounded-full bg-black text-white text-[12px] font-bold flex items-center gap-2">
                    <Save size={14} />保存草稿
                  </button>
                  <button onClick={handlePublish} className="h-10 px-4 rounded-full bg-[#2e7d32] text-white text-[12px] font-bold flex items-center gap-2">
                    <CheckCircle2 size={14} />发布
                  </button>
                  {selectedTemplate.status === 'disabled' ? (
                    <button onClick={() => handleStatusChange('published')} className="h-10 px-4 rounded-full bg-lightest-gray-background text-[12px] font-bold">
                      启用
                    </button>
                  ) : (
                    <button onClick={() => handleStatusChange('disabled')} className="h-10 px-4 rounded-full bg-[#ffebee] text-[#c62828] text-[12px] font-bold flex items-center gap-2">
                      <XCircle size={14} />禁用
                    </button>
                  )}
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[16px] font-black">审批步骤</h3>
                  <button onClick={addStep} className="h-9 px-4 rounded-full bg-lightest-gray-background text-[12px] font-bold flex items-center gap-2">
                    <Plus size={14} />添加步骤
                  </button>
                </div>

                {approverSteps.length === 0 && (
                  <div className="rounded-2xl bg-canvas-white p-8 text-center text-[13px] font-bold text-medium-gray">
                    暂无审批步骤，发布前至少添加一步。
                  </div>
                )}

                {approverSteps.map((step, index) => {
                  const rule = { ...defaultRule(), ...(step.rule || {}) };

                  return (
                    <div key={step.id} className="rounded-2xl border border-border-silver p-5 space-y-4">
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-[12px] font-black text-light-gray uppercase tracking-widest">Step {index + 1}</p>
                        <button onClick={() => removeStep(step.id)} className="text-[12px] font-bold text-[#c62828]">删除</button>
                      </div>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <input
                          className="input-field"
                          value={step.title}
                          onChange={(event) => updateStep(step.id, { title: event.target.value })}
                          placeholder="步骤名称"
                        />
                        <select
                          className="input-field"
                          value={rule.type}
                          onChange={(event) => updateStepRule(step, {
                            type: event.target.value as ApproverRule['type'],
                            memberIds: [],
                            roleGroupId: '',
                          })}
                        >
                          <option value="specified">指定成员</option>
                          <option value="role">指定角色组</option>
                          <option value="direct_supervisor">直属主管</option>
                          <option value="nth_supervisor">N 级主管</option>
                        </select>
                      </div>

                      {rule.type === 'specified' && (
                        <select
                          multiple
                          className="input-field min-h-[120px]"
                          value={rule.memberIds || []}
                          onChange={(event) => updateStepRule(step, {
                            memberIds: Array.from(event.currentTarget.selectedOptions).map((option) => option.value),
                          })}
                        >
                          {enabledMembers.map((member) => (
                            <option key={member.id} value={member.id}>
                              {member.name}{member.accountUsername ? `（${member.accountUsername}）` : '（未绑定账号）'}
                            </option>
                          ))}
                        </select>
                      )}

                      {rule.type === 'role' && (
                        <select
                          className="input-field"
                          value={rule.roleGroupId || ''}
                          onChange={(event) => updateStepRule(step, { roleGroupId: event.target.value })}
                        >
                          <option value="">选择角色组</option>
                          {directory.roleGroups.map((roleGroup) => (
                            <option key={roleGroup.id} value={roleGroup.id}>{roleGroup.name}</option>
                          ))}
                        </select>
                      )}

                      {rule.type === 'nth_supervisor' && (
                        <input
                          className="input-field"
                          type="number"
                          min={1}
                          value={rule.supervisorLevel || 1}
                          onChange={(event) => updateStepRule(step, { supervisorLevel: Number(event.target.value) || 1 })}
                          placeholder="主管层级"
                        />
                      )}

                      <select
                        className="input-field"
                        value={rule.emptyApproverAction || 'block_submit'}
                        onChange={(event) => updateStepRule(step, {
                          emptyApproverAction: event.target.value as ApproverRule['emptyApproverAction'],
                        })}
                      >
                        <option value="block_submit">找不到审批人时阻止提交</option>
                        <option value="auto_pass">找不到审批人时自动跳过</option>
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
