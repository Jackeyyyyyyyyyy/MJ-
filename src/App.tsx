import React, { useState, useEffect } from 'react';
import LoginPage from './components/LoginPage';
import AppLayout from './components/AppLayout';
import WorkHome, { WorkTab } from './components/WorkHome';
import AccountPermissionAdmin from './components/AccountPermissionAdmin';
import OrganizationAdmin from './components/OrganizationAdmin';
import WorkflowAdmin from './components/WorkflowAdmin';
import WorkflowStatsAdmin from './components/WorkflowStatsAdmin';
import BusinessFormAdmin from './components/BusinessFormAdmin';
import AiBranchLogs from './components/AiBranchLogs';
import ApprovalTable from './components/ApprovalTable';
import ApprovalDetailModal from './components/ApprovalDetailModal';
import ApprovalProgressModal from './components/ApprovalProgressModal';
import AiPromptEditor from './components/AiPromptEditor';
import AiAssistantHome from './components/AiAssistantHome';
import BackupPage from './components/BackupPage';
import SettingsPage from './components/SettingsPage';
import { auth } from './auth';
import { storage } from './storage';
import { AdminView, Role, ApprovalNotification, ApprovalRecord, ApprovalStatus } from './types';
import { approvalSchema, replaceApprovalSchema } from './approvalSchema';
import { setApprovalAppBadge } from './lib/pushNotifications';

type AppRoute =
  | { kind: 'work'; tab: WorkTab }
  | { kind: 'admin'; view: AdminView }
  | { kind: 'module'; moduleName: string; typeName: string };

const adminRouteViews: AdminView[] = ['settings', 'accounts', 'ai-assistant', 'organization', 'stats', 'workflows', 'business-forms', 'ai-branch-logs'];
const workRouteTabs: WorkTab[] = ['requests', 'approvals', 'processing', 'cc', 'global'];

function decodeRoutePart(part?: string) {
  if (!part) return '';

  try {
    return decodeURIComponent(part);
  } catch {
    return part;
  }
}

function parseRoute(pathname = window.location.pathname): AppRoute {
  const parts = pathname.split('/').filter(Boolean).map(decodeRoutePart);
  const [section, first, second] = parts;

  if (section === 'admin' && adminRouteViews.includes(first as AdminView)) {
    return { kind: 'admin', view: first as AdminView };
  }

  if (section === 'module' && first && second) {
    const matchedModule = approvalSchema.modules.find((module) => module.name === first);
    const matchedType = matchedModule?.approvalTypes.find((type) => type.name === second);

    if (matchedModule && matchedType) {
      return { kind: 'module', moduleName: matchedModule.name, typeName: matchedType.name };
    }
  }

  if (section === 'work' && workRouteTabs.includes(first as WorkTab)) {
    return { kind: 'work', tab: first as WorkTab };
  }

  return { kind: 'work', tab: 'requests' };
}

function routeToPath(route: AppRoute) {
  if (route.kind === 'admin') {
    return `/admin/${route.view}`;
  }

  if (route.kind === 'module') {
    return `/module/${encodeURIComponent(route.moduleName)}/${encodeURIComponent(route.typeName)}`;
  }

  return `/work/${route.tab}`;
}

function normalizeRouteSearch(search = '') {
  if (!search) return '';
  return search.startsWith('?') ? search : `?${search}`;
}

function routeToUrl(route: AppRoute, search = '') {
  return `${routeToPath(route)}${normalizeRouteSearch(search)}`;
}

function pushRoute(route: AppRoute, search = '') {
  const nextUrl = routeToUrl(route, search);
  if (`${window.location.pathname}${window.location.search}` !== nextUrl) {
    window.history.pushState(null, '', nextUrl);
  }
}

function replaceRoute(route: AppRoute, search = '') {
  const nextUrl = routeToUrl(route, search);
  if (`${window.location.pathname}${window.location.search}` !== nextUrl) {
    window.history.replaceState(null, '', nextUrl);
  }
}

const notificationTypes: ApprovalNotification['type'][] = [
  'approval_pending',
  'approval_progress',
  'approval_approved',
  'approval_rejected',
  'approval_processing',
  'approval_completed',
  'approval_cc',
];

function parseNotificationType(value: string | null) {
  return notificationTypes.includes(value as ApprovalNotification['type'])
    ? value as ApprovalNotification['type']
    : null;
}

function getNotificationSearch(notificationId?: string, recordId?: string, type?: ApprovalNotification['type'] | null) {
  const params = new URLSearchParams();
  if (notificationId) params.set('notificationId', notificationId);
  if (recordId) params.set('recordId', recordId);
  if (type) params.set('type', type);
  const search = params.toString();
  return search ? `?${search}` : '';
}

function getNotificationWorkTab(type?: ApprovalNotification['type'] | null, record?: ApprovalRecord | null): WorkTab {
  if (type === 'approval_pending') return 'approvals';
  if (type === 'approval_processing') return 'processing';
  if (type === 'approval_cc') return 'cc';

  if (record?.currentUserCanApprove || record?.currentUserHasApproved) return 'approvals';
  if (record?.currentUserCanProcess || record?.currentUserHasProcessed) return 'processing';
  if (record?.currentUserIsCc) return 'cc';
  return 'requests';
}

function getNotificationLaunchParams(search = window.location.search) {
  const params = new URLSearchParams(search);
  return {
    notificationId: params.get('notificationId') || '',
    recordId: params.get('recordId') || '',
    type: parseNotificationType(params.get('type')),
  };
}

function MainApp() {
  const initialRoute = parseRoute();
  const [isAuthenticated, setIsAuthenticated] = useState(!!auth.getCurrentUser());
  const [perspective, setPerspective] = useState<Role | null>(auth.getPerspective());
  const [activeUsername, setActiveUsername] = useState(auth.getCurrentUser()?.username || '');
  const [selectedModule, setSelectedModule] = useState<string>(initialRoute.kind === 'module' ? initialRoute.moduleName : '');
  const [selectedType, setSelectedType] = useState<string>(initialRoute.kind === 'module' ? initialRoute.typeName : '');
  const [activeAdminView, setActiveAdminView] = useState<AdminView | null>(initialRoute.kind === 'admin' ? initialRoute.view : null);
  const [activeWorkTab, setActiveWorkTab] = useState<WorkTab>(initialRoute.kind === 'work' ? initialRoute.tab : 'requests');
  const [schemaVersion, setSchemaVersion] = useState(0);
  
  // Dynamic list state
  const [dynamicRecords, setDynamicRecords] = useState<ApprovalRecord[]>([]);
  const [selectedOne, setSelectedOne] = useState<ApprovalRecord | null>(null);
  const [notificationRecord, setNotificationRecord] = useState<ApprovalRecord | null>(null);
  const [showD, setShowD] = useState(false);
  const [showP, setShowP] = useState(false);
  const handledNotificationLaunchRef = React.useRef('');

  const handleLogin = () => {
    const route = parseRoute();
    const notificationSearch = getNotificationLaunchParams().recordId ? window.location.search : '';
    setIsAuthenticated(true);
    setPerspective(auth.getPerspective());
    setActiveUsername(auth.getCurrentUser()?.username || '');
    applyRoute(route);
    replaceRoute(route, notificationSearch);
  };

  const handleLogout = () => {
    auth.logout();
    void setApprovalAppBadge(0);
    window.history.pushState(null, '', '/');
    setIsAuthenticated(false);
    setPerspective(null);
    setActiveUsername('');
  };

  const handlePerspectiveChange = (nextPerspective: Role) => {
    setPerspective(nextPerspective);
    setActiveUsername(auth.getCurrentUser()?.username || '');
    applyRoute({ kind: 'work', tab: nextPerspective === 'boss' || nextPerspective === 'developer' ? 'global' : 'requests' });
    pushRoute({ kind: 'work', tab: nextPerspective === 'boss' || nextPerspective === 'developer' ? 'global' : 'requests' });
  };

  const handleSelectType = (moduleName: string, typeName: string) => {
    setSelectedModule(moduleName);
    setSelectedType(typeName);
    setActiveAdminView(null);
    const nextRoute: AppRoute = moduleName && typeName
      ? { kind: 'module', moduleName, typeName }
      : { kind: 'work', tab: activeWorkTab };
    pushRoute(nextRoute);
  };

  const handleOpenAccountAdmin = () => {
    applyRoute({ kind: 'admin', view: 'accounts' });
    pushRoute({ kind: 'admin', view: 'accounts' });
  };

  const handleOpenAiAssistant = () => {
    applyRoute({ kind: 'admin', view: 'ai-assistant' });
    pushRoute({ kind: 'admin', view: 'ai-assistant' });
  };

  const handleOpenOrganizationAdmin = () => {
    applyRoute({ kind: 'admin', view: 'organization' });
    pushRoute({ kind: 'admin', view: 'organization' });
  };

  const handleOpenStatsAdmin = () => {
    applyRoute({ kind: 'admin', view: 'stats' });
    pushRoute({ kind: 'admin', view: 'stats' });
  };

  const handleOpenWorkflowAdmin = () => {
    applyRoute({ kind: 'admin', view: 'workflows' });
    pushRoute({ kind: 'admin', view: 'workflows' });
  };

  const handleOpenBusinessFormAdmin = () => {
    applyRoute({ kind: 'admin', view: 'business-forms' });
    pushRoute({ kind: 'admin', view: 'business-forms' });
  };

  const handleOpenAiBranchLogs = () => {
    applyRoute({ kind: 'admin', view: 'ai-branch-logs' });
    pushRoute({ kind: 'admin', view: 'ai-branch-logs' });
  };

  const handleOpenSettings = () => {
    applyRoute({ kind: 'admin', view: 'settings' });
    pushRoute({ kind: 'admin', view: 'settings' });
  };

  const handleWorkTabChange = (tab: WorkTab) => {
    setSelectedModule('');
    setSelectedType('');
    setActiveAdminView(null);
    setActiveWorkTab(tab);
    pushRoute({ kind: 'work', tab });
  };

  const handleOpenNotificationRecord = (notification: ApprovalNotification, record: ApprovalRecord) => {
    const tab = getNotificationWorkTab(notification.type, record);
    const route: AppRoute = { kind: 'work', tab };
    const search = getNotificationSearch(notification.id, notification.recordId, notification.type);

    setSelectedOne(null);
    setShowD(false);
    setShowP(false);
    applyRoute(route);
    pushRoute(route, search);
    setNotificationRecord(record);
  };

  function applyRoute(route: AppRoute) {
    if (route.kind === 'admin') {
      setSelectedModule('');
      setSelectedType('');
      setActiveAdminView(route.view);
      return;
    }

    if (route.kind === 'module') {
      setSelectedModule(route.moduleName);
      setSelectedType(route.typeName);
      setActiveAdminView(null);
      return;
    }

    setSelectedModule('');
    setSelectedType('');
    setActiveAdminView(null);
    setActiveWorkTab(route.tab);
  }

  const loadDynamicRecords = async () => {
    if (selectedType) {
      const all = await storage.getRecords();
      setDynamicRecords(all.filter(r => r.moduleName === selectedModule && r.approvalTypeName === selectedType));
    }
  };

  const handleDynamicApprove = async (record: ApprovalRecord) => {
    const user = auth.getCurrentUser();
    if (!user || !window.confirm(`确认通过审批单 ${record.id}？`)) return;

    await storage.updateStatus(record.id, ApprovalStatus.APPROVED, user.name);
    await loadDynamicRecords();
  };

  const handleDynamicReject = async (record: ApprovalRecord) => {
    const user = auth.getCurrentUser();
    if (!user) return;

    const reason = window.prompt(`请输入审批单 ${record.id} 的驳回原因`);
    if (!reason?.trim()) return;

    await storage.updateStatus(record.id, ApprovalStatus.REJECTED, user.name, reason.trim());
    await loadDynamicRecords();
  };

  const handleDynamicCompleteProcess = async (record: ApprovalRecord) => {
    if (!window.confirm(`确认完成 ${record.processorTaskName || '办理任务'}？`)) return;

    await storage.completeProcessing(record.id);
    await loadDynamicRecords();
  };

  const handleNotificationApprove = async (record: ApprovalRecord) => {
    const user = auth.getCurrentUser();
    if (!user || !window.confirm(`确认通过审批单 ${record.id}？`)) return;

    const updatedRecord = await storage.updateStatus(record.id, ApprovalStatus.APPROVED, user.name);
    setNotificationRecord(updatedRecord);
  };

  const handleNotificationReject = async (record: ApprovalRecord) => {
    const user = auth.getCurrentUser();
    if (!user) return;

    const reason = window.prompt(`请输入审批单 ${record.id} 的驳回原因`);
    if (!reason?.trim()) return;

    const updatedRecord = await storage.updateStatus(record.id, ApprovalStatus.REJECTED, user.name, reason.trim());
    setNotificationRecord(updatedRecord);
  };

  const handleNotificationCompleteProcess = async (record: ApprovalRecord) => {
    const comment = window.prompt(`填写 ${record.processorTaskName || '办理任务'} 的办理备注，可留空`, '');
    if (comment === null) return;

    const updatedRecord = await storage.completeProcessing(record.id, comment.trim());
    setNotificationRecord(updatedRecord);
  };

  useEffect(() => {
    loadDynamicRecords();
  }, [selectedModule, selectedType, activeUsername]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const params = getNotificationLaunchParams();
    if (!params.recordId) return;

    const launchKey = `${activeUsername}:${params.notificationId}:${params.recordId}:${params.type || ''}`;
    if (handledNotificationLaunchRef.current === launchKey) return;
    handledNotificationLaunchRef.current = launchKey;

    let isMounted = true;

    void (async () => {
      try {
        if (params.notificationId) {
          await storage.markNotificationRead(params.notificationId).catch(() => undefined);
        }

        const records = await storage.getRecords();
        const record = records.find((item) => item.id === params.recordId) || null;
        if (!isMounted || !record) return;

        const tab = getNotificationWorkTab(params.type, record);
        const route: AppRoute = { kind: 'work', tab };
        const search = getNotificationSearch(params.notificationId, params.recordId, params.type);

        setSelectedOne(null);
        setShowD(false);
        setShowP(false);
        applyRoute(route);
        replaceRoute(route, search);
        setNotificationRecord(record);
        window.dispatchEvent(new Event('approval-notifications-updated'));
      } catch {
        // Notification deep links should not block the main app if the record is gone.
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, activeUsername]);

  useEffect(() => {
    if (!isAuthenticated) return;

    let isMounted = true;

    const handleSchemaUpdated = () => setSchemaVersion((version) => version + 1);
    window.addEventListener('approval-schema-updated', handleSchemaUpdated);

    storage.getApprovalSchema()
      .then((nextSchema) => {
        if (!isMounted) return;
        replaceApprovalSchema(nextSchema);
        applyRoute(parseRoute());
      })
      .catch(() => {
        // Keep the bundled schema when the API is unavailable.
      });

    return () => {
      isMounted = false;
      window.removeEventListener('approval-schema-updated', handleSchemaUpdated);
    };
  }, [isAuthenticated]);

  useEffect(() => {
    const handlePopState = () => applyRoute(parseRoute());
    window.addEventListener('popstate', handlePopState);
    const route = parseRoute();
    const notificationSearch = getNotificationLaunchParams().recordId ? window.location.search : '';
    applyRoute(route);
    if (isAuthenticated) replaceRoute(route, notificationSearch);

    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !activeAdminView) return;

    const isSuperAdminPerspective = auth.getSessionUser()?.role === 'developer' && perspective === 'developer';
    const canUseAiAssistant = perspective === 'boss' || isSuperAdminPerspective;
    if (activeAdminView === 'settings') return;

    const aiAssistantViews: AdminView[] = ['ai-assistant', 'ai-branch-logs'];
    const canAccessAdminView = activeAdminView === 'ai-assistant'
      ? canUseAiAssistant
      : aiAssistantViews.includes(activeAdminView)
        ? isSuperAdminPerspective
        : isSuperAdminPerspective;

    if (!canAccessAdminView) {
      const fallbackRoute: AppRoute = { kind: 'work', tab: perspective === 'boss' || perspective === 'developer' ? 'global' : 'requests' };
      applyRoute(fallbackRoute);
      replaceRoute(fallbackRoute);
    }
  }, [isAuthenticated, activeAdminView, perspective]);

  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  const renderContent = () => {
    const isSuperAdminPerspective = auth.getSessionUser()?.role === 'developer' && perspective === 'developer';
    const canUseAiAssistant = perspective === 'boss' || isSuperAdminPerspective;

    if (activeAdminView === 'accounts' && isSuperAdminPerspective) {
      return <AccountPermissionAdmin />;
    }

    if (activeAdminView === 'settings') {
      return <SettingsPage activeUsername={activeUsername} />;
    }

    if (activeAdminView === 'ai-assistant' && canUseAiAssistant) {
      return <AiAssistantHome />;
    }

    if (activeAdminView === 'organization' && isSuperAdminPerspective) {
      return <OrganizationAdmin />;
    }

    if (activeAdminView === 'stats' && isSuperAdminPerspective) {
      return <WorkflowStatsAdmin />;
    }

    if (activeAdminView === 'workflows' && isSuperAdminPerspective) {
      return <WorkflowAdmin />;
    }

    if (activeAdminView === 'business-forms' && isSuperAdminPerspective) {
      return <BusinessFormAdmin />;
    }

    if (activeAdminView === 'ai-branch-logs' && isSuperAdminPerspective) {
      return <AiBranchLogs />;
    }

    if (selectedType) {
      const canReview = perspective === 'employee' || perspective === 'boss';
      const canSeeAiSuggestion = canReview || isSuperAdminPerspective;

      return (
        <div className="space-y-6">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-xs text-medium-gray font-bold uppercase tracking-wider">
              <span>审批模块</span>
              <span className="text-light-gray">/</span>
              <span>{selectedModule}</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">{selectedType}</h1>
          </div>

          {isSuperAdminPerspective && (
            <AiPromptEditor
              moduleName={selectedModule}
              approvalTypeName={selectedType}
            />
          )}
          
          <ApprovalTable 
            records={dynamicRecords}
            onViewDetail={(r) => { setSelectedOne(r); setShowD(true); }}
            onViewProgress={(r) => { setSelectedOne(r); setShowP(true); }}
            showActions={true}
          />

          <ApprovalDetailModal
            record={selectedOne}
            onClose={() => { setSelectedOne(null); setShowD(false); }}
            showAiSuggestion={canSeeAiSuggestion}
            showAiRawResponse={canSeeAiSuggestion}
            onApprove={canReview && selectedOne?.currentUserCanApprove ? (record) => { setShowD(false); void handleDynamicApprove(record); } : undefined}
            onReject={canReview && selectedOne?.currentUserCanApprove ? (record) => { setShowD(false); void handleDynamicReject(record); } : undefined}
            onCompleteProcess={selectedOne?.currentUserCanProcess ? (record) => { setShowD(false); void handleDynamicCompleteProcess(record); } : undefined}
          />
          <ApprovalProgressModal record={selectedOne} onClose={() => { setSelectedOne(null); setShowP(false); }} />
        </div>
      );
    }

    switch (perspective) {
      case 'employee':
        return <WorkHome activeTab={activeWorkTab} onTabChange={handleWorkTabChange} />;
      case 'boss':
      case 'developer':
        return <WorkHome showGlobal activeTab={activeWorkTab} onTabChange={handleWorkTabChange} />;
      default:
        return <WorkHome activeTab={activeWorkTab} onTabChange={handleWorkTabChange} />;
    }
  };

  return (
    <AppLayout 
      onLogout={handleLogout} 
      onPerspectiveChange={handlePerspectiveChange}
      activeUsername={activeUsername}
      activeAdminView={activeAdminView}
      onOpenAccountAdmin={handleOpenAccountAdmin}
      onOpenAiAssistant={handleOpenAiAssistant}
      onOpenOrganizationAdmin={handleOpenOrganizationAdmin}
      onOpenStatsAdmin={handleOpenStatsAdmin}
      onOpenWorkflowAdmin={handleOpenWorkflowAdmin}
      onOpenBusinessFormAdmin={handleOpenBusinessFormAdmin}
      onOpenAiBranchLogs={handleOpenAiBranchLogs}
      onOpenSettings={handleOpenSettings}
      onOpenNotificationRecord={handleOpenNotificationRecord}
      selectedModule={selectedModule}
      selectedType={selectedType}
      onSelectType={handleSelectType}
    >
      <React.Fragment key={schemaVersion}>{renderContent()}</React.Fragment>
      <ApprovalDetailModal
        record={notificationRecord}
        onClose={() => setNotificationRecord(null)}
        showAiSuggestion
        showAiRawResponse
        onApprove={notificationRecord?.currentUserCanApprove ? (record) => void handleNotificationApprove(record) : undefined}
        onReject={notificationRecord?.currentUserCanApprove ? (record) => void handleNotificationReject(record) : undefined}
        onCompleteProcess={notificationRecord?.currentUserCanProcess ? (record) => void handleNotificationCompleteProcess(record) : undefined}
      />
    </AppLayout>
  );
}

export default function App() {
  return window.location.pathname === '/backup' ? <BackupPage /> : <MainApp />;
}
