import { ApprovalRecord, ApprovalStatus, ApprovalLog } from './types';

const STORAGE_KEY = 'mj_approval_records';

export const storage = {
  getRecords(): ApprovalRecord[] {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveRecords(records: ApprovalRecord[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  },

  addRecord(record: Omit<ApprovalRecord, 'id' | 'createdAt' | 'updatedAt' | 'logs' | 'status'>): ApprovalRecord {
    const records = this.getRecords();
    const now = new Date().toISOString();
    const newRecord: ApprovalRecord = {
      ...record,
      id: `APP-${Date.now()}`,
      status: ApprovalStatus.PENDING,
      createdAt: now,
      updatedAt: now,
      logs: [
        {
          action: '发起申请',
          user: record.applicant,
          time: now,
          details: '提交了审批单'
        }
      ]
    };
    records.unshift(newRecord);
    this.saveRecords(records);
    return newRecord;
  },

  updateStatus(id: string, status: ApprovalStatus, approver: string, reason?: string) {
    const records = this.getRecords();
    const index = records.findIndex(r => r.id === id);
    if (index !== -1) {
      const now = new Date().toISOString();
      const log: ApprovalLog = {
        action: status === ApprovalStatus.APPROVED ? '批准' : '拒绝',
        user: approver,
        time: now,
        details: reason || (status === ApprovalStatus.APPROVED ? '审批通过' : '审批拒绝')
      };
      
      records[index] = {
        ...records[index],
        status,
        updatedAt: now,
        approver,
        ...(status === ApprovalStatus.APPROVED ? { approvedAt: now } : { rejectedAt: now, rejectReason: reason }),
        logs: [...records[index].logs, log]
      };
      this.saveRecords(records);
    }
  },

  clearAll() {
    this.saveRecords([]);
  }
};
