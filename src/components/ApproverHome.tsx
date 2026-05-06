import React, { useState, useEffect, useMemo } from 'react';
import { storage } from '../storage';
import { auth } from '../auth';
import { ApprovalRecord, ApprovalStatus } from '../types';
import { cn } from '../lib/utils';
import ApprovalTable from './ApprovalTable';
import ApprovalDetailModal from './ApprovalDetailModal';
import ApprovalProgressModal from './ApprovalProgressModal';
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
  const stats = [
    { label: '总申请', value: records.length, icon: FileText },
    { label: '待审批', value: pendingRecords.length, icon: Clock },
    { label: '已通过', value: records.filter(r => r.status === ApprovalStatus.APPROVED).length, icon: CheckCircle2 },
    { label: '被驳回', value: records.filter(r => r.status === ApprovalStatus.REJECTED).length, icon: XCircle },
  ];

  const loadData = async () => {
    const all = await storage.getRecords();
    setPendingRecords(all.filter(r => r.status === ApprovalStatus.PENDING));
    setProcessedRecords(all.filter(r => r.status !== ApprovalStatus.PENDING));
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
    <div className="space-y-12 pb-40 animate-in fade-in duration-700">
      <header className="flex flex-col gap-1">
        <h1 className="text-[32px] font-bold tracking-tight">审批</h1>
        <p className="text-[14px] text-light-gray font-medium">待办事宜与处理记录</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((item, idx) => (
          <div key={idx} className="bg-white border border-border-silver p-8 flex flex-col gap-6 rounded-2xl group hover:shadow-xl hover:shadow-black/[0.02] transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-light-gray uppercase tracking-widest">{item.label}</span>
              <item.icon size={18} className="text-light-silver" />
            </div>
            <p className="text-[32px] font-bold text-midnight-graphite tracking-tighter">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="flex p-1 bg-lightest-gray-background rounded-xl w-full lg:w-fit overflow-x-auto no-scrollbar">
        <button 
          onClick={() => setActiveTab('pending')}
          className={cn(
            "flex-1 lg:flex-none px-8 py-2.5 text-[13px] font-bold rounded-lg transition-all flex items-center justify-center gap-3",
            activeTab === 'pending' ? "bg-white text-black shadow-sm" : "text-light-gray hover:text-black"
          )}
        >
          待处理
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
          历史记录
        </button>
      </div>

      <div className="bg-white border border-border-silver rounded-2xl overflow-hidden shadow-sm">
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
