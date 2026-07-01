import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle2, Clock, Check } from 'lucide-react';
import { ApprovalMode, ApprovalRecord, ApprovalStatus, WorkflowApproverSnapshot, WorkflowStepStatus } from '../types';
import { cn } from '../lib/utils';
import { formatLocalDateTime } from '../lib/time';
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
  stepStatus?: WorkflowStepStatus;
  isFinal?: boolean;
}

function getApprovalModeDesc(mode?: ApprovalMode) {
  return mode === 'all_of' ? '通过方式：所有人都要通过' : '通过方式：任意一人通过';
}

function getCcProgressStep(record: ApprovalRecord): ProgressStep | null {
  const recipients = record.ccRecipients || [];
  if (recipients.length === 0) return null;

  const recipientNames = recipients.map((recipient) => recipient.name).filter(Boolean).join('、');
  const isFinished = record.status === ApprovalStatus.APPROVED || record.status === ApprovalStatus.COMPLETED || record.status === ApprovalStatus.REJECTED;

  return {
    title: '抄送',
    desc: isFinished ? `已同步给：${recipientNames}` : `流程结束后同步给：${recipientNames}`,
    time: isFinished ? (record.approvedAt || record.rejectedAt) : undefined,
    status: isFinished ? 'completed' : 'pending'
  };
}

function getProcessorProgressStep(record: ApprovalRecord): ProgressStep | null {
  const processors = record.processors || [];
  if (processors.length === 0) return null;

  const processorNames = processors.map((processor) => processor.name).filter(Boolean).join('、');
  const isCompleted = record.status === ApprovalStatus.COMPLETED;

  return {
    title: record.processorTaskName || '办理任务',
    desc: isCompleted
      ? `办理人：${record.processedBy || processorNames || '未记录'} 已完成`
      : `待办理人处理：${processorNames || '未解析'}`,
    time: record.processedAt,
    status: isCompleted ? 'completed' : (record.status === ApprovalStatus.PROCESSING ? 'current' : 'pending')
  };
}

function isProcessorWorkflowStep(step: NonNullable<ApprovalRecord['workflowInstance']>['steps'][number]) {
  return step.stepType === 'processor' || Boolean(step.processors?.length);
}

function getWorkflowProgressStep(step: NonNullable<ApprovalRecord['workflowInstance']>['steps'][number]): ProgressStep {
  if (isProcessorWorkflowStep(step)) {
    const processors = step.processors || [];
    const processorNames = processors.map((processor) => processor.name).filter(Boolean).join('、');
    const completedBy = step.actedByName || processors.find((processor) => processor.status === 'completed')?.name;

    return {
      title: step.processorTaskName || step.name || '办理任务',
      desc: step.status === 'approved'
        ? `办理人：${completedBy || processorNames || '未记录'} 已完成`
        : `待办理人处理：${processorNames || '未解析'}`,
      time: step.actedAt,
      stepStatus: step.status,
      status: step.status === 'approved' || step.status === 'skipped'
        ? 'completed'
        : (step.status === 'pending' ? 'current' : (step.status === 'rejected' ? 'failed' : 'pending')),
    };
  }

  return {
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
    stepStatus: step.status,
    status: step.status === 'approved' || step.status === 'skipped'
      ? 'completed'
      : (step.status === 'pending' ? 'current' : (step.status === 'rejected' ? 'failed' : 'pending')),
  };
}

export default function ApprovalProgressModal({ record, onClose }: ApprovalProgressModalProps) {
  if (!record) return null;

  const workflowSteps = record.workflowInstance?.steps;
  const hasWorkflowProcessorStep = Boolean(workflowSteps?.some(isProcessorWorkflowStep));
  const processorProgressStep = hasWorkflowProcessorStep ? null : getProcessorProgressStep(record);
  const ccProgressStep = getCcProgressStep(record);
  const steps: ProgressStep[] = workflowSteps?.length
    ? [
        {
          title: '发起申请',
          desc: `发起人：${record.applicant}`,
          time: record.createdAt,
          status: 'completed'
        },
        ...workflowSteps.map(getWorkflowProgressStep),
        ...(processorProgressStep ? [processorProgressStep] : []),
        ...(ccProgressStep ? [ccProgressStep] : []),
        {
          title: record.status === ApprovalStatus.REJECTED ? '审批驳回' : (record.status === ApprovalStatus.COMPLETED ? '办理完成' : '审批完成'),
          desc: record.status === ApprovalStatus.APPROVED || record.status === ApprovalStatus.COMPLETED
            ? '流程已结束'
            : (record.status === ApprovalStatus.PROCESSING ? '审批已通过，等待办理完成' : (record.status === ApprovalStatus.REJECTED ? '审批流程已被拒绝' : '等待最终审批结果')),
          time: record.processedAt || record.approvedAt || record.rejectedAt,
          status: record.status === ApprovalStatus.APPROVED || record.status === ApprovalStatus.COMPLETED
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
        ...(processorProgressStep ? [processorProgressStep] : []),
        ...(ccProgressStep ? [ccProgressStep] : []),
        {
          title: record.status === ApprovalStatus.COMPLETED ? '办理完成' : '审批通过',
          desc: record.status === ApprovalStatus.APPROVED || record.status === ApprovalStatus.COMPLETED
            ? '流程顺利结束'
            : (record.status === ApprovalStatus.PROCESSING ? '审批已通过，等待办理完成' : (record.status === ApprovalStatus.REJECTED ? '审批流程已被拒绝' : '待处理')),
          time: record.processedAt || record.approvedAt || record.rejectedAt,
          status: record.status === ApprovalStatus.APPROVED || record.status === ApprovalStatus.COMPLETED ? 'completed' : (record.status === ApprovalStatus.REJECTED ? 'failed' : 'pending'),
          isFinal: true,
        }
      ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/25 backdrop-blur-[2px]"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 36 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 36 }}
          className="relative flex max-h-[88dvh] w-full max-w-md flex-col overflow-hidden rounded-t-[24px] border border-white/70 bg-white shadow-[0_-4px_18px_rgba(15,23,42,0.055)] sm:rounded-[22px] sm:shadow-[0_10px_30px_rgba(15,23,42,0.11)]"
        >
          <div className="border-b border-black/[0.045] bg-white px-4 pb-3.5 pt-2.5 sm:px-6 sm:pt-3.5">
            <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-black/[0.12] sm:hidden" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-[11px] bg-[#eef5ff] text-[#1677ff]">
                <CheckCircle2 className="h-5 w-5" strokeWidth={2.5} />
              </div>
              <h2 className="text-[17px] font-semibold tracking-tight text-midnight-graphite">审批流进度汇总</h2>
              </div>
              <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full text-medium-gray transition-colors hover:bg-[#f5f6f8] hover:text-midnight-graphite">
                <X size={20} strokeWidth={2.5} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-8 sm:py-7">
            <div className="relative space-y-0">
              {steps.map((step, idx) => (
                <div key={idx} className="relative flex gap-3.5 pb-8 last:pb-0">
                  {/* Line */}
                  {idx !== steps.length - 1 && (
                    <div className={cn(
                      "absolute left-4 top-8 h-full w-px transition-all duration-700",
                      step.status === 'completed' ? "bg-[#1677ff]/24" : "bg-slate-100"
                    )} />
                  )}

                  {/* Icon Container */}
                  <div className="z-10 shrink-0">
                    <div className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full border transition-all duration-500",
                      step.isFinal && step.status === 'completed' ? "bg-[#1677ff] border-[#1677ff] text-white" :
                      step.status === 'completed' ? "bg-[#1677ff] border-[#1677ff] text-white" :
                      (step.status === 'current' ? "bg-white border-[#1677ff] text-[#1677ff] shadow-[0_6px_16px_rgba(22,119,255,0.10)]" :
                      (step.status === 'failed' ? "bg-rose-500 border-rose-500 text-white" : "bg-white border-border-silver text-light-gray"))
                    )}>
                      {step.status === 'completed' && <Check size={16} strokeWidth={2.7} />}
                      {step.status === 'current' && <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 4, ease: 'linear' }}><Clock size={16} strokeWidth={2.7} /></motion.div>}
                      {step.status === 'failed' && <X size={16} strokeWidth={2.7} />}
                      {step.status === 'pending' && <div className="h-1.5 w-1.5 rounded-full bg-slate-200" />}
                    </div>
                  </div>

                  {/* Text Content */}
                  <div className="min-w-0 flex flex-col gap-1 pt-1">
                    <h3 className={cn(
                      "text-[15px] font-semibold tracking-tight",
                      step.status === 'completed' ? "text-midnight-graphite" : (step.status === 'current' ? "text-midnight-graphite" : "text-medium-gray")
                    )}>{step.title}</h3>
                    <p className="text-[12.5px] font-medium leading-5 text-medium-gray">{step.desc}</p>
                    {step.approvers && step.approvers.length > 1 && (
                      <ApprovalParallelApprovers approvers={step.approvers} title={step.title} approvalMode={step.approvalMode} stepStatus={step.stepStatus} />
                    )}
                    {step.time && (
                      <p className="mt-1.5 font-mono text-[10.5px] font-medium text-light-gray">
                        {formatLocalDateTime(step.time, 'date-time-seconds')}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-black/[0.04] bg-white px-5 py-3">
            <button
              type="button"
              onClick={onClose}
              className="flex h-11 w-full items-center justify-center rounded-full bg-[#1677ff] text-[14px] font-semibold text-white shadow-[0_5px_12px_rgba(22,119,255,0.12)] transition-colors hover:bg-action-blue"
            >
              知道了
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
