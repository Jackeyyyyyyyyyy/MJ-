import { AccountInput, ApprovalAttachment, ApprovalRecord, ApprovalStatus, SystemAccount } from './types';
import { auth } from './auth';

type NewApprovalRecord = Omit<ApprovalRecord, 'id' | 'createdAt' | 'updatedAt' | 'logs' | 'status'>;
type UploadInput = Pick<ApprovalAttachment, 'name' | 'type' | 'size'> & {
  data: string;
};

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

async function download(url: string): Promise<Blob> {
  const token = auth.getToken();
  const response = await fetch(url, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`File download failed: ${response.status}`);
  }

  return response.blob();
}

export const storage = {
  getRecords(): Promise<ApprovalRecord[]> {
    return request<ApprovalRecord[]>('/records');
  },

  getAccounts(): Promise<SystemAccount[]> {
    return request<SystemAccount[]>('/accounts');
  },

  createAccount(account: AccountInput): Promise<SystemAccount> {
    return request<SystemAccount>('/accounts', {
      method: 'POST',
      body: JSON.stringify(account),
    });
  },

  updateAccount(id: string, account: Partial<AccountInput>): Promise<SystemAccount> {
    return request<SystemAccount>(`/accounts/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(account),
    });
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

  uploadFiles(files: UploadInput[]): Promise<ApprovalAttachment[]> {
    return request<ApprovalAttachment[]>('/uploads', {
      method: 'POST',
      body: JSON.stringify({ files }),
    });
  },

  downloadAttachment(attachment: ApprovalAttachment): Promise<Blob> {
    return download(attachment.url);
  },
};
