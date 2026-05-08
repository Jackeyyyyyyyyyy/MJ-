import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  Check,
  ChevronRight,
  FileText,
  Loader2,
  MessageSquareText,
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
  ApprovalStatus,
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
  '总结当前全局审批情况',
  '找出最需要优先处理的单据',
  '有哪些高风险或 AI 建议失败的单据',
  '分析资金类审批风险',
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

function buildInsights(overview: AiAssistantOverview | null) {
  if (!overview) return [];

  const insights = [
    `当前共有 ${overview.summary.total} 条审批记录，待处理 ${overview.summary.pending} 条。`,
  ];

  if (overview.summary.highRisk > 0) {
    insights.push(`发现 ${overview.summary.highRisk} 条高风险记录，建议优先核对。`);
  }

  if (overview.summary.aiAttention > 0) {
    insights.push(`${overview.summary.aiAttention} 条记录需要关注 AI 建议状态。`);
  }

  const busiestModule = overview.moduleStats[0];
  if (busiestModule) {
    insights.push(`${busiestModule.moduleName}模块当前最活跃，待处理 ${busiestModule.pending} 条。`);
  }

  return insights.slice(0, 4);
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  tone: string;
}) {
  return (
    <div className="bg-white border border-border-silver rounded-lg p-5 min-h-[112px] flex items-start justify-between gap-4">
      <div>
        <p className="text-[12px] font-bold text-light-gray">{label}</p>
        <p className="text-[30px] font-black tracking-tight text-midnight-graphite mt-3">{value}</p>
      </div>
      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', tone)}>
        <Icon size={18} strokeWidth={2.5} />
      </div>
    </div>
  );
}

interface RecordButtonProps {
  record: AiAssistantRecord;
  onOpen: (id: string) => void | Promise<void>;
}

function RecordButton({ record, onOpen }: RecordButtonProps) {
  return (
    <button
      type="button"
      onClick={() => onOpen(record.id)}
      className="w-full min-h-[76px] px-4 py-3 bg-white border border-border-silver rounded-lg hover:border-black/20 hover:bg-canvas-white transition-all flex items-center justify-between gap-4 text-left"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[14px] font-black text-midnight-graphite truncate">{record.approvalTypeName}</span>
          <span className="px-2 py-0.5 rounded-full bg-lightest-gray-background text-[10px] font-bold text-medium-gray shrink-0">
            {getRecordRiskLabel(record)}
          </span>
        </div>
        <p className="text-[12px] font-semibold text-light-gray mt-1 truncate">
          {record.id} · {record.moduleName} · {record.applicant}
        </p>
      </div>
      <ChevronRight size={16} strokeWidth={2.5} className="text-light-silver shrink-0" />
    </button>
  );
}

export default function AiAssistantHome() {
  const user = auth.getCurrentUser();
  const isDeveloperPerspective = user?.role === 'developer' && auth.getPerspective() === 'developer';
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

  const insights = useMemo(() => buildInsights(overview), [overview]);
  const recordMap = useMemo(() => new Map(records.map((record) => [record.id, record])), [records]);
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

  const handlePromptSave = async () => {
    if (!canSavePrompt) return;

    setIsPromptSaving(true);
    setPromptNotice('');

    try {
      const config = await storage.updateAiAssistantPrompt(prompt.trim());
      setPrompt(config.prompt);
      setSavedPrompt(config.prompt);
      setPromptNotice('AI 助手提示词已保存');
    } catch (err) {
      setPromptNotice(err instanceof Error ? err.message : '提示词保存失败');
    } finally {
      setIsPromptSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[520px] flex items-center justify-center">
        <div className="flex items-center gap-3 text-[14px] font-bold text-medium-gray">
          <Loader2 size={18} strokeWidth={2.5} className="animate-spin" />
          AI 助手正在加载
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-40 animate-in fade-in duration-700">
      <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 text-[12px] font-bold text-medium-gray uppercase tracking-wider">
            <Bot size={17} strokeWidth={2.4} />
            <span>AI 管理助手</span>
          </div>
          <h1 className="text-[34px] font-black tracking-tight text-midnight-graphite mt-3">智能工作台</h1>
        </div>
        <button
          type="button"
          onClick={() => void loadData()}
          className="h-10 px-4 bg-black text-white rounded-lg text-[13px] font-bold hover:bg-zinc-800 transition-all flex items-center justify-center gap-2"
        >
          <RefreshCw size={14} strokeWidth={2.5} />
          刷新
        </button>
      </section>

      {error && (
        <div className="px-5 py-4 bg-[#ffebee] text-[#c62828] rounded-lg text-[13px] font-bold">
          {error}
        </div>
      )}

      {overview && !overview.aiEnabled && (
        <div className="px-5 py-4 bg-[#fff7e6] border border-[#f5d7a1] rounded-lg text-[13px] font-bold text-[#9a5b00] flex items-center gap-3">
          <AlertTriangle size={17} strokeWidth={2.5} />
          AI 助手暂未启用
        </div>
      )}

      {overview && (
        <div className="grid grid-cols-2 xl:grid-cols-6 gap-3">
          <SummaryCard label="总记录" value={overview.summary.total} icon={FileText} tone="bg-lightest-gray-background text-midnight-graphite" />
          <SummaryCard label="待处理" value={overview.summary.pending} icon={MessageSquareText} tone="bg-[#fff7e6] text-[#9a5b00]" />
          <SummaryCard label="今日新增" value={overview.summary.today} icon={Sparkles} tone="bg-[#eef6ff] text-[#0066cc]" />
          <SummaryCard label="高风险" value={overview.summary.highRisk} icon={AlertTriangle} tone="bg-[#ffebee] text-[#c62828]" />
          <SummaryCard label="已通过" value={overview.summary.approved} icon={Check} tone="bg-[#e8f5e9] text-[#2e7d32]" />
          <SummaryCard label="AI关注" value={overview.summary.aiAttention} icon={Bot} tone="bg-lightest-gray-background text-medium-gray" />
        </div>
      )}

      <section className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-6">
        <div className="space-y-6">
          <div className="bg-white border border-border-silver rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-border-silver">
              <h2 className="text-[18px] font-black tracking-tight">今日洞察</h2>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
              {insights.map((insight) => (
                <div key={insight} className="min-h-[72px] bg-canvas-white border border-border-silver rounded-lg px-4 py-3 flex items-center gap-3">
                  <Sparkles size={16} strokeWidth={2.5} className="text-interactive-blue shrink-0" />
                  <span className="text-[13px] font-bold text-midnight-graphite leading-5">{insight}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-border-silver rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-border-silver">
              <h2 className="text-[18px] font-black tracking-tight">快捷问题</h2>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
              {QUICK_QUESTIONS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => void askQuestion(item)}
                  disabled={isAsking}
                  className="h-12 px-4 bg-canvas-white border border-border-silver rounded-lg text-left text-[13px] font-bold text-midnight-graphite hover:border-black/20 hover:bg-white transition-all disabled:opacity-50"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white border border-border-silver rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-border-silver flex items-center justify-between">
              <h2 className="text-[18px] font-black tracking-tight">AI 对话</h2>
              {isAsking && <Loader2 size={16} strokeWidth={2.5} className="animate-spin text-medium-gray" />}
            </div>

            <div className="min-h-[320px] p-5 space-y-4 bg-canvas-white">
              {messages.length === 0 ? (
                <div className="h-[260px] flex items-center justify-center text-[14px] font-bold text-light-gray">
                  暂无对话
                </div>
              ) : (
                messages.map((message) => (
                  <article
                    key={message.id}
                    className={cn(
                      'max-w-[86%] rounded-lg px-4 py-3',
                      message.role === 'user'
                        ? 'ml-auto bg-black text-white'
                        : 'bg-white border border-border-silver text-midnight-graphite',
                    )}
                  >
                    <p className="text-[14px] font-semibold leading-6 whitespace-pre-wrap">{message.text}</p>
                    {message.relatedRecords && message.relatedRecords.length > 0 && (
                      <div className="mt-4 space-y-2">
                        {message.relatedRecords.map((record) => (
                          <div key={record.id}>
                            <RecordButton record={record} onOpen={openRecord} />
                          </div>
                        ))}
                      </div>
                    )}
                  </article>
                ))
              )}
            </div>

            <form onSubmit={handleSubmit} className="p-4 bg-white border-t border-border-silver flex items-center gap-3">
              <input
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                className="h-11 flex-1 bg-canvas-white border border-border-silver rounded-lg px-4 text-[14px] font-semibold outline-none focus:border-black"
                placeholder="输入问题"
              />
              <button
                type="submit"
                disabled={!question.trim() || isAsking}
                className="w-11 h-11 bg-black text-white rounded-lg flex items-center justify-center hover:bg-zinc-800 transition-all disabled:opacity-40"
                title="发送"
              >
                <Send size={17} strokeWidth={2.5} />
              </button>
            </form>
          </div>
        </div>

        <aside className="space-y-6">
          {overview && (
            <>
              <div className="bg-white border border-border-silver rounded-lg overflow-hidden">
                <div className="px-5 py-4 border-b border-border-silver">
                  <h2 className="text-[18px] font-black tracking-tight">优先处理</h2>
                </div>
                <div className="p-4 space-y-2">
                  {overview.priorityRecords.length > 0 ? (
                    overview.priorityRecords.map((record) => (
                      <div key={record.id}>
                        <RecordButton record={record} onOpen={openRecord} />
                      </div>
                    ))
                  ) : (
                    <p className="text-[13px] font-bold text-light-gray px-1 py-6 text-center">暂无待处理单据</p>
                  )}
                </div>
              </div>

              <div className="bg-white border border-border-silver rounded-lg overflow-hidden">
                <div className="px-5 py-4 border-b border-border-silver">
                  <h2 className="text-[18px] font-black tracking-tight">模块分布</h2>
                </div>
                <div className="divide-y divide-border-silver">
                  {overview.moduleStats.slice(0, 8).map((item) => (
                    <div key={item.moduleName} className="px-5 py-3 flex items-center justify-between gap-4">
                      <span className="text-[13px] font-bold text-midnight-graphite">{item.moduleName}</span>
                      <span className="text-[12px] font-bold text-medium-gray">待处理 {item.pending} / 总 {item.total}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {isDeveloperPerspective && (
            <div className="bg-white border border-border-silver rounded-lg overflow-hidden">
              <div className="px-5 py-4 border-b border-border-silver flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-[18px] font-black tracking-tight">助手提示词</h2>
                  {promptNotice && <p className="text-[12px] font-bold text-medium-gray mt-1">{promptNotice}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => void handlePromptSave()}
                  disabled={!canSavePrompt}
                  className="h-9 px-3 bg-black text-white rounded-lg text-[12px] font-bold hover:bg-zinc-800 transition-all disabled:opacity-40 flex items-center gap-2"
                >
                  {isPromptSaving ? <Loader2 size={13} strokeWidth={2.5} className="animate-spin" /> : <Save size={13} strokeWidth={2.5} />}
                  保存
                </button>
              </div>
              <div className="p-4">
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  rows={8}
                  className="w-full resize-y bg-canvas-white border border-border-silver rounded-lg p-3 text-[13px] font-semibold leading-5 outline-none focus:border-black"
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
        showAiRawResponse={user?.role === 'developer'}
      />
    </div>
  );
}
