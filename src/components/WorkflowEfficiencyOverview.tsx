import React from 'react';
import { Lightbulb } from 'lucide-react';
import { storage } from '../storage';
import {
  WorkflowEfficiencyMetric,
  WorkflowEfficiencyMetricKey,
  WorkflowEfficiencyPoint,
  WorkflowEfficiencyRange,
  WorkflowEfficiencyScope,
  WorkflowEfficiencySummary,
  WorkflowTemplate,
} from '../types';
import { cn } from '../lib/utils';

const workflowEfficiencyRangeOptions: Array<{ value: WorkflowEfficiencyRange; label: string }> = [
  { value: '7d', label: '近7天' },
  { value: '30d', label: '近30天' },
  { value: '90d', label: '近90天' },
];

function formatEfficiencyValue(metric: WorkflowEfficiencyMetric, value = metric.value) {
  const hasValue = value === metric.value ? metric.hasData : metric.previousHasData;
  if (!hasValue) return '暂无';

  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: metric.precision,
    maximumFractionDigits: metric.precision,
  });
}

function getEfficiencyChartData(points: WorkflowEfficiencyPoint[]) {
  const width = 620;
  const height = 260;
  const padding = { left: 56, right: 18, top: 18, bottom: 36 };
  if (points.length === 0) {
    return {
      width,
      height,
      currentPath: '',
      previousPath: '',
      ticks: [],
      xLabels: [],
    };
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
  const toY = (value: number) => padding.top + (chartMax - value) / (chartMax - chartMin) * chartHeight;
  const smoothPath = (key: 'current' | 'previous') => {
    const coords = points.map((point, index) => ({
      x: toX(index),
      y: toY(point[key]),
    }));

    if (coords.length === 1) {
      return `M ${coords[0].x.toFixed(2)} ${coords[0].y.toFixed(2)}`;
    }

    return coords.map((point, index) => {
      if (index === 0) return `M ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;

      const previous = coords[index - 1];
      const beforePrevious = coords[index - 2] || previous;
      const next = coords[index + 1] || point;
      const cp1x = previous.x + (point.x - beforePrevious.x) / 6;
      const cp1y = previous.y + (point.y - beforePrevious.y) / 6;
      const cp2x = point.x - (next.x - previous.x) / 6;
      const cp2y = point.y - (next.y - previous.y) / 6;

      return [
        'C',
        cp1x.toFixed(2),
        cp1y.toFixed(2),
        cp2x.toFixed(2),
        cp2y.toFixed(2),
        point.x.toFixed(2),
        point.y.toFixed(2),
      ].join(' ');
    }).join(' ');
  };
  const tickValues = Array.from({ length: 4 }, (_, index) => chartMin + (chartMax - chartMin) * (index / 3)).reverse();

  return {
    width,
    height,
    currentPath: smoothPath('current'),
    previousPath: smoothPath('previous'),
    ticks: tickValues.map((value) => ({
      value,
      y: toY(value),
      label: Math.round(value).toLocaleString('zh-CN'),
    })),
    xLabels: [...new Set([
      0,
      Math.floor((points.length - 1) / 2),
      points.length - 1,
    ])].map((index) => ({
      index,
      x: toX(index),
      label: points[index]?.label || '',
    })),
  };
}

function isTimeEfficiencyMetric(metric: Pick<WorkflowEfficiencyMetric, 'key'>) {
  return metric.key === 'flowAvg' || metric.key === 'nodeAvg';
}

function getEfficiencyNotice(summary: WorkflowEfficiencySummary, metric: WorkflowEfficiencyMetric, scope: WorkflowEfficiencyScope) {
  const metricName = isTimeEfficiencyMetric(metric) ? '平均耗时' : metric.label;
  const previousText = `${formatEfficiencyValue(metric, metric.previousValue)}${metric.unit && (!isTimeEfficiencyMetric(metric) || metric.previousHasData) ? metric.unit : ''}`;
  const periodLabel = summary.currentPeriodLabel;
  const scopePrefix = scope === 'personal' ? '我的' : '';

  if (!metric.hasData) {
    return `${periodLabel}${scopePrefix}${metricName}暂无真实数据${summary.recordCount === 0 ? '，当前审批流还没有匹配的审批单' : ''}`;
  }

  if (!metric.previousHasData) {
    return `${periodLabel}${scopePrefix}${metricName} ${formatEfficiencyValue(metric)}${metric.unit}，${summary.previousPeriodLabel}暂无对比数据`;
  }

  const changePercent = Math.abs(metric.changePercent);
  const direction = metric.changePercent > 0 ? (isTimeEfficiencyMetric(metric) ? '增加' : '提升') : metric.changePercent < 0 ? '下降' : '持平';
  return `${periodLabel}${scopePrefix}${metricName}${direction} ${changePercent.toLocaleString('zh-CN', { maximumFractionDigits: 1 })}%，${summary.previousPeriodLabel} ${previousText}`;
}

export default function WorkflowEfficiencyOverview({
  template,
  scope = 'enterprise',
  skipImpersonation = true,
}: {
  template: WorkflowTemplate;
  scope?: WorkflowEfficiencyScope;
  skipImpersonation?: boolean;
}) {
  const [summary, setSummary] = React.useState<WorkflowEfficiencySummary | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [range, setRange] = React.useState<WorkflowEfficiencyRange>('7d');
  const [activeMetricKey, setActiveMetricKey] = React.useState<WorkflowEfficiencyMetricKey>('flowAvg');

  React.useEffect(() => {
    let active = true;
    setActiveMetricKey('flowAvg');
    setIsLoading(true);
    setError('');

    storage.getWorkflowEfficiencySummary(template.id, range, scope, { skipImpersonation })
      .then((nextSummary) => {
        if (!active) return;
        setSummary(nextSummary);
      })
      .catch((requestError) => {
        if (!active) return;
        setSummary(null);
        setError(requestError instanceof Error ? requestError.message : '效率统计读取失败');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [template.id, range, scope, skipImpersonation]);

  const activeMetric = summary?.metrics.find((metric) => metric.key === activeMetricKey) || summary?.metrics[0] || null;
  const chartData = getEfficiencyChartData(activeMetric && summary ? summary.trend[activeMetric.key] || [] : []);
  const noticeText = summary && activeMetric ? getEfficiencyNotice(summary, activeMetric, scope) : '正在读取真实审批数据';
  const title = scope === 'personal' ? '个人效率总览' : '企业效率总览';

  return (
    <section className="overflow-hidden rounded-xl border border-border-silver bg-white shadow-sm">
      <div className="flex flex-col gap-3 px-5 pt-5 lg:flex-row lg:items-center lg:justify-between">
        <h2 className="text-[18px] font-black text-midnight-graphite">{title}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-full bg-lightest-gray-background p-1">
            {workflowEfficiencyRangeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setRange(option.value)}
                className={cn(
                  "h-8 rounded-full px-3 text-[12px] font-black transition-colors",
                  range === option.value ? "bg-white text-midnight-graphite shadow-sm" : "text-medium-gray hover:text-midnight-graphite",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="no-scrollbar mt-4 flex gap-3 overflow-x-auto px-5 pb-1 lg:grid lg:grid-cols-4 lg:overflow-visible">
        {summary?.metrics.map((metric) => {
          const active = metric.key === activeMetric?.key;
          const showUnit = metric.unit && (!isTimeEfficiencyMetric(metric) || metric.hasData);
          return (
            <button
              key={metric.key}
              type="button"
              onClick={() => setActiveMetricKey(metric.key)}
              className={cn(
                "relative min-w-[160px] rounded-xl border px-4 py-3 text-left transition-all",
                active
                  ? "border-[#1593f4] bg-[#1593f4] text-white shadow-[0_12px_24px_rgba(21,147,244,0.28)] after:absolute after:-bottom-2 after:left-1/2 after:h-0 after:w-0 after:-translate-x-1/2 after:border-x-[8px] after:border-t-[9px] after:border-x-transparent after:border-t-[#1593f4]"
                  : "border-border-silver bg-white text-midnight-graphite hover:border-[#b7d9ff] hover:shadow-sm",
              )}
            >
              <span className={cn("block text-[13px] font-bold", active ? "text-white/85" : "text-medium-gray")}>
                {metric.label}
              </span>
              <span className="mt-2 flex items-end gap-1">
                <span className="text-[26px] font-black leading-none tracking-tight">
                  {formatEfficiencyValue(metric)}
                </span>
                {showUnit && <span className={cn("text-[13px] font-bold", active ? "text-white/90" : "text-midnight-graphite")}>{metric.unit}</span>}
              </span>
            </button>
          );
        }) || Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="min-w-[160px] rounded-xl border border-border-silver bg-white px-4 py-3">
            <div className="h-4 w-20 rounded bg-lightest-gray-background" />
            <div className="mt-3 h-7 w-24 rounded bg-lightest-gray-background" />
          </div>
        ))}
      </div>

      <div className="mx-5 mt-5 flex items-center gap-3 rounded-xl bg-[#f5f6f8] px-4 py-3 text-[14px] font-bold text-midnight-graphite">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-black shadow-sm">
          <Lightbulb size={17} strokeWidth={2.6} />
        </span>
        <p className="min-w-0">
          {error ? '效率统计读取失败，请稍后重试' : noticeText}
        </p>
      </div>

      <div className="px-5 pb-5 pt-6">
        <div className="flex items-center justify-center gap-16 text-[13px] font-bold text-medium-gray">
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#1593f4]" />
            {summary?.currentPeriodLabel || '当前周期'}
          </span>
          {summary?.previousPeriodLabel && (
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#14b8a6]" />
              {summary.previousPeriodLabel}
            </span>
          )}
        </div>

        <div className="mt-5 h-[260px] w-full">
          {isLoading || !activeMetric ? (
            <div className="flex h-full items-center justify-center rounded-xl bg-lightest-gray-background text-[13px] font-bold text-medium-gray">
              正在读取真实统计...
            </div>
          ) : error ? (
            <div className="flex h-full items-center justify-center rounded-xl bg-lightest-gray-background text-[13px] font-bold text-medium-gray">
              暂时无法读取效率统计
            </div>
          ) : (
            <svg className="h-full w-full overflow-visible" viewBox={`0 0 ${chartData.width} ${chartData.height}`} role="img" aria-label={`${activeMetric.label}趋势图`}>
              {chartData.ticks.map((tick, index) => (
                <g key={`${tick.label}-${index}`}>
                  <line x1="56" x2="602" y1={tick.y} y2={tick.y} stroke="#e4e7ec" strokeDasharray="4 5" />
                  <text x="12" y={tick.y + 5} fill="#8b8f98" fontSize="13" fontWeight="700">{tick.label}</text>
                </g>
              ))}
              {chartData.previousPath && (
                <path d={chartData.previousPath} fill="none" stroke="#14b8a6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
              )}
              {chartData.currentPath && <path d={chartData.currentPath} fill="none" stroke="#1593f4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />}
              {chartData.xLabels.map((label) => (
                <text key={`${label.index}-${label.label}`} x={label.x} y="250" fill="#8b8f98" fontSize="13" fontWeight="700" textAnchor="middle">
                  {label.label}
                </text>
              ))}
            </svg>
          )}
        </div>
      </div>
    </section>
  );
}
