import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Clock, FileText, UserCheck } from 'lucide-react';
import { storage } from '../storage';
import { ApprovalRecord, ApprovalStatus } from '../types';
import ApprovalDetailModal from './ApprovalDetailModal';
import ApprovalProgressModal from './ApprovalProgressModal';
import ApprovalTable from './ApprovalTable';
import StatsOverview from './StatsOverview';
import { cn } from '../lib/utils';

export default function ProcessorHome() {
  const [pendingRecords, setPendingRecords] = useState<ApprovalRecord[]>([]);
  const [processedRecords, setProcessedRecords] = useState<ApprovalRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<ApprovalRecord | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [completeComment, setCompleteComment] = useState('');
  const [activeTab, setActiveTab] = useState<'pending' | 'processed'>('pending');

  const records = useMemo(
    () => [...pendingRecords, ...processedRecords],
    [pendingRecords, processedRecords],
  );
  const stats = useMemo(() => records.reduce(
    (summary, record) => {
      summary.total += 1;
      if (record.status === ApprovalStatus.PROCESSING) summary.processing += 1;
      if (record.status === ApprovalStatus.COMPLETED) summary.completed += 1;
      return summary;
    },
    { total: 0, processing: 0, completed: 0 },
  ), [records]);

  const summaryItems = [
    { label: '办理任务', value: stats.total, icon: FileText, tone: 'text-midnight-graphite', bg: 'bg-lightest-gray-background' },
    { label: '待办理', value: stats.processing, icon: Clock, tone: 'text-medium-gray', bg: 'bg-lightest-gray-background' },
    { label: '已完成', value: stats.completed, icon: CheckCircle2, tone: 'text-[#2e7d32]', bg: 'bg-[#e8f5e9]' },
    { label: '当前待办', value: pendingRecords.length, icon: UserCheck, tone: 'text-[#7b5b18]', bg: 'bg-[#fff7e0]' },
  ];

  const loadData = async () => {
    const all = await storage.getRecords();
    setPendingRecords(all.filter((record) => record.status === ApprovalStatus.PROCESSING && record.currentUserCanProcess));
    setProcessedRecords(all.filter((record) => record.status === ApprovalStatus.COMPLETED && record.currentUserHasProcessed));
  };

  useEffect(() => {
    void loadData();
    const timer = window.setInterval(() => void loadData(), 3000);
    return () => window.clearInterval(timer);
  }, []);

  const openCompleteConfirm = (record: ApprovalRecord) => {
    setSelectedRecord(record);
    setShowDetail(false);
    setCompleteComment('');
    setIsCompleting(true);
  };

  const handleCompleteSubmit = async () => {
    if (!selectedRecord) return;

    await storage.completeProcessing(selectedRecord.id, completeComment.trim());
    setIsCompleting(false);
    setCompleteComment('');
    setSelectedRecord(null);
    await loadData();
  };

  return (
    <div className="space-y-3 pb-28 animate-in fade-in duration-700 lg:space-y-8 lg:pb-40">
      <div className="hidden lg:block">
        <StatsOverview
          title="办理"
          subtitle="审批通过后的后续处理"
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
          待办理
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
          已办理
        </button>
      </div>

      <div className="lg:bg-white lg:border lg:border-border-silver lg:rounded-2xl lg:overflow-hidden lg:shadow-sm">
        <ApprovalTable
          records={activeTab === 'pending' ? pendingRecords : processedRecords}
          onViewDetail={(record) => { setSelectedRecord(record); setShowDetail(true); }}
          onViewProgress={(record) => { setSelectedRecord(record); setShowProgress(true); }}
          showActions
        />
      </div>

      {showDetail && selectedRecord && (
        <ApprovalDetailModal
          record={selectedRecord}
          onClose={() => { if (!isCompleting) setSelectedRecord(null); setShowDetail(false); }}
          onCompleteProcess={activeTab === 'pending' ? openCompleteConfirm : undefined}
        />
      )}

      {showProgress && selectedRecord && (
        <ApprovalProgressModal
          record={selectedRecord}
          onClose={() => { if (!isCompleting) setSelectedRecord(null); setShowProgress(false); }}
        />
      )}

      <AnimatePresence>
        {isCompleting && (
          <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsCompleting(false)}
              className="absolute inset-0 bg-black/25 backdrop-blur-sm sm:bg-midnight-graphite/35"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 22 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98, y: 22 }}
              className="relative w-full rounded-t-[22px] bg-white px-5 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-[18px] shadow-[0_-4px_16px_rgba(20,24,34,0.055)] sm:max-w-md sm:rounded-[18px] sm:p-8 sm:shadow-[0_14px_34px_rgba(20,24,34,0.12)]"
            >
              <div className="mb-4 flex items-center gap-3 text-[#2e7d32] sm:mb-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e8f5e9]">
                  <CheckCircle2 size={20} strokeWidth={2.3} />
                </span>
                <h3 className="text-[17px] font-semibold text-midnight-graphite sm:text-[20px]">完成办理</h3>
              </div>
              <p className="mb-4 text-[14px] font-medium leading-6 text-medium-gray">
                确认已完成{selectedRecord?.processorTaskName || '办理任务'}，可填写备注。
              </p>
              <textarea
                className="mb-5 min-h-[104px] w-full resize-none rounded-[16px] border border-transparent bg-[#f6f7fb] p-3.5 text-[13.5px] font-medium leading-6 text-midnight-graphite outline-none transition-colors placeholder:text-light-gray focus:border-interactive-blue"
                placeholder="例如：已完成付款，流水号..."
                value={completeComment}
                onChange={(event) => setCompleteComment(event.target.value)}
                autoFocus
              />
              <div className="flex flex-col gap-2.5">
                <button onClick={handleCompleteSubmit} className="flex h-11 w-full items-center justify-center rounded-full bg-[#2e7d32] px-4 text-[14.5px] font-semibold text-white transition-colors hover:bg-[#256629] active:scale-[0.99]">
                  确认完成
                </button>
                <button onClick={() => setIsCompleting(false)} className="h-10 w-full text-[14px] font-semibold text-medium-gray hover:text-midnight-graphite">
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
