import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  ChevronRight,
  FileText,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
} from 'lucide-react';
import { storage } from '../storage';
import {
  AiAssistantOverview,
  AiAssistantRecord,
  ApprovalRecord,
} from '../types';
import ApprovalDetailModal from './ApprovalDetailModal';
import { cn } from '../lib/utils';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  relatedRecords?: AiAssistantRecord[];
}

const QUICK_QUESTIONS = [
  '总结当前审批风险',
  '找出最该优先处理的单据',
  '查看高风险和 AI 异常单据',
];

function createMessageId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getRecordRiskLabel(record: AiAssistantRecord) {
  return record.aiSuggestion?.riskLevel || (
    record.aiSuggestion?.displayText?.includes('高风险') ? '高风险' :
    record.aiSuggestion?.displayText?.includes('中风险') ? '中风险' :
    record.aiSuggestion?.displayText?.includes('低风险') ? '低风险' : '未评级'
  );
}

function getRiskClassName(label: string) {
  if (label.includes('高')) return 'bg-[#ffebee] text-[#c62828]';
  if (label.includes('中')) return 'bg-[#fff7e6] text-[#8a5a12]';
  if (label.includes('低')) return 'bg-[#e8f5e9] text-[#2e7d32]';
  return 'bg-lightest-gray-background text-medium-gray';
}

function getRecordReason(record: AiAssistantRecord) {
  const text = record.aiSuggestion?.displayText?.trim();
  if (!text) return 'AI 暂未给出风险说明，建议人工核对关键字段。';
  return text.length > 74 ? `${text.slice(0, 74)}...` : text;
}

function buildHeadline(overview: AiAssistantOverview | null) {
  if (!overview) return '正在整理需要关注的审批事项。';
  if (overview.summary.highRisk > 0) {
    return `今天有 ${overview.summary.highRisk} 张高风险审批建议优先查看。`;
  }
  if (overview.summary.pending > 0) {
    return `当前有 ${overview.summary.pending} 张待处理审批，AI 已按风险排序。`;
  }
  return '暂无需要特别关注的审批。';
}

function buildSignals(overview: AiAssistantOverview | null) {
  if (!overview) return [];

  return [
    { label: '待处理', value: overview.summary.pending, tone: 'text-midnight-graphite' },
    { label: '高风险', value: overview.summary.highRisk, tone: 'text-[#c62828]' },
    { label: 'AI 异常', value: overview.summary.aiAttention, tone: 'text-[#8a5a12]' },
  ];
}

interface RecordButtonProps {
  record: AiAssistantRecord;
  onOpen: (id: string) => void | Promise<void>;
}

function PriorityRecordButton({ record, onOpen }: RecordButtonProps) {
  const riskLabel = getRecordRiskLabel(record);

  return (
    <button
      type="button"
      onClick={() => onOpen(record.id)}
      className="group w-full rounded-lg border border-border-silver bg-white px-4 py-4 text-left transition-all hover:border-black/20 hover:bg-canvas-white"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-black text-midnight-graphite">{record.approvalTypeName}</span>
            <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-black', getRiskClassName(riskLabel))}>
              {riskLabel}
            </span>
          </div>
          <p className="mt-1 text-[12px] font-bold text-medium-gray">
            {record.applicant} · {record.moduleName} · {record.id}
          </p>
          <p className="mt-3 text-[13px] font-semibold leading-5 text-deep-gray">
            {getRecordReason(record)}
          </p>
        </div>
        <ChevronRight size={17} strokeWidth={2.5} className="mt-1 shrink-0 text-light-silver transition-colors group-hover:text-midnight-graphite" />
      </div>
    </button>
  );
}

export default function AiAssistantHome() {
  const [overview, setOverview] = useState<AiAssistantOverview | null>(null);
  const [records, setRecords] = useState<ApprovalRecord[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<ApprovalRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAsking, setIsAsking] = useState(false);
  const [error, setError] = useState('');

  const recordMap = useMemo(() => new Map(records.map((record) => [record.id, record])), [records]);
  const headline = useMemo(() => buildHeadline(overview), [overview]);
  const signals = useMemo(() => buildSignals(overview), [overview]);
  const latestAnswer = [...messages].reverse().find((message) => message.role === 'assistant');

  const loadData = async () => {
    setIsLoading(true);
    setError('');

    try {
      const [nextOverview, nextRecords] = await Promise.all([
        storage.getAiAssistantOverview(),
        storage.getRecords(),
      ]);
      setOverview(nextOverview);
      setRecords(nextRecords);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI 助手加载失败');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const openRecord = async (id: string) => {
    const current = recordMap.get(id);
    if (current) {
      setSelectedRecord(current);
      return;
    }

    const latestRecords = await storage.getRecords();
    setRecords(latestRecords);
    setSelectedRecord(latestRecords.find((record) => record.id === id) || null);
  };

  const askQuestion = async (value: string) => {
    const text = value.trim();
    if (!text || isAsking) return;

    setQuestion('');
    setIsAsking(true);
    setMessages((current) => [
      ...current,
      { id: createMessageId(), role: 'user', text },
    ]);

    try {
      const response = await storage.askAiAssistant(text);
      setMessages((current) => [
        ...current,
        {
          id: createMessageId(),
          role: 'assistant',
          text: response.answer,
          relatedRecords: response.relatedRecords,
        },
      ]);
    } catch (err) {
      setMessages((current) => [
        ...current,
        {
          id: createMessageId(),
          role: 'assistant',
          text: err instanceof Error ? err.message : 'AI 助手暂时无法回答，请稍后再试。',
        },
      ]);
    } finally {
      setIsAsking(false);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void askQuestion(question);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[520px] items-center justify-center">
        <div className="flex items-center gap-3 text-[14px] font-bold text-medium-gray">
          <Loader2 size={18} strokeWidth={2.5} className="animate-spin" />
          AI 助手正在整理审批事项
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in space-y-8 pb-36 duration-700">
      <section className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <div className="flex items-center gap-3 text-[12px] font-bold uppercase tracking-wider text-medium-gray">
            <Bot size={17} strokeWidth={2.4} />
            <span>简洁 AI 助手</span>
          </div>
          <h1 className="mt-3 text-[34px] font-black tracking-tight text-midnight-graphite">智能审批</h1>
          <p className="mt-3 text-[18px] font-bold leading-8 text-deep-gray">{headline}</p>
        </div>
        <button
          type="button"
          onClick={() => void loadData()}
          className="flex h-10 items-center justify-center gap-2 rounded-full bg-black px-4 text-[13px] font-bold text-white transition-all hover:bg-zinc-800"
        >
          <RefreshCw size={14} strokeWidth={2.5} />
          刷新
        </button>
      </section>

      {error && (
        <div className="rounded-lg bg-[#ffebee] px-5 py-4 text-[13px] font-bold text-[#c62828]">
          {error}
        </div>
      )}

      {overview && !overview.aiEnabled && (
        <div className="flex items-center gap-3 rounded-lg border border-[#f5d7a1] bg-[#fff7e6] px-5 py-4 text-[13px] font-bold text-[#9a5b00]">
          <AlertTriangle size={17} strokeWidth={2.5} />
          AI 助手暂未启用
        </div>
      )}

      <section className="grid grid-cols-3 gap-3">
        {signals.map((signal) => (
          <div key={signal.label} className="rounded-lg border border-border-silver bg-white px-5 py-4">
            <p className="text-[12px] font-black text-light-gray">{signal.label}</p>
            <p className={cn('mt-2 text-[30px] font-black tracking-tight', signal.tone)}>{signal.value}</p>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_380px]">
        <div className="rounded-lg border border-border-silver bg-white">
          <div className="flex items-center justify-between gap-4 border-b border-border-silver px-5 py-4">
            <div>
              <h2 className="text-[18px] font-black tracking-tight">优先处理</h2>
              <p className="mt-1 text-[12px] font-bold text-medium-gray">AI 已按风险和时间排序</p>
            </div>
            <FileText size={18} strokeWidth={2.4} className="text-light-silver" />
          </div>
          <div className="space-y-3 p-4">
            {overview && overview.priorityRecords.length > 0 ? (
              overview.priorityRecords.map((record) => (
                <div key={record.id}>
                  <PriorityRecordButton record={record} onOpen={openRecord} />
                </div>
              ))
            ) : (
              <div className="flex min-h-[220px] items-center justify-center rounded-lg bg-canvas-white px-5 text-center text-[14px] font-bold text-light-gray">
                暂无需要特别关注的审批
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-lg border border-border-silver bg-white">
            <div className="border-b border-border-silver px-5 py-4">
              <h2 className="text-[18px] font-black tracking-tight">问 AI</h2>
            </div>
            <div className="space-y-3 p-4">
              {QUICK_QUESTIONS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => void askQuestion(item)}
                  disabled={isAsking}
                  className="h-11 w-full rounded-lg border border-border-silver bg-canvas-white px-4 text-left text-[13px] font-bold text-midnight-graphite transition-all hover:border-black/20 hover:bg-white disabled:opacity-50"
                >
                  {item}
                </button>
              ))}

              <form onSubmit={handleSubmit} className="flex items-center gap-2 pt-2">
                <input
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  className="h-11 min-w-0 flex-1 rounded-lg border border-border-silver bg-canvas-white px-4 text-[13px] font-semibold outline-none focus:border-black"
                  placeholder="输入问题"
                />
                <button
                  type="submit"
                  disabled={!question.trim() || isAsking}
                  className="flex h-11 w-11 items-center justify-center rounded-lg bg-black text-white transition-all hover:bg-zinc-800 disabled:opacity-40"
                  title="发送"
                >
                  {isAsking ? <Loader2 size={17} strokeWidth={2.5} className="animate-spin" /> : <Send size={17} strokeWidth={2.5} />}
                </button>
              </form>
            </div>
          </div>

          <div className="rounded-lg border border-border-silver bg-white">
            <div className="flex items-center gap-2 border-b border-border-silver px-5 py-4">
              <Sparkles size={17} strokeWidth={2.4} className="text-interactive-blue" />
              <h2 className="text-[18px] font-black tracking-tight">最近回答</h2>
            </div>
            <div className="min-h-[180px] p-4">
              {latestAnswer ? (
                <article className="space-y-4">
                  <p className="whitespace-pre-wrap text-[14px] font-semibold leading-6 text-midnight-graphite">
                    {latestAnswer.text}
                  </p>
                  {latestAnswer.relatedRecords && latestAnswer.relatedRecords.length > 0 && (
                    <div className="space-y-2">
                      {latestAnswer.relatedRecords.map((record) => (
                        <div key={record.id}>
                          <PriorityRecordButton record={record} onOpen={openRecord} />
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              ) : (
                <div className="flex h-[150px] items-center justify-center text-center text-[13px] font-bold text-light-gray">
                  选择一个问题后，这里会显示 AI 的简短结论。
                </div>
              )}
            </div>
          </div>
        </aside>
      </section>

      <ApprovalDetailModal
        record={selectedRecord}
        onClose={() => setSelectedRecord(null)}
        showAiSuggestion
        showAiRawResponse
      />
    </div>
  );
}
