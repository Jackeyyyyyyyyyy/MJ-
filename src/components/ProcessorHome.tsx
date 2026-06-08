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
    <div className="space-y-8 pb-40 animate-in fade-in duration-700">
      <StatsOverview
        title="办理"
        subtitle="审批通过后的后续处理"
        items={summaryItems}
      />

      <div className="flex p-1 bg-lightest-gray-background rounded-xl w-full lg:w-fit overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('pending')}
          className={cn(
            "flex-1 lg:flex-none px-8 py-2.5 text-[13px] font-bold rounded-lg transition-all flex items-center justify-center gap-3",
            activeTab === 'pending' ? "bg-white text-black shadow-sm" : "text-light-gray hover:text-black"
          )}
        >
          待办理
          {pendingRecords.length > 0 && (
            <span className="px-2 min-w-[18px] h-[18px] bg-black text-white text-[10px] flex items-center justify-center rounded-full">
              {pendingRecords.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('processed')}
          className={cn(
            "flex-1 lg:flex-none px-8 py-2.5 text-[13px] font-bold rounded-lg transition-all",
            activeTab === 'processed' ? "bg-white text-black shadow-sm" : "text-light-gray hover:text-black"
          )}
        >
          已办理
        </button>
      </div>

      <div className="bg-white border border-border-silver rounded-2xl overflow-hidden shadow-sm">
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
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsCompleting(false)}
              className="absolute inset-0 bg-midnight-graphite/40 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98, y: 10 }}
              className="bg-pure-white rounded-apple-img w-full max-w-md relative p-10 shadow-apple-xl"
            >
              <div className="flex items-center gap-4 text-[#2e7d32] mb-6">
                <CheckCircle2 size={24} />
                <h3 className="text-[21px] font-bold">完成办理</h3>
              </div>
              <p className="text-[15px] text-medium-gray mb-6 font-medium">
                确认已完成{selectedRecord?.processorTaskName || '办理任务'}，可填写备注。
              </p>
              <textarea
                className="input-field min-h-[120px] mb-8 bg-canvas-white p-4 font-medium"
                placeholder="例如：已完成付款，流水号..."
                value={completeComment}
                onChange={(event) => setCompleteComment(event.target.value)}
                autoFocus
              />
              <div className="flex flex-col gap-3">
                <button onClick={handleCompleteSubmit} className="btn-primary w-full bg-[#2e7d32] hover:bg-[#256629]">
                  确认完成
                </button>
                <button onClick={() => setIsCompleting(false)} className="w-full h-[44px] text-[15px] font-semibold text-medium-gray hover:text-midnight-graphite">
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
