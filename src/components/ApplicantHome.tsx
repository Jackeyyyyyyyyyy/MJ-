import React, { useState, useEffect, useMemo } from 'react';
import { storage } from '../storage';
import { auth } from '../auth';
import { ApprovalRecord, ApprovalStatus } from '../types';
import ApprovalTable from './ApprovalTable';
import CreateApprovalModal from './CreateApprovalModal';
import ApprovalDetailModal from './ApprovalDetailModal';
import ApprovalProgressModal from './ApprovalProgressModal';
import StatsOverview from './StatsOverview';
import { cn } from '../lib/utils';
import { Plus, FileText, CheckCircle2, Clock, XCircle } from 'lucide-react';

const ALL_STATUS = '全部状态';

export default function ApplicantHome() {
  const [records, setRecords] = useState<ApprovalRecord[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<ApprovalRecord | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>(ALL_STATUS);

  const user = auth.getCurrentUser();

  const loadData = async () => {
    if (user) {
      const all = await storage.getRecords();
      setRecords(all.filter(r => r.applicant === user.name));
    }
  };

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 3000);
    return () => clearInterval(timer);
  }, []);

  const stats = useMemo(() => records.reduce(
    (summary, record) => {
      summary.total += 1;
      if (record.status === ApprovalStatus.PENDING) summary.pending += 1;
      if (record.status === ApprovalStatus.PROCESSING) summary.processing += 1;
      if (record.status === ApprovalStatus.APPROVED) summary.approved += 1;
      if (record.status === ApprovalStatus.COMPLETED) summary.completed += 1;
      if (record.status === ApprovalStatus.REJECTED) summary.rejected += 1;
      return summary;
    },
    { total: 0, pending: 0, processing: 0, approved: 0, completed: 0, rejected: 0 },
  ), [records]);

  const filteredRecords = useMemo(() => {
    if (filterStatus === ALL_STATUS) return records;
    return records.filter(record => record.status === filterStatus);
  }, [records, filterStatus]);

  const summaryItems = [
    { label: '总申请', value: stats.total, icon: FileText, tone: 'text-midnight-graphite', bg: 'bg-lightest-gray-background' },
    { label: '待审批', value: stats.pending, icon: Clock, tone: 'text-medium-gray', bg: 'bg-lightest-gray-background' },
    { label: '待办理', value: stats.processing, icon: Clock, tone: 'text-[#7b5b18]', bg: 'bg-[#fff7e0]' },
    { label: '已完成', value: stats.approved + stats.completed, icon: CheckCircle2, tone: 'text-[#2e7d32]', bg: 'bg-[#e8f5e9]' },
    { label: '被驳回', value: stats.rejected, icon: XCircle, tone: 'text-[#c62828]', bg: 'bg-[#ffebee]' },
  ];

  return (
    <div className="space-y-3 pb-32 animate-in fade-in duration-700 lg:space-y-8 lg:pb-40">
      <StatsOverview
        title="我的申请"
        subtitle="管理与追踪"
        items={summaryItems}
      />

      <div className="space-y-2.5 lg:space-y-5">
        <div className="flex flex-col justify-between gap-2 lg:flex-row lg:items-center lg:gap-4">
          <div className="flex items-center justify-between gap-3 lg:block">
            <h2 className="text-[17px] font-semibold text-midnight-graphite lg:text-[20px] lg:font-bold lg:tracking-tight">历史记录</h2>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex h-8 items-center justify-center gap-1.5 rounded-full bg-midnight-graphite px-3 text-[12px] font-medium text-white transition-all active:scale-[0.98] lg:hidden"
            >
              <Plus size={13} strokeWidth={2.5} />
              <span>新建</span>
            </button>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center lg:flex-row lg:items-center">
            <div className="-mx-1 overflow-x-auto no-scrollbar px-1 sm:mx-0 sm:px-0">
              <div className="inline-flex min-w-max rounded-[14px] bg-[#ececf0] p-1 lg:flex lg:rounded-xl lg:border-0 lg:bg-lightest-gray-background">
              {(['ALL', ApprovalStatus.PENDING, ApprovalStatus.PROCESSING, ApprovalStatus.APPROVED, ApprovalStatus.COMPLETED, ApprovalStatus.REJECTED] as string[]).map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status === 'ALL' ? ALL_STATUS : status)}
                  className={cn(
                    "h-6 rounded-[10px] px-2.5 text-[11px] font-medium transition-all lg:h-auto lg:rounded-lg lg:px-4 lg:py-1.5 lg:text-[11px] lg:font-bold",
                    (filterStatus === status || (filterStatus === ALL_STATUS && status === 'ALL'))
                      ? "bg-white text-midnight-graphite shadow-sm lg:bg-white lg:text-black"
                      : "text-medium-gray hover:text-black lg:text-light-gray"
                  )}
                >
                  {status === 'ALL'
                    ? '全部'
                    : status === ApprovalStatus.PENDING
                      ? '待审批'
                      : status === ApprovalStatus.PROCESSING
                        ? '待办理'
                        : status === ApprovalStatus.COMPLETED
                          ? '已完成'
                        : (status === ApprovalStatus.APPROVED ? '已通过' : '驳回')}
                </button>
              ))}
              </div>
            </div>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="hidden h-11 px-5 bg-black text-white rounded-full text-[14px] font-bold hover:bg-zinc-800 active:scale-[0.98] transition-all lg:flex items-center justify-center gap-2 shadow-sm"
            >
              <Plus size={15} strokeWidth={3} />
              <span>新建申请</span>
            </button>
          </div>
        </div>
        <div className="lg:bg-white lg:border lg:border-border-silver lg:rounded-2xl lg:overflow-hidden lg:shadow-sm">
          <ApprovalTable 
            records={filteredRecords}
            onViewDetail={(r) => { setSelectedRecord(r); setShowDetail(true); }}
            onViewProgress={(r) => { setSelectedRecord(r); setShowProgress(true); }}
            showActions={true}
          />
        </div>
      </div>


      <CreateApprovalModal 
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={loadData}
      />

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
