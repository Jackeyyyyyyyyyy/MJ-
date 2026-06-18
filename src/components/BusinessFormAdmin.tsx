import React from 'react';
import { AlignLeft, Asterisk, Building2, Calendar, DollarSign, Edit3, Eye, EyeOff, ListChecks, Loader2, Lock, Paperclip, Plus, RotateCcw, Save, Search, Trash2, UserRound, X } from 'lucide-react';
import { approvalSchema, replaceApprovalSchema } from '../approvalSchema';
import { storage } from '../storage';
import { ApprovalType, Module } from '../types';
import { cn } from '../lib/utils';

interface EditingTarget {
  moduleName: string;
  approvalTypeName: string;
}

const protectedBusinessForms = new Set([
  '资金|||批量修改',
  '资金|||资金减免',
  '客户|||客户信息',
  '供应商|||供应商信息',
  '供应商|||报价',
  '订单|||项目货变更',
]);

function getBusinessFormKey(moduleName: string, approvalTypeName: string) {
  return `${moduleName}|||${approvalTypeName}`;
}

function isProtectedBusinessForm(moduleName: string, approvalTypeName: string) {
  return protectedBusinessForms.has(getBusinessFormKey(moduleName, approvalTypeName));
}

function getInitialVisibilityMap() {
  const entries = approvalSchema.modules.flatMap((module) => (
    module.approvalTypes.map((type) => [
      getBusinessFormKey(module.name, type.name),
      type.visibleToUsers !== false,
    ] as const)
  ));

  return Object.fromEntries(entries);
}

function normalizeFields(value: string) {
  return value
    .split(/\r?\n|,|，/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getFieldText(type: ApprovalType) {
  return type.businessFields.join('\n');
}

function getInitialAmountFields(type: ApprovalType) {
  const configuredFields = Array.isArray(type.amountFields) ? type.amountFields : [];
  const sourceFields = configuredFields.length > 0
    ? configuredFields
    : type.businessFields.filter(isAmountCurrencyField);
  const businessFieldSet = new Set(type.businessFields);
  return sourceFields.filter((field) => businessFieldSet.has(field));
}

function getInitialFileFields(type: ApprovalType) {
  const configuredFields = Array.isArray(type.fileFields) ? type.fileFields : [];
  const businessFieldSet = new Set(type.businessFields);
  return configuredFields.filter((field) => businessFieldSet.has(field));
}

function getInitialDateFields(type: ApprovalType) {
  const configuredFields = Array.isArray(type.dateFields) ? type.dateFields : [];
  const sourceFields = Array.isArray(type.dateFields)
    ? configuredFields
    : type.businessFields.filter(isDateField);
  const businessFieldSet = new Set(type.businessFields);
  return sourceFields.filter((field) => businessFieldSet.has(field));
}

function getInitialOptionalFields(type: ApprovalType) {
  const configuredFields = Array.isArray(type.optionalFields) ? type.optionalFields : [];
  const businessFieldSet = new Set(type.businessFields);
  return configuredFields.filter((field) => businessFieldSet.has(field));
}

function getInitialMultilineFields(type: ApprovalType) {
  const configuredFields = Array.isArray(type.multilineFields) ? type.multilineFields : [];
  const businessFieldSet = new Set(type.businessFields);
  return configuredFields.filter((field) => businessFieldSet.has(field));
}

function getInitialMemberFields(type: ApprovalType) {
  const configuredFields = Array.isArray(type.memberFields) ? type.memberFields : [];
  const businessFieldSet = new Set(type.businessFields);
  return configuredFields.filter((field) => businessFieldSet.has(field));
}

function getInitialDepartmentFields(type: ApprovalType) {
  const configuredFields = Array.isArray(type.departmentFields) ? type.departmentFields : [];
  const businessFieldSet = new Set(type.businessFields);
  return configuredFields.filter((field) => businessFieldSet.has(field));
}

function getInitialSelectFieldOptions(type: ApprovalType) {
  const businessFieldSet = new Set(type.businessFields);
  return (Array.isArray(type.selectFields) ? type.selectFields : []).reduce<Record<string, string>>((optionsByField, item) => {
    const field = String(item?.field || '').trim();
    if (!field || !businessFieldSet.has(field)) return optionsByField;

    const options = (Array.isArray(item.options) ? item.options : [])
      .map((option) => String(option || '').trim())
      .filter(Boolean);
    if (options.length > 0) {
      optionsByField[field] = options.join('\n');
    }
    return optionsByField;
  }, {});
}

function isAmountCurrencyField(field: string) {
  return /金额|价格|利润|总额/.test(field);
}

function isDateField(field: string) {
  return field.includes('日期') || field.includes('时间');
}

function isCurrencyOnlyField(field: string) {
  return /^(币种|币别|货币|收款币种|付款币种)$/.test(field.trim());
}

function getFieldKindLabel(field: string) {
  if (isAmountCurrencyField(field)) return '金额+币种';
  if (isCurrencyOnlyField(field)) return '币种';
  return '';
}

export default function BusinessFormAdmin() {
  const [moduleName, setModuleName] = React.useState('');
  const [approvalTypeName, setApprovalTypeName] = React.useState('');
  const [fieldText, setFieldText] = React.useState('');
  const [amountFields, setAmountFields] = React.useState<string[]>([]);
  const [fileFields, setFileFields] = React.useState<string[]>([]);
  const [dateFields, setDateFields] = React.useState<string[]>([]);
  const [optionalFields, setOptionalFields] = React.useState<string[]>([]);
  const [multilineFields, setMultilineFields] = React.useState<string[]>([]);
  const [memberFields, setMemberFields] = React.useState<string[]>([]);
  const [departmentFields, setDepartmentFields] = React.useState<string[]>([]);
  const [selectFieldOptions, setSelectFieldOptions] = React.useState<Record<string, string>>({});
  const [editingTarget, setEditingTarget] = React.useState<EditingTarget | null>(null);
  const [visibilityMap, setVisibilityMap] = React.useState<Record<string, boolean>>(() => getInitialVisibilityMap());
  const [visibilityQuery, setVisibilityQuery] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);
  const [isVisibilitySaving, setIsVisibilitySaving] = React.useState(false);

  const businessFields = React.useMemo(() => normalizeFields(fieldText), [fieldText]);
  const selectedAmountFields = React.useMemo(
    () => amountFields.filter((field) => businessFields.includes(field)),
    [amountFields, businessFields],
  );
  const selectedFileFields = React.useMemo(
    () => fileFields.filter((field) => businessFields.includes(field)),
    [fileFields, businessFields],
  );
  const selectedDateFields = React.useMemo(
    () => dateFields.filter((field) => businessFields.includes(field)),
    [dateFields, businessFields],
  );
  const selectedOptionalFields = React.useMemo(
    () => optionalFields.filter((field) => businessFields.includes(field)),
    [optionalFields, businessFields],
  );
  const selectedMultilineFields = React.useMemo(
    () => multilineFields.filter((field) => businessFields.includes(field)),
    [multilineFields, businessFields],
  );
  const selectedMemberFields = React.useMemo(
    () => memberFields.filter((field) => businessFields.includes(field)),
    [memberFields, businessFields],
  );
  const selectedDepartmentFields = React.useMemo(
    () => departmentFields.filter((field) => businessFields.includes(field)),
    [departmentFields, businessFields],
  );
  const selectedSelectFields = React.useMemo(
    () => businessFields
      .map((field) => ({
        field,
        options: normalizeFields(selectFieldOptions[field] || ''),
      }))
      .filter((item) => item.options.length > 0),
    [businessFields, selectFieldOptions],
  );
  const hasAmountCurrencyField = selectedAmountFields.length > 0;
  const hasCurrencyOnlyField = businessFields.some(isCurrencyOnlyField);
  const moduleOptions = approvalSchema.modules.map((module) => module.name);
  const isEditing = Boolean(editingTarget);
  const allForms = React.useMemo(() => approvalSchema.modules.flatMap((module) => (
    module.approvalTypes.map((type) => ({
      key: getBusinessFormKey(module.name, type.name),
      moduleName: module.name,
      approvalTypeName: type.name,
    }))
  )), []);
  const visibleCount = allForms.filter((form) => visibilityMap[form.key] !== false).length;
  const hiddenCount = allForms.length - visibleCount;
  const visibilityKeyword = visibilityQuery.trim().toLowerCase();
  const filteredModules = approvalSchema.modules
    .map((module) => ({
      ...module,
      approvalTypes: module.approvalTypes.filter((type) => {
        if (!visibilityKeyword) return true;
        return `${module.name} ${type.name}`.toLowerCase().includes(visibilityKeyword);
      }),
    }))
    .filter((module) => module.approvalTypes.length > 0);

  const updateBusinessFields = (fields: string[]) => {
    setFieldText([...new Set(fields.map((field) => field.trim()).filter(Boolean))].join('\n'));
  };

  const toggleAmountField = (field: string) => {
    setAmountFields((current) => (
      current.includes(field)
        ? current.filter((item) => item !== field)
        : [...current, field]
    ));
    setFileFields((current) => current.filter((item) => item !== field));
    setDateFields((current) => current.filter((item) => item !== field));
    setMultilineFields((current) => current.filter((item) => item !== field));
    setMemberFields((current) => current.filter((item) => item !== field));
    setDepartmentFields((current) => current.filter((item) => item !== field));
    setSelectFieldOptions((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const toggleFileField = (field: string) => {
    setFileFields((current) => (
      current.includes(field)
        ? current.filter((item) => item !== field)
        : [...current, field]
    ));
    setAmountFields((current) => current.filter((item) => item !== field));
    setDateFields((current) => current.filter((item) => item !== field));
    setMultilineFields((current) => current.filter((item) => item !== field));
    setMemberFields((current) => current.filter((item) => item !== field));
    setDepartmentFields((current) => current.filter((item) => item !== field));
    setSelectFieldOptions((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const toggleDateField = (field: string) => {
    setDateFields((current) => (
      current.includes(field)
        ? current.filter((item) => item !== field)
        : [...current, field]
    ));
    setAmountFields((current) => current.filter((item) => item !== field));
    setFileFields((current) => current.filter((item) => item !== field));
    setMultilineFields((current) => current.filter((item) => item !== field));
    setMemberFields((current) => current.filter((item) => item !== field));
    setDepartmentFields((current) => current.filter((item) => item !== field));
    setSelectFieldOptions((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const toggleOptionalField = (field: string) => {
    setOptionalFields((current) => (
      current.includes(field)
        ? current.filter((item) => item !== field)
        : [...current, field]
    ));
  };

  const setAllVisible = (visible: boolean) => {
    setVisibilityMap(Object.fromEntries(allForms.map((form) => [form.key, visible])));
  };

  const toggleFormVisibility = (moduleName: string, approvalTypeName: string) => {
    const key = getBusinessFormKey(moduleName, approvalTypeName);
    setVisibilityMap((current) => ({
      ...current,
      [key]: current[key] === false,
    }));
  };

  const toggleMultilineField = (field: string) => {
    setMultilineFields((current) => (
      current.includes(field)
        ? current.filter((item) => item !== field)
        : [...current, field]
    ));
    setAmountFields((current) => current.filter((item) => item !== field));
    setFileFields((current) => current.filter((item) => item !== field));
    setDateFields((current) => current.filter((item) => item !== field));
    setMemberFields((current) => current.filter((item) => item !== field));
    setDepartmentFields((current) => current.filter((item) => item !== field));
    setSelectFieldOptions((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const toggleMemberField = (field: string) => {
    setMemberFields((current) => (
      current.includes(field)
        ? current.filter((item) => item !== field)
        : [...current, field]
    ));
    setAmountFields((current) => current.filter((item) => item !== field));
    setFileFields((current) => current.filter((item) => item !== field));
    setDateFields((current) => current.filter((item) => item !== field));
    setMultilineFields((current) => current.filter((item) => item !== field));
    setDepartmentFields((current) => current.filter((item) => item !== field));
    setSelectFieldOptions((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const toggleDepartmentField = (field: string) => {
    setDepartmentFields((current) => (
      current.includes(field)
        ? current.filter((item) => item !== field)
        : [...current, field]
    ));
    setAmountFields((current) => current.filter((item) => item !== field));
    setFileFields((current) => current.filter((item) => item !== field));
    setDateFields((current) => current.filter((item) => item !== field));
    setMultilineFields((current) => current.filter((item) => item !== field));
    setMemberFields((current) => current.filter((item) => item !== field));
    setSelectFieldOptions((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const updateSelectFieldOptions = (field: string, value: string) => {
    setSelectFieldOptions((current) => ({
      ...current,
      [field]: value,
    }));
    if (value.trim()) {
      setAmountFields((current) => current.filter((item) => item !== field));
      setFileFields((current) => current.filter((item) => item !== field));
      setDateFields((current) => current.filter((item) => item !== field));
      setMultilineFields((current) => current.filter((item) => item !== field));
      setMemberFields((current) => current.filter((item) => item !== field));
      setDepartmentFields((current) => current.filter((item) => item !== field));
    }
  };

  const resetForm = () => {
    setModuleName('');
    setApprovalTypeName('');
    setFieldText('');
    setAmountFields([]);
    setFileFields([]);
    setDateFields([]);
    setOptionalFields([]);
    setMultilineFields([]);
    setMemberFields([]);
    setDepartmentFields([]);
    setSelectFieldOptions({});
    setEditingTarget(null);
    setError('');
  };

  const startEditing = (module: Module, type: ApprovalType) => {
    if (isProtectedBusinessForm(module.name, type.name)) {
      setError('该表单使用系统特殊配置，默认不可编辑。');
      return;
    }

    setModuleName(module.name);
    setApprovalTypeName(type.name);
    setFieldText(getFieldText(type));
    setAmountFields(getInitialAmountFields(type));
    setFileFields(getInitialFileFields(type));
    setDateFields(getInitialDateFields(type));
    setOptionalFields(getInitialOptionalFields(type));
    setMultilineFields(getInitialMultilineFields(type));
    setMemberFields(getInitialMemberFields(type));
    setDepartmentFields(getInitialDepartmentFields(type));
    setSelectFieldOptions(getInitialSelectFieldOptions(type));
    setEditingTarget({
      moduleName: module.name,
      approvalTypeName: type.name,
    });
    setMessage('');
    setError('');
  };

  const handleDelete = async (module: Module, type: ApprovalType) => {
    if (isProtectedBusinessForm(module.name, type.name)) {
      setError('该表单使用系统特殊配置，默认不可删除。');
      return;
    }

    const confirmed = window.confirm(`确定删除业务表单「${module.name} / ${type.name}」吗？`);
    if (!confirmed) return;

    setMessage('');
    setError('');
    setIsSaving(true);

    try {
      const nextSchema = await storage.deleteBusinessForm(module.name, type.name);
      replaceApprovalSchema(nextSchema);

      if (editingTarget?.moduleName === module.name && editingTarget.approvalTypeName === type.name) {
        resetForm();
      }

      setMessage('业务表单已删除，左侧业务模块和发起申请入口已同步刷新。');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '删除失败，请稍后再试。');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');
    setError('');

    const nextModuleName = moduleName.trim();
    const nextApprovalTypeName = approvalTypeName.trim();

    if (!nextModuleName || !nextApprovalTypeName || businessFields.length === 0) {
      setError('请填写模块名称、表单名称和至少 1 个业务字段。');
      return;
    }

    setIsSaving(true);
    try {
      const nextSchema = editingTarget
        ? await storage.updateBusinessForm(editingTarget.moduleName, editingTarget.approvalTypeName, {
            moduleName: nextModuleName,
            approvalTypeName: nextApprovalTypeName,
            businessFields,
            amountFields: selectedAmountFields,
            fileFields: selectedFileFields,
            dateFields: selectedDateFields,
            optionalFields: selectedOptionalFields,
            multilineFields: selectedMultilineFields,
            memberFields: selectedMemberFields,
            departmentFields: selectedDepartmentFields,
            selectFields: selectedSelectFields,
          })
        : await storage.createBusinessForm({
            moduleName: nextModuleName,
            approvalTypeName: nextApprovalTypeName,
            businessFields,
            amountFields: selectedAmountFields,
            fileFields: selectedFileFields,
            dateFields: selectedDateFields,
            optionalFields: selectedOptionalFields,
            multilineFields: selectedMultilineFields,
            memberFields: selectedMemberFields,
            departmentFields: selectedDepartmentFields,
            selectFields: selectedSelectFields,
          });

      replaceApprovalSchema(nextSchema);
      resetForm();
      setMessage(isEditing
        ? '业务表单已更新，左侧业务模块和发起申请入口已同步刷新。'
        : '业务表单已创建，左侧业务模块和发起申请入口已同步更新。');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '保存失败，请稍后再试。');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveVisibility = async () => {
    setMessage('');
    setError('');
    setIsVisibilitySaving(true);

    try {
      const nextSchema = await storage.updateBusinessFormVisibility(
        allForms.map((form) => ({
          moduleName: form.moduleName,
          approvalTypeName: form.approvalTypeName,
          visibleToUsers: visibilityMap[form.key] !== false,
        })),
      );
      replaceApprovalSchema(nextSchema);
      setVisibilityMap(getInitialVisibilityMap());
      setMessage('表单显示范围已保存，员工端入口和左侧业务模块已同步刷新。');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '保存显示范围失败，请稍后再试。');
    } finally {
      setIsVisibilitySaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-light-gray">System Admin</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-midnight-graphite">
          {isEditing ? '编辑业务表单' : '新建业务表单'}
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
        <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-border-silver bg-white p-6 shadow-sm">
          {isEditing && (
            <div className="flex items-center justify-between gap-3 rounded-xl bg-lightest-gray-background px-4 py-3">
              <div className="min-w-0">
                <div className="text-[12px] font-black text-midnight-graphite">正在编辑</div>
                <div className="truncate text-[12px] font-semibold text-medium-gray">
                  {editingTarget?.moduleName} / {editingTarget?.approvalTypeName}
                </div>
              </div>
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex h-9 items-center gap-2 rounded-full bg-white px-3 text-[12px] font-black text-midnight-graphite shadow-sm transition-colors hover:text-interactive-blue"
              >
                <RotateCcw size={14} strokeWidth={2.6} />
                取消编辑
              </button>
            </div>
          )}

          <label className="block space-y-2">
            <span className="text-[12px] font-black uppercase tracking-wider text-light-gray">所属业务模块</span>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
              <select
                value={moduleOptions.includes(moduleName) ? moduleName : ''}
                onChange={(event) => setModuleName(event.target.value)}
                className="input-field text-[14px]"
              >
                <option value="">新建模块</option>
                {moduleOptions.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
              <input
                value={moduleName}
                onChange={(event) => setModuleName(event.target.value)}
                placeholder="例如：合同、行政、项目"
                className="input-field text-[14px]"
              />
            </div>
          </label>

          <label className="block space-y-2">
            <span className="text-[12px] font-black uppercase tracking-wider text-light-gray">表单名称</span>
            <input
              value={approvalTypeName}
              onChange={(event) => setApprovalTypeName(event.target.value)}
              placeholder="例如：合同用印申请"
              className="input-field text-[14px]"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-[12px] font-black uppercase tracking-wider text-light-gray">业务字段</span>
            <textarea
              value={fieldText}
              onChange={(event) => setFieldText(event.target.value)}
              placeholder={'每行一个字段，例如：\n合同编号\n客户名称\n申请金额\n附件'}
              className="input-field min-h-[220px] resize-y py-3 text-[14px] leading-7"
            />
          </label>

          <div className="rounded-2xl border border-[#ffd8dc] bg-[#fff8f8] p-4">
            <div className="space-y-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[13px] font-black text-midnight-graphite">
                  <Asterisk size={15} strokeWidth={2.8} />
                  非必填字段
                </div>
                <p className="mt-1 text-[12px] font-semibold text-medium-gray">
                  默认所有业务字段都是必填。勾选后，该字段在用户发起申请时可以留空；未勾选字段会显示红色星号。
                </p>
              </div>
              {businessFields.length > 0 ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {businessFields.map((field) => {
                    const checked = selectedOptionalFields.includes(field);

                    return (
                      <label
                        key={field}
                        className={cn(
                          'flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border bg-white px-3 py-2 text-[12px] font-black transition-colors',
                          checked
                            ? 'border-rose-400 text-rose-700 shadow-sm'
                            : 'border-border-silver text-midnight-graphite hover:border-rose-200',
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleOptionalField(field)}
                          className="h-4 w-4 accent-rose-500"
                        />
                        <span className="min-w-0 truncate">{field}</span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl bg-white px-3 py-2 text-[12px] font-bold text-light-gray">
                  先填写业务字段，再选择哪些字段允许留空。
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-[#e0e7ff] bg-[#f8faff] p-4">
            <div className="space-y-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[13px] font-black text-midnight-graphite">
                  <ListChecks size={15} strokeWidth={2.8} />
                  选项字段
                </div>
                <p className="mt-1 text-[12px] font-semibold text-medium-gray">
                  给字段填写选项后，用户发起申请时会显示下拉选择。一行一个选项，适合类型、是否、用途、地区等字段。
                </p>
              </div>
              {businessFields.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {businessFields.map((field) => {
                    const optionText = selectFieldOptions[field] || '';
                    const active = normalizeFields(optionText).length > 0;

                    return (
                      <label
                        key={field}
                        className={cn(
                          'block rounded-xl border bg-white p-3 transition-colors',
                          active ? 'border-indigo-400 shadow-sm' : 'border-border-silver',
                        )}
                      >
                        <span className={cn(
                          'block truncate text-[12px] font-black',
                          active ? 'text-indigo-700' : 'text-midnight-graphite',
                        )}>
                          {field}
                        </span>
                        <textarea
                          value={optionText}
                          onChange={(event) => updateSelectFieldOptions(field, event.target.value)}
                          placeholder={'选项一\n选项二'}
                          className="mt-2 min-h-[86px] w-full resize-y rounded-lg border border-border-silver bg-canvas-white px-3 py-2 text-[12px] font-semibold text-midnight-graphite outline-none transition-colors focus:border-indigo-400"
                        />
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl bg-white px-3 py-2 text-[12px] font-bold text-light-gray">
                  先填写业务字段，再为字段配置下拉选项。
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-[#e6e0d4] bg-[#fffdf8] p-4">
            <div className="space-y-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[13px] font-black text-midnight-graphite">
                  <AlignLeft size={15} strokeWidth={2.8} />
                  多行文本字段
                </div>
                <p className="mt-1 text-[12px] font-semibold text-medium-gray">
                  适合原因说明、备注、详细描述这类内容较长的字段。
                </p>
              </div>
              {businessFields.length > 0 ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {businessFields.map((field) => {
                    const checked = selectedMultilineFields.includes(field);

                    return (
                      <label
                        key={field}
                        className={cn(
                          'flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border bg-white px-3 py-2 text-[12px] font-black transition-colors',
                          checked
                            ? 'border-amber-500 text-amber-700 shadow-sm'
                            : 'border-border-silver text-midnight-graphite hover:border-amber-200',
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleMultilineField(field)}
                          className="h-4 w-4 accent-amber-600"
                        />
                        <span className="min-w-0 truncate">{field}</span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl bg-white px-3 py-2 text-[12px] font-bold text-light-gray">
                  先填写业务字段，再选择哪些字段是多行文本。
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-[#d8e8ff] bg-[#f7fbff] p-4">
            <div className="space-y-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[13px] font-black text-midnight-graphite">
                  <UserRound size={15} strokeWidth={2.8} />
                  人员字段
                </div>
                <p className="mt-1 text-[12px] font-semibold text-medium-gray">
                  适合申请人选择同事、对接人、负责人、交接人等字段。
                </p>
              </div>
              {businessFields.length > 0 ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {businessFields.map((field) => {
                    const checked = selectedMemberFields.includes(field);

                    return (
                      <label
                        key={field}
                        className={cn(
                          'flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border bg-white px-3 py-2 text-[12px] font-black transition-colors',
                          checked
                            ? 'border-sky-500 text-sky-700 shadow-sm'
                            : 'border-border-silver text-midnight-graphite hover:border-sky-200',
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleMemberField(field)}
                          className="h-4 w-4 accent-sky-600"
                        />
                        <span className="min-w-0 truncate">{field}</span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl bg-white px-3 py-2 text-[12px] font-bold text-light-gray">
                  先填写业务字段，再选择哪些字段是人员字段。
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-[#dbe8ce] bg-[#fbfff7] p-4">
            <div className="space-y-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[13px] font-black text-midnight-graphite">
                  <Building2 size={15} strokeWidth={2.8} />
                  部门字段
                </div>
                <p className="mt-1 text-[12px] font-semibold text-medium-gray">
                  适合费用归属部门、申请部门、调入/调出部门等字段。
                </p>
              </div>
              {businessFields.length > 0 ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {businessFields.map((field) => {
                    const checked = selectedDepartmentFields.includes(field);

                    return (
                      <label
                        key={field}
                        className={cn(
                          'flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border bg-white px-3 py-2 text-[12px] font-black transition-colors',
                          checked
                            ? 'border-lime-500 text-lime-700 shadow-sm'
                            : 'border-border-silver text-midnight-graphite hover:border-lime-200',
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleDepartmentField(field)}
                          className="h-4 w-4 accent-lime-600"
                        />
                        <span className="min-w-0 truncate">{field}</span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl bg-white px-3 py-2 text-[12px] font-bold text-light-gray">
                  先填写业务字段，再选择哪些字段是部门字段。
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-[#d8e8ff] bg-[#f5fbff] p-4">
            <div className="space-y-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[13px] font-black text-midnight-graphite">
                  <DollarSign size={15} strokeWidth={2.8} />
                  金额字段
                </div>
                <p className="mt-1 text-[12px] font-semibold text-medium-gray">
                  从上面的业务字段里选择哪些是金额字段。被选中的字段会在发起申请时使用“币种 + 数字金额”，流程条件分化也会按金额识别。
                </p>
              </div>
              {businessFields.length > 0 ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {businessFields.map((field) => {
                    const checked = selectedAmountFields.includes(field);

                    return (
                      <label
                        key={field}
                        className={cn(
                          'flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border bg-white px-3 py-2 text-[12px] font-black transition-colors',
                          checked
                            ? 'border-interactive-blue text-interactive-blue shadow-sm'
                            : 'border-border-silver text-midnight-graphite hover:border-[#b9d8ff]',
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleAmountField(field)}
                          className="h-4 w-4 accent-interactive-blue"
                        />
                        <span className="min-w-0 truncate">{field}</span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl bg-white px-3 py-2 text-[12px] font-bold text-light-gray">
                  先填写业务字段，再选择哪些字段是金额字段。
                </div>
              )}
            </div>
            {hasCurrencyOnlyField && !hasAmountCurrencyField && (
              <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[12px] font-bold text-amber-700">
                当前只有币种字段，没有金额类字段；普通条件分化需要金额类字段才会开放。
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-[#e5ddff] bg-[#fbf9ff] p-4">
            <div className="space-y-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[13px] font-black text-midnight-graphite">
                  <Calendar size={15} strokeWidth={2.8} />
                  日期/时间字段
                </div>
                <p className="mt-1 text-[12px] font-semibold text-medium-gray">
                  从上面的业务字段里选择哪些是日期或时间字段。被选中的字段会在发起申请时使用日期选择器。
                </p>
              </div>
              {businessFields.length > 0 ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {businessFields.map((field) => {
                    const checked = selectedDateFields.includes(field);

                    return (
                      <label
                        key={field}
                        className={cn(
                          'flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border bg-white px-3 py-2 text-[12px] font-black transition-colors',
                          checked
                            ? 'border-violet-500 text-violet-700 shadow-sm'
                            : 'border-border-silver text-midnight-graphite hover:border-violet-200',
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleDateField(field)}
                          className="h-4 w-4 accent-violet-600"
                        />
                        <span className="min-w-0 truncate">{field}</span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl bg-white px-3 py-2 text-[12px] font-bold text-light-gray">
                  先填写业务字段，再选择哪些字段是日期/时间字段。
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-[#cfeadc] bg-[#f8fdfb] p-4">
            <div className="space-y-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[13px] font-black text-midnight-graphite">
                  <Paperclip size={15} strokeWidth={2.8} />
                  文件字段
                </div>
                <p className="mt-1 text-[12px] font-semibold text-medium-gray">
                  从上面的业务字段里选择哪些需要“填空 + 附件”。被选中的字段会在发起申请时同时要求填写内容和上传附件。
                </p>
              </div>
              {businessFields.length > 0 ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {businessFields.map((field) => {
                    const checked = selectedFileFields.includes(field);

                    return (
                      <label
                        key={field}
                        className={cn(
                          'flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border bg-white px-3 py-2 text-[12px] font-black transition-colors',
                          checked
                            ? 'border-emerald-500 text-emerald-700 shadow-sm'
                            : 'border-border-silver text-midnight-graphite hover:border-emerald-200',
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleFileField(field)}
                          className="h-4 w-4 accent-emerald-600"
                        />
                        <span className="min-w-0 truncate">{field}</span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl bg-white px-3 py-2 text-[12px] font-bold text-light-gray">
                  先填写业务字段，再选择哪些字段需要填空和附件。
                </div>
              )}
            </div>
          </div>

          {businessFields.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {businessFields.map((field) => {
                const isSelectedAmountField = selectedAmountFields.includes(field);
                const isSelectedFileField = selectedFileFields.includes(field);
                const isSelectedDateField = selectedDateFields.includes(field);
                const isSelectedOptionalField = selectedOptionalFields.includes(field);
                const fieldKindLabel = isSelectedAmountField
                  ? '金额+币种'
                  : isSelectedFileField
                    ? '填空+附件'
                    : isSelectedDateField
                    ? '日期/时间'
                    : isCurrencyOnlyField(field)
                    ? getFieldKindLabel(field)
                    : '';

                return (
                  <span
                    key={field}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold",
                      isSelectedAmountField
                        ? "bg-[#e7f1ff] text-interactive-blue"
                        : isSelectedFileField
                          ? "bg-emerald-50 text-emerald-700"
                          : isSelectedDateField
                          ? "bg-violet-50 text-violet-700"
                          : isCurrencyOnlyField(field)
                          ? "bg-amber-50 text-amber-700"
                          : "bg-lightest-gray-background text-midnight-graphite",
                    )}
                  >
                    {field}
                    <span className={cn(
                      'rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-black',
                      isSelectedOptionalField ? 'text-rose-700' : 'text-rose-500',
                    )}>
                      {isSelectedOptionalField ? '非必填' : '必填'}
                    </span>
                    {fieldKindLabel && (
                      <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-black">
                        {fieldKindLabel}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => updateBusinessFields(businessFields.filter((item) => item !== field))}
                      className="text-light-gray hover:text-rose-500"
                      aria-label={`移除 ${field}`}
                    >
                      <X size={12} strokeWidth={3} />
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          {error && <div className="rounded-xl bg-rose-50 px-4 py-3 text-[13px] font-bold text-rose-600">{error}</div>}
          {message && <div className="rounded-xl bg-emerald-50 px-4 py-3 text-[13px] font-bold text-emerald-700">{message}</div>}

          <button type="submit" disabled={isSaving} className={cn('btn-primary h-12 w-full text-[15px] font-black', isSaving && 'opacity-70')}>
            {isSaving ? <Loader2 className="animate-spin" size={17} /> : <Save size={17} />}
            <span>{isSaving ? '正在保存' : isEditing ? '保存修改' : '保存业务表单'}</span>
          </button>
        </form>

        <aside className="space-y-4 rounded-2xl border border-border-silver bg-canvas-white p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 text-[13px] font-black text-midnight-graphite">
              <Plus size={15} strokeWidth={3} />
              已有业务
            </div>
            <div className="flex shrink-0 overflow-hidden rounded-full bg-white text-[10px] font-black shadow-sm">
              <span className="px-2.5 py-1 text-emerald-700">{visibleCount} 显示</span>
              <span className="border-l border-border-silver px-2.5 py-1 text-medium-gray">{hiddenCount} 隐藏</span>
            </div>
          </div>

          <label className="relative block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-light-silver" />
            <input
              value={visibilityQuery}
              onChange={(event) => setVisibilityQuery(event.target.value)}
              placeholder="搜索模块或表单"
              className="input-field h-11 pl-10 text-[13px]"
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setAllVisible(true)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-white px-3 text-[12px] font-black text-midnight-graphite shadow-sm transition-colors hover:text-interactive-blue"
            >
              <Eye size={14} strokeWidth={2.6} />
              全部显示
            </button>
            <button
              type="button"
              onClick={() => setAllVisible(false)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-white px-3 text-[12px] font-black text-midnight-graphite shadow-sm transition-colors hover:text-rose-600"
            >
              <EyeOff size={14} strokeWidth={2.6} />
              全部隐藏
            </button>
          </div>

          <button
            type="button"
            onClick={() => void handleSaveVisibility()}
            disabled={isVisibilitySaving}
            className={cn('btn-primary h-11 w-full text-[13px] font-black', isVisibilitySaving && 'opacity-70')}
          >
            {isVisibilitySaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            <span>{isVisibilitySaving ? '正在保存显示范围' : '保存显示范围'}</span>
          </button>

          <div className="max-h-[560px] space-y-3 overflow-y-auto pr-1">
            {filteredModules.map((module) => (
              <div key={module.name} className="rounded-xl bg-white p-3 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate text-[13px] font-black text-midnight-graphite">{module.name}</div>
                  <span className="shrink-0 rounded-full bg-lightest-gray-background px-2 py-0.5 text-[10px] font-black text-medium-gray">
                    {module.approvalTypes.length} 个表单
                  </span>
                </div>
                <div className="mt-2 space-y-2">
                  {module.approvalTypes.map((type) => {
                    const isActive = editingTarget?.moduleName === module.name
                      && editingTarget?.approvalTypeName === type.name;
                    const isProtected = isProtectedBusinessForm(module.name, type.name);
                    const isVisible = visibilityMap[getBusinessFormKey(module.name, type.name)] !== false;

                    return (
                      <div
                        key={type.name}
                        className={cn(
                          'rounded-lg px-3 py-2 transition-colors',
                          isActive ? 'bg-[#e7f1ff]' : isVisible ? 'bg-lightest-gray-background' : 'bg-[#f1f2f5]',
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 items-center gap-2">
                              <div className="truncate text-[12px] font-black text-midnight-graphite">{type.name}</div>
                              {isProtected && (
                                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-700">
                                  <Lock size={10} strokeWidth={2.8} />
                                  系统配置
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-medium-gray">
                              <span>{type.businessFields.length} 个字段</span>
                              <span className={cn(
                                'rounded-full px-2 py-0.5 text-[10px] font-black',
                                isVisible ? 'bg-emerald-50 text-emerald-700' : 'bg-white text-medium-gray',
                              )}>
                                {isVisible ? '员工可见' : '已隐藏'}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleFormVisibility(module.name, type.name)}
                            title={isVisible ? '隐藏员工入口' : '显示到员工入口'}
                            aria-label={isVisible ? '隐藏员工入口' : '显示到员工入口'}
                            className={cn(
                              'inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white text-[0px] shadow-sm transition-colors',
                              isVisible ? 'text-emerald-700 hover:text-rose-600' : 'text-medium-gray hover:text-interactive-blue',
                            )}
                          >
                            {isVisible ? <Eye size={12} strokeWidth={2.6} /> : <EyeOff size={12} strokeWidth={2.6} />}
                            {isVisible ? '隐藏' : '显示'}
                          </button>
                          <button
                            type="button"
                            onClick={() => startEditing(module, type)}
                            disabled={isProtected}
                            title={isProtected ? '系统特殊配置表单默认不可编辑' : '编辑表单'}
                            aria-label="编辑"
                            className="ml-auto inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white text-[0px] text-midnight-graphite shadow-sm transition-colors hover:text-interactive-blue disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:text-midnight-graphite"
                          >
                            <Edit3 size={12} strokeWidth={2.6} />
                            编辑
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(module, type)}
                            disabled={isSaving || isProtected}
                            title={isProtected ? '系统特殊配置表单默认不可删除' : '删除表单'}
                            aria-label="删除"
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white text-[0px] text-midnight-graphite shadow-sm transition-colors hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:text-midnight-graphite"
                          >
                            <Trash2 size={12} strokeWidth={2.6} />
                            删除
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {filteredModules.length === 0 && (
              <div className="rounded-xl bg-white px-4 py-6 text-center text-[12px] font-bold text-light-gray shadow-sm">
                没有匹配的业务表单
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
