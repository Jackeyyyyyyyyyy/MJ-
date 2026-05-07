import React, { useEffect, useState } from 'react';
import { RefreshCw, Save, Sparkles } from 'lucide-react';
import { storage } from '../storage';
import { cn } from '../lib/utils';

interface AiPromptEditorProps {
  moduleName: string;
  approvalTypeName: string;
}

export default function AiPromptEditor({ moduleName, approvalTypeName }: AiPromptEditorProps) {
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
        const config = await storage.getAiPrompt(moduleName, approvalTypeName);
        if (cancelled) return;

        setPrompt(config.prompt);
        setSavedPrompt(config.prompt);
        setUpdatedBy(config.updatedBy || '');
        setUpdatedAt(config.updatedAt || '');
        setIsDefault(config.isDefault !== false);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : '提示词加载失败');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadPrompt();

    return () => {
      cancelled = true;
    };
  }, [moduleName, approvalTypeName]);

  const hasChanges = prompt.trim() !== savedPrompt.trim();
  const canSave = prompt.trim().length > 0 && hasChanges && !isSaving && !isLoading;

  const handleSave = async () => {
    if (!canSave) return;

    setIsSaving(true);
    setMessage('');
    setError('');

    try {
      const config = await storage.updateAiPrompt(moduleName, approvalTypeName, prompt.trim());
      setPrompt(config.prompt);
      setSavedPrompt(config.prompt);
      setUpdatedBy(config.updatedBy || '');
      setUpdatedAt(config.updatedAt || '');
      setIsDefault(false);
      setMessage('提示词已保存');
    } catch (err) {
      setError(err instanceof Error ? err.message : '提示词保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="bg-white border border-border-silver rounded-lg overflow-hidden">
      <div className="px-5 py-4 border-b border-border-silver flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="min-w-0 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-lightest-gray-background flex items-center justify-center shrink-0">
            <Sparkles size={18} strokeWidth={2.4} className="text-interactive-blue" />
          </div>
          <div className="min-w-0">
            <h2 className="text-[18px] font-bold tracking-tight">AI 审批提示词</h2>
            <p className="text-[12px] text-light-gray font-semibold truncate">
              {isDefault ? '系统默认' : `上次修改：${updatedBy || '超级管理员'}${updatedAt ? ` · ${new Date(updatedAt).toLocaleString()}` : ''}`}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!canSave}
          className="h-10 px-4 bg-black text-white rounded-lg text-[13px] font-bold hover:bg-zinc-800 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {isSaving ? <RefreshCw size={14} strokeWidth={2.5} className="animate-spin" /> : <Save size={14} strokeWidth={2.5} />}
          保存提示词
        </button>
      </div>

      {(message || error) && (
        <div className={cn(
          'px-5 py-3 text-[13px] font-semibold',
          error ? 'text-[#c62828] bg-[#ffebee]' : 'text-[#2e7d32] bg-[#e8f5e9]',
        )}>
          {error || message}
        </div>
      )}

      <div className="p-5">
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          disabled={isLoading}
          rows={5}
          className="w-full min-h-[132px] resize-y bg-canvas-white border border-border-silver rounded-lg p-4 text-[14px] font-semibold leading-6 text-midnight-graphite outline-none focus:border-black disabled:opacity-60"
          placeholder={isLoading ? '正在加载提示词...' : '输入该业务类型的 AI 审批提示词'}
        />
      </div>
    </section>
  );
}
