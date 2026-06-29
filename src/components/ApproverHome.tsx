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
    <div className="space-y-5 pb-32 animate-in fade-in duration-700 lg:space-y-8 lg:pb-40">
      <StatsOverview
        title="审批"
        subtitle="待办事宜与处理记录"
        items={summaryItems}
      />

      <div className="-mx-1 flex gap-1 overflow-x-auto no-scrollbar rounded-[16px] bg-[#ececf0] p-1 lg:mx-0 lg:w-fit lg:gap-0 lg:rounded-xl lg:bg-lightest-gray-background">
        <button 
          onClick={() => setActiveTab('pending')}
          className={cn(
            "h-8 shrink-0 rounded-[12px] px-3 text-[11px] font-medium transition-all flex items-center justify-center gap-1.5 lg:h-auto lg:flex-1 lg:border-0 lg:rounded-lg lg:px-8 lg:py-2.5 lg:text-[13px] lg:font-bold lg:gap-3",
            activeTab === 'pending'
              ? "bg-white text-midnight-graphite shadow-sm lg:bg-white lg:text-black lg:shadow-sm"
              : "text-medium-gray hover:text-black lg:bg-transparent lg:text-light-gray"
          )}
        >
          待处理
          {pendingRecords.length > 0 && (
            <span className="px-1.5 min-w-[16px] h-[16px] bg-lightest-gray-background text-current lg:bg-black lg:text-white text-[10px] flex items-center justify-center rounded-full">
              {pendingRecords.length}
            </span>
          )}
        </button>
        <button 
          onClick={() => setActiveTab('processed')}
          className={cn(
            "h-8 shrink-0 rounded-[12px] px-3 text-[11px] font-medium transition-all lg:h-auto lg:flex-1 lg:border-0 lg:rounded-lg lg:px-8 lg:py-2.5 lg:text-[13px] lg:font-bold",
            activeTab === 'processed'
              ? "bg-white text-midnight-graphite shadow-sm lg:bg-white lg:text-black lg:shadow-sm"
              : "text-medium-gray hover:text-black lg:bg-transparent lg:text-light-gray"
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

      {/* 确认框使用 Apple 风格 */}
      <AnimatePresence>
        {isApproving && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsApproving(false)}
              className="absolute inset-0 bg-midnight-graphite/40 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98, y: 10 }}
              className="bg-pure-white rounded-apple-img w-full max-w-sm relative p-10 shadow-apple-xl text-center"
            >
              <div className="w-16 h-16 bg-[#e8f5e9] rounded-full flex items-center justify-center mx-auto mb-6 text-[#2e7d32]">
                <CheckCircle2 size={32} strokeWidth={2} />
              </div>
              <h3 className="text-[21px] font-bold text-midnight-graphite mb-3">确认批准</h3>
              <p className="text-[15px] text-medium-gray mb-8 px-2 font-medium">审批一旦通过将向全链路提交，确定要批准该笔申请吗？</p>
              <div className="flex flex-col gap-3">
                <button onClick={confirmApprove} className="btn-primary w-full bg-[#2e7d32] hover:bg-[#256629]">
                  确定批准
                </button>
                <button onClick={() => setIsApproving(false)} className="w-full h-[44px] text-[15px] font-semibold text-medium-gray hover:text-midnight-graphite">
                  取消
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isRejecting && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsRejecting(false)}
              className="absolute inset-0 bg-midnight-graphite/40 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98, y: 10 }}
              className="bg-pure-white rounded-apple-img w-full max-w-md relative p-10 shadow-apple-xl"
            >
              <div className="flex items-center gap-4 text-[#c62828] mb-6">
                <AlertCircle size={24} />
                <h3 className="text-[21px] font-bold">拒绝申请确认</h3>
              </div>
              <p className="text-[15px] text-medium-gray mb-6 font-medium">请输入拒绝原因，该信息将被记录并同步：</p>
              <textarea 
                className="input-field min-h-[120px] mb-8 bg-canvas-white p-4 font-medium"
                placeholder="详细拒绝理由..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                autoFocus
              />
              <div className="flex flex-col gap-3">
                <button 
                  onClick={handleRejectSubmit}
                  disabled={!rejectReason.trim()}
                  className="btn-primary w-full bg-[#c62828] hover:bg-[#a52121] disabled:opacity-30"
                >
                  确认拒绝
                </button>
                <button onClick={() => setIsRejecting(false)} className="w-full h-[44px] text-[15px] font-semibold text-medium-gray hover:text-midnight-graphite">
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
