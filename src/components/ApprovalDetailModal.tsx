import React from 'react';
import { ApprovalAttachment, ApprovalRecord, ApprovalStatus } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { X, FileText, ShieldCheck, AlertCircle, CheckCircle2, XCircle, Download, Eye, Check, Clock } from 'lucide-react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { storage } from '../storage';

interface ApprovalDetailModalProps {
  record: ApprovalRecord | null;
  onClose: () => void;
  onApprove?: (record: ApprovalRecord) => void;
  onReject?: (record: ApprovalRecord) => void;
}

function isAttachmentList(value: unknown): value is ApprovalAttachment[] {
  return Array.isArray(value) && value.every((item) => {
    return !!item && typeof item === 'object' && 'name' in item && 'url' in item;
  });
}

function canPreviewAttachment(attachment: ApprovalAttachment) {
  const type = attachment.type || '';
  return type.startsWith('image/') || type === 'application/pdf' || type.startsWith('text/');
}

interface PreviewState {
  attachment: ApprovalAttachment;
  url: string;
  kind: 'image' | 'pdf' | 'text';
  text?: string;
}

export default function ApprovalDetailModal({ record, onClose, onApprove, onReject }: ApprovalDetailModalProps) {
  const [preview, setPreview] = React.useState<PreviewState | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = React.useState(false);

  React.useEffect(() => {
    return () => {
      if (preview?.url) URL.revokeObjectURL(preview.url);
    };
  }, [preview?.url]);

  if (!record) return null;

  const canReview = record.status === ApprovalStatus.PENDING && !!onApprove && !!onReject;
  const finishedAt = record.approvedAt || record.rejectedAt;
  const approvalTimeline = [
    {
      title: '发起申请',
      desc: `发起人：${record.applicant}`,
      time: record.createdAt,
      state: 'done',
    },
    {
      title: '审批人处理',
      desc: record.status === ApprovalStatus.PENDING ? '待审批人处理' : `审批人：${record.approver || '系统审批员'}`,
      time: finishedAt,
      state: record.status === ApprovalStatus.PENDING ? 'active' : 'done',
    },
    {
      title: record.status === ApprovalStatus.REJECTED ? '审批驳回' : '审批通过',
      desc: record.status === ApprovalStatus.APPROVED
        ? '审批流程已通过'
        : (record.status === ApprovalStatus.REJECTED ? '审批流程已被拒绝' : '等待最终审批结果'),
      time: finishedAt,
      state: record.status === ApprovalStatus.APPROVED
        ? 'done'
        : (record.status === ApprovalStatus.REJECTED ? 'failed' : 'pending'),
    },
  ];

  const handleAttachmentDownload = async (attachment: ApprovalAttachment) => {
    try {
      const blob = await storage.downloadAttachment(attachment);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = attachment.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      window.alert('文件下载失败，请稍后再试');
    }
  };

  const closePreview = () => {
    setPreview((current) => {
      if (current?.url) URL.revokeObjectURL(current.url);
      return null;
    });
  };

  const handleAttachmentPreview = async (attachment: ApprovalAttachment) => {
    if (!canPreviewAttachment(attachment)) {
      await handleAttachmentDownload(attachment);
      return;
    }

    setIsPreviewLoading(true);
    try {
      const blob = await storage.downloadAttachment(attachment);
      const url = URL.createObjectURL(blob);
      const type = attachment.type || blob.type || '';
      const kind = type.startsWith('image/') ? 'image' : (type === 'application/pdf' ? 'pdf' : 'text');
      const text = kind === 'text' ? await blob.text() : undefined;

      setPreview((current) => {
        if (current?.url) URL.revokeObjectURL(current.url);
        return { attachment, url, kind, text };
      });
    } catch {
      window.alert('文件预览失败，请稍后再试');
    } finally {
      setIsPreviewLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/40 backdrop-blur-xl"
        />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 30 }}
            className="bg-white rounded-[40px] w-full max-w-2xl relative shadow-2xl overflow-hidden border border-black/[0.03] flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="px-10 py-8 border-b border-black/[0.02] flex items-center justify-between bg-[#fbfbfd] shrink-0">
              <div className="flex items-center gap-6">
                <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center text-white">
                  <FileText size={24} strokeWidth={2.5} />
                </div>
                <div>
                  <h2 className="text-[22px] font-black tracking-tight text-black uppercase">卷宗详情</h2>
                  <p className="text-[10px] font-black text-medium-gray tracking-[0.16em] uppercase mt-1">流水识别码: {record.id.split('-')[1]}</p>
                </div>
              </div>
              <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/[0.05] transition-colors text-medium-gray">
                <X size={20} strokeWidth={3} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar p-12 space-y-16">
              {/* Context Grid */}
              <div className="grid grid-cols-2 gap-x-16 gap-y-10">
                <div className="flex flex-col gap-2">
                  <p className="text-[10px] font-black text-medium-gray uppercase tracking-[0.16em]">功能类型</p>
                  <p className="text-[17px] font-black text-black tracking-tight leading-none">{record.approvalTypeName}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <p className="text-[10px] font-black text-medium-gray uppercase tracking-[0.16em]">业务模块</p>
                  <p className="text-[17px] font-black text-black tracking-tight leading-none">{record.moduleName}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <p className="text-[10px] font-black text-medium-gray uppercase tracking-[0.16em]">发起主体</p>
                  <p className="text-[17px] font-black text-black tracking-tight leading-none">{record.applicant}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <p className="text-[10px] font-black text-medium-gray uppercase tracking-[0.16em]">时间戳</p>
                  <p className="text-[17px] font-black text-black tracking-tighter leading-none font-mono uppercase">{format(new Date(record.createdAt), 'yyyy.MM.dd // HH:mm')}</p>
                </div>
              </div>

              {/* Approval Result if processed */}
              {(record.status === ApprovalStatus.APPROVED || record.status === ApprovalStatus.REJECTED) && (
                <div className={cn(
                  "p-8 rounded-[32px] border relative overflow-hidden",
                  record.status === ApprovalStatus.APPROVED ? "bg-black text-white border-black" : "bg-[#fff1f0]/20 border-rose-100"
                )}>
                  {record.status === ApprovalStatus.APPROVED && (
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl" />
                  )}
                  <div className="flex items-center justify-between relative">
                    <div className="flex items-center gap-5">
                      <div className={cn(
                        "w-10 h-10 rounded-2xl flex items-center justify-center",
                        record.status === ApprovalStatus.APPROVED ? "bg-white text-black" : "bg-rose-500 text-white"
                      )}>
                        {record.status === ApprovalStatus.APPROVED ? <ShieldCheck size={20} strokeWidth={2.5} /> : <AlertCircle size={20} strokeWidth={2.5} />}
                      </div>
                      <div>
                        <p className={cn("text-[16px] font-black uppercase tracking-tight", record.status === ApprovalStatus.APPROVED ? "text-white" : "text-black")}>
                          {record.status === ApprovalStatus.APPROVED ? '核准通过' : '校验失败'}
                        </p>
                        <p className={cn("text-[10px] font-black uppercase tracking-[0.16em]", record.status === ApprovalStatus.APPROVED ? "text-white/70" : "text-medium-gray")}>裁定结果已存证</p>
                      </div>
                    </div>
                    <span className={cn("text-[10px] font-black font-mono uppercase tracking-widest", record.status === ApprovalStatus.APPROVED ? "text-white/70" : "text-medium-gray")}>
                      {record.approvedAt || record.rejectedAt ? format(new Date(record.approvedAt || record.rejectedAt || ''), 'HH:mm:ss') : ''}
                    </span>
                  </div>
                  {record.rejectReason && (
                    <div className="mt-6 pt-6 border-t border-black/5">
                      <p className="text-[10px] font-black text-medium-gray uppercase tracking-widest mb-2">异常日志追踪</p>
                      <p className="text-[15px] font-bold text-rose-600 leading-tight italic">"{record.rejectReason}"</p>
                    </div>
                  )}
                </div>
              )}

              {/* Business Data */}
              <div className="space-y-8">
                <div className="flex items-center gap-4">
                  <div className="h-px bg-black/[0.05] flex-1" />
                  <h3 className="text-[10px] font-black text-medium-gray uppercase tracking-[0.22em] whitespace-nowrap">业务数据资产</h3>
                  <div className="h-px bg-black/[0.05] flex-1" />
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {Object.entries(record.businessData).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between gap-6 p-7 bg-[#fbfbfd] rounded-[24px] group border border-transparent hover:border-black/[0.02] hover:bg-white transition-all">
                      <span className="text-[11px] font-black text-medium-gray uppercase tracking-[0.16em]">{key}</span>
                      {isAttachmentList(value) ? (
                        <div className="min-w-0 flex flex-col items-end gap-2">
                          {value.map((attachment) => (
                            <div key={attachment.id} className="max-w-full flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => void handleAttachmentPreview(attachment)}
                                className="min-w-0 h-9 px-3 rounded-full bg-white border border-black/[0.06] text-[13px] font-bold text-black hover:border-black/[0.16] hover:bg-canvas-white transition-all flex items-center gap-2"
                              >
                                <Eye size={14} strokeWidth={2.5} className="shrink-0" />
                                <span className="truncate">{attachment.name}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleAttachmentDownload(attachment)}
                                className="w-9 h-9 rounded-full bg-white border border-black/[0.06] text-medium-gray hover:text-black hover:border-black/[0.16] hover:bg-canvas-white transition-all flex items-center justify-center"
                                title="下载附件"
                              >
                                <Download size={14} strokeWidth={2.5} />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[17px] font-black text-black tracking-tight text-right break-all">{String(value)}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Audit Log */}
              <div className="overflow-hidden rounded-[40px] bg-white border border-black/[0.03] shadow-xl shadow-black/[0.04]">
                <div className="px-10 py-8 border-b border-black/[0.02] flex items-center justify-between bg-[#fbfbfd]">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-black rounded-2xl flex items-center justify-center">
                      <CheckCircle2 className="text-white w-5 h-5" strokeWidth={3} />
                    </div>
                    <h3 className="text-[20px] font-black text-black tracking-tight uppercase">审批流进度汇总</h3>
                  </div>
                </div>
                <div className="p-12">
                  <div className="space-y-0 relative">
                    {approvalTimeline.map((step, idx) => (
                      <div key={idx} className="relative flex gap-8 pb-16 last:pb-0">
                        {idx !== approvalTimeline.length - 1 && (
                          <div className={cn(
                            "absolute top-10 left-5 w-[1.5px] h-full transition-all duration-700",
                            step.state === 'done' ? "bg-black" : "bg-slate-100"
                          )} />
                        )}

                        <div className="shrink-0 z-10">
                          <div className={cn(
                            "w-10 h-10 rounded-2xl flex items-center justify-center border-2 transition-all duration-500",
                            step.state === 'done' ? "bg-black border-black text-white" :
                            (step.state === 'active' ? "bg-white border-black text-black shadow-xl shadow-black/10" :
                            (step.state === 'failed' ? "bg-rose-500 border-rose-500 text-white" : "bg-white border-border-silver text-light-gray"))
                          )}>
                            {step.state === 'done' && <Check size={18} strokeWidth={3} />}
                            {step.state === 'active' && <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 4, ease: 'linear' }}><Clock size={18} strokeWidth={3} /></motion.div>}
                            {step.state === 'failed' && <X size={18} strokeWidth={3} />}
                            {step.state === 'pending' && <div className="w-2 h-2 rounded-full bg-slate-100" />}
                          </div>
                        </div>

                        <div className="flex flex-col gap-1.5 pt-1.5">
                          <h4 className={cn(
                            "text-[15px] font-black uppercase tracking-tight",
                            step.state === 'pending' ? "text-medium-gray" : "text-black"
                          )}>{step.title}</h4>
                          <p className="text-[12px] font-bold text-medium-gray">{step.desc}</p>
                          {step.time && (
                            <p className="text-[10px] font-black text-light-gray font-mono mt-2 uppercase tracking-widest">
                              {format(new Date(step.time), 'yyyy.MM.dd // HH:mm:ss')}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-8 bg-[#fbfbfd] border-t border-black/[0.02] flex items-center justify-center">
                  <span className="text-[9px] font-black text-medium-gray uppercase tracking-[0.24em]">由 Matrix Core 驱动解析</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-10 py-8 bg-[#fbfbfd] border-t border-black/[0.02] shrink-0">
              {canReview ? (
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3">
                  <button
                    onClick={() => onApprove?.(record)}
                    className="h-14 bg-[#2e7d32] text-white text-[13px] font-black rounded-2xl hover:bg-[#256629] transition-all shadow-xl shadow-[#2e7d32]/10 flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 size={18} strokeWidth={2.5} />
                    通过审批
                  </button>
                  <button
                    onClick={() => onReject?.(record)}
                    className="h-14 bg-[#c62828] text-white text-[13px] font-black rounded-2xl hover:bg-[#a52121] transition-all shadow-xl shadow-[#c62828]/10 flex items-center justify-center gap-2"
                  >
                    <XCircle size={18} strokeWidth={2.5} />
                    驳回申请
                  </button>
                  <button
                    onClick={onClose}
                    className="h-14 px-6 bg-white border border-black/[0.06] text-medium-gray text-[13px] font-black rounded-2xl hover:text-black hover:border-black/[0.12] transition-all"
                  >
                    关闭
                  </button>
                </div>
              ) : (
                <button 
                  onClick={onClose} 
                  className="w-full h-14 bg-black text-white text-[12px] font-black uppercase tracking-[0.3em] rounded-2xl hover:bg-black/90 transition-all shadow-2xl shadow-black/20"
                >
                  确认并退出
                </button>
              )}
            </div>
        </motion.div>

        <AnimatePresence>
          {(preview || isPreviewLoading) && (
            <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={closePreview}
                className="absolute inset-0 bg-black/60 backdrop-blur-xl"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 20 }}
                className="relative w-full max-w-5xl h-[86vh] bg-white rounded-[32px] shadow-2xl overflow-hidden flex flex-col"
              >
                <div className="h-16 px-6 border-b border-black/[0.06] flex items-center justify-between shrink-0">
                  <div className="min-w-0 flex flex-col">
                    <span className="text-[14px] font-black text-black truncate">{preview?.attachment.name || '附件预览'}</span>
                    <span className="text-[10px] font-black text-medium-gray uppercase tracking-widest">附件预览</span>
                  </div>
                  <button onClick={closePreview} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/[0.05] text-medium-gray hover:text-black transition-colors">
                    <X size={20} strokeWidth={3} />
                  </button>
                </div>

                <div className="flex-1 bg-[#f5f5f7] overflow-hidden">
                  {isPreviewLoading && !preview ? (
                    <div className="h-full flex items-center justify-center text-[14px] font-bold text-medium-gray">加载中...</div>
                  ) : preview?.kind === 'image' ? (
                    <div className="h-full w-full flex items-center justify-center p-6">
                      <img src={preview.url} alt={preview.attachment.name} className="max-h-full max-w-full object-contain rounded-2xl shadow-xl shadow-black/10" />
                    </div>
                  ) : preview?.kind === 'pdf' ? (
                    <iframe src={preview.url} title={preview.attachment.name} className="h-full w-full bg-white" />
                  ) : preview?.kind === 'text' ? (
                    <pre className="h-full w-full overflow-auto bg-white p-8 text-[13px] leading-6 text-black whitespace-pre-wrap">{preview.text}</pre>
                  ) : (
                    <div className="h-full flex items-center justify-center text-[14px] font-bold text-medium-gray">该文件类型不支持预览</div>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </AnimatePresence>
  );
}
