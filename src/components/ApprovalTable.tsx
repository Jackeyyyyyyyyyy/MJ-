import React from 'react';
import { ApprovalRecord, ApprovalStatus } from '../types';
import { cn } from '../lib/utils';
import { FileText } from 'lucide-react';
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
    const processorNames = (record.processors || []).map((processor) => processor.name).filter(Boolean).join('、');
    const [firstBusinessEntry] = Object.entries(record.businessData);
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
        className="rounded-[16px] border border-black/[0.05] bg-white px-3.5 py-3.5 active:scale-[0.99] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-blue-highlight"
        title="查看详情"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-medium text-light-gray font-mono">#{record.id.split('-')[1]}</p>
            <h3 className="mt-1 truncate text-[15px] font-semibold leading-tight text-midnight-graphite">
              {record.approvalTypeName}
            </h3>
            <p className="mt-0.5 truncate text-[11px] font-medium text-medium-gray">{record.moduleName}</p>
          </div>
          <span className={cn(
            "status-tag shrink-0 px-2 py-0.5 text-[10px] font-medium",
            record.status === ApprovalStatus.PENDING && "status-pending",
            record.status === ApprovalStatus.PROCESSING && "status-processing",
            record.status === ApprovalStatus.APPROVED && "status-approved",
            record.status === ApprovalStatus.COMPLETED && "status-completed",
            record.status === ApprovalStatus.REJECTED && "status-rejected"
          )}>
            {record.status}
          </span>
        </div>

        {firstBusinessEntry && (
          <div className="mt-3 rounded-[12px] bg-canvas-white px-3 py-2.5">
            <p className="text-[10px] font-medium text-light-gray">{firstBusinessEntry[0]}</p>
            <p className="mt-0.5 truncate text-[13px] font-medium text-charcoal-grey">
              {formatBusinessValuePreview(firstBusinessEntry[1])}
            </p>
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2.5 text-[11px]">
          <div className="min-w-0">
            <p className="font-medium text-light-gray">发起人</p>
            <p className="mt-0.5 truncate font-medium text-midnight-graphite">{record.applicant}</p>
          </div>
          <div className="min-w-0 text-right">
            <p className="font-medium text-light-gray">办理人</p>
            <p className="mt-0.5 truncate font-medium text-midnight-graphite">{processorNames || '-'}</p>
          </div>
          <div className="col-span-2 flex items-center justify-between border-t border-black/[0.05] pt-2.5">
            <span className="font-medium text-medium-gray">{formatLocalDate(record.createdAt)}</span>
            <span className="font-medium text-light-gray">{formatLocalTime(record.createdAt)}</span>
          </div>
        </div>
      </article>
    );
  };

  if (!records || records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-[18px] border border-black/[0.05] bg-white px-6 py-14 lg:rounded-none lg:border-0 lg:bg-pure-white lg:px-12 lg:py-40">
        <div className="w-11 h-11 bg-canvas-white rounded-full flex items-center justify-center mb-4 lg:w-24 lg:h-24 lg:mb-8">
          <FileText size={20} strokeWidth={1.2} className="text-light-silver lg:w-8 lg:h-8" />
        </div>
        <p className="text-[15px] font-semibold text-midnight-graphite lg:text-[21px] lg:font-bold lg:tracking-tight">暂无卷宗记录</p>
        <p className="text-center text-[12px] font-normal text-light-gray mt-1.5 lg:text-[17px] lg:font-medium lg:mt-2">当前条件下未发现任何匹配的审批数据。</p>
      </div>
    );
  }

  return (
    <div className="w-full bg-transparent lg:bg-pure-white">
      <div className="space-y-3 lg:hidden">
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
