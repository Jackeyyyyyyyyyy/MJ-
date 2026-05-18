import {
  AccountInput,
  AiAssistantChatResponse,
  AiAssistantOverview,
  AiAssistantPromptConfig,
  AiPromptConfig,
  ApprovalAttachment,
  ApprovalRecord,
  ApprovalStatus,
  OrganizationDirectory,
  SystemAccount,
  WorkflowTemplate,
  WorkflowTemplateInput,
  WorkflowVersion,
} from './types';
import { auth } from './auth';

type NewApprovalRecord = Omit<ApprovalRecord, 'id' | 'createdAt' | 'updatedAt' | 'logs' | 'status'>;
type UploadInput = Pick<ApprovalAttachment, 'name' | 'type' | 'size'> & {
  data: string;
};

interface RequestOptions {
  skipImpersonation?: boolean;
}

async function request<T>(path: string, options?: RequestInit, requestOptions?: RequestOptions): Promise<T> {
  const token = auth.getToken();
  const impersonatedUsername = requestOptions?.skipImpersonation ? null : auth.getImpersonatedUsername();
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(impersonatedUsername ? { 'X-MJ-Impersonate': impersonatedUsername } : {}),
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
    return request<SystemAccount[]>('/accounts', undefined, { skipImpersonation: true });
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

  getAiPrompt(moduleName: string, approvalTypeName: string): Promise<AiPromptConfig> {
    const params = new URLSearchParams({ moduleName, approvalTypeName });
    return request<AiPromptConfig>(`/ai-prompts?${params.toString()}`);
  },

  updateAiPrompt(
    moduleName: string,
    approvalTypeName: string,
    prompt: string,
  ): Promise<AiPromptConfig> {
    return request<AiPromptConfig>('/ai-prompts', {
      method: 'PATCH',
      body: JSON.stringify({ moduleName, approvalTypeName, prompt }),
    });
  },

  getAiAssistantOverview(): Promise<AiAssistantOverview> {
    return request<AiAssistantOverview>('/ai-assistant/overview');
  },

  askAiAssistant(question: string): Promise<AiAssistantChatResponse> {
    return request<AiAssistantChatResponse>('/ai-assistant/chat', {
      method: 'POST',
      body: JSON.stringify({ question }),
    });
  },

  getAiAssistantPrompt(): Promise<AiAssistantPromptConfig> {
    return request<AiAssistantPromptConfig>('/ai-assistant/prompt');
  },

  updateAiAssistantPrompt(prompt: string): Promise<AiAssistantPromptConfig> {
    return request<AiAssistantPromptConfig>('/ai-assistant/prompt', {
      method: 'PATCH',
      body: JSON.stringify({ prompt }),
    });
  },

  getOrganizationDirectory(): Promise<OrganizationDirectory> {
    return request<OrganizationDirectory>('/organization');
  },

  saveOrganizationDirectory(directory: OrganizationDirectory): Promise<OrganizationDirectory> {
    return request<OrganizationDirectory>('/organization', {
      method: 'PUT',
      body: JSON.stringify(directory),
    });
  },

  getWorkflowTemplates(): Promise<WorkflowTemplate[]> {
    return request<WorkflowTemplate[]>('/workflow-templates');
  },

  createWorkflowTemplate(input: WorkflowTemplateInput): Promise<WorkflowTemplate> {
    return request<WorkflowTemplate>('/workflow-templates', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  updateWorkflowDraft(id: string, draft: WorkflowVersion): Promise<WorkflowTemplate> {
    return request<WorkflowTemplate>(`/workflow-templates/${encodeURIComponent(id)}/draft`, {
      method: 'PATCH',
      body: JSON.stringify({ draft }),
    });
  },

  publishWorkflowTemplate(id: string): Promise<WorkflowTemplate> {
    return request<WorkflowTemplate>(`/workflow-templates/${encodeURIComponent(id)}/publish`, {
      method: 'POST',
    });
  },

  setWorkflowTemplateStatus(id: string, status: WorkflowTemplate['status']): Promise<WorkflowTemplate> {
    return request<WorkflowTemplate>(`/workflow-templates/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  deleteWorkflowTemplate(id: string): Promise<void> {
    return request<void>(`/workflow-templates/${encodeURIComponent(id)}`, {
      method: 'DELETE',
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
