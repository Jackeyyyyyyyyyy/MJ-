import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Plus, Save, Users } from 'lucide-react';
import { storage } from '../storage';
import { OrganizationDepartment, OrganizationDirectory, OrganizationMember, OrganizationRoleGroup, SystemAccount } from '../types';

const emptyDirectory: OrganizationDirectory = {
  departments: [],
  members: [],
  roleGroups: [],
};

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

export default function OrganizationAdmin() {
  const [directory, setDirectory] = useState<OrganizationDirectory>(emptyDirectory);
  const [accounts, setAccounts] = useState<SystemAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  const accountOptions = useMemo(
    () => accounts.filter((account) => account.role !== 'developer' && account.enabled),
    [accounts],
  );

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [nextDirectory, nextAccounts] = await Promise.all([
        storage.getOrganizationDirectory(),
        storage.getAccounts(),
      ]);
      setDirectory(nextDirectory);
      setAccounts(nextAccounts);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const updateDepartment = (id: string, patch: Partial<OrganizationDepartment>) => {
    setDirectory((current) => ({
      ...current,
      departments: current.departments.map((department) => (
        department.id === id ? { ...department, ...patch } : department
      )),
    }));
  };

  const updateMember = (id: string, patch: Partial<OrganizationMember>) => {
    setDirectory((current) => ({
      ...current,
      members: current.members.map((member) => (
        member.id === id ? { ...member, ...patch } : member
      )),
    }));
  };

  const updateRoleGroup = (id: string, patch: Partial<OrganizationRoleGroup>) => {
    setDirectory((current) => ({
      ...current,
      roleGroups: current.roleGroups.map((roleGroup) => (
        roleGroup.id === id ? { ...roleGroup, ...patch } : roleGroup
      )),
    }));
  };

  const addDepartment = () => {
    setDirectory((current) => ({
      ...current,
      departments: [
        ...current.departments,
        { id: createId('dept'), name: '新部门', leaderIds: [] },
      ],
    }));
  };

  const addMember = () => {
    setDirectory((current) => ({
      ...current,
      members: [
        ...current.members,
        {
          id: createId('member'),
          name: '新成员',
          departmentId: current.departments[0]?.id || '',
          title: '成员',
          roleGroupIds: [],
          enabled: true,
        },
      ],
    }));
  };

  const addRoleGroup = () => {
    setDirectory((current) => ({
      ...current,
      roleGroups: [
        ...current.roleGroups,
        { id: createId('role'), name: '新角色组', memberIds: [] },
      ],
    }));
  };

  const toggleRoleForMember = (member: OrganizationMember, roleGroupId: string) => {
    const nextRoleIds = member.roleGroupIds.includes(roleGroupId)
      ? member.roleGroupIds.filter((id) => id !== roleGroupId)
      : [...member.roleGroupIds, roleGroupId];

    updateMember(member.id, { roleGroupIds: nextRoleIds });
    setDirectory((current) => ({
      ...current,
      roleGroups: current.roleGroups.map((roleGroup) => {
        if (roleGroup.id !== roleGroupId) return roleGroup;
        const nextMemberIds = nextRoleIds.includes(roleGroupId)
          ? [...new Set([...roleGroup.memberIds, member.id])]
          : roleGroup.memberIds.filter((id) => id !== member.id);
        return { ...roleGroup, memberIds: nextMemberIds };
      }),
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

  if (isLoading) {
    return <div className="text-[15px] font-bold text-medium-gray">正在加载组织架构...</div>;
  }

  return (
    <div className="space-y-8 pb-32 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[11px] font-black text-light-gray uppercase tracking-[0.2em]">System Admin</p>
          <h1 className="text-2xl font-black text-midnight-graphite tracking-tight">组织架构</h1>
          <p className="mt-2 text-[14px] font-medium text-medium-gray">维护部门、成员、账号绑定和审批角色组。</p>
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

      <section className="rounded-2xl border border-border-silver bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-border-silver flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building2 size={18} />
            <h2 className="text-[18px] font-black">部门</h2>
          </div>
          <button onClick={addDepartment} className="h-9 px-4 rounded-full bg-lightest-gray-background text-[12px] font-bold flex items-center gap-2">
            <Plus size={14} />新增部门
          </button>
        </div>
        <div className="divide-y divide-border-silver">
          {directory.departments.map((department) => (
            <div key={department.id} className="grid gap-4 p-5 lg:grid-cols-[1fr_1fr]">
              <input
                className="input-field"
                value={department.name}
                onChange={(event) => updateDepartment(department.id, { name: event.target.value })}
                placeholder="部门名称"
              />
              <select
                className="input-field"
                value={department.parentId || ''}
                onChange={(event) => updateDepartment(department.id, { parentId: event.target.value || undefined })}
              >
                <option value="">无上级部门</option>
                {directory.departments.filter((item) => item.id !== department.id).map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border-silver bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-border-silver flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users size={18} />
            <h2 className="text-[18px] font-black">成员与账号绑定</h2>
          </div>
          <button onClick={addMember} className="h-9 px-4 rounded-full bg-lightest-gray-background text-[12px] font-bold flex items-center gap-2">
            <Plus size={14} />新增成员
          </button>
        </div>
        <div className="divide-y divide-border-silver">
          {directory.members.map((member) => (
            <div key={member.id} className="grid gap-4 p-5 lg:grid-cols-[1fr_1fr_1fr_1fr]">
              <input
                className="input-field"
                value={member.name}
                onChange={(event) => updateMember(member.id, { name: event.target.value })}
                placeholder="姓名"
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
                onChange={(event) => updateMember(member.id, { departmentId: event.target.value })}
              >
                <option value="">未选择部门</option>
                {directory.departments.map((department) => (
                  <option key={department.id} value={department.id}>{department.name}</option>
                ))}
              </select>
              <select
                className="input-field"
                value={member.supervisorId || ''}
                onChange={(event) => updateMember(member.id, { supervisorId: event.target.value || undefined })}
              >
                <option value="">无直属上级</option>
                {directory.members.filter((item) => item.id !== member.id).map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
              <input
                className="input-field lg:col-span-2"
                value={member.title}
                onChange={(event) => updateMember(member.id, { title: event.target.value })}
                placeholder="职位"
              />
              <div className="lg:col-span-2 flex flex-wrap gap-2">
                {directory.roleGroups.map((roleGroup) => (
                  <label key={roleGroup.id} className="px-3 py-2 rounded-full bg-lightest-gray-background text-[12px] font-bold flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={member.roleGroupIds.includes(roleGroup.id)}
                      onChange={() => toggleRoleForMember(member, roleGroup.id)}
                    />
                    {roleGroup.name}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border-silver bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-border-silver flex items-center justify-between">
          <h2 className="text-[18px] font-black">角色组</h2>
          <button onClick={addRoleGroup} className="h-9 px-4 rounded-full bg-lightest-gray-background text-[12px] font-bold flex items-center gap-2">
            <Plus size={14} />新增角色组
          </button>
        </div>
        <div className="divide-y divide-border-silver">
          {directory.roleGroups.map((roleGroup) => (
            <div key={roleGroup.id} className="grid gap-4 p-5 lg:grid-cols-[1fr_2fr]">
              <input
                className="input-field"
                value={roleGroup.name}
                onChange={(event) => updateRoleGroup(roleGroup.id, { name: event.target.value })}
                placeholder="角色组名称"
              />
              <p className="text-[13px] font-bold text-medium-gray self-center">
                {directory.members.filter((member) => member.roleGroupIds.includes(roleGroup.id)).map((member) => member.name).join('、') || '暂无成员'}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
