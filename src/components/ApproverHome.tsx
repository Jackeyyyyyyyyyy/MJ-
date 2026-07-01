import React, { useState, useEffect, useMemo } from 'react';
import { storage } from '../storage';
import { auth } from '../auth';
import { ApprovalRecord, ApprovalStatus } from '../types';
import { cn } from '../lib/utils';
import ApprovalTable from './ApprovalTable';
import ApprovalDetailModal from './ApprovalDetailModal';
import ApprovalProgressModal from './ApprovalProgressModal';
import StatsOverview from './StatsOverview';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, CheckCircle2, Clock, FileText, XCircle } from 'lucide-react';

export default function ApproverHome() {
  const [pendingRecords, setPendingRecords] = useState<ApprovalRecord[]>([]);
  const [processedRecords, setProcessedRecords] = useState<ApprovalRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<ApprovalRecord | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  
  const [activeTab, setActiveTab] = useState<'pending' | 'processed'>('pending');

  const user = auth.getCurrentUser();
  const records = useMemo(
    () => [...pendingRecords, ...processedRecords],
    [pendingRecords, processedRecords],
  );
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

  const summaryItems = [
    { label: '总申请', value: stats.total, icon: FileText, tone: 'text-midnight-graphite', bg: 'bg-lightest-gray-background' },
    { label: '待审批', value: stats.pending, icon: Clock, tone: 'text-medium-gray', bg: 'bg-lightest-gray-background' },
    { label: '待办理', value: stats.processing, icon: Clock, tone: 'text-[#7b5b18]', bg: 'bg-[#fff7e0]' },
    { label: '已完成', value: stats.approved + stats.completed, icon: CheckCircle2, tone: 'text-[#2e7d32]', bg: 'bg-[#e8f5e9]' },
    { label: '被驳回', value: stats.rejected, icon: XCircle, tone: 'text-[#c62828]', bg: 'bg-[#ffebee]' },
  ];

  const loadData = async () => {
    const all = await storage.getRecords();
    setPendingRecords(all.filter(r => r.status === ApprovalStatus.PENDING && r.currentUserCanApprove));
    setProcessedRecords(all.filter(r => r.status !== ApprovalStatus.PENDING && r.currentUserHasApproved));
  };

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 3000);
    return () => clearInterval(timer);
  }, []);

  const confirmApprove = async () => {
    if (selectedRecord && user) {
      await storage.updateStatus(selectedRecord.id, ApprovalStatus.APPROVED, user.name);
      setIsApproving(false);
      setSelectedRecord(null);
      await loadData();
    }
  };

  const openApproveConfirm = (record: ApprovalRecord) => {
    setSelectedRecord(record);
    setShowDetail(false);
    setIsApproving(true);
  };

  const openRejectConfirm = (record: ApprovalRecord) => {
    setSelectedRecord(record);
    setShowDetail(false);
    setIsRejecting(true);
  };

  const handleRejectSubmit = async () => {
    if (selectedRecord && user && rejectReason.trim()) {
      await storage.updateStatus(selectedRecord.id, ApprovalStatus.REJECTED, user.name, rejectReason);
      setIsRejecting(false);
      setRejectReason('');
      setSelectedRecord(null);
      await loadData();
    }
  };

  return (
    <div className="space-y-3 pb-28 animate-in fade-in duration-700 lg:space-y-8 lg:pb-40">
      <div className="hidden lg:block">
        <StatsOverview
          title="审批"
          subtitle="待办事宜与处理记录"
          items={summaryItems}
        />
      </div>

      <div className="flex gap-6 overflow-x-auto border-b border-black/[0.045] no-scrollbar lg:mx-0 lg:w-fit lg:gap-0 lg:rounded-xl lg:border-0 lg:bg-lightest-gray-background lg:p-1">
        <button 
          onClick={() => setActiveTab('pending')}
          className={cn(
            "flex h-9 shrink-0 items-center justify-center gap-1.5 border-b-2 px-0 text-[13.5px] font-medium transition-all lg:h-auto lg:flex-1 lg:gap-3 lg:rounded-lg lg:border-0 lg:px-8 lg:py-2.5 lg:text-[13px] lg:font-bold",
            activeTab === 'pending'
              ? "border-midnight-graphite text-midnight-graphite lg:bg-white lg:text-black lg:shadow-sm"
              : "border-transparent text-light-gray hover:text-black lg:bg-transparent lg:text-light-gray"
          )}
        >
          待处理
          {pendingRecords.length > 0 && (
            <span className="flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-[#f2f3f6] px-1 text-[9px] text-current lg:h-[16px] lg:min-w-[16px] lg:bg-black lg:text-[10px] lg:text-white">
              {pendingRecords.length}
            </span>
          )}
        </button>
        <button 
          onClick={() => setActiveTab('processed')}
          className={cn(
            "h-9 shrink-0 border-b-2 px-0 text-[13.5px] font-medium transition-all lg:h-auto lg:flex-1 lg:rounded-lg lg:border-0 lg:px-8 lg:py-2.5 lg:text-[13px] lg:font-bold",
            activeTab === 'processed'
              ? "border-midnight-graphite text-midnight-graphite lg:bg-white lg:text-black lg:shadow-sm"
              : "border-transparent text-light-gray hover:text-black lg:bg-transparent lg:text-light-gray"
          )}
        >
          历史记录
        </button>
      </div>

      <div className="lg:bg-white lg:border lg:border-border-silver lg:rounded-2xl lg:overflow-hidden lg:shadow-sm">
        <ApprovalTable 
          records={activeTab === 'pending' ? pendingRecords : processedRecords}
          onViewDetail={(r) => { setSelectedRecord(r); setShowDetail(true); }}
          onViewProgress={(r) => { setSelectedRecord(r); setShowProgress(true); }}
          showActions={true}
        />
      </div>


      {showDetail && selectedRecord && (
        <ApprovalDetailModal 
          record={selectedRecord}
          onClose={() => { if(!isRejecting && !isApproving) setSelectedRecord(null); setShowDetail(false); }}
          showAiSuggestion
          onApprove={activeTab === 'pending' ? openApproveConfirm : undefined}
          onReject={activeTab === 'pending' ? openRejectConfirm : undefined}
        />
      )}

      {showProgress && selectedRecord && (
        <ApprovalProgressModal 
          record={selectedRecord}
          onClose={() => { if(!isRejecting && !isApproving) setSelectedRecord(null); setShowProgress(false); }}
        />
      )}

      <AnimatePresence>
        {isApproving && (
          <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsApproving(false)}
              className="absolute inset-0 bg-black/25 backdrop-blur-sm sm:bg-midnight-graphite/35"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 22 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98, y: 22 }}
              className="relative w-full rounded-t-[22px] bg-white px-5 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-[18px] text-center shadow-[0_-4px_16px_rgba(20,24,34,0.055)] sm:max-w-sm sm:rounded-[18px] sm:p-8 sm:shadow-[0_14px_34px_rgba(20,24,34,0.12)]"
            >
              <div className="mx-auto mb-3.5 flex h-11 w-11 items-center justify-center rounded-full bg-[#e8f5e9] text-[#2e7d32] sm:mb-5 sm:h-14 sm:w-14">
                <CheckCircle2 size={26} strokeWidth={2.2} />
              </div>
              <h3 className="mb-2 text-[17px] font-semibold text-midnight-graphite sm:text-[20px]">确认批准</h3>
              <p className="mb-6 px-2 text-[14px] font-medium leading-6 text-medium-gray sm:mb-7">审批通过后会进入后续流程，确定批准该笔申请吗？</p>
              <div className="flex flex-col gap-2.5">
                <button onClick={confirmApprove} className="flex h-11 w-full items-center justify-center rounded-full bg-[#2e7d32] px-4 text-[14.5px] font-semibold text-white transition-colors hover:bg-[#256629] active:scale-[0.99]">
                  确定批准
                </button>
                <button onClick={() => setIsApproving(false)} className="h-10 w-full text-[14px] font-semibold text-medium-gray hover:text-midnight-graphite">
                  取消
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isRejecting && (
          <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsRejecting(false)}
              className="absolute inset-0 bg-black/25 backdrop-blur-sm sm:bg-midnight-graphite/35"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 22 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98, y: 22 }}
              className="relative w-full rounded-t-[22px] bg-white px-5 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-[18px] shadow-[0_-4px_16px_rgba(20,24,34,0.055)] sm:max-w-md sm:rounded-[18px] sm:p-8 sm:shadow-[0_14px_34px_rgba(20,24,34,0.12)]"
            >
              <div className="mb-4 flex items-center gap-3 text-[#c62828] sm:mb-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#fff0f0]">
                  <AlertCircle size={20} strokeWidth={2.3} />
                </span>
                <h3 className="text-[17px] font-semibold text-midnight-graphite sm:text-[20px]">拒绝申请确认</h3>
              </div>
              <p className="mb-4 text-[14px] font-medium leading-6 text-medium-gray">请输入拒绝原因，该信息将被记录并同步。</p>
              <textarea 
                className="mb-5 min-h-[104px] w-full resize-none rounded-[16px] border border-transparent bg-[#f6f7fb] p-3.5 text-[13.5px] font-medium leading-6 text-midnight-graphite outline-none transition-colors placeholder:text-light-gray focus:border-interactive-blue"
                placeholder="详细拒绝理由..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                autoFocus
              />
              <div className="flex flex-col gap-2.5">
                <button 
                  onClick={handleRejectSubmit}
                  disabled={!rejectReason.trim()}
                  className="flex h-11 w-full items-center justify-center rounded-full bg-[#c62828] px-4 text-[14.5px] font-semibold text-white transition-colors hover:bg-[#a52121] active:scale-[0.99] disabled:opacity-30"
                >
                  确认拒绝
                </button>
                <button onClick={() => setIsRejecting(false)} className="h-10 w-full text-[14px] font-semibold text-medium-gray hover:text-midnight-graphite">
                  返回
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
