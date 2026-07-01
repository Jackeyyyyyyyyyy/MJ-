import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, FileText, Send, XCircle } from 'lucide-react';
import { auth } from '../auth';
import { storage } from '../storage';
import { ApprovalRecord, ApprovalStatus } from '../types';
import ApprovalDetailModal from './ApprovalDetailModal';
import ApprovalProgressModal from './ApprovalProgressModal';
import ApprovalTable from './ApprovalTable';
import StatsOverview from './StatsOverview';
import { isLocalToday } from '../lib/time';
import { cn } from '../lib/utils';

const ALL_STATUS = '全部状态';

function isCurrentUserCc(record: ApprovalRecord, username?: string) {
  if (record.currentUserIsCc) return true;
  if (!username) return false;

  return (record.ccRecipients || []).some((recipient) => (
    recipient.accountUsername?.toLowerCase() === username.toLowerCase()
  ));
}

export default function CcHome() {
  const [records, setRecords] = useState<ApprovalRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<ApprovalRecord | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>(ALL_STATUS);

  const user = auth.getCurrentUser();

  const loadData = async () => {
    const all = await storage.getRecords();
    setRecords(all.filter((record) => isCurrentUserCc(record, user?.username)));
  };

  useEffect(() => {
    void loadData();
    const timer = setInterval(() => void loadData(), 3000);
    return () => clearInterval(timer);
  }, [user?.username]);

  const stats = useMemo(() => records.reduce(
    (summary, record) => {
      summary.total += 1;
      if (record.status === ApprovalStatus.APPROVED) summary.approved += 1;
      if (record.status === ApprovalStatus.COMPLETED) summary.completed += 1;
      if (record.status === ApprovalStatus.REJECTED) summary.rejected += 1;
      if (isLocalToday(record.updatedAt || record.createdAt)) {
        summary.today += 1;
      }
      return summary;
    },
    { total: 0, approved: 0, completed: 0, rejected: 0, today: 0 },
  ), [records]);

  const filteredRecords = useMemo(() => {
    if (filterStatus === ALL_STATUS) return records;
    return records.filter(record => record.status === filterStatus);
  }, [records, filterStatus]);

  const summaryItems = [
    { label: '总抄送', value: stats.total, icon: Send, tone: 'text-midnight-graphite', bg: 'bg-lightest-gray-background' },
    { label: '今日新增', value: stats.today, icon: FileText, tone: 'text-medium-gray', bg: 'bg-lightest-gray-background' },
    { label: '已完成', value: stats.approved + stats.completed, icon: CheckCircle2, tone: 'text-[#2e7d32]', bg: 'bg-[#e8f5e9]' },
    { label: '已拒绝', value: stats.rejected, icon: XCircle, tone: 'text-[#c62828]', bg: 'bg-[#ffebee]' },
  ];

  return (
    <div className="space-y-3 pb-28 animate-in fade-in duration-700 lg:space-y-8 lg:pb-40">
      <div className="hidden lg:block">
        <StatsOverview
          title="我的抄送"
          subtitle="流程结果与同步记录"
          items={summaryItems}
        />
      </div>

      <div className="space-y-3 lg:space-y-5">
        <div className="flex flex-col justify-between gap-2.5 lg:flex-row lg:items-center lg:gap-4">
          <h2 className="text-[17px] font-semibold text-midnight-graphite lg:text-[20px] lg:font-black lg:tracking-tight">抄送记录</h2>
          <div className="-mx-1 overflow-x-auto no-scrollbar px-1 sm:mx-0 sm:px-0">
            <div className="inline-flex min-w-max gap-1.5 lg:w-fit lg:gap-0 lg:rounded-xl lg:bg-lightest-gray-background lg:p-1">
            {(['ALL', ApprovalStatus.APPROVED, ApprovalStatus.COMPLETED, ApprovalStatus.REJECTED] as string[]).map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status === 'ALL' ? ALL_STATUS : status)}
                className={cn(
                  "h-8 rounded-full px-2.5 text-[12px] font-medium transition-all lg:h-auto lg:rounded-lg lg:border-b-0 lg:px-4 lg:py-1.5 lg:text-[11px] lg:font-bold",
                  (filterStatus === status || (filterStatus === ALL_STATUS && status === 'ALL'))
                    ? "bg-white text-midnight-graphite shadow-[0_1px_2px_rgba(20,24,34,0.025)] ring-1 ring-black/[0.02] lg:text-black lg:shadow-sm"
                    : "bg-transparent text-[#70747d] hover:text-black lg:text-light-gray"
                )}
              >
                {status === 'ALL'
                  ? '全部'
                  : status === ApprovalStatus.COMPLETED
                    ? '已完成'
                  : (status === ApprovalStatus.APPROVED ? '已通过' : '驳回')}
              </button>
            ))}
            </div>
          </div>
        </div>
        <div className="lg:bg-white lg:border lg:border-border-silver lg:rounded-2xl lg:overflow-hidden lg:shadow-sm">
          <ApprovalTable
            records={filteredRecords}
            onViewDetail={(record) => { setSelectedRecord(record); setShowDetail(true); }}
            onViewProgress={(record) => { setSelectedRecord(record); setShowProgress(true); }}
            showActions
          />
        </div>
      </div>

      {showDetail && selectedRecord && (
        <ApprovalDetailModal
          record={selectedRecord}
          onClose={() => { setSelectedRecord(null); setShowDetail(false); }}
        />
      )}

      {showProgress && selectedRecord && (
        <ApprovalProgressModal
          record={selectedRecord}
          onClose={() => { setSelectedRecord(null); setShowProgress(false); }}
        />
      )}
    </div>
  );
}
