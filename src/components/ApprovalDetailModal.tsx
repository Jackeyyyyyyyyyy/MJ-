import React from 'react';
import { ApprovalAttachment, ApprovalMode, ApprovalRecord, ApprovalStatus } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { X, FileText, ShieldCheck, AlertCircle, CheckCircle2, XCircle, Download, Eye, Check, Clock, Sparkles, UserCheck } from 'lucide-react';
import { cn } from '../lib/utils';
import { formatLocalDateTime } from '../lib/time';
import { storage } from '../storage';
import ApprovalParallelApprovers from './ApprovalParallelApprovers';

interface ApprovalDetailModalProps {
  record: ApprovalRecord | null;
  onClose: () => void;
  onApprove?: (record: ApprovalRecord) => void;
  onReject?: (record: ApprovalRecord) => void;
  onCompleteProcess?: (record: ApprovalRecord) => void;
  showAiSuggestion?: boolean;
  showAiRawResponse?: boolean;
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

function isPlainDisplayObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value) && !isAttachmentList(value);
}

function isMoneyDisplayObject(value: unknown): value is { currency?: unknown; amount?: unknown } {
  return !!value
    && typeof value === 'object'
    && !Array.isArray(value)
    && 'currency' in value
    && 'amount' in value;
}

function formatMoneyDisplay(value: { currency?: unknown; amount?: unknown }) {
  return [value.currency, value.amount].filter((item) => String(item || '').trim()).join(' ');
}

interface PreviewState {
  attachment: ApprovalAttachment;
  url: string;
  kind: 'image' | 'pdf' | 'text';
  text?: string;
}

interface SupplierQuotationInfoValue {
  quotationRows: Array<Record<string, unknown>>;
  attachments: ApprovalAttachment[];
}

interface SupplierInfoChangeValue {
  roleServices: Array<Record<string, unknown>>;
  bankAccounts: Array<Record<string, unknown>>;
  invoiceInfos: Array<Record<string, unknown>>;
}

const batchModifyDetailColumns = [
  { key: 'order', label: '订单' },
  { key: 'containerNo', label: '箱号' },
  { key: 'feeName', label: '费用名' },
  { key: 'originalAmount', label: '原始金额' },
  { key: 'originalSupplier', label: '原始供应商' },
  { key: 'updatedAmount', label: '修改后金额' },
  { key: 'updatedSupplier', label: '修改后供应商' },
];

const fundsReductionDetailColumns = [
  { key: 'order', label: '订单' },
  { key: 'containerNo', label: '箱号' },
  { key: 'feeItem', label: '费用项' },
  { key: 'originalAmount', label: '原始金额' },
  { key: 'reductionAmount', label: '申请减免金额' },
  { key: 'reducedAmount', label: '减免后金额' },
];

const customerBankAccountColumns = [
  { key: 'currencyAccount', label: '币种账户' },
  { key: 'country', label: '所属国家' },
  { key: 'bankName', label: '开户行' },
  { key: 'bankAccount', label: '银行账户' },
];

const customerInvoiceInfoColumns = [
  { key: 'currencyAccount', label: '币种账户' },
  { key: 'invoiceCompanyName', label: '开票公司名称' },
  { key: 'taxNo', label: '税号' },
  { key: 'addressPhone', label: '地址、电话' },
  { key: 'bankAndAccount', label: '开户行及账户' },
];

const supplierRoleServiceColumns = [
  { key: 'role', label: '角色' },
  { key: 'service', label: '服务' },
];

const supplierQuotationColumns = [
  { key: 'truckType', label: '拖车类型' },
  { key: 'pickupPoint', label: '提箱点' },
  { key: 'dropoffPoint', label: '落箱点' },
  { key: 'province', label: '省份' },
  { key: 'city', label: '市' },
  { key: 'county', label: '县' },
  { key: 'priceLimit', label: '报价限制' },
  { key: 'beforeQuote', label: '提交前报价' },
  { key: 'weight', label: '权重' },
  { key: 'afterQuote', label: '提交后报价' },
  { key: 'remark', label: '备注' },
];

function isCustomerInfoChangeValue(value: unknown) {
  return !!value
    && typeof value === 'object'
    && Array.isArray((value as Record<string, unknown>).businessLicense)
    && Array.isArray((value as Record<string, unknown>).bankAccounts)
    && Array.isArray((value as Record<string, unknown>).bankVoucher)
    && Array.isArray((value as Record<string, unknown>).invoiceInfos);
}

function isSupplierQuotationInfoValue(value: unknown): value is SupplierQuotationInfoValue {
  return !!value
    && typeof value === 'object'
    && Array.isArray((value as SupplierQuotationInfoValue).quotationRows)
    && Array.isArray((value as SupplierQuotationInfoValue).attachments);
}

function isSupplierInfoChangeValue(value: unknown): value is SupplierInfoChangeValue {
  return !!value
    && typeof value === 'object'
    && Array.isArray((value as SupplierInfoChangeValue).roleServices)
    && Array.isArray((value as SupplierInfoChangeValue).bankAccounts)
    && Array.isArray((value as SupplierInfoChangeValue).invoiceInfos);
}

function getStructuredDetailColumns(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) return [];

  const matchesColumns = (columns: typeof batchModifyDetailColumns) => value.every((row) => {
    return !!row && typeof row === 'object' && columns.every((column) => column.key in row);
  });

  if (matchesColumns(batchModifyDetailColumns)) return batchModifyDetailColumns;
  if (matchesColumns(fundsReductionDetailColumns)) return fundsReductionDetailColumns;
  return [];
}

function getAiSuggestionDisplay(record: ApprovalRecord) {
  if (!record.aiSuggestion) {
    return {
      text: '历史单据未生成 AI 建议',
      tone: 'neutral',
    };
  }

  if (record.aiSuggestion.status === 'generating') {
    return {
      text: 'AI建议生成中',
      tone: 'neutral',
    };
  }

  if (record.aiSuggestion.status === 'generated') {
    return {
      text: record.aiSuggestion.displayText,
      tone: record.aiSuggestion.riskLevel === '高风险'
        ? 'danger'
        : (record.aiSuggestion.riskLevel === '低风险' ? 'success' : 'warning'),
    };
  }

  return {
    text: record.aiSuggestion.status === 'skipped'
      ? 'AI建议未启用'
      : 'AI建议生成失败，不影响审批处理',
    tone: 'neutral',
  };
}

function getCcTimelineItem(record: ApprovalRecord, finishedAt?: string) {
  const recipients = record.ccRecipients || [];
  if (recipients.length === 0) return null;

  const recipientNames = recipients.map((recipient) => recipient.name).filter(Boolean).join('、');
  const isFinished = record.status === ApprovalStatus.APPROVED || record.status === ApprovalStatus.COMPLETED || record.status === ApprovalStatus.REJECTED;

  return {
    title: '抄送',
    desc: isFinished ? `已同步给：${recipientNames}` : `流程结束后同步给：${recipientNames}`,
    time: isFinished ? finishedAt : undefined,
    state: isFinished ? 'done' : 'pending',
  };
}

function getProcessorTimelineItem(record: ApprovalRecord) {
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
    state: isCompleted ? 'done' : (record.status === ApprovalStatus.PROCESSING ? 'active' : 'pending'),
  };
}

function formatWorkflowStepDesc(step: NonNullable<ApprovalRecord['workflowInstance']>['steps'][number]) {
  return [
    `审批人：${step.approvers.map((approver) => approver.name).join('、') || '未解析'}`,
    step.approvers.length > 1 ? getApprovalModeDesc(step.approvalMode) : '',
    step.actedByName ? `操作人：${step.actedByName}` : '',
    step.comment ? `意见：${step.comment}` : '',
  ].filter(Boolean).join(' ｜ ');
}

function isProcessorWorkflowStep(step: NonNullable<ApprovalRecord['workflowInstance']>['steps'][number]) {
  return step.stepType === 'processor' || Boolean(step.processors?.length);
}

function getWorkflowTimelineItem(step: NonNullable<ApprovalRecord['workflowInstance']>['steps'][number]) {
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
      state: step.status === 'approved' || step.status === 'skipped'
        ? 'done'
        : (step.status === 'pending' ? 'active' : (step.status === 'rejected' ? 'failed' : 'pending')),
    };
  }

  return {
    title: step.name,
    desc: formatWorkflowStepDesc(step),
    time: step.actedAt,
    approvers: step.approvers || [],
    approvalMode: step.approvalMode,
    stepStatus: step.status,
    state: step.status === 'approved' || step.status === 'skipped'
      ? 'done'
      : (step.status === 'pending' ? 'active' : (step.status === 'rejected' ? 'failed' : 'pending')),
  };
}

function getApprovalModeDesc(mode?: ApprovalMode) {
  return mode === 'all_of' ? '通过方式：所有人都要通过' : '通过方式：任意一人通过';
}

export default function ApprovalDetailModal({ record, onClose, onApprove, onReject, onCompleteProcess, showAiSuggestion = false }: ApprovalDetailModalProps) {
  const [preview, setPreview] = React.useState<PreviewState | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = React.useState(false);

  React.useEffect(() => {
    return () => {
      if (preview?.url) URL.revokeObjectURL(preview.url);
    };
  }, [preview?.url]);

  if (!record) return null;

  const canReview = record.status === ApprovalStatus.PENDING && record.currentUserCanApprove !== false && !!onApprove && !!onReject;
  const canProcess = record.status === ApprovalStatus.PROCESSING && record.currentUserCanProcess !== false && !!onCompleteProcess;
  const aiSuggestion = getAiSuggestionDisplay(record);
  const finishedAt = record.processedAt || record.approvedAt || record.rejectedAt;
  const workflowSteps = record.workflowInstance?.steps;
  const hasWorkflowProcessorStep = Boolean(workflowSteps?.some(isProcessorWorkflowStep));
  const processorTimelineItem = hasWorkflowProcessorStep ? null : getProcessorTimelineItem(record);
  const ccTimelineItem = getCcTimelineItem(record, finishedAt);
  const hasResultPanel = [
    ApprovalStatus.PROCESSING,
    ApprovalStatus.APPROVED,
    ApprovalStatus.COMPLETED,
    ApprovalStatus.REJECTED,
  ].includes(record.status);
  const isPositiveResult = record.status !== ApprovalStatus.REJECTED;
  const resultTitle = record.status === ApprovalStatus.PROCESSING
    ? '审批通过，待办理'
    : record.status === ApprovalStatus.COMPLETED
      ? '办理完成'
      : record.status === ApprovalStatus.APPROVED
        ? '核准通过'
        : '校验失败';
  const resultSubtitle = record.status === ApprovalStatus.PROCESSING
    ? `等待${record.processorTaskName || '办理任务'}`
    : record.status === ApprovalStatus.COMPLETED
      ? `${record.processorTaskName || '办理任务'}已完成`
      : '裁定结果已存证';
  const approvalTimeline = workflowSteps?.length
    ? [
        {
          title: '发起申请',
          desc: `发起人：${record.applicant}`,
          time: record.createdAt,
          state: 'done',
        },
        ...workflowSteps.map(getWorkflowTimelineItem),
        ...(processorTimelineItem ? [processorTimelineItem] : []),
        ...(ccTimelineItem ? [ccTimelineItem] : []),
      ]
    : [
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
          desc: record.status === ApprovalStatus.APPROVED || record.status === ApprovalStatus.PROCESSING || record.status === ApprovalStatus.COMPLETED
            ? '审批流程已通过'
            : (record.status === ApprovalStatus.REJECTED ? '审批流程已被拒绝' : '等待最终审批结果'),
          time: record.approvedAt || record.rejectedAt,
          state: record.status === ApprovalStatus.APPROVED || record.status === ApprovalStatus.PROCESSING || record.status === ApprovalStatus.COMPLETED
            ? 'done'
            : (record.status === ApprovalStatus.REJECTED ? 'failed' : 'pending'),
        },
        ...(processorTimelineItem ? [processorTimelineItem] : []),
        ...(ccTimelineItem ? [ccTimelineItem] : []),
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

  const renderAttachmentList = (attachments: ApprovalAttachment[]) => {
    if (attachments.length === 0) {
      return <span className="text-[13px] font-bold text-light-gray">未上传</span>;
    }

    return (
      <div className="flex flex-col items-start gap-2">
        {attachments.map((attachment) => (
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
    );
  };

  const renderCustomerTable = (
    rows: Array<Record<string, unknown>>,
    columns: Array<{ key: string; label: string }>,
  ) => {
    const gridClass = columns.length === 2 ? "grid-cols-2" : (columns.length === 4 ? "grid-cols-4" : "grid-cols-5");
    const minWidth = columns.length === 2 ? "min-w-[520px]" : (columns.length === 4 ? "min-w-[720px]" : "min-w-[960px]");

    return (
      <div className="overflow-x-auto no-scrollbar">
        <div className={cn(
          "overflow-hidden rounded-2xl border border-border-silver bg-white",
          minWidth,
        )}>
          <div className={cn("grid border-b border-border-silver bg-canvas-white", gridClass)}>
            {columns.map((column) => (
              <div key={column.key} className="px-3 py-3 text-[11px] font-black text-medium-gray">
                {column.label}
              </div>
            ))}
          </div>
          {rows.map((row, rowIndex) => (
            <div key={rowIndex} className={cn("grid border-b border-border-silver last:border-b-0", gridClass)}>
              {columns.map((column) => (
                <div key={column.key} className="px-3 py-4 text-[13px] font-bold text-black break-all">
                  {String(row[column.key] || '-')}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderCustomerInfoChange = (value: unknown) => {
    const data = value as {
      businessLicense: ApprovalAttachment[];
      bankAccounts: Array<Record<string, unknown>>;
      bankVoucher: ApprovalAttachment[];
      invoiceInfos: Array<Record<string, unknown>>;
    };

    return (
      <div className="space-y-5">
        <div className="rounded-2xl border border-border-silver bg-white p-4">
          <p className="text-[12px] font-black text-medium-gray uppercase tracking-[0.16em] mb-3">营业执照</p>
          {renderAttachmentList(data.businessLicense)}
        </div>
        <div>
          <p className="text-[12px] font-black text-medium-gray uppercase tracking-[0.16em] mb-3">银行账户</p>
          {renderCustomerTable(data.bankAccounts, customerBankAccountColumns)}
        </div>
        <div className="rounded-2xl border border-border-silver bg-white p-4">
          <p className="text-[12px] font-black text-medium-gray uppercase tracking-[0.16em] mb-3">银行凭证</p>
          {renderAttachmentList(data.bankVoucher)}
        </div>
        <div>
          <p className="text-[12px] font-black text-medium-gray uppercase tracking-[0.16em] mb-3">开票信息</p>
          {renderCustomerTable(data.invoiceInfos, customerInvoiceInfoColumns)}
        </div>
      </div>
    );
  };

  const renderSupplierInfoChange = (value: unknown) => {
    const data = value as SupplierInfoChangeValue;

    return (
      <div className="space-y-5">
        <div>
          <p className="text-[12px] font-black text-medium-gray uppercase tracking-[0.16em] mb-3">角色与服务</p>
          {renderCustomerTable(data.roleServices, supplierRoleServiceColumns)}
        </div>
        <div>
          <p className="text-[12px] font-black text-medium-gray uppercase tracking-[0.16em] mb-3">银行账户</p>
          {renderCustomerTable(data.bankAccounts, customerBankAccountColumns)}
        </div>
        <div>
          <p className="text-[12px] font-black text-medium-gray uppercase tracking-[0.16em] mb-3">开票信息</p>
          {renderCustomerTable(data.invoiceInfos, customerInvoiceInfoColumns)}
        </div>
      </div>
    );
  };

  const renderSupplierQuotationInfo = (value: unknown) => {
    const data = value as SupplierQuotationInfoValue;

    return (
      <div className="space-y-5">
        <div className="overflow-x-auto no-scrollbar">
          <div className="min-w-[1320px] overflow-hidden rounded-2xl border border-border-silver bg-white">
            <div className="grid grid-cols-[1fr_1fr_1fr_0.8fr_0.8fr_0.8fr_1fr_1.1fr_0.8fr_1.1fr_1fr] border-b border-border-silver bg-canvas-white">
              {supplierQuotationColumns.map((column) => (
                <div key={column.key} className="px-3 py-3 text-[11px] font-black text-medium-gray">
                  {column.label}
                </div>
              ))}
            </div>
            {data.quotationRows.map((row, rowIndex) => (
              <div key={rowIndex} className="grid grid-cols-[1fr_1fr_1fr_0.8fr_0.8fr_0.8fr_1fr_1.1fr_0.8fr_1.1fr_1fr] border-b border-border-silver last:border-b-0">
                {supplierQuotationColumns.map((column) => (
                  <div key={column.key} className="px-3 py-4 text-[13px] font-bold text-black break-all">
                    {String(row[column.key] || '-')}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border-silver bg-white p-4">
          <p className="text-[12px] font-black text-medium-gray uppercase tracking-[0.16em] mb-3">报价附件</p>
          {renderAttachmentList(data.attachments)}
        </div>
      </div>
    );
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
                  <p className="text-[17px] font-black text-black tracking-tighter leading-none font-mono uppercase">{formatLocalDateTime(record.createdAt)}</p>
                </div>
              </div>

              {showAiSuggestion && (
                <div className={cn(
                  "p-7 rounded-[24px] border relative overflow-hidden",
                  aiSuggestion.tone === 'danger' && "bg-[#fff1f0]/60 border-rose-100",
                  aiSuggestion.tone === 'warning' && "bg-[#fff7e6]/70 border-[#f5d7a1]",
                  aiSuggestion.tone === 'success' && "bg-[#e8f5e9]/80 border-[#b9dfbd]",
                  aiSuggestion.tone === 'neutral' && "bg-[#fbfbfd] border-black/[0.04]",
                )}>
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-black text-white flex items-center justify-center shrink-0">
                      <Sparkles size={18} strokeWidth={2.5} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-4 mb-2">
                        <p className="text-[10px] font-black text-medium-gray uppercase tracking-[0.16em]">AI审批建议</p>
                        <span className="text-[10px] font-black text-medium-gray uppercase tracking-[0.16em] whitespace-nowrap">仅供参考</span>
                      </div>
                      <p className="text-[16px] font-black text-black leading-snug tracking-tight">
                        {aiSuggestion.text}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Approval Result if processed */}
              {hasResultPanel && (
                <div className={cn(
                  "p-8 rounded-[32px] border relative overflow-hidden",
                  isPositiveResult ? "bg-black text-white border-black" : "bg-[#fff1f0]/20 border-rose-100"
                )}>
                  {isPositiveResult && (
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl" />
                  )}
                  <div className="flex items-center justify-between relative">
                    <div className="flex items-center gap-5">
                      <div className={cn(
                        "w-10 h-10 rounded-2xl flex items-center justify-center",
                        isPositiveResult ? "bg-white text-black" : "bg-rose-500 text-white"
                      )}>
                        {isPositiveResult ? <ShieldCheck size={20} strokeWidth={2.5} /> : <AlertCircle size={20} strokeWidth={2.5} />}
                      </div>
                      <div>
                        <p className={cn("text-[16px] font-black uppercase tracking-tight", isPositiveResult ? "text-white" : "text-black")}>
                          {resultTitle}
                        </p>
                        <p className={cn("text-[10px] font-black uppercase tracking-[0.16em]", isPositiveResult ? "text-white/70" : "text-medium-gray")}>{resultSubtitle}</p>
                      </div>
                    </div>
                    <span className={cn("text-[10px] font-black font-mono uppercase tracking-widest", isPositiveResult ? "text-white/70" : "text-medium-gray")}>
                      {formatLocalDateTime(record.processedAt || record.approvedAt || record.rejectedAt, 'time-seconds')}
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
                    <div
                      key={key}
                      className={cn(
                        "gap-6 p-7 bg-[#fbfbfd] rounded-[24px] group border border-transparent hover:border-black/[0.02] hover:bg-white transition-all",
                        isCustomerInfoChangeValue(value) || isSupplierInfoChangeValue(value) || isSupplierQuotationInfoValue(value) || getStructuredDetailColumns(value).length > 0
                          ? "flex flex-col items-stretch"
                          : "flex items-center justify-between",
                      )}
                    >
                      <span className="text-[11px] font-black text-medium-gray uppercase tracking-[0.16em]">{key}</span>
                      {isCustomerInfoChangeValue(value) ? (
                        renderCustomerInfoChange(value)
                      ) : isSupplierInfoChangeValue(value) ? (
                        renderSupplierInfoChange(value)
                      ) : isSupplierQuotationInfoValue(value) ? (
                        renderSupplierQuotationInfo(value)
                      ) : getStructuredDetailColumns(value).length > 0 ? (
                        <div className="overflow-x-auto no-scrollbar">
                          <div className="min-w-[840px] overflow-hidden rounded-2xl border border-border-silver bg-white">
                            <div
                              className={cn(
                                "grid border-b border-border-silver bg-canvas-white",
                                getStructuredDetailColumns(value).length === 7 ? "grid-cols-7" : "grid-cols-6",
                              )}
                            >
                              {getStructuredDetailColumns(value).map((column) => (
                                <div key={column.key} className="px-3 py-3 text-[11px] font-black text-medium-gray">
                                  {column.label}
                                </div>
                              ))}
                            </div>
                            {value.map((row, rowIndex) => (
                              <div
                                key={rowIndex}
                                className={cn(
                                  "grid border-b border-border-silver last:border-b-0",
                                  getStructuredDetailColumns(value).length === 7 ? "grid-cols-7" : "grid-cols-6",
                                )}
                              >
                                {getStructuredDetailColumns(value).map((column) => (
                                  <div key={column.key} className="px-3 py-4 text-[13px] font-bold text-black break-all">
                                    {String((row as Record<string, unknown>)[column.key] || '-')}
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : isAttachmentList(value) ? (
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
                      ) : isMoneyDisplayObject(value) ? (
                        <span className="text-[17px] font-black text-black tracking-tight text-right break-all">
                          {formatMoneyDisplay(value) || '-'}
                        </span>
                      ) : isPlainDisplayObject(value) ? (
                        <div className="min-w-0 flex flex-col items-end gap-2">
                          {Object.entries(value).map(([itemKey, itemValue]) => (
                            <span key={itemKey} className="text-[15px] font-black text-black tracking-tight text-right break-all">
                              {itemKey}：{String(itemValue || '-')}
                            </span>
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
                          {Array.isArray((step as { approvers?: unknown }).approvers) && (
                            <ApprovalParallelApprovers
                              approvers={(step as unknown as { approvers: NonNullable<ApprovalRecord['workflowInstance']>['steps'][number]['approvers'] }).approvers}
                              title={step.title}
                              approvalMode={(step as { approvalMode?: ApprovalMode }).approvalMode}
                              stepStatus={(step as { stepStatus?: NonNullable<ApprovalRecord['workflowInstance']>['steps'][number]['status'] }).stepStatus}
                            />
                          )}
                          {step.time && (
                            <p className="text-[10px] font-black text-light-gray font-mono mt-2 uppercase tracking-widest">
                              {formatLocalDateTime(step.time, 'date-time-seconds')}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
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
              ) : canProcess ? (
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
                  <button
                    onClick={() => onCompleteProcess?.(record)}
                    className="h-14 bg-black text-white text-[13px] font-black rounded-2xl hover:bg-black/90 transition-all shadow-xl shadow-black/10 flex items-center justify-center gap-2"
                  >
                    <UserCheck size={18} strokeWidth={2.5} />
                    完成办理
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
