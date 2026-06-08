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
                {String(value)}
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

  if (!records || records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-40 px-12 bg-pure-white">
        <div className="w-24 h-24 bg-canvas-white rounded-full flex items-center justify-center mb-8">
          <FileText size={32} strokeWidth={1} className="text-light-silver" />
        </div>
        <p className="text-[21px] font-bold text-midnight-graphite tracking-tight">暂无卷宗记录</p>
        <p className="text-[17px] font-medium text-light-gray mt-2">当前条件下未发现任何匹配的审批数据。</p>
      </div>
    );
  }

  return (
    <div className="w-full bg-pure-white">
      <div className="overflow-x-auto no-scrollbar">
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
