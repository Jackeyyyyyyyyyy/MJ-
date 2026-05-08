import React, { useState, useEffect } from 'react';
import LoginPage from './components/LoginPage';
import AppLayout from './components/AppLayout';
import ApplicantHome from './components/ApplicantHome';
import ApproverHome from './components/ApproverHome';
import BossDashboard from './components/BossDashboard';
import AccountPermissionAdmin from './components/AccountPermissionAdmin';
import ApprovalTable from './components/ApprovalTable';
import ApprovalDetailModal from './components/ApprovalDetailModal';
import ApprovalProgressModal from './components/ApprovalProgressModal';
import AiPromptEditor from './components/AiPromptEditor';
import AiAssistantHome from './components/AiAssistantHome';
import WorkflowDesigner from './components/WorkflowDesigner';
import { auth } from './auth';
import { storage } from './storage';
import { AdminView, Role, ApprovalRecord, ApprovalStatus } from './types';
import { approvalSchema } from './approvalSchema';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!auth.getCurrentUser());
  const [perspective, setPerspective] = useState<Role | null>(auth.getPerspective());
  const [selectedModule, setSelectedModule] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [activeAdminView, setActiveAdminView] = useState<AdminView | null>(null);
  
  // Dynamic list state
  const [dynamicRecords, setDynamicRecords] = useState<ApprovalRecord[]>([]);
  const [selectedOne, setSelectedOne] = useState<ApprovalRecord | null>(null);
  const [showD, setShowD] = useState(false);
  const [showP, setShowP] = useState(false);

  const handleLogin = () => {
    setIsAuthenticated(true);
    setPerspective(auth.getPerspective());
    setSelectedModule('');
    setSelectedType('');
    setActiveAdminView(null);
  };

  const handleLogout = () => {
    auth.logout();
    setIsAuthenticated(false);
    setPerspective(null);
  };

  const handleSelectType = (moduleName: string, typeName: string) => {
    setSelectedModule(moduleName);
    setSelectedType(typeName);
    setActiveAdminView(null);
  };

  const handleOpenAccountAdmin = () => {
    setSelectedModule('');
    setSelectedType('');
    setActiveAdminView('accounts');
  };

  const handleOpenAiAssistant = () => {
    setSelectedModule('');
    setSelectedType('');
    setActiveAdminView('ai-assistant');
  };

  const handleOpenWorkflowDesigner = () => {
    setSelectedModule('');
    setSelectedType('');
    setActiveAdminView('workflow-designer');
  };

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

  useEffect(() => {
    loadDynamicRecords();
  }, [selectedModule, selectedType]);

  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  const renderContent = () => {
    const isSuperAdminPerspective = auth.getCurrentUser()?.role === 'developer' && perspective === 'developer';
    const canUseAiAssistant = perspective === 'boss' || isSuperAdminPerspective;

    if (activeAdminView === 'accounts' && isSuperAdminPerspective) {
      return <AccountPermissionAdmin />;
    }

    if (activeAdminView === 'ai-assistant' && canUseAiAssistant) {
      return <AiAssistantHome />;
    }

    if (activeAdminView === 'workflow-designer' && isSuperAdminPerspective) {
      return <WorkflowDesigner />;
    }

    if (selectedType) {
      const canReview = perspective === 'approver' || perspective === 'boss';
      const canSeeAiSuggestion = canReview || auth.getCurrentUser()?.role === 'developer';

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
            showAiRawResponse={auth.getCurrentUser()?.role === 'developer'}
            onApprove={canReview ? (record) => { setShowD(false); void handleDynamicApprove(record); } : undefined}
            onReject={canReview ? (record) => { setShowD(false); void handleDynamicReject(record); } : undefined}
          />
          <ApprovalProgressModal record={selectedOne} onClose={() => { setSelectedOne(null); setShowP(false); }} />
        </div>
      );
    }

    switch (perspective) {
      case 'applicant':
        return <ApplicantHome />;
      case 'approver':
        return <ApproverHome />;
      case 'boss':
      case 'developer':
        return <BossDashboard />;
      default:
        return <ApplicantHome />;
    }
  };

  return (
    <AppLayout 
      onLogout={handleLogout} 
      onPerspectiveChange={(p) => {
        setPerspective(p);
        setActiveAdminView(null);
      }}
      activeAdminView={activeAdminView}
      onOpenAccountAdmin={handleOpenAccountAdmin}
      onOpenAiAssistant={handleOpenAiAssistant}
      onOpenWorkflowDesigner={handleOpenWorkflowDesigner}
      selectedModule={selectedModule}
      selectedType={selectedType}
      onSelectType={handleSelectType}
    >
      {renderContent()}
    </AppLayout>
  );
}
