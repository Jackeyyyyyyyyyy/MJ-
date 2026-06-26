import React from 'react';
import { BarChart3, RefreshCw } from 'lucide-react';
import { storage } from '../storage';
import { WorkflowTemplate } from '../types';
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

function sortTemplates(templates: WorkflowTemplate[]) {
  return [...templates].sort((left, right) => {
    const statusDiff = statusOrder[left.status] - statusOrder[right.status];
    if (statusDiff !== 0) return statusDiff;
    return getTemplateLabel(left).localeCompare(getTemplateLabel(right), 'zh-Hans-CN');
  });
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
            <label className="flex min-w-0 items-center gap-2">
              <span className="shrink-0 text-[13px] font-black text-medium-gray">审批流</span>
              <select
                value={selectedTemplateId}
                onChange={(event) => setSelectedTemplateId(event.target.value)}
                disabled={isLoading || sortedTemplates.length === 0}
                className="h-10 min-w-[280px] max-w-full rounded-lg border border-border-silver bg-lightest-gray-background px-3 text-[13px] font-bold text-midnight-graphite outline-none transition focus:border-interactive-blue focus:bg-white"
              >
                {sortedTemplates.length === 0 ? (
                  <option value="">暂无审批流</option>
                ) : sortedTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {getTemplateLabel(template)}
                  </option>
                ))}
              </select>
            </label>

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
