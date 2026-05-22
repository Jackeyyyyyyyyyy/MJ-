import React from 'react';
import { AlertCircle, CheckCircle2, FileText, RefreshCw, Route } from 'lucide-react';
import { storage } from '../storage';
import { AiBranchDecisionLog, ApprovalRecord } from '../types';
import { cn } from '../lib/utils';
import { formatLocalDateTime } from '../lib/time';
import ApprovalDetailModal from './ApprovalDetailModal';

function formatTime(value?: string) {
  return formatLocalDateTime(value, 'short') || '-';
}

function getStatusMeta(status: AiBranchDecisionLog['status']) {
  if (status === 'success') return { label: '成功', className: 'bg-[#edf7ed] text-[#2e7d32]', icon: CheckCircle2 };
  if (status === 'fallback') return { label: '兜底', className: 'bg-[#fff7e6] text-[#8a5a12]', icon: AlertCircle };
  if (status === 'skipped') return { label: '未启用', className: 'bg-lightest-gray-background text-medium-gray', icon: AlertCircle };
  return { label: '失败', className: 'bg-[#ffebee] text-[#c62828]', icon: AlertCircle };
}

export default function AiBranchLogs() {
  const [logs, setLogs] = React.useState<AiBranchDecisionLog[]>([]);
  const [records, setRecords] = React.useState<ApprovalRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = React.useState<ApprovalRecord | null>(null);
  const [expandedReasonIds, setExpandedReasonIds] = React.useState<Set<string>>(() => new Set());
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  const recordMap = React.useMemo(() => new Map(records.map((record) => [record.id, record])), [records]);

  const loadLogs = React.useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const [nextLogs, nextRecords] = await Promise.all([
        storage.getAiBranchDecisionLogs(),
        storage.getRecords(),
      ]);
      setLogs(nextLogs);
      setRecords(nextRecords);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '日志加载失败');
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const openRecord = React.useCallback(async (recordId?: string) => {
    if (!recordId) return;

    const currentRecord = recordMap.get(recordId);
    if (currentRecord) {
      setSelectedRecord(currentRecord);
      return;
    }

    try {
      const nextRecords = await storage.getRecords();
      setRecords(nextRecords);
      const nextRecord = nextRecords.find((record) => record.id === recordId);
      if (nextRecord) {
        setSelectedRecord(nextRecord);
        return;
      }
      setError('未找到对应卷宗，或当前账号无权限查看。');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '卷宗加载失败');
    }
  }, [recordMap]);

  const toggleReason = React.useCallback((logId: string) => {
    setExpandedReasonIds((current) => {
      const next = new Set(current);
      if (next.has(logId)) {
        next.delete(logId);
      } else {
        next.add(logId);
      }
      return next;
    });
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-light-gray">System Admin</p>
          <h1 className="mt-1 text-2xl font-bold text-midnight-graphite">AI 条件分化日志</h1>
        </div>
        <button
          type="button"
          onClick={() => void loadLogs()}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-black px-4 text-[13px] font-black text-white"
        >
          <RefreshCw size={15} strokeWidth={2.4} />
          刷新
        </button>
      </div>

      {error && (
        <div className="rounded-2xl bg-[#ffebee] px-4 py-3 text-[13px] font-bold text-[#c62828]">{error}</div>
      )}

      <div className="overflow-hidden rounded-3xl border border-border-silver bg-white">
        <div className="grid grid-cols-[140px_1.2fr_1fr_110px_1.5fr] gap-4 border-b border-border-silver bg-lightest-gray-background px-5 py-3 text-[11px] font-black uppercase tracking-wider text-medium-gray">
          <span>时间</span>
          <span>审批单</span>
          <span>AI 选择</span>
          <span>状态</span>
          <span>判断理由</span>
        </div>
        {isLoading ? (
          <div className="px-5 py-10 text-center text-[13px] font-bold text-medium-gray">正在加载日志...</div>
        ) : logs.length === 0 ? (
          <div className="px-5 py-10 text-center text-[13px] font-bold text-medium-gray">暂无 AI 条件分化日志</div>
        ) : (
          <div className="divide-y divide-border-silver">
            {logs.map((log) => {
              const status = getStatusMeta(log.status);
              const StatusIcon = status.icon;
              const record = log.recordId ? recordMap.get(log.recordId) : null;
              const reasonText = log.reason || log.error || log.rawText || '-';
              const isReasonExpanded = expandedReasonIds.has(log.id);
              const canToggleReason = reasonText.length > 54;
              return (
                <div
                  key={log.id}
                  className={cn(
                    'grid grid-cols-[140px_1.2fr_1fr_110px_1.5fr] gap-4 px-5 py-4 text-[13px]',
                    !isReasonExpanded && 'h-[112px]',
                  )}
                >
                  <span className="font-bold text-medium-gray">{formatTime(log.createdAt)}</span>
                  <span className="min-w-0">
                    <button
                      type="button"
                      onClick={() => void openRecord(log.recordId)}
                      disabled={!log.recordId}
                      className={cn(
                        'group inline-flex max-w-full items-center gap-2 text-left font-black text-midnight-graphite transition-colors',
                        log.recordId ? 'hover:text-interactive-blue disabled:cursor-not-allowed' : 'cursor-default',
                      )}
                      title={record ? '查看对应卷宗' : (log.recordId ? '查看对应卷宗' : undefined)}
                    >
                      <FileText size={14} strokeWidth={2.4} className="shrink-0 text-light-silver transition-colors group-hover:text-interactive-blue" />
                      <span className="truncate">{log.recordId || '-'}</span>
                    </button>
                    <span className="mt-1 block truncate text-[11px] font-bold text-medium-gray">
                      {[log.moduleName, log.approvalTypeName].filter(Boolean).join(' / ') || log.workflowName || '-'}
                    </span>
                  </span>
                  <span className="min-w-0">
                    <span className="inline-flex items-center gap-2 font-black text-midnight-graphite">
                      <Route size={15} strokeWidth={2.4} />
                      {log.selectedBranchTitle || log.fallbackBranchTitle || '-'}
                    </span>
                    {typeof log.confidence === 'number' && (
                      <span className="mt-1 block text-[11px] font-bold text-medium-gray">置信度 {Math.round(log.confidence * 100)}%</span>
                    )}
                  </span>
                  <span>
                    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black', status.className)}>
                      <StatusIcon size={13} strokeWidth={2.4} />
                      {status.label}
                    </span>
                  </span>
                  <span className="min-w-0 text-medium-gray">
                    <span className={cn('block whitespace-pre-wrap break-words leading-6', !isReasonExpanded && 'line-clamp-2')}>
                      {reasonText}
                    </span>
                    <span className="mt-1 block h-5">
                      <button
                        type="button"
                        onClick={() => toggleReason(log.id)}
                        className={cn(
                          'text-[11px] font-black text-midnight-graphite underline decoration-border-silver underline-offset-4 transition-colors hover:text-interactive-blue',
                          !canToggleReason && 'invisible',
                        )}
                      >
                        {isReasonExpanded ? '收起' : '查看完整'}
                      </button>
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ApprovalDetailModal
        record={selectedRecord}
        onClose={() => setSelectedRecord(null)}
        showAiSuggestion
        showAiRawResponse
      />
    </div>
  );
}
