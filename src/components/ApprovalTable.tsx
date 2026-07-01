import React from 'react';
import { ApprovalRecord, ApprovalStatus } from '../types';
import { cn } from '../lib/utils';
import { ChevronRight, FileText } from 'lucide-react';
import { formatLocalDate, formatLocalTime } from '../lib/time';

interface ApprovalTableProps {
  records: ApprovalRecord[];
  onViewDetail: (record: ApprovalRecord) => void;
  onViewProgress: (record: ApprovalRecord) => void;
  onApprove?: (record: ApprovalRecord) => void;
  onReject?: (record: ApprovalRecord) => void;
  showActions?: boolean;
}

function formatBusinessValuePreview(value: unknown) {
  if (Array.isArray(value)) {
    const isAttachmentList = value.every((item) => {
      return !!item && typeof item === 'object' && 'name' in item && 'url' in item;
    });
    if (isAttachmentList) {
      return value.length > 0 ? `${value.length} 个附件` : '未上传附件';
    }
    return value.length > 0 ? `${value.length} 条明细` : '暂无明细';
  }

  if (value && typeof value === 'object') {
    const data = value as Record<string, unknown>;
    if ('currency' in data && 'amount' in data) {
      return [data.currency, data.amount].filter((item) => String(item || '').trim()).join(' ') || '-';
    }
    if ('text' in data && Array.isArray(data.attachments)) {
      return String(data.text || '') || `${data.attachments.length} 个附件`;
    }
    return Object.entries(data)
      .slice(0, 2)
      .map(([key, item]) => `${key}：${String(item || '-')}`)
      .join('，');
  }

  return String(value || '-');
}

function getMobileStatusMeta(status: ApprovalStatus) {
  if (status === ApprovalStatus.PENDING) {
    return {
      label: '待审批',
      className: 'text-[#1677ff]',
    };
  }

  if (status === ApprovalStatus.PROCESSING) {
    return {
      label: '待办理',
      className: 'text-[#9a6a10]',
    };
  }

  if (status === ApprovalStatus.REJECTED) {
    return {
      label: '审批驳回',
      className: 'text-[#d93025]',
    };
  }

  if (status === ApprovalStatus.COMPLETED) {
    return {
      label: '办理完成',
      className: 'text-[#16965c]',
    };
  }

  return {
    label: '审批通过',
    className: 'text-[#16965c]',
  };
}

function getMobileRecordTitle(record: ApprovalRecord) {
  return `${record.applicant}提交的${record.approvalTypeName}`;
}

export default function ApprovalTable({ 
  records, 
  onViewDetail
}: ApprovalTableProps) {
  
  const renderRow = (record: ApprovalRecord) => {
    const processorNames = (record.processors || []).map((processor) => processor.name).filter(Boolean).join('、');
    const handleRowKeyDown = (event: React.KeyboardEvent<HTMLTableRowElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onViewDetail(record);
      }
    };

    return (
      <tr
        key={record.id}
        onClick={() => onViewDetail(record)}
        onKeyDown={handleRowKeyDown}
        tabIndex={0}
        className="hover:bg-canvas-white focus-visible:bg-canvas-white focus-visible:outline-none group transition-colors border-b border-border-silver last:border-0 grow-0 shrink-0 cursor-pointer"
        title="查看详情"
      >
        <td className="px-8 py-6 whitespace-nowrap text-[12px] font-medium text-light-gray font-mono">
          {record.id.split('-')[1]}
        </td>
        <td className="px-8 py-6 whitespace-nowrap">
          <div className="flex flex-col">
            <span className="text-[17px] font-semibold text-midnight-graphite tracking-tight">{record.approvalTypeName}</span>
            <span className="text-[13px] font-medium text-medium-gray">{record.moduleName}</span>
          </div>
        </td>
        
        <td className="px-8 py-6 whitespace-nowrap max-w-[320px]">
          <div className="flex items-center gap-3">
            {Object.entries(record.businessData).slice(0, 1).map(([key, value]) => (
              <span key={key} className="text-[15px] font-medium text-charcoal-grey truncate italic">
                {formatBusinessValuePreview(value)}
              </span>
            ))}
            {Object.keys(record.businessData).length > 1 && (
              <span className="text-[11px] px-2 py-0.5 bg-lightest-gray-background text-medium-gray rounded-full font-semibold">
                +{Object.keys(record.businessData).length - 1} MORE
              </span>
            )}
          </div>
        </td>

        <td className="px-8 py-6 whitespace-nowrap">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-lightest-gray-background flex items-center justify-center text-[12px] font-bold text-midnight-graphite">
              {record.applicant.charAt(0)}
            </div>
            <span className="text-[15px] font-semibold text-midnight-graphite">{record.applicant}</span>
          </div>
        </td>

        <td className="px-8 py-6 whitespace-nowrap">
          <span className={cn(
            "status-tag",
            record.status === ApprovalStatus.PENDING && "status-pending",
            record.status === ApprovalStatus.PROCESSING && "status-processing",
            record.status === ApprovalStatus.APPROVED && "status-approved",
            record.status === ApprovalStatus.COMPLETED && "status-completed",
            record.status === ApprovalStatus.REJECTED && "status-rejected"
          )}>
            {record.status}
          </span>
        </td>

        <td className="px-8 py-6 whitespace-nowrap">
          <span className="text-[14px] font-semibold text-midnight-graphite">
            {processorNames || '-'}
          </span>
        </td>

        <td className="px-8 py-6 whitespace-nowrap text-[14px] font-medium text-light-gray">
          {formatLocalDate(record.createdAt)}
          <span className="text-[12px] opacity-60 ml-2 font-normal">{formatLocalTime(record.createdAt)}</span>
        </td>
      </tr>
    );
  };

  const renderMobileCard = (record: ApprovalRecord) => {
    const businessEntries = Object.entries(record.businessData).slice(0, 5);
    const hiddenBusinessCount = Math.max(0, Object.keys(record.businessData).length - businessEntries.length);
    const statusMeta = getMobileStatusMeta(record.status);
    const handleCardKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onViewDetail(record);
      }
    };

    return (
      <article
        key={record.id}
        role="button"
        tabIndex={0}
        onClick={() => onViewDetail(record)}
        onKeyDown={handleCardKeyDown}
        className="overflow-hidden rounded-[20px] border border-black/[0.018] bg-white/98 px-3.5 py-3 shadow-[0_1px_1px_rgba(20,24,34,0.01)] transition-all active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-blue-highlight"
        title="查看详情"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-[11px] bg-[#eef5ff] text-[14px] font-semibold text-[#1677ff]">
            {record.applicant.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <h3 className="min-w-0 flex-1 truncate text-[15px] font-semibold leading-5 text-midnight-graphite">
                {getMobileRecordTitle(record)}
              </h3>
              <span className="shrink-0 pt-0.5 text-right text-[10.5px] font-medium leading-5 text-[#8b8e96]">
                {formatLocalDate(record.createdAt)} {formatLocalTime(record.createdAt)}发起
              </span>
            </div>
            <div className="mt-2 space-y-0.5">
              {businessEntries.map(([key, value]) => (
                <p key={key} className="flex min-w-0 gap-1.5 text-[13px] font-medium leading-[20px] text-[#777b84]">
                  <span className="shrink-0">{key}：</span>
                  <span className="min-w-0 truncate">{formatBusinessValuePreview(value)}</span>
                </p>
              ))}
              {businessEntries.length === 0 && (
                <p className="text-[14px] font-medium leading-[22px] text-light-gray">暂无业务摘要</p>
              )}
              {hiddenBusinessCount > 0 && (
                <p className="text-[12px] font-medium leading-5 text-light-silver">
                  还有 {hiddenBusinessCount} 项信息
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-3.5 flex items-center justify-between gap-3">
          <span className={cn("text-[13.5px] font-semibold leading-6", statusMeta.className)}>
            {statusMeta.label}
          </span>
          <span className="flex h-8 items-center justify-center gap-1 rounded-full border border-black/[0.045] bg-white px-4 text-[13px] font-medium text-midnight-graphite">
            查看
            <ChevronRight size={14} strokeWidth={2.4} />
          </span>
        </div>
      </article>
    );
  };

  if (!records || records.length === 0) {
    return (
      <div className="flex min-h-[270px] flex-col items-center justify-center rounded-none border-0 bg-transparent px-6 py-12 shadow-none lg:min-h-0 lg:rounded-none lg:border-0 lg:bg-pure-white lg:px-12 lg:py-40 lg:shadow-none lg:ring-0">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-[16px] bg-white/82 shadow-[0_1px_1px_rgba(20,24,34,0.018)] lg:mb-8 lg:h-24 lg:w-24 lg:rounded-full">
          <FileText size={17} strokeWidth={1.2} className="text-light-silver lg:w-8 lg:h-8" />
        </div>
        <p className="text-[14px] font-semibold text-midnight-graphite lg:text-[21px] lg:font-bold lg:tracking-tight">
          <span className="lg:hidden">暂无内容</span>
          <span className="hidden lg:inline">暂无卷宗记录</span>
        </p>
        <p className="mt-1 hidden text-center text-[11px] font-medium text-[#8f929a] lg:block lg:text-[17px] lg:font-medium lg:mt-2">当前条件下未发现任何匹配的审批数据。</p>
      </div>
    );
  }

  return (
    <div className="w-full bg-transparent lg:bg-pure-white">
      <div className="space-y-2.5 lg:hidden">
        {records.map(renderMobileCard)}
      </div>
      <div className="hidden overflow-x-auto no-scrollbar lg:block">
        <div className="min-w-[1120px] lg:min-w-0">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-canvas-white border-b border-border-silver">
                <th className="px-8 py-4 text-[12px] font-bold text-light-gray uppercase tracking-widest">ID</th>
                <th className="px-8 py-4 text-[12px] font-bold text-light-gray uppercase tracking-widest">单据类型</th>
                <th className="px-8 py-4 text-[12px] font-bold text-light-gray uppercase tracking-widest">业务摘要</th>
                <th className="px-8 py-4 text-[12px] font-bold text-light-gray uppercase tracking-widest">发起人</th>
                <th className="px-8 py-4 text-[12px] font-bold text-light-gray uppercase tracking-widest">状态</th>
                <th className="px-8 py-4 text-[12px] font-bold text-light-gray uppercase tracking-widest">办理人</th>
                <th className="px-8 py-4 text-[12px] font-bold text-light-gray uppercase tracking-widest">时间戳</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-silver">
              {records.map(renderRow)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
