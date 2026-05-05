import React from 'react';
import { ApprovalRecord, ApprovalStatus } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { X, FileText, User, Layout, ShieldCheck, AlertCircle, Info, History } from 'lucide-react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

interface ApprovalDetailModalProps {
  record: ApprovalRecord | null;
  onClose: () => void;
}

export default function ApprovalDetailModal({ record, onClose }: ApprovalDetailModalProps) {
  if (!record) return null;

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
                  <p className="text-[9px] font-black text-slate-300 tracking-[0.2em] uppercase mt-1">流水识别码: {record.id.split('-')[1]}</p>
                </div>
              </div>
              <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/[0.05] transition-colors text-slate-300">
                <X size={20} strokeWidth={3} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar p-12 space-y-16">
              {/* Context Grid */}
              <div className="grid grid-cols-2 gap-x-16 gap-y-10">
                <div className="flex flex-col gap-2">
                  <p className="text-[9px] font-black text-slate-200 uppercase tracking-[0.2em]">功能类型</p>
                  <p className="text-[17px] font-black text-black tracking-tight leading-none">{record.approvalTypeName}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <p className="text-[9px] font-black text-slate-200 uppercase tracking-[0.2em]">业务模块</p>
                  <p className="text-[17px] font-black text-black tracking-tight leading-none">{record.moduleName}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <p className="text-[9px] font-black text-slate-200 uppercase tracking-[0.2em]">发起主体</p>
                  <p className="text-[17px] font-black text-black tracking-tight leading-none">{record.applicant}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <p className="text-[9px] font-black text-slate-200 uppercase tracking-[0.2em]">时间戳</p>
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
                        <p className={cn("text-[9px] font-black uppercase tracking-[0.2em]", record.status === ApprovalStatus.APPROVED ? "text-white/40" : "text-slate-300")}>裁定结果已存证</p>
                      </div>
                    </div>
                    <span className={cn("text-[10px] font-black font-mono uppercase tracking-widest", record.status === ApprovalStatus.APPROVED ? "text-white/30" : "text-slate-300")}>
                      {record.approvedAt || record.rejectedAt ? format(new Date(record.approvedAt || record.rejectedAt || ''), 'HH:mm:ss') : ''}
                    </span>
                  </div>
                  {record.rejectReason && (
                    <div className="mt-6 pt-6 border-t border-black/5">
                      <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-2">异常日志追踪</p>
                      <p className="text-[15px] font-bold text-rose-600 leading-tight italic">"{record.rejectReason}"</p>
                    </div>
                  )}
                </div>
              )}

              {/* Business Data */}
              <div className="space-y-8">
                <div className="flex items-center gap-4">
                  <div className="h-px bg-black/[0.05] flex-1" />
                  <h3 className="text-[10px] font-black text-slate-200 uppercase tracking-[0.3em] whitespace-nowrap">业务数据资产</h3>
                  <div className="h-px bg-black/[0.05] flex-1" />
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {Object.entries(record.businessData).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between p-7 bg-[#fbfbfd] rounded-[24px] group border border-transparent hover:border-black/[0.02] hover:bg-white transition-all">
                      <span className="text-[11px] font-black text-slate-300 uppercase tracking-[0.2em]">{key}</span>
                      <span className="text-[17px] font-black text-black tracking-tight">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Audit Log */}
              <div className="space-y-8">
                <div className="flex items-center gap-4">
                  <div className="h-px bg-black/[0.05] flex-1" />
                  <h3 className="text-[10px] font-black text-slate-200 uppercase tracking-[0.3em] whitespace-nowrap">流程审计链</h3>
                  <div className="h-px bg-black/[0.05] flex-1" />
                </div>
                <div className="space-y-6 relative ml-4 border-l-[1.5px] border-black/[0.02] pl-10 py-2">
                  {record.logs.map((log, idx) => (
                    <div key={idx} className="relative group">
                      <div className="absolute -left-[49px] top-1 w-4.5 h-4.5 rounded-2xl border-[1.5px] border-white bg-slate-100 group-hover:bg-black group-hover:border-black transition-all duration-500" />
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-baseline justify-between gap-10">
                          <span className="text-[15px] font-black text-black uppercase tracking-tight leading-none">{log.action}</span>
                          <span className="text-[10px] font-black text-slate-200 font-mono tracking-widest uppercase">{format(new Date(log.time), 'HH:mm:ss')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest opacity-40">执行主体</span>
                          <span className="text-[13px] font-black text-black tracking-tight">{log.user}</span>
                        </div>
                        {log.details && (
                          <div className="mt-1 p-3 bg-[#fbfbfd] rounded-xl text-[12px] font-bold text-slate-400 italic">
                            {log.details}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-10 py-8 bg-[#fbfbfd] border-t border-black/[0.02] shrink-0">
              <button 
                onClick={onClose} 
                className="w-full h-14 bg-black text-white text-[12px] font-black uppercase tracking-[0.3em] rounded-2xl hover:bg-black/90 transition-all shadow-2xl shadow-black/20"
              >
                确认并退出
              </button>
            </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
