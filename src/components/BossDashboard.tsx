import React, { useState, useEffect, useMemo } from 'react';
import { storage } from '../storage';
import { auth } from '../auth';
import { ApprovalRecord, ApprovalStatus } from '../types';
import ApprovalTable from './ApprovalTable';
import ApprovalDetailModal from './ApprovalDetailModal';
import ApprovalProgressModal from './ApprovalProgressModal';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle
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
  const [rejectReason, setRejectReason] = useState('');

  const user = auth.getCurrentUser();

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

  const filteredRecords = useMemo(() => {
    return allRecords.filter(r => {
      const matchSearch = r.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          r.approvalTypeName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = filterStatus === '全部状态' || r.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [allRecords, searchTerm, filterStatus]);

  const stats = useMemo(() => {
    return {
      total: allRecords.length,
      pending: allRecords.filter(r => r.status === ApprovalStatus.PENDING).length,
      approved: allRecords.filter(r => r.status === ApprovalStatus.APPROVED).length,
      rejected: allRecords.filter(r => r.status === ApprovalStatus.REJECTED).length
    };
  }, [allRecords]);

  const cards = [
    { label: '总申请', value: stats.total, icon: FileText },
    { label: '待审批', value: stats.pending, icon: Clock },
    { label: '已通过', value: stats.approved, icon: CheckCircle2 },
    { label: '被驳回', value: stats.rejected, icon: XCircle },
  ];

  return (
    <div className="space-y-16 pb-40 animate-in fade-in duration-700">
      <header className="flex flex-col gap-1">
        <h1 className="text-[32px] font-bold tracking-tight">概览</h1>
        <p className="text-[14px] text-light-gray font-medium">实时运营状态</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, idx) => (
          <div key={idx} className="bg-white border border-border-silver p-8 flex flex-col gap-6 group hover:shadow-xl hover:shadow-black/[0.02] transition-all rounded-2xl">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-light-gray uppercase tracking-widest">{card.label}</span>
              <card.icon size={18} className="text-light-silver" />
            </div>
            <p className="text-[32px] font-bold text-midnight-graphite tracking-tighter">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-8">
        <div className="flex flex-col lg:flex-row gap-6 lg:items-center justify-between">
          <h2 className="text-[20px] font-bold tracking-tight">流水明细</h2>
          
          <div className="flex items-center gap-4">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-light-silver w-3.5 h-3.5 transition-colors group-focus-within:text-black" />
              <input 
                type="text" 
                placeholder="搜索..." 
                className="bg-transparent border-b border-border-silver py-2 pl-9 pr-2 text-[13px] focus:border-black outline-none w-48 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex bg-lightest-gray-background p-1 rounded-xl">
              {(['ALL', ApprovalStatus.PENDING, ApprovalStatus.APPROVED, ApprovalStatus.REJECTED] as string[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s === 'ALL' ? '全部状态' : s)}
                  className={cn(
                    "px-4 py-1.5 text-[11px] font-bold rounded-lg transition-all",
                    (filterStatus === s || (filterStatus === '全部状态' && s === 'ALL')) ? "bg-white text-black shadow-sm" : "text-light-gray hover:text-black"
                  )}
                >
                  {s === 'ALL' ? '全部' : (s === ApprovalStatus.PENDING ? '待处理' : (s === ApprovalStatus.APPROVED ? '已通过' : '驳回'))}
                </button>
              ))}
            </div>
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
          onApprove={openApproveConfirm}
          onReject={openRejectConfirm}
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
      </AnimatePresence>
    </div>
  );
}
