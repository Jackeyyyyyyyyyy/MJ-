import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  ClipboardList,
  Copy,
  FileText,
  GitBranch,
  Layers,
  Plus,
  Rocket,
  Save,
  Settings2,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { storage } from '../storage';
import {
  ApproverRule,
  ApproverRuleType,
  OrganizationDirectory,
  WorkflowCondition,
  WorkflowConditionNode,
  WorkflowFormField,
  WorkflowNode,
  WorkflowStepKey,
  WorkflowTemplate,
  WorkflowVersion,
} from '../types';
import { cn } from '../lib/utils';

type WorkflowDraftNode = WorkflowNode | WorkflowConditionNode;

type Selection =
  | { kind: 'node'; nodeId: string }
  | { kind: 'condition'; groupId: string; conditionId: string }
  | null;

const workflowSteps: Array<{ key: WorkflowStepKey; label: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }> }> = [
  { key: 'basic', label: '基础设置', icon: Settings2 },
  { key: 'form', label: '表单设计', icon: FileText },
  { key: 'flow', label: '流程设计', icon: GitBranch },
  { key: 'advanced', label: '高级设置', icon: ClipboardList },
];

const approverRuleOptions: Array<{ type: ApproverRuleType; label: string; hint: string }> = [
  { type: 'specified', label: '指定成员', hint: '固定人员审批或抄送' },
  { type: 'direct_supervisor', label: '直属主管', hint: '按发起人通讯录关系找上级' },
  { type: 'nth_supervisor', label: '第 N 级主管', hint: '直接定位到指定层级主管' },
  { type: 'multi_supervisor', label: '连续多级主管', hint: '从直属主管逐级往上审批' },
  { type: 'role', label: '角色/岗位', hint: '按角色组匹配审批人' },
  { type: 'initiator_select', label: '发起人自选', hint: '提交时由发起人选择' },
];

const emptyOrganization: OrganizationDirectory = {
  departments: [],
  members: [],
  roleGroups: [],
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function isConditionNode(node: WorkflowDraftNode): node is WorkflowConditionNode {
  return node.type === 'condition' && Array.isArray((node as WorkflowConditionNode).conditions);
}

function findMemberName(directory: OrganizationDirectory, id?: string) {
  if (!id) return '';
  return directory.members.find((member) => member.id === id)?.name || id;
}

function findRoleName(directory: OrganizationDirectory, id?: string) {
  if (!id) return '';
  return directory.roleGroups.find((role) => role.id === id)?.name || id;
}

function formatRule(rule: ApproverRule | undefined, directory: OrganizationDirectory) {
  if (!rule) return '未设置';

  if (rule.type === 'specified') {
    const names = (rule.memberIds || []).map((id) => findMemberName(directory, id)).filter(Boolean);
    return names.length ? names.join('、') : '请选择成员';
  }

  if (rule.type === 'direct_supervisor') return '发起人的直接主管';
  if (rule.type === 'nth_supervisor') return `发起人的第${rule.supervisorLevel || 2}级主管`;
  if (rule.type === 'multi_supervisor') return `从直接主管到第${rule.supervisorDepth || 4}级主管`;
  if (rule.type === 'role') return findRoleName(directory, rule.roleGroupId) || '请选择角色';
  return '发起人提交时自选';
}

function getNodeTone(type: WorkflowNode['type']) {
  if (type === 'start') return 'bg-[#3f5280] text-white';
  if (type === 'cc') return 'bg-[#1f8feb] text-white';
  if (type === 'condition') return 'bg-[#14b8a6] text-white';
  return 'bg-[#ff9f2d] text-white';
}

function getNodeIcon(type: WorkflowNode['type']) {
  if (type === 'start') return Users;
  if (type === 'cc') return Copy;
  if (type === 'condition') return GitBranch;
  return UserCheck;
}

function findNode(nodes: WorkflowDraftNode[], nodeId: string): WorkflowDraftNode | null {
  for (const node of nodes) {
    if (node.id === nodeId) return node;
    if (isConditionNode(node)) {
      for (const condition of node.conditions) {
        const child = condition.nodes.find((item) => item.id === nodeId);
        if (child) return child;
      }
    }
  }
  return null;
}

function updateNodeInTree(
  nodes: WorkflowDraftNode[],
  nodeId: string,
  updater: (node: WorkflowDraftNode) => WorkflowDraftNode,
) {
  return nodes.map((node) => {
    if (node.id === nodeId) return updater(node);

    if (isConditionNode(node)) {
      return {
        ...node,
        conditions: node.conditions.map((condition) => ({
          ...condition,
          nodes: condition.nodes.map((child) => (
            child.id === nodeId ? updater(child) as WorkflowNode : child
          )),
        })),
      };
    }

    return node;
  });
}

function updateConditionInTree(
  nodes: WorkflowDraftNode[],
  conditionId: string,
  updater: (condition: WorkflowCondition) => WorkflowCondition,
) {
  return nodes.map((node) => {
    if (!isConditionNode(node)) return node;
    return {
      ...node,
      conditions: node.conditions.map((condition) => (
        condition.id === conditionId ? updater(condition) : condition
      )),
    };
  });
}

function findCondition(nodes: WorkflowDraftNode[], conditionId: string) {
  for (const node of nodes) {
    if (!isConditionNode(node)) continue;
    const condition = node.conditions.find((item) => item.id === conditionId);
    if (condition) return condition;
  }
  return null;
}

function createBranchFrom(condition: WorkflowCondition, branchIndex: number): WorkflowCondition {
  return {
    id: `cond-${Date.now()}`,
    title: `条件${branchIndex}`,
    expression: '请设置条件',
    priority: branchIndex,
    nodes: condition.nodes.map((node) => ({
      ...clone(node),
      id: `${node.id}-${Date.now()}`,
    })),
  };
}

function FieldTypeLabel({ type }: { type: WorkflowFormField['type'] }) {
  const labelMap: Record<WorkflowFormField['type'], string> = {
    text: '文本',
    number: '数字',
    money: '金额',
    date: '日期',
    select: '选项',
    attachment: '附件',
  };
  return <span>{labelMap[type]}</span>;
}

function WorkflowNodeCard({
  node,
  selected,
  onSelect,
}: {
  node: WorkflowDraftNode;
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon = getNodeIcon(node.type);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-[260px] bg-white border rounded-md shadow-sm text-left overflow-hidden transition-all hover:border-[#1f8feb] hover:shadow-md',
        selected ? 'border-[#1f8feb] ring-2 ring-[#1f8feb]/15' : 'border-[#d7dbe3]',
      )}
    >
      <div className={cn('h-11 px-4 flex items-center gap-2 text-[14px] font-bold', getNodeTone(node.type))}>
        <Icon size={16} strokeWidth={2.4} />
        <span className="truncate">{node.title}</span>
      </div>
      <div className="px-4 py-4 min-h-[70px] flex items-center justify-between gap-3">
        <p className="text-[15px] font-bold text-midnight-graphite leading-snug line-clamp-2">
          {node.subtitle || '点击设置'}
        </p>
        <span className="text-[22px] text-light-silver">›</span>
      </div>
    </button>
  );
}

function Connector({ showPlus = true }: { showPlus?: boolean }) {
  return (
    <div className="flex flex-col items-center h-16">
      <div className="w-px flex-1 bg-[#d8dde8]" />
      {showPlus && (
        <div className="w-8 h-8 rounded-full bg-white border border-[#d8dde8] text-[#1f8feb] flex items-center justify-center shadow-sm">
          <Plus size={18} strokeWidth={2.8} />
        </div>
      )}
      <div className="w-px flex-1 bg-[#d8dde8]" />
    </div>
  );
}

function FlowCanvas({
  draft,
  selection,
  onSelectNode,
  onSelectCondition,
  onAddCondition,
  onDeleteCondition,
}: {
  draft: WorkflowVersion;
  selection: Selection;
  onSelectNode: (nodeId: string) => void;
  onSelectCondition: (groupId: string, conditionId: string) => void;
  onAddCondition: (groupId: string) => void;
  onDeleteCondition: (groupId: string, conditionId: string) => void;
}) {
  return (
    <div className="min-h-[720px] overflow-auto bg-[#f4f6f9] border border-[#dde2ea] rounded-lg">
      <div className="min-w-[1180px] px-10 py-12 flex flex-col items-center">
        {draft.nodes.map((node, index) => (
          <React.Fragment key={node.id}>
            {isConditionNode(node) ? (
              <div className="w-full">
                <div className="flex items-center justify-center mb-5">
                  <button
                    type="button"
                    onClick={() => onAddCondition(node.id)}
                    className="h-9 px-4 rounded-full bg-white border border-[#d8dde8] text-[#1f8feb] text-[13px] font-bold shadow-sm flex items-center gap-2"
                  >
                    <Plus size={15} strokeWidth={2.8} />
                    添加条件
                  </button>
                </div>
                <div className="grid gap-8" style={{ gridTemplateColumns: `repeat(${node.conditions.length}, minmax(260px, 1fr))` }}>
                  {node.conditions.map((condition) => (
                    <div key={condition.id} className="flex flex-col items-center">
                      <button
                        type="button"
                        onClick={() => onSelectCondition(node.id, condition.id)}
                        className={cn(
                          'w-[300px] min-h-[120px] bg-white border rounded-md shadow-sm text-left px-5 py-4 hover:border-[#14b8a6] transition-all',
                          selection?.kind === 'condition' && selection.conditionId === condition.id
                            ? 'border-[#14b8a6] ring-2 ring-[#14b8a6]/15'
                            : 'border-[#d7dbe3]',
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[13px] font-black text-[#14a38f] truncate">{condition.title}</p>
                            <p className="text-[12px] font-semibold text-light-gray mt-1">优先级 {condition.priority}</p>
                          </div>
                          {node.conditions.length > 1 && (
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(event) => {
                                event.stopPropagation();
                                onDeleteCondition(node.id, condition.id);
                              }}
                              className="w-8 h-8 rounded-full bg-[#fff1f2] text-[#c62828] flex items-center justify-center"
                            >
                              <Trash2 size={15} strokeWidth={2.4} />
                            </span>
                          )}
                        </div>
                        <p className="mt-5 text-[15px] font-bold text-midnight-graphite leading-relaxed line-clamp-3">
                          {condition.expression}
                        </p>
                      </button>

                      <Connector />

                      <div className="flex flex-col items-center">
                        {condition.nodes.map((child, childIndex) => (
                          <React.Fragment key={child.id}>
                            <WorkflowNodeCard
                              node={child}
                              selected={selection?.kind === 'node' && selection.nodeId === child.id}
                              onSelect={() => onSelectNode(child.id)}
                            />
                            {childIndex < condition.nodes.length - 1 && <Connector />}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <WorkflowNodeCard
                node={node}
                selected={selection?.kind === 'node' && selection.nodeId === node.id}
                onSelect={() => onSelectNode(node.id)}
              />
            )}

            {index < draft.nodes.length - 1 && <Connector />}
          </React.Fragment>
        ))}

        <Connector showPlus={false} />
        <div className="h-11 px-8 rounded-full bg-[#eef1f5] text-light-gray text-[14px] font-bold flex items-center justify-center">
          流程结束
        </div>
      </div>
    </div>
  );
}

function NodeDrawer({
  selection,
  draft,
  directory,
  onClose,
  onUpdateNode,
  onUpdateCondition,
}: {
  selection: Selection;
  draft: WorkflowVersion;
  directory: OrganizationDirectory;
  onClose: () => void;
  onUpdateNode: (nodeId: string, patch: Partial<WorkflowNode>) => void;
  onUpdateCondition: (conditionId: string, patch: Partial<WorkflowCondition>) => void;
}) {
  const selectedNode = selection?.kind === 'node' ? findNode(draft.nodes, selection.nodeId) : null;
  const selectedCondition = selection?.kind === 'condition' ? findCondition(draft.nodes, selection.conditionId) : null;

  if (!selection || (!selectedNode && !selectedCondition)) return null;

  const updateRule = (node: WorkflowDraftNode, patch: Partial<ApproverRule>) => {
    const currentRule = node.rule || { type: 'specified' as ApproverRuleType };
    const nextRule: ApproverRule = {
      ...currentRule,
      ...patch,
    };

    if (nextRule.type === 'specified' && !nextRule.memberIds) nextRule.memberIds = [];
    if (nextRule.type === 'role' && !nextRule.roleGroupId) nextRule.roleGroupId = directory.roleGroups[0]?.id;
    if (nextRule.type === 'nth_supervisor' && !nextRule.supervisorLevel) nextRule.supervisorLevel = 2;
    if (nextRule.type === 'multi_supervisor' && !nextRule.supervisorDepth) nextRule.supervisorDepth = 4;

    onUpdateNode(node.id, {
      rule: nextRule,
      subtitle: formatRule(nextRule, directory),
    });
  };

  const toggleMember = (node: WorkflowDraftNode, memberId: string) => {
    const currentIds = new Set(node.rule?.memberIds || []);
    if (currentIds.has(memberId)) currentIds.delete(memberId);
    else currentIds.add(memberId);
    updateRule(node, { type: 'specified', memberIds: [...currentIds] });
  };

  return (
    <div className="fixed inset-y-0 right-0 z-[70] w-full max-w-[480px] bg-white border-l border-border-silver shadow-apple-xl flex flex-col">
      <div className="h-20 px-6 border-b border-border-silver flex items-center justify-between">
        <div>
          <h2 className="text-[22px] font-black tracking-tight">
            {selectedCondition ? '条件设置' : selectedNode?.type === 'cc' ? '抄送人' : selectedNode?.type === 'start' ? '发起人' : '审批人'}
          </h2>
          <p className="text-[12px] text-light-gray font-bold mt-1">节点配置会实时同步到画布</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-lightest-gray-background text-midnight-graphite flex items-center justify-center"
        >
          <X size={18} strokeWidth={2.5} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-7">
        {selectedCondition && (
          <>
            <label className="block">
              <span className="text-[13px] font-black text-midnight-graphite">条件名称</span>
              <input
                value={selectedCondition.title}
                onChange={(event) => onUpdateCondition(selectedCondition.id, { title: event.target.value })}
                className="mt-2 w-full h-12 px-4 bg-canvas-white border border-border-silver rounded-lg text-[15px] font-bold outline-none focus:border-[#1f8feb]"
              />
            </label>
            <label className="block">
              <span className="text-[13px] font-black text-midnight-graphite">条件表达式</span>
              <textarea
                value={selectedCondition.expression}
                onChange={(event) => onUpdateCondition(selectedCondition.id, { expression: event.target.value })}
                className="mt-2 w-full min-h-[130px] px-4 py-3 bg-canvas-white border border-border-silver rounded-lg text-[15px] font-bold outline-none focus:border-[#1f8feb]"
              />
            </label>
            <label className="block">
              <span className="text-[13px] font-black text-midnight-graphite">优先级</span>
              <input
                type="number"
                min={1}
                value={selectedCondition.priority}
                onChange={(event) => onUpdateCondition(selectedCondition.id, { priority: Number(event.target.value || 1) })}
                className="mt-2 w-full h-12 px-4 bg-canvas-white border border-border-silver rounded-lg text-[15px] font-bold outline-none focus:border-[#1f8feb]"
              />
            </label>
          </>
        )}

        {selectedNode && (
          <>
            <label className="block">
              <span className="text-[13px] font-black text-midnight-graphite">节点名称</span>
              <input
                value={selectedNode.title}
                onChange={(event) => onUpdateNode(selectedNode.id, { title: event.target.value })}
                disabled={selectedNode.type === 'start'}
                className="mt-2 w-full h-12 px-4 bg-canvas-white border border-border-silver rounded-lg text-[15px] font-bold outline-none focus:border-[#1f8feb] disabled:opacity-60"
              />
            </label>

            {selectedNode.type === 'start' ? (
              <div className="bg-[#f5f8ff] border border-[#c9dcff] rounded-lg p-4">
                <p className="text-[14px] font-bold text-midnight-graphite">发起人由提交单据的人自动确定。</p>
                <p className="text-[12px] font-semibold text-light-gray mt-2">后续主管链、部门负责人等规则都会从这个人往上计算。</p>
              </div>
            ) : (
              <>
                <section>
                  <h3 className="text-[15px] font-black text-midnight-graphite mb-3">审批类型</h3>
                  <div className="grid grid-cols-1 gap-2">
                    {approverRuleOptions.map((option) => (
                      <button
                        key={option.type}
                        type="button"
                        onClick={() => updateRule(selectedNode, { type: option.type })}
                        className={cn(
                          'min-h-[62px] px-4 py-3 border rounded-lg text-left transition-all',
                          selectedNode.rule?.type === option.type
                            ? 'border-[#1f8feb] bg-[#eef6ff]'
                            : 'border-border-silver bg-white hover:bg-canvas-white',
                        )}
                      >
                        <p className="text-[14px] font-black text-midnight-graphite">{option.label}</p>
                        <p className="text-[12px] font-semibold text-light-gray mt-1">{option.hint}</p>
                      </button>
                    ))}
                  </div>
                </section>

                {selectedNode.rule?.type === 'specified' && (
                  <section>
                    <h3 className="text-[15px] font-black text-midnight-graphite mb-3">选择成员</h3>
                    <div className="max-h-[300px] overflow-y-auto border border-border-silver rounded-lg divide-y divide-border-silver">
                      {directory.members.map((member) => (
                        <label key={member.id} className="min-h-[54px] px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-canvas-white">
                          <input
                            type="checkbox"
                            checked={(selectedNode.rule?.memberIds || []).includes(member.id)}
                            onChange={() => toggleMember(selectedNode, member.id)}
                            className="accent-[#1f8feb]"
                          />
                          <span className="min-w-0">
                            <span className="block text-[14px] font-bold text-midnight-graphite">{member.name}</span>
                            <span className="block text-[12px] font-semibold text-light-gray truncate">{member.title}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </section>
                )}

                {selectedNode.rule?.type === 'role' && (
                  <label className="block">
                    <span className="text-[13px] font-black text-midnight-graphite">角色/岗位</span>
                    <select
                      value={selectedNode.rule.roleGroupId || ''}
                      onChange={(event) => updateRule(selectedNode, { type: 'role', roleGroupId: event.target.value })}
                      className="mt-2 w-full h-12 px-4 bg-canvas-white border border-border-silver rounded-lg text-[15px] font-bold outline-none focus:border-[#1f8feb]"
                    >
                      {directory.roleGroups.map((role) => (
                        <option key={role.id} value={role.id}>{role.name}</option>
                      ))}
                    </select>
                  </label>
                )}

                {selectedNode.rule?.type === 'nth_supervisor' && (
                  <label className="block">
                    <span className="text-[13px] font-black text-midnight-graphite">主管层级</span>
                    <select
                      value={selectedNode.rule.supervisorLevel || 2}
                      onChange={(event) => updateRule(selectedNode, { type: 'nth_supervisor', supervisorLevel: Number(event.target.value) })}
                      className="mt-2 w-full h-12 px-4 bg-canvas-white border border-border-silver rounded-lg text-[15px] font-bold outline-none focus:border-[#1f8feb]"
                    >
                      {[2, 3, 4, 5, 6, 7, 8].map((level) => (
                        <option key={level} value={level}>第{level}级主管</option>
                      ))}
                    </select>
                  </label>
                )}

                {selectedNode.rule?.type === 'multi_supervisor' && (
                  <label className="block">
                    <span className="text-[13px] font-black text-midnight-graphite">连续审批到</span>
                    <select
                      value={selectedNode.rule.supervisorDepth || 4}
                      onChange={(event) => updateRule(selectedNode, { type: 'multi_supervisor', supervisorDepth: Number(event.target.value) })}
                      className="mt-2 w-full h-12 px-4 bg-canvas-white border border-border-silver rounded-lg text-[15px] font-bold outline-none focus:border-[#1f8feb]"
                    >
                      {[2, 3, 4, 5, 6, 7, 8].map((level) => (
                        <option key={level} value={level}>第{level}级主管</option>
                      ))}
                    </select>
                  </label>
                )}

                <section>
                  <h3 className="text-[15px] font-black text-midnight-graphite mb-3">审批人为空时</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: 'auto_pass', label: '自动通过' },
                      { value: 'block_submit', label: '不允许提交' },
                    ].map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => updateRule(selectedNode, { emptyApproverAction: item.value as ApproverRule['emptyApproverAction'] })}
                        className={cn(
                          'h-11 rounded-lg border text-[13px] font-bold',
                          (selectedNode.rule?.emptyApproverAction || 'auto_pass') === item.value
                            ? 'border-[#1f8feb] bg-[#eef6ff] text-[#0066cc]'
                            : 'border-border-silver bg-white text-medium-gray',
                        )}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </section>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function WorkflowDesigner() {
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [directory, setDirectory] = useState<OrganizationDirectory>(emptyOrganization);
  const [draft, setDraft] = useState<WorkflowVersion | null>(null);
  const [activeStep, setActiveStep] = useState<WorkflowStepKey>('flow');
  const [selection, setSelection] = useState<Selection>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [isSavingOrg, setIsSavingOrg] = useState(false);
  const [isPublishedPreview, setIsPublishedPreview] = useState(false);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) || templates[0],
    [selectedTemplateId, templates],
  );

  const loadData = async () => {
    setIsLoading(true);
    setError('');

    try {
      const [nextTemplates, nextDirectory] = await Promise.all([
        storage.getWorkflowTemplates(),
        storage.getOrganizationDirectory(),
      ]);
      setTemplates(nextTemplates);
      setDirectory(nextDirectory);
      const firstTemplate = nextTemplates[0];
      setSelectedTemplateId(firstTemplate?.id || '');
      setDraft(firstTemplate ? clone(firstTemplate.draft) : null);
      setIsPublishedPreview(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '审批流配置加载失败');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const selectTemplate = (template: WorkflowTemplate) => {
    setSelectedTemplateId(template.id);
    setDraft(clone(template.draft));
    setSelection(null);
    setIsPublishedPreview(false);
    setNotice('');
    setError('');
  };

  const mutateDraft = (updater: (current: WorkflowVersion) => WorkflowVersion) => {
    if (isPublishedPreview) return;
    setDraft((current) => (current ? updater(clone(current)) : current));
  };

  const updateNode = (nodeId: string, patch: Partial<WorkflowNode>) => {
    mutateDraft((current) => ({
      ...current,
      nodes: updateNodeInTree(current.nodes, nodeId, (node) => ({ ...node, ...patch })),
    }));
  };

  const updateCondition = (conditionId: string, patch: Partial<WorkflowCondition>) => {
    mutateDraft((current) => ({
      ...current,
      nodes: updateConditionInTree(current.nodes, conditionId, (condition) => ({ ...condition, ...patch })),
    }));
  };

  const addCondition = (groupId: string) => {
    mutateDraft((current) => ({
      ...current,
      nodes: current.nodes.map((node) => {
        if (!isConditionNode(node) || node.id !== groupId) return node;
        const source = node.conditions[0];
        return {
          ...node,
          conditions: [
            ...node.conditions,
            createBranchFrom(source, node.conditions.length + 1),
          ],
        };
      }),
    }));
  };

  const deleteCondition = (groupId: string, conditionId: string) => {
    mutateDraft((current) => ({
      ...current,
      nodes: current.nodes.map((node) => {
        if (!isConditionNode(node) || node.id !== groupId || node.conditions.length <= 1) return node;
        return {
          ...node,
          conditions: node.conditions
            .filter((condition) => condition.id !== conditionId)
            .map((condition, index) => ({ ...condition, priority: index + 1 })),
        };
      }),
    }));
    if (selection?.kind === 'condition' && selection.conditionId === conditionId) setSelection(null);
  };

  const addFormField = () => {
    mutateDraft((current) => ({
      ...current,
      formFields: [
        ...current.formFields,
        {
          id: `field-${Date.now()}`,
          label: '新字段',
          type: 'text',
          required: false,
        },
      ],
    }));
  };

  const updateFormField = (id: string, patch: Partial<WorkflowFormField>) => {
    mutateDraft((current) => ({
      ...current,
      formFields: current.formFields.map((field) => (
        field.id === id ? { ...field, ...patch } : field
      )),
    }));
  };

  const deleteFormField = (id: string) => {
    mutateDraft((current) => ({
      ...current,
      formFields: current.formFields.filter((field) => field.id !== id),
    }));
  };

  const saveDraft = async () => {
    if (!selectedTemplate || !draft) return null;
    setIsSaving(true);
    setError('');
    setNotice('');

    try {
      const saved = await storage.saveWorkflowDraft(selectedTemplate.id, draft);
      setTemplates((current) => current.map((template) => (
        template.id === saved.id ? saved : template
      )));
      setDraft(clone(saved.draft));
      setIsPublishedPreview(false);
      setNotice('草稿已保存');
      return saved;
    } catch (err) {
      setError(err instanceof Error ? err.message : '草稿保存失败');
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const publishWorkflow = async () => {
    if (!selectedTemplate || !draft) return;
    setIsPublishing(true);
    setError('');
    setNotice('');

    try {
      const saved = await storage.saveWorkflowDraft(selectedTemplate.id, draft);
      const published = await storage.publishWorkflow(saved.id);
      setTemplates((current) => current.map((template) => (
        template.id === published.id ? published : template
      )));
      setDraft(clone(published.draft));
      setIsPublishedPreview(false);
      setNotice(`流程已发布为 V${published.currentVersion}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '流程发布失败');
    } finally {
      setIsPublishing(false);
    }
  };

  const saveOrganization = async () => {
    setIsSavingOrg(true);
    setError('');
    setNotice('');

    try {
      const saved = await storage.saveOrganizationDirectory(directory);
      setDirectory(saved);
      setNotice('组织架构已保存');
    } catch (err) {
      setError(err instanceof Error ? err.message : '组织架构保存失败');
    } finally {
      setIsSavingOrg(false);
    }
  };

  const updateMember = (memberId: string, patch: Partial<OrganizationDirectory['members'][number]>) => {
    setDirectory((current) => ({
      ...current,
      members: current.members.map((member) => (
        member.id === memberId ? { ...member, ...patch } : member
      )),
    }));
  };

  const previewPublishedVersion = () => {
    if (!selectedTemplate?.publishedVersion) return;
    setDraft(clone(selectedTemplate.publishedVersion));
    setActiveStep('flow');
    setSelection(null);
    setIsPublishedPreview(true);
    setNotice(`正在预览已发布版本 V${selectedTemplate.publishedVersion.version}`);
    setError('');
  };

  const returnToDraft = () => {
    if (!selectedTemplate) return;
    setDraft(clone(selectedTemplate.draft));
    setSelection(null);
    setIsPublishedPreview(false);
    setNotice('已回到草稿编辑');
    setError('');
  };

  if (isLoading) {
    return (
      <div className="min-h-[520px] bg-white border border-border-silver rounded-lg flex items-center justify-center">
        <p className="text-[15px] font-bold text-light-gray">正在加载审批流配置...</p>
      </div>
    );
  }

  if (!draft || !selectedTemplate) {
    return (
      <div className="min-h-[520px] bg-white border border-border-silver rounded-lg flex items-center justify-center">
        <p className="text-[15px] font-bold text-light-gray">暂无审批流模板</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-40 animate-in fade-in duration-700">
      <div className="bg-white border border-border-silver rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-border-silver flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[12px] font-bold text-light-gray">
              <span>超管</span>
              <span>/</span>
              <span>审批流配置</span>
              <span className={cn(
                'ml-2 px-2 py-0.5 rounded-full text-[11px]',
                selectedTemplate.status === 'published' ? 'bg-[#e8f5e9] text-[#2e7d32]' : 'bg-[#fff7e6] text-[#9a5b00]',
              )}>
                {selectedTemplate.status === 'published' ? `已发布 V${selectedTemplate.currentVersion}` : '草稿'}
              </span>
            </div>
            <h1 className="text-[26px] font-black tracking-tight text-midnight-graphite mt-2">
              {draft.basic.name}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void saveDraft()}
              disabled={isSaving || isPublishing || isPublishedPreview}
              className="h-11 px-5 rounded-lg border border-border-silver bg-white text-midnight-graphite text-[14px] font-bold hover:bg-canvas-white disabled:opacity-50 flex items-center gap-2"
            >
              <Save size={16} strokeWidth={2.5} />
              {isSaving ? '保存中' : '保存草稿'}
            </button>
            <button
              type="button"
              onClick={() => void publishWorkflow()}
              disabled={isSaving || isPublishing || isPublishedPreview}
              className="h-11 px-5 rounded-lg bg-[#1f8feb] text-white text-[14px] font-bold hover:bg-[#0f7bd6] disabled:opacity-50 flex items-center gap-2"
            >
              <Rocket size={16} strokeWidth={2.5} />
              {isPublishing ? '发布中' : '发布'}
            </button>
            {selectedTemplate.publishedVersion && (
              <button
                type="button"
                onClick={isPublishedPreview ? returnToDraft : previewPublishedVersion}
                className="h-11 px-5 rounded-lg border border-[#1f8feb] bg-white text-[#0066cc] text-[14px] font-bold hover:bg-[#eef6ff] flex items-center gap-2"
              >
                <CheckCircle2 size={16} strokeWidth={2.5} />
                {isPublishedPreview ? '回到草稿' : '预览已发布'}
              </button>
            )}
          </div>
        </div>

        {(error || notice) && (
          <div className={cn(
            'px-5 py-3 text-[13px] font-bold',
            error ? 'bg-[#ffebee] text-[#c62828]' : 'bg-[#e8f5e9] text-[#2e7d32]',
          )}>
            {error || notice}
          </div>
        )}

        {isPublishedPreview && (
          <div className="px-5 py-3 bg-[#eef6ff] text-[#0066cc] text-[13px] font-bold border-b border-[#c9dcff]">
            当前为已发布版本只读预览，回到草稿后才能继续编辑。
          </div>
        )}

        <div className="px-5 py-4 flex flex-col lg:flex-row gap-4 lg:items-center justify-between">
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {templates.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => selectTemplate(template)}
                className={cn(
                  'h-10 px-4 rounded-lg border text-[13px] font-bold whitespace-nowrap',
                  selectedTemplate.id === template.id
                    ? 'border-[#1f8feb] bg-[#eef6ff] text-[#0066cc]'
                    : 'border-border-silver bg-white text-medium-gray hover:bg-canvas-white',
                )}
              >
                {template.name}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {workflowSteps.map((step, index) => {
              const Icon = step.icon;
              const isActive = activeStep === step.key;
              return (
                <button
                  key={step.key}
                  type="button"
                  onClick={() => {
                    setActiveStep(step.key);
                    setSelection(null);
                  }}
                  className={cn(
                    'h-11 px-4 rounded-lg border text-[13px] font-black flex items-center justify-center gap-2 transition-all',
                    isActive
                      ? 'border-[#1f8feb] bg-[#eef6ff] text-[#0066cc]'
                      : 'border-border-silver bg-white text-midnight-graphite hover:bg-canvas-white',
                  )}
                >
                  <span className={cn(
                    'w-5 h-5 rounded-full flex items-center justify-center text-[11px]',
                    isActive ? 'bg-[#1f8feb] text-white' : 'bg-lightest-gray-background text-medium-gray',
                  )}>
                    {index + 1}
                  </span>
                  <Icon size={15} strokeWidth={2.5} />
                  {step.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {activeStep === 'basic' && (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5">
          <section className="bg-white border border-border-silver rounded-lg p-5 space-y-5">
            <h2 className="text-[20px] font-black tracking-tight">基础设置</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                ['模板名称', 'name'],
                ['业务模块', 'moduleName'],
                ['审批类型', 'approvalTypeName'],
                ['可见范围', 'visibleRange'],
              ].map(([label, key]) => (
                <label key={key} className="block">
                  <span className="text-[13px] font-black text-midnight-graphite">{label}</span>
                  <input
                    value={draft.basic[key as keyof WorkflowVersion['basic']]}
                    onChange={(event) => mutateDraft((current) => ({
                      ...current,
                      basic: { ...current.basic, [key]: event.target.value },
                    }))}
                    className="mt-2 w-full h-12 px-4 bg-canvas-white border border-border-silver rounded-lg text-[15px] font-bold outline-none focus:border-[#1f8feb]"
                  />
                </label>
              ))}
            </div>
          </section>

          <section className="bg-white border border-border-silver rounded-lg p-5">
            <h2 className="text-[20px] font-black tracking-tight">组织架构快照</h2>
            <div className="grid grid-cols-3 gap-3 mt-5">
              {[
                ['部门', directory.departments.length, Building2],
                ['成员', directory.members.length, Users],
                ['角色', directory.roleGroups.length, Layers],
              ].map(([label, value, Icon]) => (
                <div key={String(label)} className="bg-canvas-white rounded-lg p-4">
                  <Icon size={18} strokeWidth={2.4} className="text-medium-gray" />
                  <p className="text-[24px] font-black mt-3">{String(value)}</p>
                  <p className="text-[12px] font-bold text-light-gray">{String(label)}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {activeStep === 'form' && (
        <section className="bg-white border border-border-silver rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-border-silver flex items-center justify-between">
            <div>
              <h2 className="text-[20px] font-black tracking-tight">表单字段</h2>
              <p className="text-[12px] font-semibold text-light-gray mt-1">字段用于条件分支和发起审批</p>
            </div>
            <button
              type="button"
              onClick={addFormField}
              className="h-10 px-4 rounded-lg bg-black text-white text-[13px] font-bold flex items-center gap-2"
            >
              <Plus size={15} strokeWidth={2.8} />
              新增字段
            </button>
          </div>
          <div className="divide-y divide-border-silver">
            {draft.formFields.map((field) => (
              <div key={field.id} className="px-5 py-4 grid grid-cols-1 md:grid-cols-[1fr_160px_120px_44px] gap-3 items-center">
                <input
                  value={field.label}
                  onChange={(event) => updateFormField(field.id, { label: event.target.value })}
                  className="h-11 px-3 bg-canvas-white border border-border-silver rounded-lg text-[14px] font-bold outline-none focus:border-[#1f8feb]"
                />
                <select
                  value={field.type}
                  onChange={(event) => updateFormField(field.id, { type: event.target.value as WorkflowFormField['type'] })}
                  className="h-11 px-3 bg-canvas-white border border-border-silver rounded-lg text-[14px] font-bold outline-none focus:border-[#1f8feb]"
                >
                  {(['text', 'number', 'money', 'date', 'select', 'attachment'] as WorkflowFormField['type'][]).map((type) => (
                    <option key={type} value={type}>
                      <FieldTypeLabel type={type} />
                    </option>
                  ))}
                </select>
                <label className="h-11 px-3 bg-canvas-white border border-border-silver rounded-lg text-[13px] font-bold flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={(event) => updateFormField(field.id, { required: event.target.checked })}
                    className="accent-[#1f8feb]"
                  />
                  必填
                </label>
                <button
                  type="button"
                  onClick={() => deleteFormField(field.id)}
                  className="w-11 h-11 rounded-lg bg-[#fff1f2] text-[#c62828] flex items-center justify-center"
                >
                  <Trash2 size={16} strokeWidth={2.4} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeStep === 'flow' && (
        <FlowCanvas
          draft={draft}
          selection={selection}
          onSelectNode={(nodeId) => setSelection({ kind: 'node', nodeId })}
          onSelectCondition={(groupId, conditionId) => setSelection({ kind: 'condition', groupId, conditionId })}
          onAddCondition={addCondition}
          onDeleteCondition={deleteCondition}
        />
      )}

      {activeStep === 'advanced' && (
        <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-5">
          <section className="bg-white border border-border-silver rounded-lg p-5 space-y-4">
            <h2 className="text-[20px] font-black tracking-tight">高级设置</h2>
            {[
              ['allowWithdraw', '允许发起人撤回'],
              ['allowTransfer', '允许审批人转交'],
              ['enablePrint', '允许打印审批单'],
              ['autoArchive', '发布后自动归档'],
            ].map(([key, label]) => (
              <label key={key} className="h-12 px-4 bg-canvas-white border border-border-silver rounded-lg flex items-center justify-between gap-4">
                <span className="text-[14px] font-bold text-midnight-graphite">{label}</span>
                <input
                  type="checkbox"
                  checked={draft.advanced[key as keyof WorkflowVersion['advanced']]}
                  onChange={(event) => mutateDraft((current) => ({
                    ...current,
                    advanced: { ...current.advanced, [key]: event.target.checked },
                  }))}
                  className="accent-[#1f8feb]"
                />
              </label>
            ))}
          </section>

          <section className="bg-white border border-border-silver rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-border-silver flex items-center justify-between">
              <div>
                <h2 className="text-[20px] font-black tracking-tight">组织架构维护</h2>
                <p className="text-[12px] font-semibold text-light-gray mt-1">主管链规则会读取这里的直属主管关系</p>
              </div>
              <button
                type="button"
                onClick={() => void saveOrganization()}
                disabled={isSavingOrg}
                className="h-10 px-4 rounded-lg bg-black text-white text-[13px] font-bold flex items-center gap-2 disabled:opacity-50"
              >
                <Save size={15} strokeWidth={2.5} />
                {isSavingOrg ? '保存中' : '保存组织架构'}
              </button>
            </div>
            <div className="max-h-[560px] overflow-auto divide-y divide-border-silver">
              {directory.members.map((member) => (
                <div key={member.id} className="px-5 py-4 grid grid-cols-1 md:grid-cols-[130px_1fr_190px_120px] gap-3 items-center">
                  <div>
                    <p className="text-[14px] font-black text-midnight-graphite">{member.name}</p>
                    <p className="text-[12px] font-semibold text-light-gray">{directory.departments.find((department) => department.id === member.departmentId)?.name || '未分部门'}</p>
                  </div>
                  <input
                    value={member.title}
                    onChange={(event) => updateMember(member.id, { title: event.target.value })}
                    className="h-11 px-3 bg-canvas-white border border-border-silver rounded-lg text-[14px] font-bold outline-none focus:border-[#1f8feb]"
                  />
                  <select
                    value={member.supervisorId || ''}
                    onChange={(event) => updateMember(member.id, { supervisorId: event.target.value || undefined })}
                    className="h-11 px-3 bg-canvas-white border border-border-silver rounded-lg text-[14px] font-bold outline-none focus:border-[#1f8feb]"
                  >
                    <option value="">无直属主管</option>
                    {directory.members
                      .filter((option) => option.id !== member.id)
                      .map((option) => (
                        <option key={option.id} value={option.id}>{option.name}</option>
                      ))}
                  </select>
                  <label className="h-11 px-3 bg-canvas-white border border-border-silver rounded-lg text-[13px] font-bold flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={member.enabled}
                      onChange={(event) => updateMember(member.id, { enabled: event.target.checked })}
                      className="accent-[#1f8feb]"
                    />
                    启用
                  </label>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      <NodeDrawer
        selection={selection}
        draft={draft}
        directory={directory}
        onClose={() => setSelection(null)}
        onUpdateNode={updateNode}
        onUpdateCondition={updateCondition}
      />
    </div>
  );
}
