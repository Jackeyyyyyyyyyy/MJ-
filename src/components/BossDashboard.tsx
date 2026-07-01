import React, { useState, useEffect, useMemo } from 'react';
import { storage } from '../storage';
import { auth } from '../auth';
import { ApprovalRecord, ApprovalStatus } from '../types';
import ApprovalTable from './ApprovalTable';
import ApprovalDetailModal from './ApprovalDetailModal';
import ApprovalProgressModal from './ApprovalProgressModal';
import StatsOverview from './StatsOverview';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Trash2,
  Loader2,
  UserCheck
} from 'lucide-react';

export default function BossDashboard() {
  const [allRecords, setAllRecords] = useState<ApprovalRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<ApprovalRecord | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('全部状态');

  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [isClearingRecords, setIsClearingRecords] = useState(false);
  const [clearError, setClearError] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  const user = auth.getCurrentUser();
  const canClearRecords = auth.getSessionUser()?.role === 'developer' && auth.getPerspective() === 'developer';

  const loadData = async () => {
    setAllRecords(await storage.getRecords());
  };

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 5000);
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

  const handleCompleteProcess = async (record: ApprovalRecord) => {
    if (!window.confirm(`确认完成 ${record.processorTaskName || '办理任务'}？`)) return;

    await storage.completeProcessing(record.id);
    setSelectedRecord(null);
    await loadData();
  };

  const openClearConfirm = () => {
    setClearError('');
    setIsClearConfirmOpen(true);
  };

  const handleClearRecords = async () => {
    setIsClearingRecords(true);
    setClearError('');

    try {
      await storage.clearAll();
      setSelectedRecord(null);
      setShowDetail(false);
      setShowProgress(false);
      setSearchTerm('');
      setFilterStatus('全部状态');
      setIsClearConfirmOpen(false);
      await loadData();
    } catch (error) {
      setClearError(error instanceof Error ? error.message : '清空审批记录失败');
    } finally {
      setIsClearingRecords(false);
    }
  };

  const filteredRecords = useMemo(() => {
    return allRecords.filter(r => {
      const matchSearch = r.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          r.approvalTypeName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = filterStatus === '全部状态' || r.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [allRecords, searchTerm, filterStatus]);

  const stats = useMemo(() => {
    return allRecords.reduce(
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
    );
  }, [allRecords]);

  const summaryItems = [
    { label: '总申请', value: stats.total, icon: FileText, tone: 'text-midnight-graphite', bg: 'bg-lightest-gray-background' },
    { label: '待审批', value: stats.pending, icon: Clock, tone: 'text-medium-gray', bg: 'bg-lightest-gray-background' },
    { label: '待办理', value: stats.processing, icon: UserCheck, tone: 'text-[#7b5b18]', bg: 'bg-[#fff7e0]' },
    { label: '已完成', value: stats.approved + stats.completed, icon: CheckCircle2, tone: 'text-[#2e7d32]', bg: 'bg-[#e8f5e9]' },
    { label: '被驳回', value: stats.rejected, icon: XCircle, tone: 'text-[#c62828]', bg: 'bg-[#ffebee]' },
  ];

  return (
    <div className="space-y-4 pb-32 animate-in fade-in duration-700 lg:space-y-8 lg:pb-40">
      <StatsOverview
        title="概览"
        subtitle="实时运营状态"
        items={summaryItems}
      />

      <div className="space-y-4 lg:space-y-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:gap-6 lg:items-center justify-between">
          <div className="flex flex-col gap-1">
            <h2 className="text-[18px] font-bold tracking-tight lg:text-[20px]">流水明细</h2>
            {canClearRecords && (
              <p className="text-[12px] font-semibold text-medium-gray">超管可清空全部审批记录</p>
            )}
          </div>
          
          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center lg:gap-4">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-light-silver w-3.5 h-3.5 transition-colors group-focus-within:text-black" />
              <input 
                type="text" 
                placeholder="搜索..." 
                className="h-10 w-full rounded-[18px] bg-white py-2 pl-9 pr-3 text-[13px] font-semibold outline-none ring-1 ring-black/[0.03] transition-all focus:ring-black/[0.12] lg:w-48 lg:rounded-none lg:bg-transparent lg:border-b lg:border-border-silver lg:pr-2 lg:focus:border-black lg:ring-0"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex overflow-x-auto no-scrollbar rounded-[18px] bg-white p-1 shadow-[0_8px_24px_rgba(16,24,40,0.05)] lg:bg-lightest-gray-background lg:rounded-xl lg:shadow-none">
              {(['ALL', ApprovalStatus.PENDING, ApprovalStatus.PROCESSING, ApprovalStatus.APPROVED, ApprovalStatus.COMPLETED, ApprovalStatus.REJECTED] as string[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s === 'ALL' ? '全部状态' : s)}
                  className={cn(
                    "h-8 shrink-0 px-3 text-[11px] font-bold rounded-[13px] transition-all lg:h-auto lg:px-4 lg:py-1.5 lg:rounded-lg",
                    (filterStatus === s || (filterStatus === '全部状态' && s === 'ALL')) ? "bg-[#f0f0f2] text-black lg:bg-white lg:shadow-sm" : "text-light-gray hover:text-black"
                  )}
                >
                  {s === 'ALL'
                    ? '全部'
                    : s === ApprovalStatus.PENDING
                      ? '待审批'
                      : s === ApprovalStatus.PROCESSING
                        ? '待办理'
                        : s === ApprovalStatus.COMPLETED
                          ? '已完成'
                          : (s === ApprovalStatus.APPROVED ? '已通过' : '驳回')}
                </button>
              ))}
            </div>

            {canClearRecords && (
              <button
                type="button"
                onClick={openClearConfirm}
                disabled={stats.total === 0}
                className="h-9 px-4 inline-flex items-center gap-2 rounded-xl bg-[#c62828] text-white text-[12px] font-bold shadow-sm transition-all hover:bg-[#a52121] disabled:cursor-not-allowed disabled:bg-light-silver disabled:text-medium-gray disabled:shadow-none"
              >
                <Trash2 size={15} strokeWidth={2.4} />
                清空记录
              </button>
            )}
          </div>
        </div>

        <div className="bg-white border border-border-silver rounded-2xl overflow-hidden shadow-sm">
          <ApprovalTable 
            records={filteredRecords}
            onViewDetail={(r) => { setSelectedRecord(r); setShowDetail(true); }}
            onViewProgress={(r) => { setSelectedRecord(r); setShowProgress(true); }}
            showActions={true}
          />
        </div>
      </div>


      {showDetail && selectedRecord && (
        <ApprovalDetailModal 
          record={selectedRecord}
          onClose={() => { if(!isRejecting && !isApproving) setSelectedRecord(null); setShowDetail(false); }}
          showAiSuggestion
          showAiRawResponse={canClearRecords}
          onApprove={selectedRecord.currentUserCanApprove ? openApproveConfirm : undefined}
          onReject={selectedRecord.currentUserCanApprove ? openRejectConfirm : undefined}
          onCompleteProcess={selectedRecord.currentUserCanProcess ? handleCompleteProcess : undefined}
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
              <p className="text-[15px] text-medium-gray mb-8 px-2 font-medium">作为统筹决策者，确定要批准该笔申请吗？</p>
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
              <p className="text-[15px] text-medium-gray mb-4 font-medium">决策指令驳回，请注明理由：</p>
              <textarea 
                className="w-full bg-[#f5f5f7] border-none rounded-xl min-h-[120px] mb-8 p-4 font-medium text-[14px] outline-none focus:ring-2 ring-black/5"
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

        {isClearConfirmOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => !isClearingRecords && setIsClearConfirmOpen(false)}
              className="absolute inset-0 bg-midnight-graphite/45 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98, y: 10 }}
              className="bg-pure-white rounded-apple-img w-full max-w-md relative p-10 shadow-apple-xl text-center"
            >
              <div className="w-16 h-16 bg-[#ffebee] rounded-full flex items-center justify-center mx-auto mb-6 text-[#c62828]">
                <Trash2 size={30} strokeWidth={2.2} />
              </div>
              <h3 className="text-[21px] font-bold text-midnight-graphite mb-3">清空全部审批记录</h3>
              <p className="text-[15px] text-medium-gray mb-3 px-2 font-medium leading-relaxed">
                将删除当前系统内所有审批流水、业务审批记录和审批进度信息。此操作完成后不可恢复。
              </p>
              <p className="text-[12px] font-bold text-[#c62828] mb-8">
                当前将清空 {stats.total} 条记录
              </p>
              {clearError && (
                <div className="mb-5 rounded-xl border border-[#ffcdd2] bg-[#ffebee]/70 px-4 py-3 text-left text-[13px] font-semibold text-[#c62828]">
                  {clearError}
                </div>
              )}
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleClearRecords}
                  disabled={isClearingRecords}
                  className="btn-primary w-full bg-[#c62828] hover:bg-[#a52121] disabled:opacity-50"
                >
                  {isClearingRecords ? (
                    <span className="inline-flex items-center justify-center gap-2">
                      <Loader2 size={16} className="animate-spin" />
                      正在清空
                    </span>
                  ) : (
                    '一键清空'
                  )}
                </button>
                <button
                  onClick={() => setIsClearConfirmOpen(false)}
                  disabled={isClearingRecords}
                  className="w-full h-[44px] text-[15px] font-semibold text-medium-gray hover:text-midnight-graphite disabled:opacity-50"
                >
                  取消
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
