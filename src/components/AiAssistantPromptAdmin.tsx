import React, { useEffect, useState } from 'react';
import { Loader2, Save, Sparkles } from 'lucide-react';
import { storage } from '../storage';
import { cn } from '../lib/utils';
import { formatLocalDateTime } from '../lib/time';

export default function AiAssistantPromptAdmin() {
  const [prompt, setPrompt] = useState('');
  const [savedPrompt, setSavedPrompt] = useState('');
  const [updatedBy, setUpdatedBy] = useState('');
  const [updatedAt, setUpdatedAt] = useState('');
  const [isDefault, setIsDefault] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadPrompt() {
      setIsLoading(true);
      setMessage('');
      setError('');

      try {
        const config = await storage.getAiAssistantPrompt();
        if (cancelled) return;
        setPrompt(config.prompt);
        setSavedPrompt(config.prompt);
        setUpdatedBy(config.updatedBy || '');
        setUpdatedAt(config.updatedAt || '');
        setIsDefault(config.isDefault !== false);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : '提示词加载失败');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadPrompt();

    return () => {
      cancelled = true;
    };
  }, []);

  const canSave = prompt.trim().length > 0 && prompt.trim() !== savedPrompt.trim() && !isSaving && !isLoading;

  const handleSave = async () => {
    if (!canSave) return;

    setIsSaving(true);
    setMessage('');
    setError('');

    try {
      const config = await storage.updateAiAssistantPrompt(prompt.trim());
      setPrompt(config.prompt);
      setSavedPrompt(config.prompt);
      setUpdatedBy(config.updatedBy || '');
      setUpdatedAt(config.updatedAt || '');
      setIsDefault(config.isDefault !== false);
      setMessage('提示词已保存');
    } catch (err) {
      setError(err instanceof Error ? err.message : '提示词保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="animate-in fade-in space-y-6 pb-36 duration-700">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <div className="flex items-center gap-3 text-[12px] font-bold uppercase tracking-wider text-medium-gray">
            <Sparkles size={17} strokeWidth={2.4} />
            <span>简洁 AI 助手</span>
          </div>
          <h1 className="mt-3 text-[34px] font-black tracking-tight text-midnight-graphite">提示词设置</h1>
          <p className="mt-3 text-[15px] font-semibold leading-7 text-medium-gray">
            控制助手如何总结风险、解释优先级和引用审批单。这里仅影响管理助手的问答和概览判断。
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!canSave}
          className="flex h-10 items-center justify-center gap-2 rounded-full bg-black px-4 text-[13px] font-bold text-white transition-all hover:bg-zinc-800 disabled:opacity-40"
        >
          {isSaving ? <Loader2 size={14} strokeWidth={2.5} className="animate-spin" /> : <Save size={14} strokeWidth={2.5} />}
          保存
        </button>
      </section>

      {(message || error) && (
        <div className={cn(
          'rounded-lg px-5 py-4 text-[13px] font-bold',
          error ? 'bg-[#ffebee] text-[#c62828]' : 'bg-[#e8f5e9] text-[#2e7d32]',
        )}>
          {error || message}
        </div>
      )}

      <section className="rounded-lg border border-border-silver bg-white">
        <div className="border-b border-border-silver px-5 py-4">
          <h2 className="text-[18px] font-black tracking-tight">助手提示词</h2>
          <p className="mt-1 text-[12px] font-bold text-medium-gray">
            {isDefault
              ? '当前使用系统默认提示词'
              : `上次修改：${updatedBy || '超级管理员'}${updatedAt ? ` · ${formatLocalDateTime(updatedAt, 'date-time-seconds')}` : ''}`}
          </p>
        </div>
        <div className="p-5">
          {isLoading ? (
            <div className="flex min-h-[320px] items-center justify-center gap-3 text-[14px] font-bold text-medium-gray">
              <Loader2 size={18} strokeWidth={2.5} className="animate-spin" />
              正在加载提示词
            </div>
          ) : (
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={14}
              className="min-h-[360px] w-full resize-y rounded-lg border border-border-silver bg-canvas-white p-4 text-[14px] font-semibold leading-6 text-midnight-graphite outline-none focus:border-black"
              placeholder="输入 AI 助手提示词"
            />
          )}
        </div>
      </section>
    </div>
  );
}
