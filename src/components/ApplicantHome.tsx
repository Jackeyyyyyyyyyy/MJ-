import React, { useState, useEffect, useMemo } from 'react';
import { storage } from '../storage';
import { auth } from '../auth';
import { ApprovalRecord, ApprovalStatus } from '../types';
import ApprovalTable from './ApprovalTable';
import CreateApprovalModal from './CreateApprovalModal';
import ApprovalDetailModal from './ApprovalDetailModal';
import ApprovalProgressModal from './ApprovalProgressModal';
import StatsOverview from './StatsOverview';
import { Plus, FileText, CheckCircle2, Clock, XCircle } from 'lucide-react';

export default function ApplicantHome() {
  const [records, setRecords] = useState<ApprovalRecord[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<ApprovalRecord | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showProgress, setShowProgress] = useState(false);

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
      if (record.status === ApprovalStatus.APPROVED) summary.approved += 1;
      if (record.status === ApprovalStatus.REJECTED) summary.rejected += 1;
      return summary;
    },
    { total: 0, pending: 0, approved: 0, rejected: 0 },
  ), [records]);

  const summaryItems = [
    { label: '总申请', value: stats.total, icon: FileText, tone: 'text-midnight-graphite', bg: 'bg-lightest-gray-background' },
    { label: '待审批', value: stats.pending, icon: Clock, tone: 'text-medium-gray', bg: 'bg-lightest-gray-background' },
    { label: '已通过', value: stats.approved, icon: CheckCircle2, tone: 'text-[#2e7d32]', bg: 'bg-[#e8f5e9]' },
    { label: '被驳回', value: stats.rejected, icon: XCircle, tone: 'text-[#c62828]', bg: 'bg-[#ffebee]' },
  ];

  return (
    <div className="space-y-8 pb-40 animate-in fade-in duration-700">
      <StatsOverview
        title="我的申请"
        subtitle="管理与追踪"
        items={summaryItems}
        action={(
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="h-9 px-4 bg-black text-white rounded-lg text-[13px] font-bold hover:bg-zinc-800 transition-all flex items-center justify-center gap-2"
          >
            <Plus size={15} strokeWidth={3} />
            <span>新建申请</span>
          </button>
        )}
      />

      <div className="space-y-5">
        <h2 className="text-[20px] font-bold tracking-tight">历史记录</h2>
        <div className="bg-white border border-border-silver rounded-2xl overflow-hidden shadow-sm">
          <ApprovalTable 
            records={records}
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
