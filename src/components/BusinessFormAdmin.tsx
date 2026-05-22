import React from 'react';
import { FilePlus2, Loader2, Plus, Save, X } from 'lucide-react';
import { approvalSchema, replaceApprovalSchema } from '../approvalSchema';
import { storage } from '../storage';
import { cn } from '../lib/utils';

function normalizeFields(value: string) {
  return value
    .split(/\r?\n|,|，/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function BusinessFormAdmin() {
  const [moduleName, setModuleName] = React.useState('');
  const [approvalTypeName, setApprovalTypeName] = React.useState('');
  const [fieldText, setFieldText] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);

  const businessFields = React.useMemo(() => normalizeFields(fieldText), [fieldText]);
  const moduleOptions = approvalSchema.modules.map((module) => module.name);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');
    setError('');

    const nextModuleName = moduleName.trim();
    const nextApprovalTypeName = approvalTypeName.trim();

    if (!nextModuleName || !nextApprovalTypeName || businessFields.length === 0) {
      setError('请填写模块名称、表单名称和至少 1 个业务字段。');
      return;
    }

    setIsSaving(true);
    try {
      const nextSchema = await storage.createBusinessForm({
        moduleName: nextModuleName,
        approvalTypeName: nextApprovalTypeName,
        businessFields,
      });
      replaceApprovalSchema(nextSchema);
      setModuleName('');
      setApprovalTypeName('');
      setFieldText('');
      setMessage('业务表单已创建，左侧业务模块和发起申请入口已同步更新。');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '保存失败，请稍后再试。');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3 text-[12px] font-black uppercase tracking-wider text-interactive-blue">
          <FilePlus2 size={16} strokeWidth={2.5} />
          <span>业务表单</span>
        </div>
        <h1 className="text-[30px] font-black tracking-tight text-midnight-graphite">新建业务表单</h1>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-border-silver bg-white p-6 shadow-sm">
          <label className="block space-y-2">
            <span className="text-[12px] font-black uppercase tracking-wider text-light-gray">所属业务模块</span>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
              <select
                value={moduleOptions.includes(moduleName) ? moduleName : ''}
                onChange={(event) => setModuleName(event.target.value)}
                className="input-field text-[14px]"
              >
                <option value="">新建模块</option>
                {moduleOptions.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
              <input
                value={moduleName}
                onChange={(event) => setModuleName(event.target.value)}
                placeholder="例如：合同、行政、项目"
                className="input-field text-[14px]"
              />
            </div>
          </label>

          <label className="block space-y-2">
            <span className="text-[12px] font-black uppercase tracking-wider text-light-gray">表单名称</span>
            <input
              value={approvalTypeName}
              onChange={(event) => setApprovalTypeName(event.target.value)}
              placeholder="例如：合同用印申请"
              className="input-field text-[14px]"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-[12px] font-black uppercase tracking-wider text-light-gray">业务字段</span>
            <textarea
              value={fieldText}
              onChange={(event) => setFieldText(event.target.value)}
              placeholder={'每行一个字段，例如：\n合同编号\n客户名称\n申请金额\n附件'}
              className="input-field min-h-[220px] resize-y py-3 text-[14px] leading-7"
            />
          </label>

          {businessFields.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {businessFields.map((field) => (
                <span key={field} className="inline-flex items-center gap-1.5 rounded-full bg-lightest-gray-background px-3 py-1.5 text-[12px] font-bold text-midnight-graphite">
                  {field}
                  <button
                    type="button"
                    onClick={() => setFieldText(businessFields.filter((item) => item !== field).join('\n'))}
                    className="text-light-gray hover:text-rose-500"
                    aria-label={`移除 ${field}`}
                  >
                    <X size={12} strokeWidth={3} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {error && <div className="rounded-xl bg-rose-50 px-4 py-3 text-[13px] font-bold text-rose-600">{error}</div>}
          {message && <div className="rounded-xl bg-emerald-50 px-4 py-3 text-[13px] font-bold text-emerald-700">{message}</div>}

          <button type="submit" disabled={isSaving} className={cn('btn-primary h-12 w-full text-[15px] font-black', isSaving && 'opacity-70')}>
            {isSaving ? <Loader2 className="animate-spin" size={17} /> : <Save size={17} />}
            <span>{isSaving ? '正在保存' : '保存业务表单'}</span>
          </button>
        </form>

        <aside className="space-y-4 rounded-2xl border border-border-silver bg-canvas-white p-5">
          <div className="flex items-center gap-2 text-[13px] font-black text-midnight-graphite">
            <Plus size={15} strokeWidth={3} />
            已有业务
          </div>
          <div className="max-h-[520px] space-y-3 overflow-y-auto pr-1">
            {approvalSchema.modules.map((module) => (
              <div key={module.name} className="rounded-xl bg-white p-3 shadow-sm">
                <div className="text-[13px] font-black text-midnight-graphite">{module.name}</div>
                <div className="mt-2 space-y-1">
                  {module.approvalTypes.map((type) => (
                    <div key={type.name} className="text-[12px] font-semibold text-medium-gray">
                      {type.name} · {type.businessFields.length} 个字段
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
