import React from 'react';
import { BarChart3, CheckCircle2, ChevronDown, RefreshCw, Search } from 'lucide-react';
import { storage } from '../storage';
import { WorkflowNode, WorkflowTemplate } from '../types';
import WorkflowEfficiencyOverview from './WorkflowEfficiencyOverview';
import { cn } from '../lib/utils';

const statusLabels: Record<WorkflowTemplate['status'], string> = {
  draft: '草稿',
  published: '已发布',
  disabled: '已停用',
};

const statusOrder: Record<WorkflowTemplate['status'], number> = {
  published: 0,
  draft: 1,
  disabled: 2,
};

function getWorkflowTitle(moduleName?: string, approvalTypeName?: string) {
  return approvalTypeName || moduleName || '未设置业务';
}

function getTemplateLabel(template: WorkflowTemplate) {
  const moduleName = template.moduleName || template.draft?.basic?.moduleName || template.publishedVersion?.basic?.moduleName;
  const approvalTypeName = template.approvalTypeName || template.draft?.basic?.approvalTypeName || template.publishedVersion?.basic?.approvalTypeName;
  const title = moduleName
    ? `${moduleName} / ${getWorkflowTitle(moduleName, approvalTypeName)}`
    : getWorkflowTitle(moduleName, approvalTypeName);

  return `${title} · ${statusLabels[template.status]} · v${template.currentVersion || 1}`;
}

function collectWorkflowNodeSearchText(nodes: WorkflowNode[] | undefined): string {
  const tokens: string[] = [];

  const visit = (items: WorkflowNode[] | undefined) => {
    (items || []).forEach((node) => {
      tokens.push(node.id, node.type, node.title, node.subtitle || '');
      if (node.rule?.positionTitles?.length) tokens.push(...node.rule.positionTitles);
      (node.conditions || []).forEach((condition) => {
        tokens.push(condition.id, condition.title, condition.expression, condition.aiDescription || '');
        (condition.workflowConditions || []).forEach((workflowCondition) => {
          tokens.push(
            workflowCondition.id,
            workflowCondition.field,
            workflowCondition.operator,
            workflowCondition.value || '',
            workflowCondition.currencyValue || '',
            workflowCondition.expression || '',
          );
        });
        visit(condition.nodes);
      });
    });
  };

  visit(nodes);
  return tokens.filter(Boolean).join(' ');
}

function sortTemplates(templates: WorkflowTemplate[]) {
  return [...templates].sort((left, right) => {
    const statusDiff = statusOrder[left.status] - statusOrder[right.status];
    if (statusDiff !== 0) return statusDiff;
    return getTemplateLabel(left).localeCompare(getTemplateLabel(right), 'zh-Hans-CN');
  });
}

function WorkflowTemplateSearchSelect({
  templates,
  selectedId,
  disabled,
  onSelect,
}: {
  templates: WorkflowTemplate[];
  selectedId: string;
  disabled: boolean;
  onSelect: (templateId: string) => void;
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [keyword, setKeyword] = React.useState('');
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const selectedTemplate = React.useMemo(
    () => templates.find((template) => template.id === selectedId) || null,
    [templates, selectedId],
  );
  const normalizedKeyword = keyword.trim().toLowerCase();
  const templateOptions = React.useMemo(() => templates.map((template) => {
    const label = getTemplateLabel(template);
    return {
      template,
      label,
      searchText: [
        label,
        template.name,
        template.moduleName,
        template.approvalTypeName,
        template.draft?.basic?.name,
        template.draft?.basic?.moduleName,
        template.draft?.basic?.approvalTypeName,
        template.draft?.processorRule?.taskName,
        template.publishedVersion?.basic?.name,
        template.publishedVersion?.basic?.moduleName,
        template.publishedVersion?.basic?.approvalTypeName,
        template.publishedVersion?.processorRule?.taskName,
        collectWorkflowNodeSearchText(template.draft?.nodes),
        collectWorkflowNodeSearchText(template.publishedVersion?.nodes),
      ].filter(Boolean).join(' ').toLowerCase(),
    };
  }), [templates]);
  const filteredOptions = React.useMemo(() => {
    if (!normalizedKeyword) return templateOptions;
    return templateOptions.filter((option) => option.searchText.includes(normalizedKeyword));
  }, [normalizedKeyword, templateOptions]);

  React.useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen]);

  React.useEffect(() => {
    if (disabled) setIsOpen(false);
  }, [disabled]);

  const handleSelect = (templateId: string) => {
    onSelect(templateId);
    setIsOpen(false);
    setKeyword('');
  };

  return (
    <div ref={rootRef} className="relative min-w-0 sm:min-w-[420px]">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={cn(
          "flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-border-silver bg-lightest-gray-background px-3 text-left text-[13px] font-bold text-midnight-graphite outline-none transition focus:border-interactive-blue focus:bg-white",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        <span className="min-w-0 truncate">
          {selectedTemplate ? getTemplateLabel(selectedTemplate) : '暂无审批流'}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn("shrink-0 transition-transform", isOpen && "rotate-180")}
          size={15}
          strokeWidth={2.6}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-12 z-50 w-[min(520px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border-silver bg-white shadow-xl shadow-black/10">
          <div className="border-b border-border-silver p-3">
            <label className="relative block">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-light-silver"
                size={15}
                strokeWidth={2.5}
              />
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setIsOpen(false);
                }}
                placeholder="搜索审批流"
                className="input-field h-10 py-2 pl-9 pr-3 text-[13px]"
                autoFocus
              />
            </label>
          </div>

          <div className="max-h-[360px] overflow-y-auto p-1.5" role="listbox">
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-8 text-center text-[13px] font-bold text-medium-gray">
                未找到匹配的审批流
              </div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.template.id}
                  type="button"
                  onClick={() => handleSelect(option.template.id)}
                  role="option"
                  aria-selected={option.template.id === selectedId}
                  className={cn(
                    "flex h-10 w-full items-center justify-between gap-3 rounded-xl px-3 text-left text-[13px] font-black text-midnight-graphite transition hover:bg-lightest-gray-background",
                    option.template.id === selectedId && "bg-[#e7f1ff] text-interactive-blue",
                  )}
                >
                  <span className="min-w-0 truncate">{option.label}</span>
                  {option.template.id === selectedId && <CheckCircle2 size={15} strokeWidth={3} className="shrink-0" />}
                </button>
              ))
            )}
          </div>

          {templates.length > 0 && (
            <div className="border-t border-border-silver px-4 py-2 text-[11px] font-bold text-light-gray">
              {normalizedKeyword ? `找到 ${filteredOptions.length} 项` : `共 ${templates.length} 项`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function WorkflowStatsAdmin() {
  const [templates, setTemplates] = React.useState<WorkflowTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const loadTemplates = React.useCallback(() => {
    setIsLoading(true);
    setError('');
    storage.getWorkflowTemplates()
      .then((nextTemplates) => {
        setTemplates(nextTemplates);
      })
      .catch((requestError) => {
        setTemplates([]);
        setError(requestError instanceof Error ? requestError.message : '统计数据读取失败');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  React.useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const sortedTemplates = React.useMemo(() => sortTemplates(templates), [templates]);

  React.useEffect(() => {
    if (sortedTemplates.length === 0) {
      setSelectedTemplateId('');
      return;
    }

    if (!selectedTemplateId || !sortedTemplates.some((template) => template.id === selectedTemplateId)) {
      setSelectedTemplateId(sortedTemplates[0].id);
    }
  }, [selectedTemplateId, sortedTemplates]);

  const selectedTemplate = sortedTemplates.find((template) => template.id === selectedTemplateId) || null;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border-silver bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-black text-white">
              <BarChart3 size={20} strokeWidth={2.6} />
            </span>
            <div>
              <p className="text-[12px] font-black uppercase tracking-[0.18em] text-medium-gray">审批效率</p>
              <h1 className="text-[26px] font-black tracking-tight text-midnight-graphite">统计</h1>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex min-w-0 items-center gap-2">
              <span className="shrink-0 text-[13px] font-black text-medium-gray">审批流</span>
              <WorkflowTemplateSearchSelect
                templates={sortedTemplates}
                selectedId={selectedTemplateId}
                disabled={isLoading || sortedTemplates.length === 0}
                onSelect={setSelectedTemplateId}
              />
            </div>

            <button
              type="button"
              onClick={loadTemplates}
              disabled={isLoading}
              className={cn(
                "inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border-silver px-4 text-[13px] font-black text-midnight-graphite transition hover:bg-lightest-gray-background",
                isLoading && "cursor-not-allowed opacity-60",
              )}
            >
              <RefreshCw className={cn(isLoading && "animate-spin")} size={15} strokeWidth={2.6} />
              刷新
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-[#ffd6d6] bg-[#fff6f6] px-4 py-3 text-[13px] font-bold text-[#b42318]">
          {error}
        </div>
      )}

      {selectedTemplate ? (
        <WorkflowEfficiencyOverview template={selectedTemplate} />
      ) : (
        <div className="flex min-h-[280px] items-center justify-center rounded-xl border border-dashed border-border-silver bg-white text-[13px] font-bold text-medium-gray">
          {isLoading ? '正在读取审批流...' : '暂无可统计审批流'}
        </div>
      )}
    </div>
  );
}
