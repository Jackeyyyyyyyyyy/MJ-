import React from 'react';
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Plus,
  Search,
  Send,
  X,
} from 'lucide-react';
import ApprovalDetailModal from './ApprovalDetailModal';
import ApprovalProgressModal from './ApprovalProgressModal';
import ApprovalTable from './ApprovalTable';
import BossDashboard from './BossDashboard';
import EfficiencyDiagnosis from './EfficiencyDiagnosis';
import { auth } from '../auth';
import { cn } from '../lib/utils';
import { storage } from '../storage';
import { ApprovalNotification, ApprovalRecord, ApprovalStatus, Schema } from '../types';

export type WorkTab = 'requests' | 'approvals' | 'processing' | 'processed' | 'efficiency' | 'cc' | 'global';
type MobileApprovalCategory = 'pending' | 'processed' | 'initiated' | 'cc' | 'global';
type MobileFilterSheet = 'type' | 'status' | null;

interface WorkHomeProps {
  showGlobal?: boolean;
  activeTab?: WorkTab;
  activeUsername?: string;
  onTabChange?: (tab: WorkTab) => void;
  onQuickCreate?: (moduleName?: string, typeName?: string) => void;
}

const mobileDataPollMs = 3000;
const ALL_APPROVAL_TYPES = '全部审批单';
const ALL_STATUSES = '全部状态';
const UNREAD_ONLY = '仅查看未读';

const mobileCategoryTabs: Array<{ id: MobileApprovalCategory; label: string; icon: React.ElementType }> = [
  { id: 'pending', label: '待处理的', icon: ClipboardList },
  { id: 'processed', label: '已处理的', icon: CheckCircle2 },
  { id: 'initiated', label: '我发起的', icon: FileText },
  { id: 'cc', label: '抄送我的', icon: Send },
];

const statusOptions = [
  { value: ALL_STATUSES, label: ALL_STATUSES },
  { value: ApprovalStatus.PENDING, label: '待审批' },
  { value: ApprovalStatus.PROCESSING, label: '待办理' },
  { value: ApprovalStatus.APPROVED, label: '已通过' },
  { value: ApprovalStatus.COMPLETED, label: '已完成' },
  { value: ApprovalStatus.REJECTED, label: '驳回' },
];

function formatBadgeCount(count: number) {
  return count > 99 ? '99+' : String(count);
}

function getInitialMobileCategory(activeTab: WorkTab): MobileApprovalCategory {
  if (activeTab === 'global') return 'global';
  if (activeTab === 'processed') return 'processed';
  if (activeTab === 'requests') return 'initiated';
  if (activeTab === 'cc') return 'cc';
  return 'pending';
}

function getWorkTabForApprovalCategory(category: MobileApprovalCategory): WorkTab {
  switch (category) {
    case 'global':
      return 'global';
    case 'processed':
      return 'processed';
    case 'initiated':
      return 'requests';
    case 'cc':
      return 'cc';
    case 'pending':
    default:
      return 'approvals';
  }
}

function isSameUsername(a?: string, b?: string) {
  return Boolean(a && b && a.toLowerCase() === b.toLowerCase());
}

function isInitiatedByCurrentUser(record: ApprovalRecord, username?: string, name?: string) {
  return isSameUsername(record.applicantUsername, username) || Boolean(name && record.applicant === name);
}

function isCurrentUserCc(record: ApprovalRecord, username?: string) {
  if (record.currentUserIsCc) return true;
  return (record.ccRecipients || []).some((recipient) => isSameUsername(recipient.accountUsername, username));
}

function isProcessedByCurrentUser(record: ApprovalRecord) {
  return Boolean(record.currentUserHasApproved || record.currentUserHasProcessed);
}

function isPendingForCurrentUser(record: ApprovalRecord) {
  return Boolean(record.currentUserCanApprove || record.currentUserCanProcess);
}

function recordMatchesKeyword(record: ApprovalRecord, keyword: string) {
  const normalized = keyword.trim().toLowerCase();
  if (!normalized) return true;

  const searchable = [
    record.moduleName,
    record.approvalTypeName,
    record.applicant,
    record.id,
    ...Object.entries(record.businessData || {}).flatMap(([key, value]) => [key, String(value ?? '')]),
  ].join(' ').toLowerCase();

  return searchable.includes(normalized);
}

function getTypeOptions(schema: Schema | null, records: ApprovalRecord[]) {
  const fromSchema = schema?.modules.flatMap((module) => (
    module.approvalTypes
      .filter((type) => type.visibleToUsers !== false)
      .map((type) => type.name)
  )) || [];
  const fromRecords = records.map((record) => record.approvalTypeName);
  return [ALL_APPROVAL_TYPES, ...Array.from(new Set([...fromSchema, ...fromRecords])).filter(Boolean)];
}

function getUnreadCcRecordIds(notifications: ApprovalNotification[], username?: string) {
  return new Set(
    notifications
      .filter((notification) => (
        notification.type === 'approval_cc'
        && !notification.readAt
        && (!username || isSameUsername(notification.recipientUsername, username))
      ))
      .map((notification) => notification.recordId),
  );
}

function getStatusLabel(status: string) {
  return statusOptions.find((option) => option.value === status)?.label || status;
}

interface ApprovalCenterProps {
  activeTab: WorkTab;
  showGlobal?: boolean;
  onCategoryChange?: (tab: WorkTab) => void;
  onQuickCreate?: WorkHomeProps['onQuickCreate'];
  globalContent?: React.ReactNode;
}

function ApprovalCenter({ activeTab, showGlobal = false, onCategoryChange, onQuickCreate, globalContent }: ApprovalCenterProps) {
  const [records, setRecords] = React.useState<ApprovalRecord[]>([]);
  const [notifications, setNotifications] = React.useState<ApprovalNotification[]>([]);
  const [schema, setSchema] = React.useState<Schema | null>(null);
  const [query, setQuery] = React.useState('');
  const [selectedType, setSelectedType] = React.useState(ALL_APPROVAL_TYPES);
  const [selectedStatus, setSelectedStatus] = React.useState(ALL_STATUSES);
  const [activeSheet, setActiveSheet] = React.useState<MobileFilterSheet>(null);
  const [selectedRecord, setSelectedRecord] = React.useState<ApprovalRecord | null>(null);
  const [showDetail, setShowDetail] = React.useState(false);
  const [showProgress, setShowProgress] = React.useState(false);
  const user = auth.getCurrentUser();
  const activeCategory = getInitialMobileCategory(activeTab);
  const categoryTabs = React.useMemo(
    () => showGlobal
      ? [...mobileCategoryTabs, { id: 'global' as const, label: '全部', icon: LayoutDashboard }]
      : mobileCategoryTabs,
    [showGlobal],
  );

  React.useEffect(() => {
    setSelectedStatus(ALL_STATUSES);
  }, [activeCategory]);

  const loadMobileData = React.useCallback(async () => {
    const [nextRecords, nextNotifications] = await Promise.all([
      storage.getRecords(),
      storage.getNotifications(),
    ]);
    setRecords(nextRecords);
    setNotifications(nextNotifications);

    try {
      setSchema(await storage.getApprovalSchema());
    } catch {
      setSchema(null);
    }
  }, []);

  React.useEffect(() => {
    void loadMobileData();
    const timer = window.setInterval(() => void loadMobileData(), mobileDataPollMs);
    const handleNotificationsUpdated = () => void loadMobileData();

    window.addEventListener('approval-notifications-updated', handleNotificationsUpdated);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('approval-notifications-updated', handleNotificationsUpdated);
    };
  }, [loadMobileData]);

  const unreadCcRecordIds = React.useMemo(
    () => getUnreadCcRecordIds(notifications, user?.username),
    [notifications, user?.username],
  );

  const categoryCounts = React.useMemo<Record<MobileApprovalCategory, number>>(() => ({
    pending: records.filter(isPendingForCurrentUser).length,
    processed: records.filter(isProcessedByCurrentUser).length,
    initiated: records.filter((record) => isInitiatedByCurrentUser(record, user?.username, user?.name)).length,
    cc: records.filter((record) => isCurrentUserCc(record, user?.username)).length,
    global: records.length,
  }), [records, user?.name, user?.username]);

  const categoryRecords = React.useMemo(() => {
    switch (activeCategory) {
      case 'global':
        return records;
      case 'pending':
        return records.filter(isPendingForCurrentUser);
      case 'processed':
        return records.filter(isProcessedByCurrentUser);
      case 'cc':
        return records.filter((record) => isCurrentUserCc(record, user?.username));
      case 'initiated':
      default:
        return records.filter((record) => isInitiatedByCurrentUser(record, user?.username, user?.name));
    }
  }, [activeCategory, records, user?.name, user?.username]);

  const typeOptions = React.useMemo(() => getTypeOptions(schema, records), [records, schema]);

  React.useEffect(() => {
    if (!typeOptions.includes(selectedType)) {
      setSelectedType(ALL_APPROVAL_TYPES);
    }
  }, [selectedType, typeOptions]);

  React.useEffect(() => {
    if (activeCategory !== 'cc' && selectedStatus === UNREAD_ONLY) {
      setSelectedStatus(ALL_STATUSES);
    }
  }, [activeCategory, selectedStatus]);

  const filteredRecords = React.useMemo(() => {
    return categoryRecords
      .filter((record) => selectedType === ALL_APPROVAL_TYPES || record.approvalTypeName === selectedType)
      .filter((record) => {
        if (selectedStatus === ALL_STATUSES) return true;
        if (selectedStatus === UNREAD_ONLY) return unreadCcRecordIds.has(record.id);
        return record.status === selectedStatus;
      })
      .filter((record) => recordMatchesKeyword(record, query));
  }, [categoryRecords, query, selectedStatus, selectedType, unreadCcRecordIds]);

  const statusFilterLabel = selectedStatus === ALL_STATUSES
    ? (activeCategory === 'cc' ? ALL_STATUSES : '审批状态')
    : getStatusLabel(selectedStatus);

  const handleApprove = async (record: ApprovalRecord) => {
    if (!user || !window.confirm(`确认通过「${record.approvalTypeName}」吗？`)) return;
    await storage.updateStatus(record.id, ApprovalStatus.APPROVED, user.name);
    setShowDetail(false);
    setSelectedRecord(null);
    await loadMobileData();
  };

  const handleReject = async (record: ApprovalRecord) => {
    if (!user) return;
    const reason = window.prompt('请输入驳回原因');
    if (!reason?.trim()) return;
    await storage.updateStatus(record.id, ApprovalStatus.REJECTED, user.name, reason.trim());
    setShowDetail(false);
    setSelectedRecord(null);
    await loadMobileData();
  };

  const handleCompleteProcess = async (record: ApprovalRecord) => {
    const comment = window.prompt('填写办理备注（可选）') ?? '';
    await storage.completeProcessing(record.id, comment.trim());
    setShowDetail(false);
    setSelectedRecord(null);
    await loadMobileData();
  };

  const statusSheetOptions = activeCategory === 'cc'
    ? [
        { value: ALL_STATUSES, label: ALL_STATUSES },
        { value: UNREAD_ONLY, label: UNREAD_ONLY },
      ]
    : statusOptions;
  const shouldRenderGlobalContent = activeCategory === 'global' && globalContent;

  return (
    <section className="space-y-3.5 pb-28 lg:space-y-6 lg:pb-40">
      <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
        <div className="-mx-4 flex items-center gap-7 overflow-x-auto px-4 pb-1.5 pt-0.5 no-scrollbar lg:mx-0 lg:h-12 lg:w-fit lg:max-w-full lg:shrink-0 lg:gap-1 lg:overflow-x-auto lg:rounded-[14px] lg:border lg:border-border-silver lg:bg-white lg:p-1 lg:shadow-sm 2xl:overflow-visible">
          {categoryTabs.map((tab) => {
            const Icon = tab.icon;
            const count = categoryCounts[tab.id] || 0;
            const isActive = activeCategory === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  onCategoryChange?.(getWorkTabForApprovalCategory(tab.id));
                  setSelectedStatus(ALL_STATUSES);
                }}
                className={cn(
                  "relative flex h-9 shrink-0 items-center justify-center gap-1.5 text-[17px] font-semibold tracking-normal transition-colors lg:h-10 lg:rounded-[10px] lg:px-4 lg:text-[13px] lg:font-bold",
                  isActive
                    ? "text-midnight-graphite lg:bg-[#f5f6f8] lg:text-midnight-graphite"
                    : "text-[#8d9199] hover:text-midnight-graphite lg:text-medium-gray lg:hover:bg-[#f8f9fb] lg:hover:text-midnight-graphite",
                )}
              >
                <Icon size={15} strokeWidth={2.35} className={cn("hidden lg:block", isActive ? "text-midnight-graphite" : "text-[#8d929b]")} />
                <span>{tab.label}</span>
                <span className={cn(
                  "pl-0.5 text-[13px] font-semibold tabular-nums lg:text-[12px]",
                  isActive ? "text-midnight-graphite" : "text-[#9aa0aa]",
                )}>
                  {formatBadgeCount(count)}
                </span>
                {isActive && (
                  <span className="absolute bottom-0 left-1/2 h-[3px] w-5 -translate-x-1/2 rounded-full bg-midnight-graphite lg:hidden" />
                )}
              </button>
            );
          })}
        </div>

        {!shouldRenderGlobalContent && (
          <div className="hidden items-center justify-end gap-2 lg:flex 2xl:shrink-0">
            <label className="flex h-11 min-w-[240px] max-w-[360px] flex-1 items-center gap-2 rounded-xl border border-border-silver bg-white px-4 text-medium-gray shadow-sm 2xl:w-[300px] 2xl:flex-none">
              <Search size={16} strokeWidth={2.4} className="shrink-0 text-light-silver" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-[14px] font-medium text-midnight-graphite outline-none placeholder:text-[#9da1aa]"
                placeholder="请输入审批单名称"
              />
            </label>
            {onQuickCreate && (
              <button
                type="button"
                onClick={() => onQuickCreate()}
                className="flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full bg-black px-5 text-[14px] font-bold text-white shadow-sm transition-all hover:bg-zinc-800 active:scale-[0.98]"
                aria-label="发起审批"
              >
                <Plus size={15} strokeWidth={2.6} />
                <span>发起审批</span>
              </button>
            )}
          </div>
        )}
      </div>

      {shouldRenderGlobalContent ? (
        globalContent
      ) : (
        <>
      <div className="flex items-center gap-2 lg:hidden">
        <label className="mj-mobile-pill flex h-[38px] min-w-0 flex-1 items-center gap-2 px-3.5 text-medium-gray shadow-[inset_0_1px_0_rgba(255,255,255,0.62)] lg:h-11 lg:max-w-[360px] lg:flex-none lg:rounded-xl lg:border lg:border-border-silver lg:bg-white lg:shadow-none">
          <Search size={16} strokeWidth={2.4} className="shrink-0 text-light-silver" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-[13px] font-medium text-midnight-graphite outline-none placeholder:text-[#9da1aa] lg:text-[14px]"
            placeholder="请输入审批单名称"
          />
        </label>
        {onQuickCreate && (
          <button
            type="button"
            onClick={() => onQuickCreate()}
            className="flex h-[38px] shrink-0 items-center justify-center gap-1.5 rounded-full bg-[#1677ff] px-3.5 text-[13px] font-semibold text-white shadow-[0_4px_10px_rgba(22,119,255,0.12)] transition-all active:scale-[0.98] lg:h-11 lg:bg-black lg:px-5 lg:text-[14px] lg:font-bold lg:shadow-sm lg:hover:bg-zinc-800"
            aria-label="发起审批"
          >
            <Plus size={15} strokeWidth={2.6} />
            <span>发起审批</span>
          </button>
        )}
      </div>

      <div className="flex items-center gap-2.5 lg:hidden">
        <button
          type="button"
          onClick={() => setActiveSheet('type')}
          className={cn(
            "flex h-9 max-w-[46vw] items-center gap-1.5 rounded-full bg-[#eef0f5] px-3.5 text-[13.5px] font-medium text-[#6c7078] transition active:scale-[0.99]",
            selectedType !== ALL_APPROVAL_TYPES && "text-[#1677ff]",
          )}
        >
          <span className="truncate">{selectedType}</span>
          <ChevronDown size={15} strokeWidth={2.4} className="shrink-0" />
        </button>
        <button
          type="button"
          onClick={() => setActiveSheet('status')}
          className={cn(
            "flex h-9 max-w-[42vw] items-center gap-1.5 rounded-full bg-[#eef0f5] px-3.5 text-[13.5px] font-medium text-[#6c7078] transition active:scale-[0.99]",
            selectedStatus !== ALL_STATUSES && "text-[#1677ff]",
          )}
        >
          <span className="truncate">{statusFilterLabel}</span>
          <ChevronDown size={15} strokeWidth={2.4} className="shrink-0" />
        </button>
      </div>

      <div className="hidden items-center justify-between gap-4 lg:flex">
        <h2 className="text-[20px] font-black tracking-tight text-midnight-graphite">历史记录</h2>
        <div className="flex items-center gap-2">
          <label className="relative">
            <select
              value={selectedType}
              onChange={(event) => setSelectedType(event.target.value)}
              className="h-10 min-w-[160px] appearance-none rounded-xl border border-border-silver bg-white py-0 pl-4 pr-9 text-[12px] font-bold text-midnight-graphite outline-none transition focus:border-interactive-blue"
            >
              {typeOptions.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <ChevronDown size={15} strokeWidth={2.4} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-light-gray" />
          </label>
          <label className="relative">
            <select
              value={selectedStatus}
              onChange={(event) => setSelectedStatus(event.target.value)}
              className="h-10 min-w-[132px] appearance-none rounded-xl border border-border-silver bg-white py-0 pl-4 pr-9 text-[12px] font-bold text-midnight-graphite outline-none transition focus:border-interactive-blue"
            >
              {statusSheetOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <ChevronDown size={15} strokeWidth={2.4} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-light-gray" />
          </label>
        </div>
      </div>

      <div className="lg:overflow-hidden lg:rounded-2xl lg:border lg:border-border-silver lg:bg-white lg:shadow-sm">
        <ApprovalTable
          records={filteredRecords}
          onViewDetail={(record) => {
            setSelectedRecord(record);
            setShowDetail(true);
          }}
          onViewProgress={(record) => {
            setSelectedRecord(record);
            setShowProgress(true);
          }}
          showActions
        />
      </div>

      {activeSheet && (
        <div className="fixed inset-0 z-[80] flex items-end lg:hidden">
          <button
            type="button"
            aria-label="关闭筛选"
            className="absolute inset-0 bg-black/38"
            onClick={() => setActiveSheet(null)}
          />
          <div className="relative max-h-[68dvh] w-full overflow-hidden rounded-t-[24px] bg-[#f6f7fb] shadow-[0_-8px_30px_rgba(15,23,42,0.12)]">
            <div className="flex items-center justify-between border-b border-black/[0.045] bg-[#f6f7fb] px-5 py-4">
              <h3 className="text-[17px] font-semibold text-midnight-graphite">
                {activeSheet === 'type' ? '全部审批单' : (activeCategory === 'cc' ? '全部状态' : '审批状态')}
              </h3>
              <button
                type="button"
                onClick={() => setActiveSheet(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[#7b7f88] active:bg-black/[0.04]"
              >
                <X size={20} strokeWidth={2.2} />
              </button>
            </div>
            <div className="max-h-[calc(68dvh-65px)] overflow-y-auto bg-[#f6f7fb]">
              {(activeSheet === 'type'
                ? typeOptions.map((type) => ({ value: type, label: type }))
                : statusSheetOptions
              ).map((option) => {
                const selected = activeSheet === 'type'
                  ? selectedType === option.value
                  : selectedStatus === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      if (activeSheet === 'type') {
                        setSelectedType(option.value);
                      } else {
                        setSelectedStatus(option.value);
                      }
                      setActiveSheet(null);
                    }}
                    className="flex h-14 w-full items-center justify-between border-b border-black/[0.045] bg-[#f6f7fb] px-5 text-left text-[17px] font-medium text-midnight-graphite active:bg-black/[0.035]"
                  >
                    <span className="truncate">{option.label}</span>
                    {selected && (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1677ff] text-white">
                        <Check size={16} strokeWidth={2.6} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {showDetail && selectedRecord && (
        <ApprovalDetailModal
          record={selectedRecord}
          onClose={() => {
            setSelectedRecord(null);
            setShowDetail(false);
          }}
          showAiSuggestion
          onApprove={selectedRecord.currentUserCanApprove ? handleApprove : undefined}
          onReject={selectedRecord.currentUserCanApprove ? handleReject : undefined}
          onCompleteProcess={selectedRecord.currentUserCanProcess ? handleCompleteProcess : undefined}
        />
      )}

      {showProgress && selectedRecord && (
        <ApprovalProgressModal
          record={selectedRecord}
          onClose={() => {
            setSelectedRecord(null);
            setShowProgress(false);
          }}
        />
      )}
        </>
      )}
    </section>
  );
}

export default function WorkHome({ showGlobal = false, activeTab: controlledTab, activeUsername, onTabChange, onQuickCreate }: WorkHomeProps) {
  const [internalTab, setInternalTab] = React.useState<WorkTab>(showGlobal ? 'global' : 'requests');
  const activeTab = controlledTab ?? internalTab;

  const setActiveTab = (tab: WorkTab) => {
    if (controlledTab === undefined) {
      setInternalTab(tab);
    }
    onTabChange?.(tab);
  };

  React.useEffect(() => {
    if (!showGlobal && activeTab === 'global') {
      setActiveTab('requests');
    }
  }, [activeTab, showGlobal]);

  return (
    <div className="space-y-3.5 lg:space-y-6">
      {activeTab === 'efficiency' ? (
        <div className="lg:hidden">
          <EfficiencyDiagnosis />
        </div>
      ) : (
        <div className="lg:hidden">
          <ApprovalCenter activeTab={activeTab} showGlobal={showGlobal} onCategoryChange={setActiveTab} onQuickCreate={onQuickCreate} />
        </div>
      )}

      <div className="hidden lg:block">
        {activeTab === 'efficiency' ? (
          <EfficiencyDiagnosis />
        ) : (
          <ApprovalCenter
            activeTab={activeTab}
            showGlobal={showGlobal}
            onCategoryChange={setActiveTab}
            onQuickCreate={onQuickCreate}
            globalContent={showGlobal ? <BossDashboard /> : undefined}
          />
        )}
      </div>
    </div>
  );
}
