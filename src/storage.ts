import {
  AccountInput,
  AuthSessionResponse,
  AiAssistantChatResponse,
  AiAssistantOverview,
  AiAssistantPromptConfig,
  AiBranchDecisionLog,
  AiFormFillInput,
  AiFormFillResponse,
  AiPromptConfig,
  ApprovalAttachment,
  ApprovalNotification,
  ApprovalRecord,
  ApprovalStatus,
  ApprovalType,
  OrganizationDirectory,
  OrganizationSelectOptions,
  PasskeyCredentialSummary,
  SystemAccount,
  WorkflowTemplate,
  WorkflowEfficiencySummary,
  WorkflowEfficiencyRange,
  WorkflowTemplateInput,
  WorkflowVersion,
  Schema,
  WebPushConfig,
  WebPushSubscriptionResult,
} from './types';
import { auth } from './auth';

type NewApprovalRecord = Omit<ApprovalRecord, 'id' | 'createdAt' | 'updatedAt' | 'logs' | 'status'>;
type UploadInput = Pick<ApprovalAttachment, 'name' | 'type' | 'size'> & {
  data: string;
};
type BusinessFormInput = {
  moduleName: string;
  approvalTypeName: string;
  businessFields: string[];
  amountFields?: string[];
  fileFields?: string[];
  attachmentFields?: string[];
  dateFields?: string[];
  dateTimeFields?: string[];
  optionalFields?: string[];
  multilineFields?: string[];
  memberFields?: string[];
  departmentFields?: string[];
  selectFields?: Array<{
    field: string;
    options: string[];
  }>;
  detailFields?: Array<{
    field: string;
    columns: ApprovalType['detailFields'][number]['columns'];
  }>;
  durationFields?: ApprovalType['durationFields'];
  visibleToUsers?: boolean;
};

type BusinessFormVisibilityInput = {
  moduleName: string;
  approvalTypeName: string;
  visibleToUsers: boolean;
};

interface RequestOptions {
  skipImpersonation?: boolean;
}

const apiRequestTimeoutMs = 15000;

function getClientTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

async function request<T>(path: string, options?: RequestInit, requestOptions?: RequestOptions): Promise<T> {
  const token = auth.getToken();
  const impersonatedUsername = requestOptions?.skipImpersonation ? null : auth.getImpersonatedUsername();
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), apiRequestTimeoutMs);
  let response: Response;

  try {
    response = await fetch(`/api${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-MJ-Timezone': getClientTimeZone(),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(impersonatedUsername ? { 'X-MJ-Impersonate': impersonatedUsername } : {}),
        ...options?.headers,
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`API request timed out: ${path}`);
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }

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

function emitNotificationsUpdated() {
  window.dispatchEvent(new Event('approval-notifications-updated'));
}

export const storage = {
  getApprovalSchema(): Promise<Schema> {
    return request<Schema>('/approval-schema');
  },

  createBusinessForm(input: BusinessFormInput): Promise<Schema> {
    return request<Schema>('/business-forms', {
      method: 'POST',
      body: JSON.stringify(input),
    }, { skipImpersonation: true });
  },

  updateBusinessForm(
    moduleName: string,
    approvalTypeName: string,
    input: BusinessFormInput,
  ): Promise<Schema> {
    return request<Schema>(
      `/business-forms/${encodeURIComponent(moduleName)}/${encodeURIComponent(approvalTypeName)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(input),
      },
      { skipImpersonation: true },
    );
  },

  deleteBusinessForm(moduleName: string, approvalTypeName: string): Promise<Schema> {
    return request<Schema>(
      `/business-forms/${encodeURIComponent(moduleName)}/${encodeURIComponent(approvalTypeName)}`,
      { method: 'DELETE' },
      { skipImpersonation: true },
    );
  },

  updateBusinessFormVisibility(items: BusinessFormVisibilityInput[]): Promise<Schema> {
    return request<Schema>('/business-form-visibility', {
      method: 'PATCH',
      body: JSON.stringify({ items }),
    }, { skipImpersonation: true });
  },

  getRecords(): Promise<ApprovalRecord[]> {
    return request<ApprovalRecord[]>('/records');
  },

  getNotifications(): Promise<ApprovalNotification[]> {
    return request<ApprovalNotification[]>('/notifications');
  },

  markNotificationRead(id: string): Promise<ApprovalNotification> {
    return request<ApprovalNotification>(`/notifications/${encodeURIComponent(id)}/read`, {
      method: 'PATCH',
    });
  },

  markAllNotificationsRead(): Promise<{ updated: number }> {
    return request<{ updated: number }>('/notifications/read-all', {
      method: 'PATCH',
    });
  },

  getPushConfig(): Promise<WebPushConfig> {
    return request<WebPushConfig>('/push/config');
  },

  savePushSubscription(subscription: PushSubscriptionJSON): Promise<WebPushSubscriptionResult> {
    return request<WebPushSubscriptionResult>('/push/subscriptions', {
      method: 'POST',
      body: JSON.stringify({ subscription }),
    });
  },

  deletePushSubscription(endpoint: string): Promise<WebPushSubscriptionResult> {
    return request<WebPushSubscriptionResult>('/push/subscriptions', {
      method: 'DELETE',
      body: JSON.stringify({ endpoint }),
    });
  },

  getPasskeys(): Promise<PasskeyCredentialSummary[]> {
    return request<PasskeyCredentialSummary[]>('/auth/passkeys');
  },

  getPasskeyRegistrationOptions(): Promise<any> {
    return request<any>('/auth/passkey/register/options', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },

  verifyPasskeyRegistration(credential: unknown): Promise<PasskeyCredentialSummary> {
    return request<PasskeyCredentialSummary>('/auth/passkey/register/verify', {
      method: 'POST',
      body: JSON.stringify({ credential }),
    });
  },

  deletePasskey(id: string): Promise<{ removed: boolean }> {
    return request<{ removed: boolean }>(`/auth/passkeys/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  getPasskeyLoginOptions(username?: string): Promise<any> {
    return request<any>('/auth/passkey/login/options', {
      method: 'POST',
      body: JSON.stringify({ username: username || '' }),
    });
  },

  verifyPasskeyLogin(credential: unknown): Promise<AuthSessionResponse> {
    return request<AuthSessionResponse>('/auth/passkey/login/verify', {
      method: 'POST',
      body: JSON.stringify({ credential }),
    });
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

  deleteAccount(id: string): Promise<void> {
    return request<void>(`/accounts/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  getAiPrompt(moduleName: string, approvalTypeName: string): Promise<AiPromptConfig> {
    const params = new URLSearchParams({ moduleName, approvalTypeName });
    return request<AiPromptConfig>(`/ai-prompts?${params.toString()}`, undefined, { skipImpersonation: true });
  },

  updateAiPrompt(
    moduleName: string,
    approvalTypeName: string,
    prompt: string,
  ): Promise<AiPromptConfig> {
    return request<AiPromptConfig>('/ai-prompts', {
      method: 'PATCH',
      body: JSON.stringify({ moduleName, approvalTypeName, prompt }),
    }, { skipImpersonation: true });
  },

  fillApprovalFormWithAi(input: AiFormFillInput): Promise<AiFormFillResponse> {
    return request<AiFormFillResponse>('/ai-form-fill', {
      method: 'POST',
      body: JSON.stringify(input),
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
    return request<AiAssistantPromptConfig>('/ai-assistant/prompt', undefined, { skipImpersonation: true });
  },

  updateAiAssistantPrompt(prompt: string): Promise<AiAssistantPromptConfig> {
    return request<AiAssistantPromptConfig>('/ai-assistant/prompt', {
      method: 'PATCH',
      body: JSON.stringify({ prompt }),
    }, { skipImpersonation: true });
  },

  getAiBranchDecisionLogs(): Promise<AiBranchDecisionLog[]> {
    return request<AiBranchDecisionLog[]>('/ai-branch-logs', undefined, { skipImpersonation: true });
  },

  getOrganizationDirectory(): Promise<OrganizationDirectory> {
    return request<OrganizationDirectory>('/organization', undefined, { skipImpersonation: true });
  },

  getOrganizationOptions(): Promise<OrganizationSelectOptions> {
    return request<OrganizationSelectOptions>('/organization/options');
  },

  saveOrganizationDirectory(directory: OrganizationDirectory): Promise<OrganizationDirectory> {
    return request<OrganizationDirectory>('/organization', {
      method: 'PUT',
      body: JSON.stringify(directory),
    }, { skipImpersonation: true });
  },

  getWorkflowTemplates(): Promise<WorkflowTemplate[]> {
    return request<WorkflowTemplate[]>('/workflow-templates', undefined, { skipImpersonation: true });
  },

  getWorkflowEfficiencySummary(id: string, range: WorkflowEfficiencyRange = '7d'): Promise<WorkflowEfficiencySummary> {
    return request<WorkflowEfficiencySummary>(
      `/workflow-templates/${encodeURIComponent(id)}/efficiency?range=${encodeURIComponent(range)}`,
      undefined,
      { skipImpersonation: true },
    );
  },

  createWorkflowTemplate(input: WorkflowTemplateInput): Promise<WorkflowTemplate> {
    return request<WorkflowTemplate>('/workflow-templates', {
      method: 'POST',
      body: JSON.stringify(input),
    }, { skipImpersonation: true });
  },

  updateWorkflowDraft(id: string, draft: WorkflowVersion): Promise<WorkflowTemplate> {
    return request<WorkflowTemplate>(`/workflow-templates/${encodeURIComponent(id)}/draft`, {
      method: 'PATCH',
      body: JSON.stringify({ draft }),
    }, { skipImpersonation: true });
  },

  publishWorkflowTemplate(id: string): Promise<WorkflowTemplate> {
    return request<WorkflowTemplate>(`/workflow-templates/${encodeURIComponent(id)}/publish`, {
      method: 'POST',
    }, { skipImpersonation: true });
  },

  duplicateWorkflowTemplate(id: string): Promise<WorkflowTemplate> {
    return request<WorkflowTemplate>(`/workflow-templates/${encodeURIComponent(id)}/duplicate`, {
      method: 'POST',
    }, { skipImpersonation: true });
  },

  setWorkflowTemplateStatus(id: string, status: WorkflowTemplate['status']): Promise<WorkflowTemplate> {
    return request<WorkflowTemplate>(`/workflow-templates/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }, { skipImpersonation: true });
  },

  deleteWorkflowTemplate(id: string): Promise<void> {
    return request<void>(`/workflow-templates/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }, { skipImpersonation: true });
  },

  addRecord(record: NewApprovalRecord): Promise<ApprovalRecord> {
    return request<ApprovalRecord>('/records', {
      method: 'POST',
      body: JSON.stringify(record),
    }).then((createdRecord) => {
      emitNotificationsUpdated();
      return createdRecord;
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
    }).then((updatedRecord) => {
      emitNotificationsUpdated();
      return updatedRecord;
    });
  },

  completeProcessing(
    id: string,
    comment?: string,
  ): Promise<ApprovalRecord> {
    return request<ApprovalRecord>(`/records/${encodeURIComponent(id)}/process`, {
      method: 'PATCH',
      body: JSON.stringify({ comment }),
    }).then((updatedRecord) => {
      emitNotificationsUpdated();
      return updatedRecord;
    });
  },

  clearAll(): Promise<void> {
    return request<void>('/records', {
      method: 'DELETE',
    }, { skipImpersonation: true }).then((result) => {
      emitNotificationsUpdated();
      return result;
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
