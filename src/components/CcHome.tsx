import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, FileText, Send, XCircle } from 'lucide-react';
import { auth } from '../auth';
import { storage } from '../storage';
import { ApprovalRecord, ApprovalStatus } from '../types';
import ApprovalDetailModal from './ApprovalDetailModal';
import ApprovalProgressModal from './ApprovalProgressModal';
import ApprovalTable from './ApprovalTable';
import StatsOverview from './StatsOverview';

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
      if (record.status === ApprovalStatus.REJECTED) summary.rejected += 1;
      if (String(record.updatedAt || record.createdAt).slice(0, 10) === new Date().toISOString().slice(0, 10)) {
        summary.today += 1;
      }
      return summary;
    },
    { total: 0, approved: 0, rejected: 0, today: 0 },
  ), [records]);

  const summaryItems = [
    { label: '总抄送', value: stats.total, icon: Send, tone: 'text-midnight-graphite', bg: 'bg-lightest-gray-background' },
    { label: '今日新增', value: stats.today, icon: FileText, tone: 'text-medium-gray', bg: 'bg-lightest-gray-background' },
    { label: '已通过', value: stats.approved, icon: CheckCircle2, tone: 'text-[#2e7d32]', bg: 'bg-[#e8f5e9]' },
    { label: '已拒绝', value: stats.rejected, icon: XCircle, tone: 'text-[#c62828]', bg: 'bg-[#ffebee]' },
  ];

  return (
    <div className="space-y-8 pb-40 animate-in fade-in duration-700">
      <StatsOverview
        title="我的抄送"
        subtitle="流程结果与同步记录"
        items={summaryItems}
      />

      <div className="space-y-5">
        <h2 className="text-[20px] font-bold tracking-tight">抄送记录</h2>
        <div className="bg-white border border-border-silver rounded-2xl overflow-hidden shadow-sm">
          <ApprovalTable
            records={records}
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
