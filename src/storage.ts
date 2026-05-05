import { ApprovalRecord, ApprovalStatus } from './types';
import { auth } from './auth';

type NewApprovalRecord = Omit<ApprovalRecord, 'id' | 'createdAt' | 'updatedAt' | 'logs' | 'status'>;

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = auth.getToken();
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  if (!response.ok) {
    let message = `API request failed: ${response.status}`;

    try {
      const body = await response.json();
      if (body?.error) message = body.error;
    } catch {
      // Ignore invalid error bodies and use the status-based message.
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export const storage = {
  getRecords(): Promise<ApprovalRecord[]> {
    return request<ApprovalRecord[]>('/records');
  },

  addRecord(record: NewApprovalRecord): Promise<ApprovalRecord> {
    return request<ApprovalRecord>('/records', {
      method: 'POST',
      body: JSON.stringify(record),
    });
  },

  updateStatus(
    id: string,
    status: ApprovalStatus,
    approver: string,
    reason?: string,
  ): Promise<ApprovalRecord> {
    return request<ApprovalRecord>(`/records/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, approver, reason }),
    });
  },

  clearAll(): Promise<void> {
    return request<void>('/records', {
      method: 'DELETE',
    });
  },
};
