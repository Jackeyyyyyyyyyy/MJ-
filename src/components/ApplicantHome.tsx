import React, { useState, useEffect } from 'react';
import { storage } from '../storage';
import { auth } from '../auth';
import { cn } from '../lib/utils';
import { ApprovalRecord, ApprovalStatus } from '../types';
import ApprovalTable from './ApprovalTable';
import CreateApprovalModal from './CreateApprovalModal';
import ApprovalDetailModal from './ApprovalDetailModal';
import ApprovalProgressModal from './ApprovalProgressModal';
import { Plus, FileText, CheckCircle2, Clock, XCircle } from 'lucide-react';

export default function ApplicantHome() {
  const [records, setRecords] = useState<ApprovalRecord[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<ApprovalRecord | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showProgress, setShowProgress] = useState(false);

  const user = auth.getCurrentUser();

  const loadData = () => {
    if (user) {
      const all = storage.getRecords();
      setRecords(all.filter(r => r.applicant === user.name));
    }
  };

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 3000);
    return () => clearInterval(timer);
  }, []);

  const stats = [
    { label: '总申请', value: records.length, icon: FileText },
    { label: '待审批', value: records.filter(r => r.status === ApprovalStatus.PENDING).length, icon: Clock },
    { label: '已通过', value: records.filter(r => r.status === ApprovalStatus.APPROVED).length, icon: CheckCircle2 },
    { label: '被驳回', value: records.filter(r => r.status === ApprovalStatus.REJECTED).length, icon: XCircle },
  ];

  return (
    <div className="space-y-16 pb-40 animate-in fade-in duration-700">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-[32px] font-bold tracking-tight">我的申请</h1>
          <p className="text-[14px] text-light-gray font-medium">管理与追踪</p>
        </div>
        <button 
          onClick={() => setIsCreateModalOpen(true)}
          className="h-11 px-6 bg-black text-white rounded-xl text-[14px] font-bold hover:bg-zinc-800 transition-all flex items-center gap-2"
        >
          <Plus size={16} strokeWidth={3} />
          <span>新建申请</span>
        </button>
      </div>

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

      <div className="space-y-8">
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
