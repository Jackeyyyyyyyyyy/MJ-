import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Building2, CheckCircle2, Crosshair, GitBranch, Maximize2, Minimize2, Minus, Plus, Save, Search, ShieldCheck, Trash2, UserCheck, UserRound, Users } from 'lucide-react';
import { storage } from '../storage';
import { OrganizationDepartment, OrganizationDirectory, OrganizationMember, SystemAccount } from '../types';
import { cn } from '../lib/utils';

const emptyDirectory: OrganizationDirectory = {
  departments: [],
  members: [],
};
const TRACKPAD_PAN_SENSITIVITY = 1.45;
const TRACKPAD_ZOOM_SENSITIVITY = 0.00235;

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function getDepartmentName(directory: OrganizationDirectory, departmentId?: string) {
  return directory.departments.find((department) => department.id === departmentId)?.name || '未配置部门';
}

function getMemberName(directory: OrganizationDirectory, memberId?: string) {
  return directory.members.find((member) => member.id === memberId)?.name || '未配置成员';
}

function normalizeMemberIds(memberIds?: string[]) {
  return [...new Set((memberIds || []).map((memberId) => memberId.trim()).filter(Boolean))];
}

function getDepartmentManagerNames(directory: OrganizationDirectory, department?: OrganizationDepartment | null) {
  return normalizeMemberIds(department?.managerMemberIds)
    .map((memberId) => directory.members.find((member) => member.id === memberId && member.enabled !== false)?.name)
    .filter(Boolean);
}

function getActiveDepartmentManagers(directory: OrganizationDirectory, department?: OrganizationDepartment | null) {
  return normalizeMemberIds(department?.managerMemberIds)
    .map((memberId) => directory.members.find((member) => member.id === memberId && member.enabled !== false))
    .filter(Boolean) as OrganizationMember[];
}

interface DepartmentChartNode {
  department: OrganizationDepartment;
  children: DepartmentChartNode[];
  memberCount: number;
  boundCount: number;
  hasMissingParent: boolean;
  hasCycle: boolean;
}

interface ReportingChartNode {
  department: OrganizationDepartment;
  memberRoots: ReportingMemberNode[];
  children: ReportingChartNode[];
  memberCount: number;
  boundCount: number;
  hasMissingParent: boolean;
  hasCycle: boolean;
}

interface ReportingMemberNode {
  member: OrganizationMember;
  children: ReportingMemberNode[];
  hasCycle: boolean;
}

function buildDepartmentMemberTree(members: OrganizationMember[]) {
  const membersById = new Map(members.map((member) => [member.id, member]));
  const childrenBySupervisor = new Map<string, OrganizationMember[]>();

  members.forEach((member) => {
    if (!member.supervisorId || !membersById.has(member.supervisorId)) return;
    const children = childrenBySupervisor.get(member.supervisorId) || [];
    children.push(member);
    childrenBySupervisor.set(member.supervisorId, children);
  });

  const createNode = (member: OrganizationMember, ancestors = new Set<string>()): ReportingMemberNode => {
    const hasCycle = ancestors.has(member.id);
    if (hasCycle) return { member, children: [], hasCycle: true };

    const nextAncestors = new Set(ancestors);
    nextAncestors.add(member.id);

    return {
      member,
      children: (childrenBySupervisor.get(member.id) || []).map((child) => createNode(child, nextAncestors)),
      hasCycle: false,
    };
  };

  const roots = members.filter((member) => !member.supervisorId || !membersById.has(member.supervisorId));
  return (roots.length > 0 ? roots : members.slice(0, 1)).map((member) => createNode(member));
}

function buildDepartmentChart(directory: OrganizationDirectory) {
  const departmentsById = new Map(directory.departments.map((department) => [department.id, department]));
  const childrenByParent = new Map<string, OrganizationDepartment[]>();

  directory.departments.forEach((department) => {
    if (!department.parentId || !departmentsById.has(department.parentId)) return;
    const children = childrenByParent.get(department.parentId) || [];
    children.push(department);
    childrenByParent.set(department.parentId, children);
  });

  const visited = new Set<string>();
  const createNode = (department: OrganizationDepartment, ancestors = new Set<string>()): DepartmentChartNode => {
    const hasCycle = ancestors.has(department.id);
    visited.add(department.id);
    const members = directory.members.filter((member) => member.departmentId === department.id && member.enabled !== false);

    if (hasCycle) {
      return {
        department,
        children: [],
        memberCount: members.length,
        boundCount: members.filter((member) => Boolean(member.accountUsername)).length,
        hasMissingParent: false,
        hasCycle: true,
      };
    }

    const nextAncestors = new Set(ancestors);
    nextAncestors.add(department.id);

    return {
      department,
      children: (childrenByParent.get(department.id) || []).map((child) => createNode(child, nextAncestors)),
      memberCount: members.length,
      boundCount: members.filter((member) => Boolean(member.accountUsername)).length,
      hasMissingParent: Boolean(department.parentId && !departmentsById.has(department.parentId)),
      hasCycle: false,
    };
  };

  const rootDepartments = directory.departments.filter((department) => !department.parentId || !departmentsById.has(department.parentId));
  const roots = (rootDepartments.length > 0 ? rootDepartments : directory.departments.slice(0, 1)).map((department) => createNode(department));
  const detachedRoots = directory.departments
    .filter((department) => !visited.has(department.id))
    .map((department) => createNode(department));

  return [...roots, ...detachedRoots];
}

function buildReportingChart(directory: OrganizationDirectory) {
  const departmentsById = new Map(directory.departments.map((department) => [department.id, department]));
  const childrenByParent = new Map<string, OrganizationDepartment[]>();

  directory.departments.forEach((department) => {
    if (!department.parentId || !departmentsById.has(department.parentId)) return;
    const children = childrenByParent.get(department.parentId) || [];
    children.push(department);
    childrenByParent.set(department.parentId, children);
  });

  const visited = new Set<string>();
  const createNode = (department: OrganizationDepartment, ancestors = new Set<string>()): ReportingChartNode => {
    const hasCycle = ancestors.has(department.id);
    visited.add(department.id);
    const members = directory.members.filter((member) => member.departmentId === department.id && member.enabled !== false);

    if (hasCycle) {
      return {
        department,
        memberRoots: buildDepartmentMemberTree(members),
        children: [],
        memberCount: members.length,
        boundCount: members.filter((member) => Boolean(member.accountUsername)).length,
        hasMissingParent: false,
        hasCycle: true,
      };
    }

    const nextAncestors = new Set(ancestors);
    nextAncestors.add(department.id);

    return {
      department,
      memberRoots: buildDepartmentMemberTree(members),
      children: (childrenByParent.get(department.id) || []).map((child) => createNode(child, nextAncestors)),
      memberCount: members.length,
      boundCount: members.filter((member) => Boolean(member.accountUsername)).length,
      hasMissingParent: Boolean(department.parentId && !departmentsById.has(department.parentId)),
      hasCycle: false,
    };
  };

  const rootDepartments = directory.departments.filter((department) => !department.parentId || !departmentsById.has(department.parentId));
  const roots = (rootDepartments.length > 0 ? rootDepartments : directory.departments.slice(0, 1)).map((department) => createNode(department));
  const detachedRoots = directory.departments
    .filter((department) => !visited.has(department.id))
    .map((department) => createNode(department));

  return [...roots, ...detachedRoots];
}

function countDepartmentNodes(nodes: DepartmentChartNode[]): number {
  return nodes.reduce((total, node) => total + 1 + countDepartmentNodes(node.children), 0);
}

function countReportingNodes(nodes: ReportingChartNode[]): number {
  return nodes.reduce((total, node) => total + node.memberCount + countReportingNodes(node.children), 0);
}

function collectReportingDescendantDepartmentIds(node: ReportingChartNode, ids = new Set<string>()) {
  node.children.forEach((child) => {
    ids.add(child.department.id);
    collectReportingDescendantDepartmentIds(child, ids);
  });

  return ids;
}

function hasDepartmentCycle(directory: OrganizationDirectory, departmentId: string) {
  const departmentsById = new Map(directory.departments.map((department) => [department.id, department]));
  const seen = new Set<string>();
  let current = departmentsById.get(departmentId);

  while (current?.parentId) {
    if (seen.has(current.id)) return true;
    seen.add(current.id);
    current = departmentsById.get(current.parentId);
  }

  return false;
}

function hasMemberCycle(directory: OrganizationDirectory, memberId: string) {
  const membersById = new Map(directory.members.map((member) => [member.id, member]));
  const seen = new Set<string>();
  let current = membersById.get(memberId);

  while (current?.supervisorId) {
    if (seen.has(current.id)) return true;
    seen.add(current.id);
    current = membersById.get(current.supervisorId);
  }

  return false;
}

function getAncestorDepartmentIds(directory: OrganizationDirectory, departmentId?: string) {
  const departmentsById = new Map(directory.departments.map((department) => [department.id, department]));
  const ids = new Set<string>();
  let current = departmentId ? departmentsById.get(departmentId) : undefined;

  while (current) {
    if (ids.has(current.id)) break;
    ids.add(current.id);
    current = current.parentId ? departmentsById.get(current.parentId) : undefined;
  }

  return ids;
}

function getReportLineMemberIds(directory: OrganizationDirectory, memberId: string) {
  const childrenBySupervisor = new Map<string, OrganizationMember[]>();
  directory.members.forEach((member) => {
    if (!member.supervisorId) return;
    childrenBySupervisor.set(member.supervisorId, [
      ...(childrenBySupervisor.get(member.supervisorId) || []),
      member,
    ]);
  });

  const ids = new Set<string>();
  const collect = (supervisorId: string) => {
    (childrenBySupervisor.get(supervisorId) || []).forEach((child) => {
      if (ids.has(child.id)) return;
      ids.add(child.id);
      collect(child.id);
    });
  };

  collect(memberId);
  return ids;
}

function getSupervisorCandidates(directory: OrganizationDirectory, member: OrganizationMember) {
  const eligibleDepartmentIds = getAncestorDepartmentIds(directory, member.departmentId);
  const reportLineMemberIds = getReportLineMemberIds(directory, member.id);

  return directory.members.filter((candidate) => (
    candidate.id !== member.id
    && candidate.enabled !== false
    && eligibleDepartmentIds.has(candidate.departmentId)
    && !reportLineMemberIds.has(candidate.id)
  ));
}

function buildHealthMessages(directory: OrganizationDirectory) {
  const messages: Array<{ tone: 'danger' | 'warning' | 'info'; text: string }> = [];
  const departmentIds = new Set(directory.departments.map((department) => department.id));
  const memberIds = new Set(directory.members.map((member) => member.id));
  const accountOwners = new Map<string, string[]>();

  directory.members.forEach((member) => {
    if (member.accountUsername) {
      accountOwners.set(member.accountUsername, [...(accountOwners.get(member.accountUsername) || []), member.name]);
    }

    if (!member.departmentId || !departmentIds.has(member.departmentId)) {
      messages.push({ tone: 'danger', text: `${member.name} 未归属有效部门` });
    }

    if (member.supervisorId && !memberIds.has(member.supervisorId)) {
      messages.push({ tone: 'danger', text: `${member.name} 的直属上级不存在` });
    }

    if (member.supervisorId && memberIds.has(member.supervisorId)) {
      const supervisor = directory.members.find((item) => item.id === member.supervisorId);
      const allowedDepartmentIds = getAncestorDepartmentIds(directory, member.departmentId);
      if (supervisor && !allowedDepartmentIds.has(supervisor.departmentId)) {
        messages.push({ tone: 'danger', text: `${member.name} 的直属上级不符合部门层级` });
      }
    }

    if (hasMemberCycle(directory, member.id)) {
      messages.push({ tone: 'danger', text: `${member.name} 的汇报链路存在循环` });
    }
  });

  accountOwners.forEach((owners, accountUsername) => {
    if (owners.length > 1) {
      messages.push({ tone: 'danger', text: `账号 ${accountUsername} 被重复绑定：${owners.join('、')}` });
    }
  });

  directory.departments.forEach((department) => {
    if (department.parentId && !departmentIds.has(department.parentId)) {
      messages.push({ tone: 'danger', text: `${department.name} 的上级部门不存在` });
    }

    if (hasDepartmentCycle(directory, department.id)) {
      messages.push({ tone: 'danger', text: `${department.name} 的部门层级存在循环` });
    }

    normalizeMemberIds(department.managerMemberIds).forEach((managerMemberId) => {
      const manager = directory.members.find((member) => member.id === managerMemberId);
      if (!manager) {
        messages.push({ tone: 'danger', text: `${department.name} 的部门主管不存在` });
      } else if (manager.enabled === false) {
        messages.push({ tone: 'warning', text: `${department.name} 的部门主管 ${manager.name} 已停用` });
      }
    });
  });

  const unboundMembers = directory.members.filter((member) => !member.accountUsername && member.enabled !== false);
  if (unboundMembers.length > 0) {
    messages.push({ tone: 'warning', text: `${unboundMembers.length} 名成员未绑定登录账号，不能直接处理审批任务` });
  }

  if (messages.length === 0) {
    messages.push({ tone: 'info', text: '组织配置完整，可用于审批人解析' });
  }

  return messages;
}

function ChartViewport({ children }: { children: React.ReactNode }) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<HTMLDivElement | null>(null);
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const dragStateRef = useRef({
    isDragging: false,
    startX: 0,
    startY: 0,
    x: 0,
    y: 0,
  });
  const [isDragging, setIsDragging] = useState(false);

  const fitToView = () => {
    const viewport = viewportRef.current;
    const chart = chartRef.current;
    if (!viewport || !chart) return;

    const contentWidth = chart.offsetWidth;
    const contentHeight = chart.offsetHeight;
    if (!contentWidth || !contentHeight) return;

    const paddingX = 72;
    const paddingY = 64;

    const scale = Math.min(
      1.2,
      Math.max(0.38, Math.min((viewport.clientWidth - paddingX) / contentWidth, (viewport.clientHeight - paddingY) / contentHeight)),
    );

    setView({
      scale,
      x: (viewport.clientWidth - contentWidth * scale) / 2 - chart.offsetLeft * scale,
      y: Math.max(32, (viewport.clientHeight - contentHeight * scale) / 2) - chart.offsetTop * scale,
    });
  };

  useEffect(() => {
    const frame = window.requestAnimationFrame(fitToView);
    return () => window.cancelAnimationFrame(frame);
  }, [children]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === viewportRef.current);
      window.requestAnimationFrame(fitToView);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [children]);

  const zoomAt = (nextScale: number, clientX?: number, clientY?: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    setView((current) => {
      const scale = Math.min(1.6, Math.max(0.35, nextScale));
      const rect = viewport.getBoundingClientRect();
      const originX = (clientX ?? rect.left + rect.width / 2) - rect.left;
      const originY = (clientY ?? rect.top + rect.height / 2) - rect.top;
      const contentX = (originX - current.x) / current.scale;
      const contentY = (originY - current.y) / current.scale;

      return {
        scale,
        x: originX - contentX * scale,
        y: originY - contentY * scale,
      };
    });
  };

  const beginDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest('button')) return;

    dragStateRef.current = {
      isDragging: true,
      startX: event.clientX,
      startY: event.clientY,
      x: view.x,
      y: view.y,
    };
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const updateDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState.isDragging) return;

    setView((current) => ({
      ...current,
      x: dragState.x + event.clientX - dragState.startX,
      y: dragState.y + event.clientY - dragState.startY,
    }));
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    dragStateRef.current.isDragging = false;
    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const toggleFullscreen = async () => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    if (document.fullscreenElement === viewport) {
      await document.exitFullscreen();
      return;
    }

    await viewport.requestFullscreen();
  };

  return (
    <div
      ref={viewportRef}
      className={cn(
        "diagram-fullscreen-surface relative h-[560px] overflow-hidden bg-canvas-white select-none touch-none",
        isDragging ? "cursor-grabbing" : "cursor-grab"
      )}
      onPointerDown={beginDrag}
      onPointerMove={updateDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onWheel={(event) => {
        event.preventDefault();
        if (event.ctrlKey || event.metaKey) {
          const zoomMultiplier = Math.exp(-event.deltaY * TRACKPAD_ZOOM_SENSITIVITY);
          zoomAt(view.scale * zoomMultiplier, event.clientX, event.clientY);
          return;
        }

        const deltaX = (event.deltaX || (event.shiftKey ? event.deltaY : 0)) * TRACKPAD_PAN_SENSITIVITY;
        const deltaY = (event.shiftKey ? 0 : event.deltaY) * TRACKPAD_PAN_SENSITIVITY;
        setView((current) => ({
          ...current,
          x: current.x - deltaX,
          y: current.y - deltaY,
        }));
      }}
    >
      <div className="absolute right-5 top-5 z-20 flex items-center gap-1 rounded-full border border-border-silver bg-white/95 p-1 shadow-sm">
        <button type="button" className="h-8 w-8 rounded-full text-medium-gray hover:bg-lightest-gray-background flex items-center justify-center" onClick={() => zoomAt(view.scale * 0.88)}>
          <Minus size={14} />
        </button>
        <span className="min-w-12 text-center text-[11px] font-black text-medium-gray">{Math.round(view.scale * 100)}%</span>
        <button type="button" className="h-8 w-8 rounded-full text-medium-gray hover:bg-lightest-gray-background flex items-center justify-center" onClick={() => zoomAt(view.scale * 1.12)}>
          <Plus size={14} />
        </button>
        <button type="button" className="h-8 w-8 rounded-full text-medium-gray hover:bg-lightest-gray-background flex items-center justify-center" onClick={fitToView}>
          <Crosshair size={14} />
        </button>
        <button
          type="button"
          className="h-8 w-8 rounded-full text-medium-gray hover:bg-lightest-gray-background flex items-center justify-center"
          onClick={toggleFullscreen}
          title={isFullscreen ? '退出全屏' : '全屏'}
          aria-label={isFullscreen ? '退出全屏' : '全屏'}
        >
          {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
      </div>
      <div
        ref={contentRef}
        className="absolute left-0 top-0 flex min-w-max items-start justify-center gap-12 px-10 py-12 pb-16"
        style={{
          transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})`,
          transformOrigin: '0 0',
        }}
      >
        <div ref={chartRef} className="flex items-start justify-center gap-12">{children}</div>
      </div>
    </div>
  );
}

function DepartmentManagerPicker({
  department,
  directory,
  onChange,
}: {
  department: OrganizationDepartment;
  directory: OrganizationDirectory;
  onChange: (managerMemberIds: string[]) => void;
}) {
  const [keyword, setKeyword] = useState('');
  const selectedIds = normalizeMemberIds(department.managerMemberIds);
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const normalizedKeyword = keyword.trim().toLowerCase();
  const memberOptions = useMemo(() => (
    directory.members
      .filter((member) => member.enabled !== false)
      .map((member) => {
        const departmentName = getDepartmentName(directory, member.departmentId);
        return {
          member,
          searchText: [member.name, departmentName, member.title, member.accountUsername].filter(Boolean).join(' ').toLowerCase(),
          description: [departmentName, member.title, member.accountUsername ? `账号 ${member.accountUsername}` : '未绑定账号'].filter(Boolean).join(' / '),
        };
      })
  ), [directory]);
  const filteredOptions = useMemo(() => {
    if (!normalizedKeyword) return memberOptions;
    return memberOptions.filter((option) => option.searchText.includes(normalizedKeyword));
  }, [memberOptions, normalizedKeyword]);
  const selectedManagers = selectedIds
    .map((memberId) => directory.members.find((member) => member.id === memberId))
    .filter(Boolean) as OrganizationMember[];

  const toggleManager = (memberId: string, checked: boolean) => {
    if (checked) {
      onChange(normalizeMemberIds([...selectedIds, memberId]));
      return;
    }

    onChange(selectedIds.filter((selectedId) => selectedId !== memberId));
  };

  return (
    <div className="space-y-2 lg:col-span-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[12px] font-black text-light-gray uppercase tracking-wider">部门主管</span>
        <span className="text-[11px] font-bold text-medium-gray">已选 {selectedIds.length} 人</span>
      </div>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-light-gray"
          size={15}
          strokeWidth={2.5}
        />
        <input
          className="input-field h-10 py-2 pl-9 pr-3 text-[13px]"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="搜索姓名、部门、岗位或账号"
        />
      </div>
      {selectedManagers.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedManagers.map((member) => (
            <button
              key={member.id}
              type="button"
              onClick={() => toggleManager(member.id, false)}
              className="rounded-full bg-[#e8f5e9] px-2.5 py-1 text-[11px] font-black text-[#2e7d32] hover:bg-[#d7edd9]"
              title="点击取消部门主管"
            >
              {member.name}
            </button>
          ))}
        </div>
      )}
      <div className="max-h-56 overflow-y-auto rounded-2xl border border-border-silver bg-white p-2">
        {memberOptions.length === 0 ? (
          <p className="px-3 py-6 text-center text-[13px] font-bold text-medium-gray">暂无启用成员</p>
        ) : filteredOptions.length === 0 ? (
          <p className="px-3 py-6 text-center text-[13px] font-bold text-medium-gray">未找到匹配成员</p>
        ) : (
          filteredOptions.map(({ member, description }) => (
            <label
              key={member.id}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 transition-colors",
                selectedIdSet.has(member.id) ? "bg-[#f1faee]" : "hover:bg-lightest-gray-background"
              )}
            >
              <input
                type="checkbox"
                checked={selectedIdSet.has(member.id)}
                onChange={(event) => toggleManager(member.id, event.target.checked)}
                className="accent-black"
              />
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-black text-midnight-graphite">{member.name}</span>
                <span className="block truncate text-[11px] font-bold text-medium-gray">{description}</span>
              </span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}

function ReportingMemberTree({
  node,
  directory,
  managerIdSet,
}: {
  node: ReportingMemberNode;
  directory: OrganizationDirectory;
  managerIdSet: Set<string>;
  key?: React.Key;
}) {
  const member = node.member;
  const isManager = managerIdSet.has(member.id);

  return (
    <div className="relative">
      <div className={cn(
        "rounded-md border-l-2 px-2.5 py-2",
        isManager ? "border-l-midnight-graphite bg-white" : "border-l-border-silver bg-transparent",
      )}>
        <div className="flex items-baseline gap-2">
          <p className="min-w-0 flex-1 truncate text-[13px] font-black text-midnight-graphite">{member.name}</p>
          {(isManager || member.isAdmin) && (
            <span className="shrink-0 text-[10px] font-bold text-medium-gray">
              {[isManager ? '主管' : '', member.isAdmin ? '管理员' : ''].filter(Boolean).join(' / ')}
            </span>
          )}
        </div>
        <p className="mt-1 truncate text-[11px] font-bold text-medium-gray">{member.title || '未配置职位'}</p>
        <p className="mt-0.5 truncate text-[10px] font-bold text-light-gray">
          上级：{member.supervisorId ? getMemberName(directory, member.supervisorId) : '无'}
        </p>
        {node.hasCycle && (
          <p className="mt-1 text-[10px] font-bold text-[#c62828]">汇报链路存在循环</p>
        )}
      </div>
      {node.children.length > 0 && (
        <div className="ml-3 mt-1 space-y-1 border-l border-border-silver pl-3">
          {node.children.map((child) => (
            <ReportingMemberTree
              key={child.member.id}
              node={child}
              directory={directory}
              managerIdSet={managerIdSet}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ReportingChartCard({
  node,
  directory,
  expandedDepartmentIds,
  selectedDepartmentId,
  onToggleDepartment,
  onSelectDepartment,
}: {
  node: ReportingChartNode;
  directory: OrganizationDirectory;
  expandedDepartmentIds: Set<string>;
  selectedDepartmentId: string;
  onToggleDepartment: (node: ReportingChartNode) => void;
  onSelectDepartment: (departmentId: string) => void;
  key?: React.Key;
}) {
  const warning = node.hasMissingParent || node.hasCycle;
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedDepartmentIds.has(node.department.id);
  const isSelected = selectedDepartmentId === node.department.id;
  const managerNames = getDepartmentManagerNames(directory, node.department);
  const managerIdSet = useMemo(() => new Set(normalizeMemberIds(node.department.managerMemberIds)), [node.department.managerMemberIds]);
  const managerLabel = managerNames.length > 0 ? `主管 ${managerNames.slice(0, 2).join('、')}${managerNames.length > 2 ? ` +${managerNames.length - 2}` : ''}` : '未配置主管';

  return (
    <div className="flex flex-col items-center shrink-0">
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelectDepartment(node.department.id)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelectDepartment(node.department.id);
          }
        }}
        className={cn(
          "w-[320px] rounded-lg border bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] outline-none transition-colors hover:border-midnight-graphite/35 focus:ring-2 focus:ring-midnight-graphite/10",
          warning ? "border-[#c62828]" : isSelected ? "border-midnight-graphite" : "border-border-silver"
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-[17px] font-black leading-6 text-midnight-graphite">{node.department.name}</p>
            <p className={cn(
              "mt-1 truncate text-[12px] font-bold",
              managerNames.length > 0 ? "text-medium-gray" : "text-[#9a5b00]",
            )}>
              {managerLabel}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {hasChildren && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleDepartment(node);
                }}
                className={cn(
                  "h-8 min-w-8 rounded-lg border px-2 text-[12px] font-black flex items-center justify-center gap-1 transition-colors",
                  isExpanded
                    ? "border-midnight-graphite bg-midnight-graphite text-white"
                    : "border-border-silver bg-white text-medium-gray hover:border-midnight-graphite/40"
                )}
                aria-label={isExpanded ? '收起下级部门' : '展开下级部门'}
                title={isExpanded ? '收起下级部门' : '展开下级部门'}
              >
                {isExpanded ? <Minus size={12} strokeWidth={3} /> : <Plus size={12} strokeWidth={3} />}
                {node.children.length}
              </button>
            )}
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <div className="rounded-lg border border-border-silver bg-[#fafafa] p-2.5">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-medium-gray">成员</span>
              <span className="text-[11px] font-bold text-light-gray">{node.memberCount} 人</span>
            </div>
            {node.memberRoots.length === 0 ? (
              <p className="px-1 py-2 text-[12px] font-bold text-light-gray">暂无成员</p>
            ) : (
              <div className="max-h-48 space-y-1 overflow-y-auto pr-1">
                {node.memberRoots.map((memberNode) => (
                  <ReportingMemberTree
                    key={memberNode.member.id}
                    node={memberNode}
                    directory={directory}
                    managerIdSet={managerIdSet}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
        {warning && (
          <p className="text-[11px] font-bold text-[#c62828]">
            {node.hasCycle ? '部门层级存在循环' : '上级部门不存在'}
          </p>
        )}
      </div>

      {hasChildren && isExpanded && (
        <div className="flex flex-col items-center">
          <div className="h-8 w-px bg-border-silver" />
          <div className="relative flex items-start gap-8 pt-8">
            {node.children.length > 1 && (
              <div className="absolute left-[140px] right-[140px] top-0 h-px bg-border-silver" />
            )}
            {node.children.map((child) => (
              <div key={`${node.department.id}-${child.department.id}`} className="relative flex flex-col items-center shrink-0">
                <div className="absolute left-1/2 top-[-32px] h-8 w-px -translate-x-1/2 bg-border-silver" />
                <ReportingChartCard
                  node={child}
                  directory={directory}
                  expandedDepartmentIds={expandedDepartmentIds}
                  selectedDepartmentId={selectedDepartmentId}
                  onToggleDepartment={onToggleDepartment}
                  onSelectDepartment={onSelectDepartment}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DepartmentTreeItem({
  node,
  selectedId,
  onSelect,
  depth = 0,
}: {
  node: DepartmentChartNode;
  selectedId: string;
  onSelect: (id: string) => void;
  depth?: number;
  key?: React.Key;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={() => onSelect(node.department.id)}
        className={cn(
          "w-full min-h-10 rounded-xl px-3 py-2 text-left text-[13px] font-bold transition-all flex items-center gap-2",
          selectedId === node.department.id ? "bg-black text-white" : "text-midnight-graphite hover:bg-lightest-gray-background"
        )}
        style={{ paddingLeft: `${12 + depth * 14}px` }}
      >
        <Building2 size={14} strokeWidth={2.4} className="shrink-0" />
        <span className="truncate">{node.department.name}</span>
        <span className={cn(
          "ml-auto text-[10px] font-black",
          selectedId === node.department.id ? "text-white/70" : "text-light-gray"
        )}>
          {node.memberCount}
        </span>
      </button>
      {node.children.length > 0 && (
        <div className="mt-1 space-y-1">
          {node.children.map((child) => (
            <DepartmentTreeItem
              key={child.department.id}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function OrganizationAdmin() {
  const [directory, setDirectory] = useState<OrganizationDirectory>(emptyDirectory);
  const [accounts, setAccounts] = useState<SystemAccount[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [expandedReportingDepartmentIds, setExpandedReportingDepartmentIds] = useState<Set<string>>(() => new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const departmentEditorRef = useRef<HTMLDivElement | null>(null);

  const accountOptions = useMemo(
    () => accounts.filter((account) => account.role !== 'developer' && account.enabled),
    [accounts],
  );
  const departmentChartRoots = useMemo(() => buildDepartmentChart(directory), [directory]);
  const reportingChartRoots = useMemo(() => buildReportingChart(directory), [directory]);
  const departmentIdSet = useMemo(() => new Set(directory.departments.map((department) => department.id)), [directory.departments]);
  const selectedDepartment = directory.departments.find((department) => department.id === selectedDepartmentId) || null;
  const selectedDepartmentMembers = useMemo(
    () => directory.members.filter((member) => member.departmentId === selectedDepartmentId),
    [directory.members, selectedDepartmentId],
  );
  const selectedDepartmentManagerIds = useMemo(
    () => normalizeMemberIds(selectedDepartment?.managerMemberIds),
    [selectedDepartment],
  );
  const activeMembers = useMemo(
    () => directory.members.filter((member) => member.enabled !== false),
    [directory.members],
  );
  const unboundMembers = useMemo(
    () => activeMembers.filter((member) => !member.accountUsername),
    [activeMembers],
  );
  const unboundMemberCount = unboundMembers.length;
  const boundMemberCount = activeMembers.filter((member) => Boolean(member.accountUsername)).length;
  const missingManagerDepartments = useMemo(
    () => directory.departments.filter((department) => getActiveDepartmentManagers(directory, department).length === 0),
    [directory],
  );
  const rootSupervisorMembers = useMemo(
    () => activeMembers.filter((member) => !member.supervisorId),
    [activeMembers],
  );
  const adminMembers = useMemo(
    () => activeMembers.filter((member) => member.isAdmin),
    [activeMembers],
  );
  const departmentsWithManagersCount = Math.max(0, directory.departments.length - missingManagerDepartments.length);

  const selectDepartmentForEdit = (departmentId: string, shouldScroll = false) => {
    setSelectedDepartmentId(departmentId);
    if (shouldScroll) {
      window.requestAnimationFrame(() => {
        departmentEditorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [nextDirectory, nextAccounts] = await Promise.all([
        storage.getOrganizationDirectory(),
        storage.getAccounts(),
      ]);
      setDirectory(nextDirectory);
      setAccounts(nextAccounts);
      setSelectedDepartmentId((current) => current || nextDirectory.departments[0]?.id || '');
      setExpandedReportingDepartmentIds(new Set(nextDirectory.departments.map((department) => department.id)));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (!directory.departments.length) {
      setSelectedDepartmentId('');
      return;
    }

    if (!directory.departments.some((department) => department.id === selectedDepartmentId)) {
      setSelectedDepartmentId(directory.departments[0].id);
    }
  }, [directory.departments, selectedDepartmentId]);

  useEffect(() => {
    setExpandedReportingDepartmentIds((current) => {
      const next = new Set([...current].filter((id) => departmentIdSet.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [departmentIdSet]);

  const toggleReportingDepartment = (node: ReportingChartNode) => {
    setExpandedReportingDepartmentIds((current) => {
      const next = new Set(current);

      if (next.has(node.department.id)) {
        next.delete(node.department.id);
        collectReportingDescendantDepartmentIds(node).forEach((id) => next.delete(id));
        return next;
      }

      next.add(node.department.id);
      return next;
    });
  };

  const updateDepartment = (id: string, patch: Partial<OrganizationDepartment>) => {
    setDirectory((current) => ({
      ...current,
      departments: current.departments.map((department) => (
        department.id === id ? { ...department, ...patch } : department
      )),
    }));
  };

  const updateSelectedDepartmentManager = (memberId: string, checked: boolean) => {
    if (!selectedDepartment) return;

    const managerMemberIds = checked
      ? normalizeMemberIds([...selectedDepartmentManagerIds, memberId])
      : selectedDepartmentManagerIds.filter((selectedId) => selectedId !== memberId);

    updateDepartment(selectedDepartment.id, { managerMemberIds });
  };

  const updateMember = (id: string, patch: Partial<OrganizationMember>) => {
    setDirectory((current) => ({
      ...current,
      members: current.members.map((member) => (
        member.id === id ? { ...member, ...patch } : member
      )),
    }));
  };

  const addDepartment = (parentId?: string) => {
    const id = createId('dept');
    if (parentId) {
      setExpandedReportingDepartmentIds((current) => {
        const next = new Set(current);
        next.add(parentId);
        return next;
      });
    }
    setDirectory((current) => ({
      ...current,
      departments: [
        ...current.departments,
        { id, name: '新部门', parentId },
      ],
    }));
    setSelectedDepartmentId(id);
  };

  const removeDepartment = (department: OrganizationDepartment) => {
    const hasChildren = directory.departments.some((item) => item.parentId === department.id);
    const hasMembers = directory.members.some((member) => member.departmentId === department.id);
    if (hasChildren || hasMembers) {
      window.alert('请先移走下级部门和部门成员，再删除该部门。');
      return;
    }

    setDirectory((current) => ({
      ...current,
      departments: current.departments.filter((item) => item.id !== department.id),
    }));
  };

  const addMember = (departmentId = selectedDepartmentId) => {
    const id = createId('member');
    setDirectory((current) => ({
      ...current,
      members: [
        ...current.members,
        {
          id,
          name: '新成员',
          departmentId,
          title: '成员',
          isAdmin: false,
          enabled: true,
        },
      ],
    }));
  };

  const removeMember = (member: OrganizationMember) => {
    setDirectory((current) => ({
      ...current,
      departments: current.departments.map((department) => ({
        ...department,
        managerMemberIds: normalizeMemberIds(department.managerMemberIds).filter((memberId) => memberId !== member.id),
      })),
      members: current.members
        .filter((item) => item.id !== member.id)
        .map((item) => item.supervisorId === member.id ? { ...item, supervisorId: undefined } : item),
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage('');
    try {
      const saved = await storage.saveOrganizationDirectory(directory);
      setDirectory(saved);
      setMessage('组织架构已保存');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  const organizationHealthItems = [
    {
      label: '主管覆盖',
      value: `${departmentsWithManagersCount}/${directory.departments.length}`,
      description: missingManagerDepartments.length > 0 ? `还有 ${missingManagerDepartments.length} 个部门未设主管` : '全部部门已配置主管',
      icon: missingManagerDepartments.length > 0 ? AlertTriangle : CheckCircle2,
      tone: missingManagerDepartments.length > 0 ? 'warning' : 'success',
      targetDepartmentId: missingManagerDepartments[0]?.id,
    },
    {
      label: '账号绑定',
      value: `${boundMemberCount}/${activeMembers.length}`,
      description: unboundMemberCount > 0 ? `${unboundMemberCount} 名成员未绑定账号` : '可直接处理审批任务',
      icon: unboundMemberCount > 0 ? AlertTriangle : CheckCircle2,
      tone: unboundMemberCount > 0 ? 'warning' : 'success',
      targetDepartmentId: unboundMembers[0]?.departmentId,
    },
    {
      label: '直属上级',
      value: rootSupervisorMembers.length,
      description: rootSupervisorMembers.length > 0 ? '通常是最高层或待补充' : '所有成员都有直属上级',
      icon: UserCheck,
      tone: 'neutral',
      targetDepartmentId: rootSupervisorMembers[0]?.departmentId,
    },
    {
      label: '组织管理员',
      value: adminMembers.length,
      description: adminMembers.length > 0 ? '空审批人可转管理员' : '建议至少配置 1 名管理员',
      icon: ShieldCheck,
      tone: adminMembers.length > 0 ? 'success' : 'warning',
      targetDepartmentId: adminMembers[0]?.departmentId,
    },
  ];

  if (isLoading) {
    return <div className="text-[15px] font-bold text-medium-gray">正在加载组织架构...</div>;
  }

  return (
    <div className="space-y-8 pb-32 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[11px] font-black text-light-gray uppercase tracking-[0.2em]">System Admin</p>
          <h1 className="mt-1 text-2xl font-black text-midnight-graphite tracking-tight">组织架构</h1>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="h-11 px-5 rounded-full bg-black text-white text-[13px] font-bold flex items-center justify-center gap-2 disabled:opacity-40"
        >
          <Save size={15} strokeWidth={3} />
          {isSaving ? '保存中...' : '保存配置'}
        </button>
      </div>

      {message && (
        <div className="rounded-2xl border border-border-silver bg-white px-5 py-4 text-[13px] font-bold text-midnight-graphite">
          {message}
        </div>
      )}

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {organizationHealthItems.map((item) => {
          const Icon = item.icon;
          const canJump = Boolean(item.targetDepartmentId);

          return (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                if (item.targetDepartmentId) selectDepartmentForEdit(item.targetDepartmentId, true);
              }}
              className={cn(
                "min-h-[112px] rounded-2xl border bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md disabled:hover:translate-y-0 disabled:hover:shadow-sm",
                item.tone === 'warning' ? "border-[#f3d08a]" : item.tone === 'success' ? "border-[#cfe7d3]" : "border-border-silver",
                !canJump && "cursor-default",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
                  item.tone === 'warning' ? "bg-[#fff7e6] text-[#9a5b00]" : item.tone === 'success' ? "bg-[#e8f5e9] text-[#2e7d32]" : "bg-lightest-gray-background text-midnight-graphite",
                )}>
                  <Icon size={17} strokeWidth={2.5} />
                </div>
                <span className="text-[22px] font-black leading-none text-midnight-graphite">{item.value}</span>
              </div>
              <p className="mt-3 text-[12px] font-black uppercase tracking-wider text-light-gray">{item.label}</p>
              <p className="mt-1 text-[12px] font-bold leading-5 text-medium-gray">{item.description}</p>
            </button>
          );
        })}
      </section>

      <section className="rounded-2xl border border-border-silver bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-border-silver flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-black text-white flex items-center justify-center">
              <GitBranch size={18} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-[18px] font-black">人员汇报关系图</h2>
              <p className="text-[12px] font-bold text-medium-gray">
                按部门展示成员、直属上级、主管和管理员配置。
              </p>
            </div>
          </div>
          <div className="text-[12px] font-bold text-light-gray">
            未绑定账号 {unboundMemberCount}
          </div>
        </div>

        {reportingChartRoots.length === 0 ? (
          <div className="px-8 py-16 text-center text-[14px] font-bold text-medium-gray">
            暂无成员，添加成员后会自动生成汇报关系图。
          </div>
        ) : (
          <ChartViewport>
            {reportingChartRoots.map((node) => (
              <ReportingChartCard
                key={node.department.id}
                node={node}
                directory={directory}
                expandedDepartmentIds={expandedReportingDepartmentIds}
                selectedDepartmentId={selectedDepartmentId}
                onToggleDepartment={toggleReportingDepartment}
                onSelectDepartment={(departmentId) => selectDepartmentForEdit(departmentId, true)}
              />
            ))}
          </ChartViewport>
        )}
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6">
        <aside className="rounded-2xl border border-border-silver bg-white shadow-sm overflow-hidden h-fit">
          <div className="px-5 py-4 border-b border-border-silver flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 size={17} />
              <h2 className="text-[17px] font-black">部门树</h2>
            </div>
            <button
              type="button"
              onClick={() => addDepartment()}
              className="h-8 px-3 rounded-full bg-lightest-gray-background text-[12px] font-black flex items-center gap-1"
            >
              <Plus size={13} /> 根部门
            </button>
          </div>
          <div className="p-3 space-y-1 max-h-[620px] overflow-y-auto">
            {departmentChartRoots.length === 0 ? (
              <div className="px-3 py-8 text-center text-[13px] font-bold text-medium-gray">
                暂无部门
              </div>
            ) : (
              departmentChartRoots.map((node) => (
                <DepartmentTreeItem
                  key={node.department.id}
                  node={node}
                  selectedId={selectedDepartmentId}
                  onSelect={(departmentId) => selectDepartmentForEdit(departmentId)}
                />
              ))
            )}
          </div>
        </aside>

        <div className="space-y-6">
          <section ref={departmentEditorRef} className="rounded-2xl border border-border-silver bg-white shadow-sm overflow-hidden scroll-mt-6">
            <div className="px-6 py-5 border-b border-border-silver flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <Building2 size={18} />
                <h2 className="text-[18px] font-black">{selectedDepartment?.name || '部门详情'}</h2>
              </div>
              {selectedDepartment && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => addDepartment(selectedDepartment.id)}
                    className="h-9 px-4 rounded-full bg-lightest-gray-background text-[12px] font-bold flex items-center gap-2"
                  >
                    <Plus size={14} /> 添加子部门
                  </button>
                  <button
                    type="button"
                    onClick={() => removeDepartment(selectedDepartment)}
                    className="h-9 px-4 rounded-full bg-[#ffebee] text-[#c62828] text-[12px] font-bold flex items-center gap-2"
                  >
                    <Trash2 size={14} /> 删除部门
                  </button>
                </div>
              )}
            </div>

            {selectedDepartment ? (
              <div className="p-6 grid gap-4 lg:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-[12px] font-black text-light-gray uppercase tracking-wider">部门名称</span>
                  <input
                    className="input-field"
                    value={selectedDepartment.name}
                    onChange={(event) => updateDepartment(selectedDepartment.id, { name: event.target.value })}
                    placeholder="部门名称"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-[12px] font-black text-light-gray uppercase tracking-wider">上级部门</span>
                  <select
                    className="input-field"
                    value={selectedDepartment.parentId || ''}
                    onChange={(event) => updateDepartment(selectedDepartment.id, { parentId: event.target.value || undefined })}
                  >
                    <option value="">无上级部门</option>
                    {directory.departments.filter((department) => department.id !== selectedDepartment.id).map((department) => (
                      <option key={department.id} value={department.id}>{department.name}</option>
                    ))}
                  </select>
                </label>
                <DepartmentManagerPicker
                  department={selectedDepartment}
                  directory={directory}
                  onChange={(managerMemberIds) => updateDepartment(selectedDepartment.id, { managerMemberIds })}
                />
              </div>
            ) : (
              <div className="px-8 py-16 text-center text-[14px] font-bold text-medium-gray">
                请先添加一个部门。
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-border-silver bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-border-silver flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <Users size={18} />
                <h2 className="text-[18px] font-black">当前部门成员</h2>
              </div>
              <button
                type="button"
                onClick={() => addMember()}
                disabled={!selectedDepartmentId}
                className="h-9 px-4 rounded-full bg-lightest-gray-background text-[12px] font-bold flex items-center gap-2 disabled:opacity-40"
              >
                <Plus size={14} /> 新增成员
              </button>
            </div>

            <div className="divide-y divide-border-silver">
              {selectedDepartmentMembers.length === 0 ? (
                <div className="px-8 py-12 text-center text-[14px] font-bold text-medium-gray">
                  当前部门暂无成员。
                </div>
              ) : (
                selectedDepartmentMembers.map((member) => {
                  const supervisorCandidates = getSupervisorCandidates(directory, member);

                  return (
                  <article key={member.id} className="p-5 space-y-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-2xl bg-lightest-gray-background flex items-center justify-center shrink-0">
                          <UserRound size={17} strokeWidth={2.4} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-[15px] font-black text-midnight-graphite truncate">{member.name}</p>
                            {selectedDepartmentManagerIds.includes(member.id) && (
                              <span className="shrink-0 rounded-full bg-[#e8f5e9] px-2 py-0.5 text-[10px] font-black text-[#2e7d32]">
                                部门主管
                              </span>
                            )}
                            {member.isAdmin && (
                              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#e8f1ff] px-2 py-0.5 text-[10px] font-black text-interactive-blue">
                                <ShieldCheck size={11} strokeWidth={2.8} /> 管理员
                              </span>
                            )}
                          </div>
                          <p className="text-[12px] font-bold text-medium-gray truncate">
                            {member.accountUsername ? `账号：${member.accountUsername}` : '未绑定登录账号'}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeMember(member)}
                        className="h-9 px-4 rounded-full bg-[#ffebee] text-[#c62828] text-[12px] font-bold flex items-center justify-center gap-2"
                      >
                        <Trash2 size={14} /> 删除成员
                      </button>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-4">
                      <input
                        className="input-field"
                        value={member.name}
                        onChange={(event) => updateMember(member.id, { name: event.target.value })}
                        placeholder="姓名"
                      />
                      <input
                        className="input-field"
                        value={member.title}
                        onChange={(event) => updateMember(member.id, { title: event.target.value })}
                        placeholder="岗位/职务"
                      />
                      <select
                        className="input-field"
                        value={member.accountUsername || ''}
                        onChange={(event) => updateMember(member.id, { accountUsername: event.target.value || undefined })}
                      >
                        <option value="">未绑定登录账号</option>
                        {accountOptions.map((account) => (
                          <option key={account.username} value={account.username}>{account.name}（{account.username}）</option>
                        ))}
                      </select>
                      <select
                        className="input-field"
                        value={member.departmentId}
                        onChange={(event) => updateMember(member.id, { departmentId: event.target.value, supervisorId: undefined })}
                      >
                        <option value="">未选择部门</option>
                        {directory.departments.map((department) => (
                          <option key={department.id} value={department.id}>{department.name}</option>
                        ))}
                      </select>
                      <select
                        className="input-field lg:col-span-2"
                        value={member.supervisorId || ''}
                        onChange={(event) => updateMember(member.id, { supervisorId: event.target.value || undefined })}
                      >
                        <option value="">无直属上级</option>
                        {supervisorCandidates.length === 0 && (
                          <option value="" disabled>暂无可选上级</option>
                        )}
                        {supervisorCandidates.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name} / {getDepartmentName(directory, item.departmentId)}
                          </option>
                        ))}
                      </select>
                      <label className="input-field flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={member.enabled !== false}
                          onChange={(event) => updateMember(member.id, { enabled: event.target.checked })}
                          className="accent-black"
                        />
                        启用成员
                      </label>
                      <label className="input-field flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={Boolean(member.isAdmin)}
                          onChange={(event) => updateMember(member.id, { isAdmin: event.target.checked })}
                          className="accent-black"
                        />
                        管理员
                      </label>
                      <label className="input-field flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedDepartmentManagerIds.includes(member.id)}
                          onChange={(event) => updateSelectedDepartmentManager(member.id, event.target.checked)}
                          className="accent-black"
                        />
                        部门主管
                      </label>
                    </div>

                  </article>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </section>

    </div>
  );
}
