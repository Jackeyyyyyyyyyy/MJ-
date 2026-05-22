import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Clock3,
  FileText,
  Loader2,
  RefreshCw,
  Save,
  Send,
  Sparkles,
} from 'lucide-react';
import { auth } from '../auth';
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
  '今天最需要先处理什么？',
  '有没有高风险审批单？',
  '帮我总结全局审批状态',
  '哪些模块积压最多？',
];

function createMessageId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getRiskLabel(record: AiAssistantRecord) {
  return record.aiSuggestion?.riskLevel || (
    record.aiSuggestion?.displayText?.includes('高风险') ? '高风险' :
    record.aiSuggestion?.displayText?.includes('中风险') ? '中风险' :
    record.aiSuggestion?.displayText?.includes('低风险') ? '低风险' : '未评级'
  );
}

function Metric({
  label,
  value,
  icon: Icon,
  tone = 'text-midnight-graphite',
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  tone?: string;
}) {
  return (
    <div className="min-h-[92px] rounded-lg border border-black/[0.06] bg-white px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] font-bold text-medium-gray">{label}</p>
        <Icon size={15} strokeWidth={2.4} className={cn('shrink-0', tone)} />
      </div>
      <p className="mt-3 text-[28px] font-black tracking-tight text-midnight-graphite">{value}</p>
    </div>
  );
}

function RecordRow({
  record,
  onOpen,
}: {
  record: AiAssistantRecord;
  onOpen: (id: string) => void | Promise<void>;
}) {
  const riskLabel = getRiskLabel(record);
  const isHighRisk = riskLabel.includes('高');

  return (
    <button
      type="button"
      onClick={() => onOpen(record.id)}
      className="group w-full rounded-lg border border-black/[0.06] bg-white px-4 py-3 text-left transition-all hover:border-black/20 hover:shadow-sm"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-[14px] font-black text-midnight-graphite">{record.approvalTypeName}</span>
            <span className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-black',
              isHighRisk ? 'bg-[#fff1f0] text-[#c62828]' : 'bg-lightest-gray-background text-medium-gray',
            )}>
              {riskLabel}
            </span>
          </div>
          <p className="mt-1 truncate text-[12px] font-semibold text-light-gray">
            {record.id} · {record.moduleName} · {record.applicant}
          </p>
        </div>
        <ArrowUpRight size={15} strokeWidth={2.4} className="shrink-0 text-light-silver transition-colors group-hover:text-midnight-graphite" />
      </div>
    </button>
  );
}

export default function AiAssistantNewHome() {
  const isDeveloperPerspective = auth.getSessionUser()?.role === 'developer' && auth.getPerspective() === 'developer';
  const [overview, setOverview] = useState<AiAssistantOverview | null>(null);
  const [records, setRecords] = useState<ApprovalRecord[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<ApprovalRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAsking, setIsAsking] = useState(false);
  const [error, setError] = useState('');
  const [prompt, setPrompt] = useState('');
  const [savedPrompt, setSavedPrompt] = useState('');
  const [promptNotice, setPromptNotice] = useState('');
  const [isPromptSaving, setIsPromptSaving] = useState(false);

  const recordMap = useMemo(() => new Map(records.map((record) => [record.id, record])), [records]);
  const priorityRecords = overview?.priorityRecords.slice(0, 5) || [];
  const busyModules = overview?.moduleStats.slice(0, 5) || [];
  const canSavePrompt = Boolean(isDeveloperPerspective && prompt.trim() && prompt.trim() !== savedPrompt.trim() && !isPromptSaving);

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

      if (isDeveloperPerspective) {
        const config = await storage.getAiAssistantPrompt();
        setPrompt(config.prompt);
        setSavedPrompt(config.prompt);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI 助手加载失败');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [isDeveloperPerspective]);

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
    setMessages((current) => [...current, { id: createMessageId(), role: 'user', text }]);

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

  const handlePromptSave = async () => {
    if (!canSavePrompt) return;

    setIsPromptSaving(true);
    setPromptNotice('');

    try {
      const config = await storage.updateAiAssistantPrompt(prompt.trim());
      setPrompt(config.prompt);
      setSavedPrompt(config.prompt);
      setPromptNotice('已保存');
    } catch (err) {
      setPromptNotice(err instanceof Error ? err.message : '保存失败');
    } finally {
      setIsPromptSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[520px] flex items-center justify-center">
        <div className="flex items-center gap-3 text-[14px] font-bold text-medium-gray">
          <Loader2 size={18} strokeWidth={2.5} className="animate-spin" />
          正在加载 AI 助手
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1320px] space-y-5 pb-32 animate-in fade-in duration-500">
      <section className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[12px] font-black text-medium-gray ring-1 ring-black/[0.06]">
            <Bot size={14} strokeWidth={2.5} />
            AI 助手新
            {overview?.aiEnabled ? (
              <span className="h-1.5 w-1.5 rounded-full bg-[#2e7d32]" />
            ) : (
              <span className="h-1.5 w-1.5 rounded-full bg-[#c62828]" />
            )}
          </div>
          <h1 className="mt-4 text-[32px] font-black tracking-tight text-midnight-graphite lg:text-[40px]">审批驾驶舱</h1>
        </div>
        <button
          type="button"
          onClick={() => void loadData()}
          className="h-10 w-fit rounded-full bg-midnight-graphite px-4 text-[13px] font-bold text-white transition-all hover:bg-black flex items-center gap-2"
        >
          <RefreshCw size={14} strokeWidth={2.5} />
          刷新
        </button>
      </section>

      {error && (
        <div className="rounded-lg bg-[#fff1f0] px-4 py-3 text-[13px] font-bold text-[#c62828]">
          {error}
        </div>
      )}

      {overview && !overview.aiEnabled && (
        <div className="rounded-lg border border-[#f5d7a1] bg-[#fff7e6] px-4 py-3 text-[13px] font-bold text-[#9a5b00] flex items-center gap-2">
          <AlertTriangle size={16} strokeWidth={2.5} />
          AI 暂未启用，请先配置模型参数
        </div>
      )}

      {overview && (
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Metric label="待处理" value={overview.summary.pending} icon={Clock3} tone="text-[#9a5b00]" />
          <Metric label="高风险" value={overview.summary.highRisk} icon={AlertTriangle} tone="text-[#c62828]" />
          <Metric label="今日新增" value={overview.summary.today} icon={Sparkles} tone="text-interactive-blue" />
          <Metric label="已通过" value={overview.summary.approved} icon={CheckCircle2} tone="text-[#2e7d32]" />
          <Metric label="总记录" value={overview.summary.total} icon={FileText} />
        </section>
      )}

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="rounded-lg border border-black/[0.06] bg-white overflow-hidden">
          <div className="border-b border-black/[0.06] px-5 py-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[18px] font-black tracking-tight text-midnight-graphite">对话</h2>
              <p className="mt-1 text-[12px] font-semibold text-medium-gray">只读分析，不会替你审批</p>
            </div>
            {isAsking && <Loader2 size={17} strokeWidth={2.5} className="animate-spin text-medium-gray" />}
          </div>

          <div className="min-h-[430px] bg-[#fafafa] px-5 py-5">
            {messages.length === 0 ? (
              <div className="flex min-h-[390px] flex-col justify-between">
                <div className="max-w-[520px]">
                  <p className="text-[22px] font-black tracking-tight text-midnight-graphite">你可以直接问审批风险、积压、优先级。</p>
                  <p className="mt-2 text-[13px] font-semibold leading-6 text-medium-gray">我会基于当前审批数据给出简短结论，并把相关单据带出来。</p>
                </div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {QUICK_QUESTIONS.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => void askQuestion(item)}
                      disabled={isAsking}
                      className="h-11 rounded-lg border border-black/[0.06] bg-white px-4 text-left text-[13px] font-bold text-midnight-graphite transition-all hover:border-black/20 disabled:opacity-50"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <article
                    key={message.id}
                    className={cn(
                      'max-w-[88%] rounded-lg px-4 py-3',
                      message.role === 'user'
                        ? 'ml-auto bg-midnight-graphite text-white'
                        : 'border border-black/[0.06] bg-white text-midnight-graphite',
                    )}
                  >
                    <p className="whitespace-pre-wrap text-[14px] font-semibold leading-6">{message.text}</p>
                    {message.relatedRecords && message.relatedRecords.length > 0 && (
                      <div className="mt-4 space-y-2">
                        {message.relatedRecords.map((record) => (
                          <div key={record.id}>
                            <RecordRow record={record} onOpen={openRecord} />
                          </div>
                        ))}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void askQuestion(question);
            }}
            className="border-t border-black/[0.06] bg-white p-4"
          >
            <div className="flex items-center gap-3 rounded-full bg-lightest-gray-background px-4 py-2">
              <input
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                className="h-10 min-w-0 flex-1 bg-transparent text-[14px] font-semibold text-midnight-graphite outline-none placeholder:text-light-gray"
                placeholder="输入问题..."
              />
              <button
                type="submit"
                disabled={!question.trim() || isAsking}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-midnight-graphite text-white transition-all hover:bg-black disabled:opacity-40"
                title="发送"
              >
                <Send size={15} strokeWidth={2.5} />
              </button>
            </div>
          </form>
        </div>

        <aside className="space-y-5">
          <div className="rounded-lg border border-black/[0.06] bg-white overflow-hidden">
            <div className="border-b border-black/[0.06] px-5 py-4">
              <h2 className="text-[16px] font-black tracking-tight text-midnight-graphite">优先处理</h2>
            </div>
            <div className="space-y-2 p-4">
              {priorityRecords.length > 0 ? (
                priorityRecords.map((record) => (
                  <div key={record.id}>
                    <RecordRow record={record} onOpen={openRecord} />
                  </div>
                ))
              ) : (
                <p className="py-8 text-center text-[13px] font-bold text-light-gray">暂无优先单据</p>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-black/[0.06] bg-white overflow-hidden">
            <div className="border-b border-black/[0.06] px-5 py-4">
              <h2 className="text-[16px] font-black tracking-tight text-midnight-graphite">模块积压</h2>
            </div>
            <div className="divide-y divide-black/[0.06]">
              {busyModules.map((item) => (
                <div key={item.moduleName} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-[13px] font-black text-midnight-graphite">{item.moduleName}</p>
                    <p className="text-[12px] font-bold text-medium-gray">{item.pending}/{item.total}</p>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-lightest-gray-background">
                    <div
                      className="h-full rounded-full bg-midnight-graphite"
                      style={{ width: `${item.total > 0 ? Math.max(8, Math.round((item.pending / item.total) * 100)) : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {isDeveloperPerspective && (
            <div className="rounded-lg border border-black/[0.06] bg-white overflow-hidden">
              <div className="border-b border-black/[0.06] px-5 py-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-[16px] font-black tracking-tight text-midnight-graphite">提示词</h2>
                  {promptNotice && <p className="mt-1 text-[12px] font-bold text-medium-gray">{promptNotice}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => void handlePromptSave()}
                  disabled={!canSavePrompt}
                  className="h-8 rounded-full bg-midnight-graphite px-3 text-[12px] font-bold text-white transition-all disabled:opacity-40 flex items-center gap-2"
                >
                  {isPromptSaving ? <Loader2 size={13} strokeWidth={2.5} className="animate-spin" /> : <Save size={13} strokeWidth={2.5} />}
                  保存
                </button>
              </div>
              <div className="p-4">
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  rows={7}
                  className="w-full resize-y rounded-lg border border-black/[0.06] bg-[#fafafa] p-3 text-[13px] font-semibold leading-5 text-midnight-graphite outline-none focus:border-black/30"
                />
              </div>
            </div>
          )}
        </aside>
      </section>

      <ApprovalDetailModal
        record={selectedRecord}
        onClose={() => setSelectedRecord(null)}
        showAiSuggestion
        showAiRawResponse={isDeveloperPerspective}
      />
    </div>
  );
}
