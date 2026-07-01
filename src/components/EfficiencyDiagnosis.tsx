import React from 'react';
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Lightbulb,
  Minus,
  TrendingDown,
  TrendingUp,
  UserRound,
} from 'lucide-react';
import { auth } from '../auth';
import { storage } from '../storage';
import {
  PersonalEfficiencyMetric,
  PersonalEfficiencyRanking,
  PersonalEfficiencySummary,
  WorkflowEfficiencyMetric,
  WorkflowEfficiencyMetricKey,
  WorkflowEfficiencyPoint,
  WorkflowEfficiencyRange,
  WorkflowEfficiencyScope,
  WorkflowEfficiencySummary,
  WorkflowTemplate,
} from '../types';
import { cn } from '../lib/utils';

type EfficiencyMetricLike = Pick<
  WorkflowEfficiencyMetric | PersonalEfficiencyMetric,
  'label' | 'value' | 'unit' | 'precision' | 'previousValue' | 'changePercent' | 'hasData' | 'previousHasData'
>;

const rangeOptions: Array<{ value: WorkflowEfficiencyRange; label: string; days: number }> = [
  { value: '7d', label: '近7天', days: 7 },
  { value: '30d', label: '近30天', days: 30 },
  { value: '90d', label: '近90天', days: 90 },
];

const metricOrder: WorkflowEfficiencyMetricKey[] = ['flowAvg', 'nodeAvg', 'volume', 'users'];

function getTemplateName(template: WorkflowTemplate) {
  const moduleName = template.moduleName || template.draft?.basic?.moduleName || template.publishedVersion?.basic?.moduleName;
  const approvalTypeName = template.approvalTypeName || template.draft?.basic?.approvalTypeName || template.publishedVersion?.basic?.approvalTypeName;
  return moduleName ? `${moduleName} / ${approvalTypeName || moduleName}` : approvalTypeName || template.name || '审批流';
}

function sortTemplates(templates: WorkflowTemplate[]) {
  return [...templates].sort((left, right) => {
    const statusDelta = Number(right.status === 'published') - Number(left.status === 'published');
    if (statusDelta !== 0) return statusDelta;
    return getTemplateName(left).localeCompare(getTemplateName(right), 'zh-Hans-CN');
  });
}

function formatMetricValue(metric?: EfficiencyMetricLike | null, value = metric?.value) {
  if (!metric || !metric.hasData || value === undefined) return '暂无';
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: metric.precision,
    maximumFractionDigits: metric.precision,
  });
}

function formatPlainValue(value: number, precision = 1) {
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });
}

function isTimeMetric(metric?: Pick<WorkflowEfficiencyMetric, 'key'> | null) {
  return metric?.key === 'flowAvg' || metric?.key === 'nodeAvg';
}

function getMetricUnit(metric?: EfficiencyMetricLike | null) {
  if (!metric?.unit || !metric.hasData) return '';
  return metric.unit;
}

function formatPercent(value?: number) {
  const percent = Math.abs(value || 0);
  if (percent === 0) return '持平';
  return `${percent.toLocaleString('zh-CN', { maximumFractionDigits: 1 })}%`;
}

function getMetricChangeText(metric?: EfficiencyMetricLike | null) {
  if (!metric || !metric.hasData || !metric.previousHasData) return '同比 暂无';
  if (metric.changePercent === 0) return '同比 持平';
  const direction = metric.changePercent > 0 ? '↑' : '↓';
  return `同比 ${formatPercent(metric.changePercent)} ${direction}`;
}

function getEfficiencyErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (/permission denied/i.test(message)) return '当前账号暂无查看该统计范围的权限';
  return message || '效率诊断读取失败';
}

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}.${month}.${day}`;
}

function getRangePeriod(range: WorkflowEfficiencyRange) {
  const option = rangeOptions.find((item) => item.value === range) || rangeOptions[1];
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - option.days + 1);
  return `${formatDate(start)}-${formatDate(end)}`;
}

function getChartData(points: WorkflowEfficiencyPoint[]) {
  const width = 620;
  const height = 258;
  const padding = { left: 54, right: 18, top: 18, bottom: 36 };

  if (points.length === 0) {
    return { width, height, currentPath: '', previousPath: '', ticks: [], xLabels: [] };
  }

  const values = points.flatMap((point) => [point.current, point.previous]);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = Math.max(1, maxValue - minValue);
  const chartMin = Math.max(0, minValue - range * 0.18);
  const chartMax = maxValue + range * 0.16;
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const toX = (index: number) => padding.left + (chartWidth / Math.max(1, points.length - 1)) * index;
  const toY = (value: number) => padding.top + ((chartMax - value) / (chartMax - chartMin)) * chartHeight;

  const smoothPath = (key: 'current' | 'previous') => {
    const coords = points.map((point, index) => ({ x: toX(index), y: toY(point[key]) }));
    if (coords.length === 1) return `M ${coords[0].x.toFixed(2)} ${coords[0].y.toFixed(2)}`;

    return coords.map((point, index) => {
      if (index === 0) return `M ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
      const previous = coords[index - 1];
      const beforePrevious = coords[index - 2] || previous;
      const next = coords[index + 1] || point;
      const cp1x = previous.x + (point.x - beforePrevious.x) / 6;
      const cp1y = previous.y + (point.y - beforePrevious.y) / 6;
      const cp2x = point.x - (next.x - previous.x) / 6;
      const cp2y = point.y - (next.y - previous.y) / 6;
      return `C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)} ${cp2x.toFixed(2)} ${cp2y.toFixed(2)} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    }).join(' ');
  };

  const ticks = Array.from({ length: 4 }, (_, index) => chartMin + (chartMax - chartMin) * (index / 3)).reverse();
  const xIndexes = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])];

  return {
    width,
    height,
    currentPath: smoothPath('current'),
    previousPath: smoothPath('previous'),
    ticks: ticks.map((value) => ({
      y: toY(value),
      label: Math.round(value).toLocaleString('zh-CN'),
    })),
    xLabels: xIndexes.map((index) => ({
      x: toX(index),
      label: points[index]?.label || '',
    })),
  };
}

function getMetricMap(summary: WorkflowEfficiencySummary | null) {
  return new Map((summary?.metrics || []).map((metric) => [metric.key, metric]));
}

function MetricCard({
  metric,
  active,
  onClick,
}: {
  key?: React.Key;
  metric?: WorkflowEfficiencyMetric;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = metric?.changePercent && metric.changePercent < 0 ? TrendingDown : TrendingUp;
  const showUnit = metric && (!isTimeMetric(metric) || metric.hasData);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative min-h-[86px] min-w-0 rounded-[8px] border px-2.5 py-2.5 text-left transition-all sm:px-4 sm:py-3",
        active
          ? "border-[#1593f4] bg-[#1593f4] text-white shadow-[0_10px_22px_rgba(21,147,244,0.22)] after:absolute after:-bottom-2 after:left-1/2 after:h-0 after:w-0 after:-translate-x-1/2 after:border-x-[8px] after:border-t-[9px] after:border-x-transparent after:border-t-[#1593f4]"
          : "border-[#edf0f5] bg-white text-midnight-graphite shadow-[0_1px_2px_rgba(16,24,40,0.03)]",
      )}
    >
      <span className={cn("block min-h-[30px] text-[11px] font-semibold leading-[15px] sm:min-h-0 sm:text-[13px]", active ? "text-white/86" : "text-[#6f737c]")}>
        {metric?.label || '读取中'}
      </span>
      <span className="mt-1.5 flex items-end gap-0.5 sm:mt-3 sm:gap-1">
        <span className="text-[23px] font-semibold leading-none tracking-normal sm:text-[28px]">
          {formatMetricValue(metric)}
        </span>
        {showUnit && (
          <span className={cn("pb-0.5 text-[10.5px] font-semibold sm:text-[13px]", active ? "text-white/86" : "text-midnight-graphite")}>
            {getMetricUnit(metric)}
          </span>
        )}
      </span>
      <span className={cn("mt-2 flex items-center gap-0.5 whitespace-nowrap text-[10.5px] font-medium sm:mt-3 sm:gap-1 sm:text-[12px]", active ? "text-white/78" : "text-[#8d929b]")}>
        <span className="min-w-0 truncate">{getMetricChangeText(metric)}</span>
        {metric?.hasData && metric?.previousHasData && metric.changePercent !== 0 && <Icon size={13} strokeWidth={2.5} />}
      </span>
    </button>
  );
}

function PersonalMetricCard({ metric }: { key?: React.Key; metric: PersonalEfficiencyMetric }) {
  const Icon = metric.changePercent > 0 ? ArrowUp : metric.changePercent < 0 ? ArrowDown : null;
  const showUnit = Boolean(metric.unit && metric.hasData);
  const changeIsActive = metric.hasData && metric.previousHasData && metric.changePercent !== 0;

  return (
    <div className="min-h-[96px] rounded-[7px] bg-[#f3f4f7] px-3 py-2.5 text-left shadow-[inset_0_0_0_1px_rgba(20,24,34,0.018)]">
      <p className="min-h-[30px] text-[12.5px] font-semibold leading-[15px] text-[#8d929b]">{metric.label}</p>
      <div className="mt-1 flex items-end gap-1">
        <span className="text-[27px] font-semibold leading-none text-midnight-graphite">{formatMetricValue(metric)}</span>
        {showUnit && <span className="pb-0.5 text-[12px] font-semibold text-midnight-graphite">{metric.unit}</span>}
      </div>
      <div className={cn("mt-2 flex items-center gap-1 text-[12px] font-semibold", changeIsActive ? "text-[#2f9df8]" : "text-[#a5a8af]")}>
        <span className="text-[#b0b3ba]">同比</span>
        <span>{metric.previousHasData ? formatPercent(metric.changePercent) : '暂无'}</span>
        {Icon ? <Icon size={14} strokeWidth={2.7} /> : <Minus size={13} strokeWidth={2.5} />}
      </div>
    </div>
  );
}

function InsightStrip({
  summary,
  metric,
  scope,
}: {
  summary: WorkflowEfficiencySummary | null;
  metric?: WorkflowEfficiencyMetric;
  scope: WorkflowEfficiencyScope;
}) {
  const value = formatMetricValue(metric);
  const unit = getMetricUnit(metric);
  const change = metric?.hasData && metric.previousHasData ? formatPercent(metric.changePercent) : '暂无对比';
  const action = metric?.changePercent && metric.changePercent > 0 && isTimeMetric(metric) ? '请注意效率' : '保持关注';

  return (
    <div className="mx-0 mt-3 flex items-start gap-2.5 rounded-[8px] bg-[#f5f6f8] px-3.5 py-2.5 text-[13.5px] font-medium leading-6 text-midnight-graphite">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-black shadow-sm">
        <Lightbulb size={15} strokeWidth={2.5} />
      </span>
      <p className="min-w-0">
        {summary ? `${summary.currentPeriodLabel}${scope === 'personal' ? '我的' : ''}${metric?.label || '效率'} ${value}${unit}，同比 ${change}，${action}` : '正在读取真实统计数据'}
      </p>
    </div>
  );
}

function BenchmarkStrip({
  label,
  value,
  hasData,
}: {
  label: string;
  value: number;
  hasData: boolean;
}) {
  return (
    <div className="mt-3 flex items-center gap-2 text-[14px] font-semibold text-midnight-graphite">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#d6d9df] bg-white text-midnight-graphite">
        <Lightbulb size={13} strokeWidth={2.7} />
      </span>
      <span>{label}</span>
      <span className="text-[#f5a033]">{hasData ? formatPlainValue(value, 1) : '暂无'}</span>
      <span>小时</span>
    </div>
  );
}

function TrendChart({
  summary,
  activeMetric,
  isLoading,
}: {
  summary: WorkflowEfficiencySummary | null;
  activeMetric?: WorkflowEfficiencyMetric;
  isLoading: boolean;
}) {
  const points = activeMetric && summary ? summary.trend[activeMetric.key] || [] : [];
  const chart = getChartData(points);

  if (isLoading || !activeMetric) {
    return (
      <div className="mt-4 flex h-[130px] items-center justify-center rounded-[8px] bg-[#f7f8fa] text-[13px] font-semibold text-[#8d929b] sm:h-[190px] lg:h-[235px]">
        正在读取统计
      </div>
    );
  }

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-center gap-12 text-[13px] font-medium text-[#7d828c]">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#1593f4]" />
          {summary?.currentPeriodLabel || '当前周期'}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#14b8a6]" />
          {summary?.previousPeriodLabel || '上周期'}
        </span>
      </div>
      <div className="h-[130px] w-full overflow-hidden sm:h-[190px] lg:h-[235px]">
        <svg className="h-full w-full overflow-visible" viewBox={`0 0 ${chart.width} ${chart.height}`} role="img" aria-label={`${activeMetric.label}趋势图`}>
          {chart.ticks.map((tick, index) => (
            <g key={`${tick.label}-${index}`}>
              <line x1="54" x2="602" y1={tick.y} y2={tick.y} stroke="#e5e7eb" strokeDasharray="4 5" />
              <text x="12" y={tick.y + 5} fill="#8d929b" fontSize="13" fontWeight="600">{tick.label}</text>
            </g>
          ))}
          {chart.previousPath && (
            <path d={chart.previousPath} fill="none" stroke="#14b8a6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
          )}
          {chart.currentPath && (
            <path d={chart.currentPath} fill="none" stroke="#1593f4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
          )}
          {chart.xLabels.map((label) => (
            <text key={label.label} x={label.x} y="248" fill="#8d929b" fontSize="13" fontWeight="600" textAnchor="middle">
              {label.label}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}

function PersonalSection({
  title,
  metrics,
  benchmarkLabel,
  benchmarkValue,
  benchmarkHasData,
}: {
  title: string;
  metrics: PersonalEfficiencyMetric[];
  benchmarkLabel: string;
  benchmarkValue: number;
  benchmarkHasData: boolean;
}) {
  return (
    <section className="border-b-[8px] border-[#f5f6fa] bg-white px-4 py-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[18px] font-semibold text-midnight-graphite">{title}</h2>
        <button type="button" className="flex h-8 w-8 items-center justify-center rounded-full text-[#8d929b] transition-colors hover:bg-[#f5f6f8] hover:text-midnight-graphite" aria-label={`查看${title}详情`}>
          <ChevronRight size={21} strokeWidth={2.2} />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {metrics.map((metric) => (
          <React.Fragment key={metric.key}>
            <PersonalMetricCard metric={metric} />
          </React.Fragment>
        ))}
      </div>

      <BenchmarkStrip label={benchmarkLabel} value={benchmarkValue} hasData={benchmarkHasData} />
    </section>
  );
}

function getRankingTrendIcon(ranking: PersonalEfficiencyRanking) {
  if (ranking.trend === 'up') return <ArrowUp size={22} strokeWidth={2.7} className="text-[#2f9df8]" />;
  if (ranking.trend === 'down') return <ArrowDown size={22} strokeWidth={2.7} className="text-[#2f9df8]" />;
  return <Minus size={20} strokeWidth={2.5} className="text-[#a5a8af]" />;
}

function formatRankingValue(ranking: PersonalEfficiencyRanking) {
  if (ranking.unit) return formatPlainValue(ranking.value, 1);
  return ranking.value.toLocaleString('zh-CN', { maximumFractionDigits: 0 });
}

function RankingSection({
  title,
  ranking,
  valueHeader,
  insight,
}: {
  title: string;
  ranking: PersonalEfficiencyRanking;
  valueHeader: string;
  insight: string;
}) {
  return (
    <section className="border-b-[8px] border-[#f5f6fa] bg-white px-4 py-4">
      <h2 className="text-[18px] font-semibold text-midnight-graphite">{title}</h2>
      <div className="mt-4 grid grid-cols-[0.9fr_1.3fr_1.35fr_0.7fr] items-center gap-2 border-b border-[#edf0f4] pb-2 text-[14px] font-semibold text-[#8d929b]">
        <span>排行</span>
        <span>昵称</span>
        <span>{valueHeader}</span>
        <span className="text-right">趋势</span>
      </div>
      <div className="grid grid-cols-[0.9fr_1.3fr_1.35fr_0.7fr] items-center gap-2 py-2.5 text-[16px] font-semibold text-midnight-graphite">
        <span className="text-[28px] leading-none">{ranking.rank}</span>
        <span className="truncate">{ranking.name || '我'}</span>
        <span>
          {formatRankingValue(ranking)}
          {ranking.unit && <span className="ml-1 text-[13px] font-semibold">{ranking.unit}</span>}
        </span>
        <span className="flex justify-end">{getRankingTrendIcon(ranking)}</span>
      </div>
      <div className="mt-1.5 flex items-start gap-2 rounded-[7px] bg-[#f5f6f8] px-3 py-2 text-[13.5px] font-semibold leading-6 text-midnight-graphite">
        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#d6d9df] bg-white">
          <Lightbulb size={13} strokeWidth={2.7} />
        </span>
        <p className="min-w-0">
          {ranking.label}在企业中排名 <span className="text-[#f5a033]">{ranking.rank} / {ranking.total}</span>，{insight}
        </p>
      </div>
    </section>
  );
}

function PersonalEfficiencyPanel({
  summary,
  isLoading,
}: {
  summary: PersonalEfficiencySummary | null;
  isLoading: boolean;
}) {
  if (isLoading && !summary) {
    return (
      <div className="space-y-0">
        {Array.from({ length: 4 }, (_, index) => (
          <section key={index} className="border-b-[8px] border-[#f5f6fa] bg-white px-4 py-4">
            <div className="h-6 w-28 rounded bg-[#eef0f4]" />
            <div className="mt-4 grid grid-cols-3 gap-2">
              {Array.from({ length: 3 }, (_, cardIndex) => (
                <div key={cardIndex} className="h-[96px] rounded-[7px] bg-[#f2f3f7]" />
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="mx-4 mt-4 flex min-h-[160px] flex-col items-center justify-center rounded-[8px] bg-[#f7f8fa] text-center">
        <BarChart3 size={28} strokeWidth={2.4} className="text-[#8b9099]" />
        <p className="mt-3 text-[14px] font-semibold text-[#8b9099]">暂无个人效率数据</p>
      </div>
    );
  }

  return (
    <>
      <PersonalSection
        title="我发起的"
        metrics={summary.initiated.metrics}
        benchmarkLabel="企业流程平均耗时"
        benchmarkValue={summary.initiated.enterpriseFlowAvgHours}
        benchmarkHasData={summary.initiated.enterpriseFlowAvgHasData}
      />
      <PersonalSection
        title="我审批的"
        metrics={summary.approved.metrics}
        benchmarkLabel="企业审批平均耗时"
        benchmarkValue={summary.approved.enterpriseApprovalAvgHours}
        benchmarkHasData={summary.approved.enterpriseApprovalAvgHasData}
      />
      <RankingSection
        title="我的待办排行"
        ranking={summary.rankings.pending}
        valueHeader="待处理单量"
        insight={summary.rankings.pending.value > 0 ? '请优先处理当前待办' : '当前无待办，继续保持响应效率'}
      />
      <RankingSection
        title="我的审批耗时排行"
        ranking={summary.rankings.approvalTime}
        valueHeader="审批平均耗时(h)"
        insight={summary.rankings.approvalTime.value > 0 ? '继续压缩审批等待时间' : '当前周期暂无审批耗时数据'}
      />
    </>
  );
}

export default function EfficiencyDiagnosis() {
  const currentRole = auth.getCurrentUser()?.role || 'employee';
  const canUseEnterpriseScope = currentRole === 'boss' || currentRole === 'developer';
  const [scope, setScope] = React.useState<WorkflowEfficiencyScope>('personal');
  const [range, setRange] = React.useState<WorkflowEfficiencyRange>('30d');
  const [templates, setTemplates] = React.useState<WorkflowTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = React.useState('');
  const [summary, setSummary] = React.useState<WorkflowEfficiencySummary | null>(null);
  const [personalSummary, setPersonalSummary] = React.useState<PersonalEfficiencySummary | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [activeMetricKey, setActiveMetricKey] = React.useState<WorkflowEfficiencyMetricKey>('flowAvg');
  const [rangeMenuOpen, setRangeMenuOpen] = React.useState(false);
  const [showDataInfo, setShowDataInfo] = React.useState(false);
  const effectiveScope: WorkflowEfficiencyScope = canUseEnterpriseScope ? scope : 'personal';
  const scopeTabs = React.useMemo(
    () => [
      ...(canUseEnterpriseScope ? [{ value: 'enterprise' as const, label: '企业', icon: Building2 }] : []),
      { value: 'personal' as const, label: '个人', icon: UserRound },
    ],
    [canUseEnterpriseScope],
  );

  React.useEffect(() => {
    if (!canUseEnterpriseScope && scope === 'enterprise') {
      setScope('personal');
    }
  }, [canUseEnterpriseScope, scope]);

  React.useEffect(() => {
    let active = true;
    setError('');

    storage.getWorkflowTemplates({ skipImpersonation: false })
      .then((nextTemplates) => {
        if (!active) return;
        const sorted = sortTemplates(nextTemplates);
        setTemplates(sorted);
        setSelectedTemplateId((current) => current && sorted.some((template) => template.id === current)
          ? current
          : sorted[0]?.id || '');
      })
      .catch((requestError) => {
        if (!active) return;
        setError(getEfficiencyErrorMessage(requestError));
      });

    return () => {
      active = false;
    };
  }, []);

  const selectedTemplate = React.useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) || null,
    [selectedTemplateId, templates],
  );

  React.useEffect(() => {
    if (effectiveScope !== 'enterprise') {
      setSummary(null);
      return;
    }

    if (!selectedTemplate) {
      setSummary(null);
      return;
    }

    let active = true;
    setIsLoading(true);
    setError('');
    setActiveMetricKey('flowAvg');

    storage.getWorkflowEfficiencySummary(selectedTemplate.id, range, effectiveScope, { skipImpersonation: false })
      .then((nextSummary) => {
        if (active) setSummary(nextSummary);
      })
      .catch((requestError) => {
        if (!active) return;
        setSummary(null);
        setError(getEfficiencyErrorMessage(requestError));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [effectiveScope, range, selectedTemplate]);

  React.useEffect(() => {
    if (effectiveScope !== 'personal') {
      setPersonalSummary(null);
      return;
    }

    let active = true;
    setIsLoading(true);
    setError('');

    storage.getPersonalEfficiencySummary(range, { skipImpersonation: false })
      .then((nextSummary) => {
        if (active) setPersonalSummary(nextSummary);
      })
      .catch((requestError) => {
        if (!active) return;
        setPersonalSummary(null);
        setError(getEfficiencyErrorMessage(requestError));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [effectiveScope, range]);

  const metricMap = getMetricMap(summary);
  const activeMetric = metricMap.get(activeMetricKey) || summary?.metrics[0];
  const periodText = getRangePeriod(range);
  const selectedRangeOption = rangeOptions.find((item) => item.value === range) || rangeOptions[1];

  return (
    <div className="mx-[-16px] mt-[-4px] bg-white pb-[calc(88px+env(safe-area-inset-bottom))] text-midnight-graphite lg:mx-0 lg:mt-0 lg:overflow-hidden lg:rounded-[8px] lg:border lg:border-border-silver lg:pb-8">
      <header className="border-b border-[#edf0f4] bg-white px-4 pt-1">
        <div className={cn("grid h-[48px]", scopeTabs.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
          {scopeTabs.map((item) => {
            const Icon = item.icon;
            const active = effectiveScope === item.value;

            return (
              <button
                key={item.value}
                type="button"
                onClick={() => setScope(item.value)}
                className={cn(
                  "relative flex items-center justify-center gap-1.5 text-[16px] font-semibold",
                  active ? "text-midnight-graphite" : "text-[#8d929b]",
                )}
              >
                <Icon size={16} strokeWidth={2.35} />
                {item.label}
                {active && <span className="absolute bottom-0 left-1/2 h-[3px] w-7 -translate-x-1/2 rounded-full bg-midnight-graphite" />}
              </button>
            );
          })}
        </div>
      </header>

      <div className="relative flex min-h-[46px] items-center justify-between border-b border-[#edf0f4] px-4">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="relative shrink-0"
            onBlur={(event) => {
              const nextFocused = event.relatedTarget;
              if (!(nextFocused instanceof Node) || !event.currentTarget.contains(nextFocused)) {
                setRangeMenuOpen(false);
              }
            }}
          >
            <button
              type="button"
              aria-haspopup="listbox"
              aria-expanded={rangeMenuOpen}
              onClick={() => setRangeMenuOpen((open) => !open)}
              className="flex h-8 w-[82px] items-center justify-between text-[15px] font-semibold text-midnight-graphite outline-none"
            >
              <span>{selectedRangeOption.label}</span>
              <ChevronDown
                size={15}
                strokeWidth={2.5}
                className={cn("text-midnight-graphite transition-transform", rangeMenuOpen && "rotate-180")}
              />
            </button>
            {rangeMenuOpen && (
              <div
                role="listbox"
                className="absolute left-0 top-[calc(100%+4px)] z-20 w-[82px] overflow-hidden rounded-[6px] border border-[#edf0f4] bg-white py-1 shadow-[0_8px_24px_rgba(15,23,42,0.12)]"
              >
                {rangeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={option.value === range}
                    onClick={() => {
                      setRange(option.value);
                      setRangeMenuOpen(false);
                    }}
                    className={cn(
                      "flex h-8 w-full items-center px-3 text-left text-[15px] font-medium",
                      option.value === range
                        ? "bg-[#eef7ff] text-interactive-blue"
                        : "text-midnight-graphite hover:bg-[#f7f8fa]",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <span className="h-5 w-px bg-[#edf0f4]" />
          <span className="truncate text-[14px] font-medium text-[#8b9099]">{periodText}</span>
        </div>

        <button
          type="button"
          onClick={() => setShowDataInfo((visible) => !visible)}
          className="ml-3 flex shrink-0 items-center gap-1 text-[13px] font-semibold text-[#8d929b] transition-colors hover:text-midnight-graphite"
        >
          数据说明
          <CircleHelp size={16} strokeWidth={2.3} />
        </button>

        {showDataInfo && (
          <div className="absolute right-4 top-[calc(100%+6px)] z-30 w-[260px] rounded-[8px] border border-[#edf0f4] bg-white p-3 text-[12px] font-medium leading-5 text-[#6f737c] shadow-[0_12px_28px_rgba(15,23,42,0.14)]">
            个人页统计当前账号发起、审批和待处理任务；企业基准使用全公司聚合数据。排名仅展示本人名次和总人数。
          </div>
        )}
      </div>

      {effectiveScope === 'enterprise' && (
        <div className="border-b border-[#edf0f4] px-4 py-3">
          <label className="relative block">
            <select
              value={selectedTemplateId}
              onChange={(event) => setSelectedTemplateId(event.target.value)}
              className="h-10 w-full appearance-none rounded-[8px] border border-[#edf0f4] bg-[#f7f8fa] pl-3 pr-9 text-[13px] font-semibold text-midnight-graphite outline-none"
            >
              {templates.map((template) => (
                <option key={template.id} value={template.id}>{getTemplateName(template)}</option>
              ))}
            </select>
            <ChevronDown size={16} strokeWidth={2.5} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8b9099]" />
          </label>
        </div>
      )}

      {error && (
        <div className="mx-4 mt-3 rounded-[8px] bg-[#fff4f4] px-3 py-2 text-[13px] font-semibold text-[#b42318]">
          {error}
        </div>
      )}

      {effectiveScope === 'personal' ? (
        <PersonalEfficiencyPanel summary={personalSummary} isLoading={isLoading} />
      ) : (
        <>
          <section className="px-4 py-3">
            <div className="mb-3 flex items-center">
              <h2 className="text-[18px] font-semibold text-midnight-graphite">效率总览</h2>
            </div>

            <div className="grid grid-cols-4 gap-1.5 pb-2 sm:gap-2.5">
              {metricOrder.map((key) => {
                const metric = metricMap.get(key);
                return (
                  <React.Fragment key={key}>
                    <MetricCard
                      metric={metric}
                      active={activeMetricKey === key}
                      onClick={() => setActiveMetricKey(key)}
                    />
                  </React.Fragment>
                );
              })}
            </div>

            <InsightStrip summary={summary} metric={activeMetric} scope={effectiveScope} />
            <TrendChart summary={summary} activeMetric={activeMetric} isLoading={isLoading} />
          </section>

          {!isLoading && templates.length === 0 && (
            <div className="mx-4 mt-4 flex min-h-[160px] flex-col items-center justify-center rounded-[8px] bg-[#f7f8fa] text-center">
              <BarChart3 size={28} strokeWidth={2.4} className="text-[#8b9099]" />
              <p className="mt-3 text-[14px] font-semibold text-[#8b9099]">暂无可统计审批流</p>
            </div>
          )}

          <div className="hidden border-t border-[#edf0f4] px-4 pt-4 lg:block">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#f5f6f8] px-3 py-1.5 text-[12px] font-semibold text-[#6f737c]">
              <CheckCircle2 size={14} strokeWidth={2.5} />
              企业与个人切换已接入真实统计
            </div>
          </div>
        </>
      )}
    </div>
  );
}
