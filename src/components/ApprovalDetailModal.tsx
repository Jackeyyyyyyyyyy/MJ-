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

function isFileFieldDisplayValue(value: unknown): value is { text?: unknown; attachments: ApprovalAttachment[] } {
  return !!value
    && typeof value === 'object'
    && !Array.isArray(value)
    && 'text' in value
    && isAttachmentList((value as { attachments?: unknown }).attachments);
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
  if (isAttachmentList(value)) return [];
  if (!Array.isArray(value) || value.length === 0) return [];

  const matchesColumns = (columns: typeof batchModifyDetailColumns) => value.every((row) => {
    return !!row && typeof row === 'object' && columns.every((column) => column.key in row);
  });

  if (matchesColumns(batchModifyDetailColumns)) return batchModifyDetailColumns;
  if (matchesColumns(fundsReductionDetailColumns)) return fundsReductionDetailColumns;
  const rowsAreObjects = value.every((row) => (
    !!row && typeof row === 'object' && !Array.isArray(row) && !isAttachmentList(row)
  ));
  if (!rowsAreObjects) return [];

  const firstRow = value[0] as Record<string, unknown>;
  const keys = Object.keys(firstRow).filter((key) => key.trim());
  if (keys.length === 0) return [];

  return keys.map((key) => ({ key, label: key }));
}

function getDetailTableGridStyle(columnCount: number): React.CSSProperties {
  return {
    gridTemplateColumns: `repeat(${Math.max(columnCount, 1)}, minmax(150px, 1fr))`,
  };
}

function getDetailTableMinWidth(columnCount: number): React.CSSProperties {
  return {
    minWidth: `${Math.max(620, Math.max(columnCount, 1) * 170)}px`,
  };
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
  const contentRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    return () => {
      if (preview?.url) URL.revokeObjectURL(preview.url);
    };
  }, [preview?.url]);

  React.useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
  }, [record?.id]);

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

  const renderFileFieldDisplay = (value: { text?: unknown; attachments: ApprovalAttachment[] }) => {
    return (
      <div className="min-w-0 flex-1 space-y-3">
        <div className="rounded-2xl border border-border-silver bg-white p-4">
          <p className="mb-2 text-[11px] font-medium text-light-gray">填写内容</p>
          <p className="break-all text-[15px] font-semibold text-midnight-graphite">
            {String(value.text || '').trim() || '-'}
          </p>
        </div>
        <div className="rounded-2xl border border-border-silver bg-white p-4">
          <p className="mb-3 text-[11px] font-medium text-light-gray">附件</p>
          {renderAttachmentList(value.attachments)}
        </div>
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
              <div key={column.key} className="px-3 py-3 text-[11px] font-semibold text-medium-gray">
                {column.label}
              </div>
            ))}
          </div>
          {rows.map((row, rowIndex) => (
            <div key={rowIndex} className={cn("grid border-b border-border-silver last:border-b-0", gridClass)}>
              {columns.map((column) => (
                <div key={column.key} className="break-all px-3 py-4 text-[13px] font-medium text-midnight-graphite">
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
          <p className="mb-3 text-[12px] font-medium text-medium-gray">营业执照</p>
          {renderAttachmentList(data.businessLicense)}
        </div>
        <div>
          <p className="mb-3 text-[12px] font-medium text-medium-gray">银行账户</p>
          {renderCustomerTable(data.bankAccounts, customerBankAccountColumns)}
        </div>
        <div className="rounded-2xl border border-border-silver bg-white p-4">
          <p className="mb-3 text-[12px] font-medium text-medium-gray">银行凭证</p>
          {renderAttachmentList(data.bankVoucher)}
        </div>
        <div>
          <p className="mb-3 text-[12px] font-medium text-medium-gray">开票信息</p>
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
          <p className="mb-3 text-[12px] font-medium text-medium-gray">角色与服务</p>
          {renderCustomerTable(data.roleServices, supplierRoleServiceColumns)}
        </div>
        <div>
          <p className="mb-3 text-[12px] font-medium text-medium-gray">银行账户</p>
          {renderCustomerTable(data.bankAccounts, customerBankAccountColumns)}
        </div>
        <div>
          <p className="mb-3 text-[12px] font-medium text-medium-gray">开票信息</p>
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
                <div key={column.key} className="px-3 py-3 text-[11px] font-semibold text-medium-gray">
                  {column.label}
                </div>
              ))}
            </div>
            {data.quotationRows.map((row, rowIndex) => (
              <div key={rowIndex} className="grid grid-cols-[1fr_1fr_1fr_0.8fr_0.8fr_0.8fr_1fr_1.1fr_0.8fr_1.1fr_1fr] border-b border-border-silver last:border-b-0">
                {supplierQuotationColumns.map((column) => (
                  <div key={column.key} className="break-all px-3 py-4 text-[13px] font-medium text-midnight-graphite">
                    {String(row[column.key] || '-')}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border-silver bg-white p-4">
          <p className="mb-3 text-[12px] font-medium text-medium-gray">报价附件</p>
          {renderAttachmentList(data.attachments)}
        </div>
      </div>
    );
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-end justify-center overflow-hidden p-0 sm:items-center sm:p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/25 backdrop-blur-[2px]"
        />
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 42 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 42 }}
            className="relative flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[24px] border border-white/70 bg-[#f5f6fa] shadow-[0_-4px_18px_rgba(15,23,42,0.055)] sm:h-auto sm:max-h-[90dvh] sm:rounded-[22px] sm:shadow-[0_10px_30px_rgba(15,23,42,0.10)]"
          >
            {/* Header */}
            <div className="shrink-0 border-b border-black/[0.045] bg-white px-4 pb-3.5 pt-2.5 sm:px-7 sm:py-5">
              <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-black/[0.12] sm:hidden" />
              <div className="flex items-center justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-[#eef5ff] text-[#1677ff]">
                    <FileText size={19} strokeWidth={2.35} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-[17px] font-semibold tracking-tight text-midnight-graphite">卷宗详情</h2>
                    <p className="mt-0.5 truncate text-[11px] font-medium text-light-gray">流水识别码：{record.id.split('-')[1]}</p>
                  </div>
                </div>
                <button onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-medium-gray transition-colors hover:bg-[#f5f6f8] hover:text-midnight-graphite">
                  <X size={18} strokeWidth={2.5} />
                </button>
              </div>
            </div>

            <div ref={contentRef} className="flex-1 overflow-y-auto no-scrollbar space-y-3.5 p-3.5 pb-4 sm:space-y-5 sm:p-7">
              {/* Context Grid */}
              <div className="grid grid-cols-2 overflow-hidden rounded-[16px] border border-black/[0.03] bg-white shadow-[0_1px_1px_rgba(15,23,42,0.018)]">
                <div className="flex min-w-0 flex-col gap-1 border-b border-r border-black/[0.04] p-3">
                  <p className="text-[11px] font-medium text-light-gray">功能类型</p>
                  <p className="truncate text-[15px] font-semibold leading-5 text-midnight-graphite">{record.approvalTypeName}</p>
                </div>
                <div className="flex min-w-0 flex-col gap-1 border-b border-black/[0.04] p-3">
                  <p className="text-[11px] font-medium text-light-gray">业务模块</p>
                  <p className="truncate text-[15px] font-semibold leading-5 text-midnight-graphite">{record.moduleName}</p>
                </div>
                <div className="flex min-w-0 flex-col gap-1 border-r border-black/[0.04] p-3">
                  <p className="text-[11px] font-medium text-light-gray">发起主体</p>
                  <p className="truncate text-[15px] font-semibold leading-5 text-midnight-graphite">{record.applicant}</p>
                </div>
                <div className="flex min-w-0 flex-col gap-1 p-3">
                  <p className="text-[11px] font-medium text-light-gray">时间戳</p>
                  <p className="truncate font-mono text-[14px] font-semibold leading-5 text-midnight-graphite">{formatLocalDateTime(record.createdAt)}</p>
                </div>
              </div>

              {showAiSuggestion && (
                <div className={cn(
                  "relative overflow-hidden rounded-[18px] border p-3.5 sm:rounded-[22px] sm:p-7",
                  aiSuggestion.tone === 'danger' && "bg-[#fff1f0]/60 border-rose-100",
                  aiSuggestion.tone === 'warning' && "bg-[#fff7e6]/70 border-[#f5d7a1]",
                  aiSuggestion.tone === 'success' && "bg-[#e8f5e9]/80 border-[#b9dfbd]",
                  aiSuggestion.tone === 'neutral' && "bg-[#fbfbfd] border-black/[0.04]",
                )}>
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] bg-white text-midnight-graphite ring-1 ring-black/[0.06]">
                      <Sparkles size={16} strokeWidth={2.35} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-4 mb-2">
                        <p className="text-[12px] font-semibold text-medium-gray">AI审批建议</p>
                        <span className="whitespace-nowrap text-[11px] font-medium text-light-gray">仅供参考</span>
                      </div>
                      <p className="text-[15px] font-semibold leading-snug tracking-tight text-midnight-graphite">
                        {aiSuggestion.text}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Approval Result if processed */}
              {hasResultPanel && (
                <div className={cn(
                  "relative overflow-hidden rounded-[18px] border p-4 sm:rounded-[22px] sm:p-6",
                  isPositiveResult ? "border-[#dcefe1] bg-[#f1f8f4] text-[#1b5e20]" : "border-rose-100 bg-[#fff1f0]/55"
                )}>
                  {isPositiveResult && (
                    <div className="absolute right-0 top-0 h-32 w-32 -translate-y-16 translate-x-16 rounded-full bg-white/60 blur-2xl" />
                  )}
                  <div className="flex items-center justify-between relative">
                    <div className="flex items-center gap-3.5">
                      <div className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-full",
                        isPositiveResult ? "bg-[#22a06b] text-white" : "bg-rose-500 text-white"
                      )}>
                        {isPositiveResult ? <ShieldCheck size={20} strokeWidth={2.5} /> : <AlertCircle size={20} strokeWidth={2.5} />}
                      </div>
                      <div>
                        <p className={cn("text-[16px] font-semibold tracking-tight", isPositiveResult ? "text-[#1b5e20]" : "text-midnight-graphite")}>
                          {resultTitle}
                        </p>
                        <p className="text-[11px] font-medium text-medium-gray">{resultSubtitle}</p>
                      </div>
                    </div>
                    <span className="font-mono text-[10.5px] font-medium text-medium-gray">
                      {formatLocalDateTime(record.processedAt || record.approvedAt || record.rejectedAt, 'time-seconds')}
                    </span>
                  </div>
                  {record.rejectReason && (
                    <div className="mt-6 pt-6 border-t border-black/5">
                      <p className="mb-2 text-[11px] font-medium text-medium-gray">异常日志追踪</p>
                      <p className="text-[15px] font-bold text-rose-600 leading-tight italic">"{record.rejectReason}"</p>
                    </div>
                  )}
                </div>
              )}

              {/* Business Data */}
              <div className="space-y-3">
                <div className="px-1">
                  <h3 className="text-[17px] font-semibold tracking-tight text-midnight-graphite">业务信息</h3>
                </div>
                <div className="grid grid-cols-1 gap-2.5">
                  {Object.entries(record.businessData).map(([key, value]) => (
                    <div
                      key={key}
                      className={cn(
                        "gap-4 rounded-[16px] border border-black/[0.035] bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.02)] transition-all sm:gap-6 sm:p-5 sm:rounded-[20px]",
                        isCustomerInfoChangeValue(value) || isSupplierInfoChangeValue(value) || isSupplierQuotationInfoValue(value) || isFileFieldDisplayValue(value) || getStructuredDetailColumns(value).length > 0
                          ? "flex flex-col items-stretch"
                          : "flex items-center justify-between",
                      )}
                    >
                      <span className="text-[12px] font-medium text-medium-gray">{key}</span>
                      {isCustomerInfoChangeValue(value) ? (
                        renderCustomerInfoChange(value)
                      ) : isSupplierInfoChangeValue(value) ? (
                        renderSupplierInfoChange(value)
                      ) : isSupplierQuotationInfoValue(value) ? (
                        renderSupplierQuotationInfo(value)
                      ) : isFileFieldDisplayValue(value) ? (
                        renderFileFieldDisplay(value)
                      ) : getStructuredDetailColumns(value).length > 0 ? (
                        <div className="overflow-x-auto no-scrollbar">
                          <div
                            className="overflow-hidden rounded-2xl border border-border-silver bg-white"
                            style={getDetailTableMinWidth(getStructuredDetailColumns(value).length)}
                          >
                            <div
                              className="grid border-b border-border-silver bg-canvas-white"
                              style={getDetailTableGridStyle(getStructuredDetailColumns(value).length)}
                            >
                              {getStructuredDetailColumns(value).map((column) => (
                                <div key={column.key} className="px-3 py-3 text-[11px] font-semibold text-medium-gray">
                                  {column.label}
                                </div>
                              ))}
                            </div>
                            {value.map((row, rowIndex) => (
                              <div
                                key={rowIndex}
                                className="grid border-b border-border-silver last:border-b-0"
                                style={getDetailTableGridStyle(getStructuredDetailColumns(value).length)}
                              >
                                {getStructuredDetailColumns(value).map((column) => (
                                  <div key={column.key} className="break-all px-3 py-4 text-[13px] font-medium text-midnight-graphite">
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
                        <span className="break-all text-right text-[16px] font-semibold tracking-tight text-midnight-graphite">
                          {formatMoneyDisplay(value) || '-'}
                        </span>
                      ) : isPlainDisplayObject(value) ? (
                        <div className="min-w-0 flex flex-col items-end gap-2">
                          {Object.entries(value).map(([itemKey, itemValue]) => (
                            <span key={itemKey} className="break-all text-right text-[14px] font-semibold tracking-tight text-midnight-graphite">
                              {itemKey}：{String(itemValue || '-')}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="break-all text-right text-[16px] font-semibold tracking-tight text-midnight-graphite">{String(value)}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Audit Log */}
              <div className="overflow-hidden rounded-[16px] border border-black/[0.03] bg-white shadow-[0_1px_1px_rgba(15,23,42,0.018)]">
                <div className="flex items-center justify-between border-b border-black/[0.045] bg-white px-4 py-3.5 sm:px-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-[11px] bg-[#eef5ff] text-[#1677ff]">
                      <CheckCircle2 className="h-[18px] w-[18px]" strokeWidth={2.5} />
                    </div>
                    <h3 className="text-[16px] font-semibold tracking-tight text-midnight-graphite">审批流进度汇总</h3>
                  </div>
                </div>
                <div className="p-4 sm:p-7">
                  <div className="relative space-y-0">
                    {approvalTimeline.map((step, idx) => (
                      <div key={idx} className="relative flex gap-3.5 pb-8 last:pb-0">
                        {idx !== approvalTimeline.length - 1 && (
                          <div className={cn(
                            "absolute left-4 top-8 h-full w-px transition-all duration-700",
                            step.state === 'done' ? "bg-[#1677ff]/24" : "bg-slate-100"
                          )} />
                        )}

                        <div className="z-10 shrink-0">
                          <div className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-full border transition-all duration-500",
                            step.state === 'done' ? "bg-[#1677ff] border-[#1677ff] text-white" :
                            (step.state === 'active' ? "bg-white border-[#1677ff] text-[#1677ff] shadow-[0_6px_16px_rgba(22,119,255,0.10)]" :
                            (step.state === 'failed' ? "bg-rose-500 border-rose-500 text-white" : "bg-white border-border-silver text-light-gray"))
                          )}>
                            {step.state === 'done' && <Check size={16} strokeWidth={2.7} />}
                            {step.state === 'active' && <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 4, ease: 'linear' }}><Clock size={16} strokeWidth={2.7} /></motion.div>}
                            {step.state === 'failed' && <X size={16} strokeWidth={2.7} />}
                            {step.state === 'pending' && <div className="h-1.5 w-1.5 rounded-full bg-slate-200" />}
                          </div>
                        </div>

                        <div className="min-w-0 flex flex-col gap-1 pt-1">
                          <h4 className={cn(
                            "text-[15px] font-semibold tracking-tight",
                            step.state === 'pending' ? "text-medium-gray" : "text-midnight-graphite"
                          )}>{step.title}</h4>
                          <p className="text-[12.5px] font-medium leading-5 text-medium-gray">{step.desc}</p>
                          {Array.isArray((step as { approvers?: unknown }).approvers) && (
                            <ApprovalParallelApprovers
                              approvers={(step as unknown as { approvers: NonNullable<ApprovalRecord['workflowInstance']>['steps'][number]['approvers'] }).approvers}
                              title={step.title}
                              approvalMode={(step as { approvalMode?: ApprovalMode }).approvalMode}
                              stepStatus={(step as { stepStatus?: NonNullable<ApprovalRecord['workflowInstance']>['steps'][number]['status'] }).stepStatus}
                            />
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
              </div>
            </div>

            {/* Footer */}
            <div className="shrink-0 border-t border-black/[0.045] bg-white/95 px-4 py-3 backdrop-blur sm:px-7 sm:py-5">
              {canReview ? (
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3">
                  <button
                    onClick={() => onApprove?.(record)}
                    className="flex h-11 items-center justify-center gap-2 rounded-full bg-[#22a06b] text-[14px] font-semibold text-white shadow-[0_6px_14px_rgba(34,160,107,0.14)] transition-colors hover:bg-[#1d8f5f] sm:h-12"
                  >
                    <CheckCircle2 size={18} strokeWidth={2.5} />
                    通过审批
                  </button>
                  <button
                    onClick={() => onReject?.(record)}
                    className="flex h-11 items-center justify-center gap-2 rounded-full bg-[#ffebe9] text-[14px] font-semibold text-[#d93025] transition-colors hover:bg-[#ffe0dd] sm:h-12"
                  >
                    <XCircle size={18} strokeWidth={2.5} />
                    驳回申请
                  </button>
                  <button
                    onClick={onClose}
                    className="h-11 rounded-full border border-black/[0.06] bg-white px-6 text-[14px] font-semibold text-medium-gray transition-colors hover:border-black/[0.12] hover:text-midnight-graphite sm:h-12"
                  >
                    关闭
                  </button>
                </div>
              ) : canProcess ? (
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
                  <button
                    onClick={() => onCompleteProcess?.(record)}
                    className="flex h-12 items-center justify-center gap-2 rounded-full bg-[#1677ff] text-[14px] font-semibold text-white shadow-[0_5px_12px_rgba(22,119,255,0.12)] transition-colors hover:bg-[#0f6fe8] sm:h-12"
                  >
                    <UserCheck size={18} strokeWidth={2.5} />
                    完成办理
                  </button>
                  <button
                    onClick={onClose}
                    className="h-12 rounded-full border border-black/[0.06] bg-white px-6 text-[14px] font-semibold text-medium-gray transition-colors hover:border-black/[0.12] hover:text-midnight-graphite sm:h-12"
                  >
                    关闭
                  </button>
                </div>
              ) : (
                <button 
                  onClick={onClose} 
                  className="flex h-12 w-full items-center justify-center rounded-full bg-[#1677ff] text-[14px] font-semibold text-white shadow-[0_5px_12px_rgba(22,119,255,0.12)] transition-colors hover:bg-action-blue"
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
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 20 }}
                className="relative flex h-[86vh] w-full max-w-5xl flex-col overflow-hidden rounded-[22px] bg-white shadow-[0_14px_40px_rgba(15,23,42,0.15)]"
              >
                <div className="h-16 px-6 border-b border-black/[0.06] flex items-center justify-between shrink-0">
                  <div className="min-w-0 flex flex-col">
                    <span className="truncate text-[14px] font-semibold text-midnight-graphite">{preview?.attachment.name || '附件预览'}</span>
                    <span className="text-[11px] font-medium text-light-gray">附件预览</span>
                  </div>
                  <button onClick={closePreview} className="flex h-9 w-9 items-center justify-center rounded-full text-medium-gray transition-colors hover:bg-[#f5f6f8] hover:text-midnight-graphite">
                    <X size={20} strokeWidth={2.5} />
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
