import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle2, Clock, Check } from 'lucide-react';
import { ApprovalMode, ApprovalRecord, ApprovalStatus, WorkflowApproverSnapshot } from '../types';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import ApprovalParallelApprovers from './ApprovalParallelApprovers';

interface ApprovalProgressModalProps {
  record: ApprovalRecord | null;
  onClose: () => void;
}

type ProgressStepStatus = 'completed' | 'current' | 'failed' | 'pending';

interface ProgressStep {
  title: string;
  desc: string;
  time?: string;
  status: ProgressStepStatus;
  approvers?: WorkflowApproverSnapshot[];
  approvalMode?: ApprovalMode;
  isFinal?: boolean;
}

function getApprovalModeDesc(mode?: ApprovalMode) {
  return mode === 'all_of' ? '通过方式：所有人都要通过' : '通过方式：任意一人通过';
}

function getCcProgressStep(record: ApprovalRecord): ProgressStep | null {
  const recipients = record.ccRecipients || [];
  if (recipients.length === 0) return null;

  const recipientNames = recipients.map((recipient) => recipient.name).filter(Boolean).join('、');
  const isFinished = record.status === ApprovalStatus.APPROVED || record.status === ApprovalStatus.REJECTED;

  return {
    title: '抄送',
    desc: isFinished ? `已同步给：${recipientNames}` : `流程结束后同步给：${recipientNames}`,
    time: isFinished ? (record.approvedAt || record.rejectedAt) : undefined,
    status: isFinished ? 'completed' : 'pending'
  };
}

export default function ApprovalProgressModal({ record, onClose }: ApprovalProgressModalProps) {
  if (!record) return null;

  const workflowSteps = record.workflowInstance?.steps;
  const ccProgressStep = getCcProgressStep(record);
  const steps: ProgressStep[] = workflowSteps?.length
    ? [
        {
          title: '发起申请',
          desc: `发起人：${record.applicant}`,
          time: record.createdAt,
          status: 'completed'
        },
        ...workflowSteps.map((step): ProgressStep => ({
          title: step.name,
          desc: [
            `审批人：${step.approvers.map((approver) => approver.name).join('、') || '未解析'}`,
            step.approvers.length > 1 ? getApprovalModeDesc(step.approvalMode) : '',
            step.actedByName ? `操作人：${step.actedByName}` : '',
            step.comment ? `意见：${step.comment}` : '',
          ].filter(Boolean).join(' ｜ '),
          time: step.actedAt,
          approvers: step.approvers || [],
          approvalMode: step.approvalMode,
          status: step.status === 'approved' || step.status === 'skipped'
            ? 'completed'
            : (step.status === 'pending' ? 'current' : (step.status === 'rejected' ? 'failed' : 'pending')),
        })),
        ...(ccProgressStep ? [ccProgressStep] : []),
        {
          title: record.status === ApprovalStatus.REJECTED ? '审批驳回' : '审批完成',
          desc: record.status === ApprovalStatus.APPROVED
            ? '审批流程已通过'
            : (record.status === ApprovalStatus.REJECTED ? '审批流程已被拒绝' : '等待最终审批结果'),
          time: record.approvedAt || record.rejectedAt,
          status: record.status === ApprovalStatus.APPROVED
            ? 'completed'
            : (record.status === ApprovalStatus.REJECTED ? 'failed' : 'pending'),
          isFinal: true,
        },
      ]
    : [
        {
          title: '发起申请',
          desc: `发起人：${record.applicant}`,
          time: record.createdAt,
          status: 'completed'
        },
        {
          title: '审批人处理',
          desc: record.status === ApprovalStatus.PENDING ? '待审批人处理' : (record.approver ? `审批人：${record.approver}` : '处理完成'),
          time: record.approvedAt || record.rejectedAt,
          status: record.status === ApprovalStatus.PENDING ? 'current' : 'completed'
        },
        ...(ccProgressStep ? [ccProgressStep] : []),
        {
          title: '审批通过',
          desc: record.status === ApprovalStatus.APPROVED ? '审批流程顺利结束' : (record.status === ApprovalStatus.REJECTED ? '审批流程已被拒绝' : '待处理'),
          time: record.approvedAt || record.rejectedAt,
          status: record.status === ApprovalStatus.APPROVED ? 'completed' : (record.status === ApprovalStatus.REJECTED ? 'failed' : 'pending'),
          isFinal: true,
        }
      ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 30 }}
          className="bg-white rounded-[40px] w-full max-w-md relative flex flex-col shadow-2xl overflow-hidden border border-black/[0.03]"
        >
          <div className="px-10 py-8 border-b border-black/[0.02] flex items-center justify-between bg-[#fbfbfd]">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-black rounded-2xl flex items-center justify-center">
                <CheckCircle2 className="text-white w-5 h-5" strokeWidth={3} />
              </div>
              <h2 className="text-[20px] font-black text-black tracking-tight uppercase">审批流进度汇总</h2>
            </div>
            <button onClick={onClose} className="w-10 h-10 flex items-center justify-center hover:bg-black/[0.05] rounded-full transition-all text-medium-gray">
              <X size={20} strokeWidth={2.5} />
            </button>
          </div>

          <div className="p-12">
            <div className="space-y-0 relative">
              {steps.map((step, idx) => (
                <div key={idx} className="relative flex gap-8 pb-16 last:pb-0">
                  {/* Line */}
                  {idx !== steps.length - 1 && (
                    <div className={cn(
                      "absolute top-10 left-5 w-[1.5px] h-full transition-all duration-700",
                      step.status === 'completed' ? "bg-black" : "bg-slate-100"
                    )} />
                  )}

                  {/* Icon Container */}
                  <div className="shrink-0 z-10">
                    <div className={cn(
                      "w-10 h-10 rounded-2xl flex items-center justify-center border-2 transition-all duration-500",
                      step.isFinal && step.status === 'completed' ? "bg-[#2e7d32] border-[#2e7d32] text-white" :
                      step.status === 'completed' ? "bg-black border-black text-white" : 
                      (step.status === 'current' ? "bg-white border-black text-black shadow-xl shadow-black/10" : 
                      (step.status === 'failed' ? "bg-rose-500 border-rose-500 text-white" : "bg-white border-border-silver text-light-gray"))
                    )}>
                      {step.status === 'completed' && <Check size={18} strokeWidth={3} />}
                      {step.status === 'current' && <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 4, ease: 'linear' }}><Clock size={18} strokeWidth={3} /></motion.div>}
                      {step.status === 'failed' && <X size={18} strokeWidth={3} />}
                      {step.status === 'pending' && <div className="w-2 h-2 rounded-full bg-slate-100" />}
                    </div>
                  </div>

                  {/* Text Content */}
                  <div className="flex flex-col gap-1.5 pt-1.5">
                    <h3 className={cn(
                      "text-[15px] font-black uppercase tracking-tight",
                      step.status === 'completed' ? "text-black" : (step.status === 'current' ? "text-black" : "text-medium-gray")
                    )}>{step.title}</h3>
                    <p className="text-[12px] font-bold text-medium-gray">{step.desc}</p>
                    {step.approvers && step.approvers.length > 1 && (
                      <ApprovalParallelApprovers approvers={step.approvers} title={step.title} approvalMode={step.approvalMode} />
                    )}
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
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
