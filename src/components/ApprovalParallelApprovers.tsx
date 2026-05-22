import React from 'react';
import { motion } from 'motion/react';
import { Check, Clock, Lock, X } from 'lucide-react';
import { ApprovalMode, WorkflowApproverSnapshot, WorkflowStepStatus } from '../types';
import { cn } from '../lib/utils';

interface ApprovalParallelApproversProps {
  approvers: WorkflowApproverSnapshot[];
  title: string;
  approvalMode?: ApprovalMode;
  stepStatus?: WorkflowStepStatus;
}

function getApprovalModeLabel(mode?: ApprovalMode) {
  return mode === 'all_of' ? '所有人通过' : '任意一人通过';
}

function isApproverClosed(approver: WorkflowApproverSnapshot, approvalMode?: ApprovalMode, stepStatus?: WorkflowStepStatus) {
  return approver.status === 'closed' || (
    approvalMode === 'one_of'
    && stepStatus === 'approved'
    && (!approver.status || approver.status === 'pending')
  );
}

function getApproverStatusLabel(approver: WorkflowApproverSnapshot, approvalMode?: ApprovalMode, stepStatus?: WorkflowStepStatus) {
  if (approver.status === 'approved') return '已同意';
  if (approver.status === 'rejected') return '已拒绝';
  if (isApproverClosed(approver, approvalMode, stepStatus)) return '已关闭';
  return '待处理';
}

function getApproverStatusStyle(approver: WorkflowApproverSnapshot, approvalMode?: ApprovalMode, stepStatus?: WorkflowStepStatus) {
  if (approver.status === 'approved') {
    return {
      card: 'border-[#2e7d32]/15 bg-[#f1f8f2] text-[#1b5e20]',
      dot: 'bg-[#2e7d32] text-white',
      line: 'bg-[#2e7d32]',
    };
  }

  if (approver.status === 'rejected') {
    return {
      card: 'border-rose-500/15 bg-rose-50 text-rose-700',
      dot: 'bg-rose-500 text-white',
      line: 'bg-rose-500',
    };
  }

  if (isApproverClosed(approver, approvalMode, stepStatus)) {
    return {
      card: 'border-slate-200 bg-slate-50 text-medium-gray',
      dot: 'bg-slate-100 text-medium-gray border border-slate-200',
      line: 'bg-slate-200',
    };
  }

  return {
    card: 'border-black/[0.06] bg-white text-medium-gray',
    dot: 'bg-white text-medium-gray border border-border-silver',
    line: 'bg-slate-200',
  };
}

export default function ApprovalParallelApprovers({ approvers, title, approvalMode, stepStatus }: ApprovalParallelApproversProps) {
  if (approvers.length <= 1) return null;

  return (
    <div className="mt-4 w-full max-w-[520px]">
      <div className="mb-2 inline-flex h-7 items-center rounded-full bg-black px-3 text-[11px] font-black text-white">
        {getApprovalModeLabel(approvalMode)}
      </div>
      <div className="relative flex items-stretch gap-3 overflow-x-auto pb-1 pt-5">
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="absolute left-8 right-8 top-[28px] h-[1.5px] origin-left bg-black/15"
        />
        {approvers.map((approver, index) => {
          const style = getApproverStatusStyle(approver, approvalMode, stepStatus);
          const isClosed = isApproverClosed(approver, approvalMode, stepStatus);

          return (
            <motion.div
              key={`${title}-${approver.memberId || approver.name}-${index}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: index * 0.08, ease: 'easeOut' }}
              className="relative min-w-[132px] flex-1"
            >
              <div className={cn('mx-auto mb-2 h-4 w-[1.5px]', style.line)} />
              <div
                className={cn(
                  'relative rounded-2xl border px-3 py-3 shadow-sm transition-all duration-300',
                  style.card,
                )}
              >
                <div className={cn('absolute -top-5 left-1/2 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-2xl shadow-sm', style.dot)}>
                  {approver.status === 'approved' && <Check size={15} strokeWidth={3} />}
                  {approver.status === 'rejected' && <X size={15} strokeWidth={3} />}
                  {isClosed && <Lock size={14} strokeWidth={3} />}
                  {!isClosed && (!approver.status || approver.status === 'pending') ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 4, ease: 'linear' }}>
                      <Clock size={14} strokeWidth={3} />
                    </motion.div>
                  ) : null}
                </div>
                <div className="pt-2">
                  <p className="truncate text-center text-[12px] font-black text-black">{approver.name || '未解析'}</p>
                  <p className="mt-1 text-center text-[10px] font-black uppercase tracking-widest">{getApproverStatusLabel(approver, approvalMode, stepStatus)}</p>
                  {approver.comment && (
                    <p className="mt-2 line-clamp-2 text-center text-[10px] font-bold text-medium-gray">{approver.comment}</p>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
