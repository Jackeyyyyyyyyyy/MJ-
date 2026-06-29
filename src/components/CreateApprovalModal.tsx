import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronRight, Upload, Calendar, Clock3, Calculator, DollarSign, FileText, Plus, AlignLeft, Building2, ListChecks, Table2, UserRound, Sparkles, ImagePlus, ChevronUp, ChevronDown, Loader2 } from 'lucide-react';
import { getVisibleApprovalModules } from '../approvalSchema';
import { storage } from '../storage';
import { auth } from '../auth';
import { cn } from '../lib/utils';
import { AiFormFillField, ApprovalAttachment, Module, ApprovalType, OrganizationSelectOptions } from '../types';

interface BatchModifyDetailRow {
  [key: string]: string;
  order: string;
  containerNo: string;
  feeName: string;
  originalAmount: string;
  originalSupplier: string;
  updatedAmount: string;
  updatedSupplier: string;
}

interface FundsReductionDetailRow {
  [key: string]: string;
  order: string;
  containerNo: string;
  feeItem: string;
  originalAmount: string;
  reductionAmount: string;
  reducedAmount: string;
}

interface CustomerBankAccountRow {
  [key: string]: string;
  currencyAccount: string;
  country: string;
  bankName: string;
  bankAccount: string;
}

interface CustomerInvoiceInfoRow {
  [key: string]: string;
  currencyAccount: string;
  invoiceCompanyName: string;
  taxNo: string;
  addressPhone: string;
  bankAndAccount: string;
}

interface CustomerInfoChangeValue {
  businessLicense: ApprovalAttachment[];
  bankAccounts: CustomerBankAccountRow[];
  bankVoucher: ApprovalAttachment[];
  invoiceInfos: CustomerInvoiceInfoRow[];
}

interface SupplierRoleServiceRow {
  [key: string]: string;
  role: string;
  service: string;
}

interface SupplierInfoChangeValue {
  roleServices: SupplierRoleServiceRow[];
  bankAccounts: CustomerBankAccountRow[];
  invoiceInfos: CustomerInvoiceInfoRow[];
}

interface ProjectCargoChangeValue {
  销售项目货: string;
  客服项目货: string;
}

interface SupplierQuotationRow {
  [key: string]: string;
  truckType: string;
  pickupPoint: string;
  dropoffPoint: string;
  province: string;
  city: string;
  county: string;
  priceLimit: string;
  beforeQuote: string;
  weight: string;
  afterQuote: string;
  remark: string;
}

interface SupplierQuotationInfoValue {
  quotationRows: SupplierQuotationRow[];
  attachments: ApprovalAttachment[];
}

interface MoneyInputValue {
  currency: string;
  amount: string;
}

interface FileFieldValue {
  text: string;
  attachments: ApprovalAttachment[];
}

interface CreateApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
}

type AiFillMode = 'text' | 'image';
type AiFillMessageType = 'idle' | 'success' | 'error';

interface AiFormFillPanelProps {
  isOpen: boolean;
  mode: AiFillMode;
  text: string;
  imageFile: File | null;
  imagePreview: string;
  message: string;
  messageType: AiFillMessageType;
  isLoading: boolean;
  onToggle: () => void;
  onModeChange: (mode: AiFillMode) => void;
  onTextChange: (text: string) => void;
  onImageChange: (files: FileList | null) => void;
  onClearImage: () => void;
  onSubmit: () => void;
}

const batchModifyDetailColumns: Array<{ key: keyof BatchModifyDetailRow; label: string; placeholder: string; type?: string }> = [
  { key: 'order', label: '订单', placeholder: '输入订单' },
  { key: 'containerNo', label: '箱号', placeholder: '输入箱号' },
  { key: 'feeName', label: '费用名', placeholder: '输入费用名' },
  { key: 'originalAmount', label: '原始金额', placeholder: '原始金额', type: 'number' },
  { key: 'originalSupplier', label: '原始供应商', placeholder: '原始供应商' },
  { key: 'updatedAmount', label: '修改后金额', placeholder: '修改后金额', type: 'number' },
  { key: 'updatedSupplier', label: '修改后供应商', placeholder: '修改后供应商' },
];

const fundsReductionDetailColumns: Array<{ key: keyof FundsReductionDetailRow; label: string; placeholder: string; type?: string }> = [
  { key: 'order', label: '订单', placeholder: '输入订单' },
  { key: 'containerNo', label: '箱号', placeholder: '输入箱号' },
  { key: 'feeItem', label: '费用项', placeholder: '输入费用项' },
  { key: 'originalAmount', label: '原始金额', placeholder: '原始金额', type: 'number' },
  { key: 'reductionAmount', label: '申请减免金额', placeholder: '申请减免金额', type: 'number' },
  { key: 'reducedAmount', label: '减免后金额', placeholder: '减免后金额', type: 'number' },
];

const customerBankAccountColumns: Array<{ key: keyof CustomerBankAccountRow; label: string; placeholder: string }> = [
  { key: 'currencyAccount', label: '币种账户', placeholder: '如 CNY / USD' },
  { key: 'country', label: '所属国家', placeholder: '输入所属国家' },
  { key: 'bankName', label: '开户行', placeholder: '输入开户行' },
  { key: 'bankAccount', label: '银行账户', placeholder: '输入银行账户' },
];

const customerInvoiceInfoColumns: Array<{ key: keyof CustomerInvoiceInfoRow; label: string; placeholder: string }> = [
  { key: 'currencyAccount', label: '币种账户', placeholder: '如 CNY / USD' },
  { key: 'invoiceCompanyName', label: '开票公司名称', placeholder: '输入开票公司名称' },
  { key: 'taxNo', label: '税号', placeholder: '输入税号' },
  { key: 'addressPhone', label: '地址、电话', placeholder: '输入地址、电话' },
  { key: 'bankAndAccount', label: '开户行及账户', placeholder: '输入开户行及账户' },
];

const supplierRoleServiceColumns: Array<{ key: keyof SupplierRoleServiceRow; label: string; placeholder: string }> = [
  { key: 'role', label: '角色', placeholder: '如 班列公司 / 车队' },
  { key: 'service', label: '服务', placeholder: '输入服务内容' },
];

const projectCargoOptions = ['项目货', '非项目货'];
const currencyOptions = ['CNY', 'USD', 'EUR', 'HKD', 'JPY', 'GBP'];
const emptyOrganizationOptions: OrganizationSelectOptions = { departments: [], members: [] };
const noCompanionOption: SearchableSingleSelectOption = {
  key: '__none__',
  value: '无',
  label: '无',
  searchText: '无 none',
};

const supplierQuotationColumns: Array<{ key: keyof SupplierQuotationRow; label: string; placeholder: string }> = [
  { key: 'truckType', label: '拖车类型', placeholder: '输入拖车类型' },
  { key: 'pickupPoint', label: '提箱点', placeholder: '输入提箱点' },
  { key: 'dropoffPoint', label: '落箱点', placeholder: '输入落箱点' },
  { key: 'province', label: '省份', placeholder: '输入省份' },
  { key: 'city', label: '市', placeholder: '输入市' },
  { key: 'county', label: '县', placeholder: '输入县' },
  { key: 'priceLimit', label: '报价限制', placeholder: '输入报价限制' },
  { key: 'beforeQuote', label: '提交前报价', placeholder: '输入提交前报价' },
  { key: 'weight', label: '权重', placeholder: '输入权重' },
  { key: 'afterQuote', label: '提交后报价', placeholder: '输入提交后报价' },
  { key: 'remark', label: '备注', placeholder: '输入备注' },
];

const createEmptyProjectCargoChange = (): ProjectCargoChangeValue => ({
  销售项目货: '',
  客服项目货: '',
});

function createEmptyBatchModifyDetail(): BatchModifyDetailRow {
  return {
    order: '',
    containerNo: '',
    feeName: '',
    originalAmount: '',
    originalSupplier: '',
    updatedAmount: '',
    updatedSupplier: '',
  };
}

function createEmptyFundsReductionDetail(): FundsReductionDetailRow {
  return {
    order: '',
    containerNo: '',
    feeItem: '',
    originalAmount: '',
    reductionAmount: '',
    reducedAmount: '',
  };
}

function createEmptyCustomerBankAccount(): CustomerBankAccountRow {
  return {
    currencyAccount: '',
    country: '',
    bankName: '',
    bankAccount: '',
  };
}

function createEmptyCustomerInvoiceInfo(): CustomerInvoiceInfoRow {
  return {
    currencyAccount: '',
    invoiceCompanyName: '',
    taxNo: '',
    addressPhone: '',
    bankAndAccount: '',
  };
}

function createEmptyCustomerInfoChange(): CustomerInfoChangeValue {
  return {
    businessLicense: [],
    bankAccounts: [createEmptyCustomerBankAccount()],
    bankVoucher: [],
    invoiceInfos: [createEmptyCustomerInvoiceInfo()],
  };
}

function createEmptySupplierRoleService(): SupplierRoleServiceRow {
  return {
    role: '',
    service: '',
  };
}

function createEmptySupplierInfoChange(): SupplierInfoChangeValue {
  return {
    roleServices: [createEmptySupplierRoleService()],
    bankAccounts: [createEmptyCustomerBankAccount()],
    invoiceInfos: [createEmptyCustomerInvoiceInfo()],
  };
}

function createEmptySupplierQuotationRow(): SupplierQuotationRow {
  return {
    truckType: '',
    pickupPoint: '',
    dropoffPoint: '',
    province: '',
    city: '',
    county: '',
    priceLimit: '',
    beforeQuote: '',
    weight: '',
    afterQuote: '',
    remark: '',
  };
}

function createEmptySupplierQuotationInfo(): SupplierQuotationInfoValue {
  return {
    quotationRows: [createEmptySupplierQuotationRow()],
    attachments: [],
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error(`读取文件失败：${file.name}`));
    reader.readAsDataURL(file);
  });
}

function isMoneyField(field: string) {
  return /金额|价格|利润|总额/.test(field);
}

function isDateField(field: string) {
  return field.includes('日期') || field.includes('时间');
}

function isConfiguredMoneyField(type: ApprovalType | null, field: string) {
  if (!type) return isMoneyField(field);
  if (Array.isArray(type.amountFields) && type.amountFields.length > 0) {
    return type.amountFields.includes(field);
  }
  return isMoneyField(field);
}

function isNumericField(field: string) {
  return isMoneyField(field) || field.includes('汇率');
}

function isConfiguredNumericField(type: ApprovalType | null, field: string) {
  return isConfiguredMoneyField(type, field)
    || field.includes('汇率')
    || Boolean(getConfiguredDurationRule(type, field));
}

function isConfiguredFileField(type: ApprovalType | null, field: string) {
  return Array.isArray(type?.fileFields) && type.fileFields.includes(field);
}

function isConfiguredAttachmentField(type: ApprovalType | null, field: string) {
  return Array.isArray(type?.attachmentFields) && type.attachmentFields.includes(field);
}

function isUploadOnlyField(type: ApprovalType | null, field: string) {
  return isConfiguredAttachmentField(type, field)
    || (!isConfiguredFileField(type, field) && (field.includes('附件') || field.includes('图片')));
}

function isConfiguredDateField(type: ApprovalType | null, field: string) {
  if (!type) return isDateField(field);
  if (Array.isArray(type.dateFields)) {
    return type.dateFields.includes(field);
  }
  return isDateField(field);
}

function isConfiguredDateTimeField(type: ApprovalType | null, field: string) {
  return Array.isArray(type?.dateTimeFields) && type.dateTimeFields.includes(field);
}

function isConfiguredOptionalField(type: ApprovalType | null, field: string) {
  return Array.isArray(type?.optionalFields) && type.optionalFields.includes(field);
}

function isConfiguredMultilineField(type: ApprovalType | null, field: string) {
  return Array.isArray(type?.multilineFields) && type.multilineFields.includes(field);
}

function isConfiguredMemberField(type: ApprovalType | null, field: string) {
  return Array.isArray(type?.memberFields) && type.memberFields.includes(field);
}

function isConfiguredDepartmentField(type: ApprovalType | null, field: string) {
  return Array.isArray(type?.departmentFields) && type.departmentFields.includes(field);
}

function getConfiguredSelectOptions(type: ApprovalType | null, field: string) {
  const configuredField = Array.isArray(type?.selectFields)
    ? type.selectFields.find((item) => item.field === field)
    : null;
  const options = Array.isArray(configuredField?.options) ? configuredField.options : [];
  return [...new Set(options.map((option) => String(option || '').trim()).filter(Boolean))];
}

function getConfiguredDetailColumns(type: ApprovalType | null, field: string) {
  const configuredField = Array.isArray(type?.detailFields)
    ? type.detailFields.find((item) => item.field === field)
    : null;
  const columns = Array.isArray(configuredField?.columns) ? configuredField.columns : [];
  const normalizedColumns = columns
    .map((column) => {
      if (typeof column === 'string') {
        const name = column.trim();
        if (!name) return null;
        return {
          key: name,
          label: name,
          placeholder: `输入${name}`,
          type: isMoneyField(name) || name.includes('数量') || name.includes('单价') ? 'number' : 'text',
          options: [] as string[],
        };
      }

      const name = String(column?.name || '').trim();
      if (!name) return null;
      const type = column.type || (isMoneyField(name) || name.includes('数量') || name.includes('单价') ? 'number' : 'text');
      return {
        key: name,
        label: name,
        placeholder: `输入${name}`,
        type,
        options: Array.isArray(column.options) ? column.options : [],
        unit: column.unit,
      };
    })
    .filter(Boolean);

  const seen = new Set<string>();
  return normalizedColumns.filter((column) => {
    if (!column || seen.has(column.key)) return false;
    seen.add(column.key);
    return true;
  });
}

function getConfiguredDurationRule(type: ApprovalType | null, field: string) {
  const configuredRule = Array.isArray(type?.durationFields)
    ? type.durationFields.find((item) => item.field === field) || null
    : null;
  if (configuredRule) return configuredRule;

  if (!type || !field.includes('天数')) return null;
  const startField = type.businessFields.find((item) => item !== field && item.includes('开始'));
  const endField = type.businessFields.find((item) => item !== field && item.includes('结束'));
  if (!startField || !endField) return null;

  return {
    field,
    startField,
    endField,
    unit: 'days' as const,
  };
}

function getConfiguredDurationRules(type: ApprovalType | null) {
  if (!type) return [];
  const rules = Array.isArray(type.durationFields) ? [...type.durationFields] : [];
  const configuredFields = new Set(rules.map((rule) => rule.field));

  type.businessFields.forEach((field) => {
    if (configuredFields.has(field)) return;
    const rule = getConfiguredDurationRule(type, field);
    if (rule) {
      rules.push(rule);
      configuredFields.add(rule.field);
    }
  });

  return rules;
}

function calculateDurationValue(startValue: unknown, endValue: unknown, unit: 'hours' | 'days' = 'hours') {
  const startTime = Date.parse(String(startValue || ''));
  const endTime = Date.parse(String(endValue || ''));
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime < startTime) return '';
  const hours = (endTime - startTime) / 36e5;
  const value = unit === 'days' ? hours / 24 : hours;
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

function getDateOnlyUtcTime(value: unknown) {
  const match = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const time = Date.UTC(year, month - 1, day);
  const date = new Date(time);
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    return null;
  }
  return time;
}

function calculateInclusiveDayDurationValue(startValue: unknown, endValue: unknown) {
  const startTime = getDateOnlyUtcTime(startValue);
  const endTime = getDateOnlyUtcTime(endValue);
  if (startTime === null || endTime === null || endTime < startTime) return '';
  const days = Math.round((endTime - startTime) / 864e5) + 1;
  return String(days);
}

function formatDurationNumber(value: number) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

function getDurationOptionMatch(
  value: string,
  unit: 'hours' | 'days',
  options: string[],
) {
  const numericValue = Number(value);
  const unitText = unit === 'days' ? '天' : '小时';
  const candidates = [
    value,
    `${value}${unitText}`,
    `${value} ${unitText}`,
    unit === 'days' ? `${value}日` : `${value}时`,
  ];
  const normalizedCandidates = new Set(candidates.map((item) => item.replace(/\s+/g, '').toLowerCase()));

  const exactMatch = options.find((option) => normalizedCandidates.has(option.replace(/\s+/g, '').toLowerCase()));
  if (exactMatch) return exactMatch;

  if (Number.isFinite(numericValue)) {
    const numericMatch = options.find((option) => {
      const optionNumber = Number(option.match(/-?\d+(?:\.\d+)?/)?.[0]);
      return Number.isFinite(optionNumber) && Math.abs(optionNumber - numericValue) < 0.001;
    });
    if (numericMatch) return numericMatch;
  }

  return options.length > 0 && unit === 'days' ? `${value}${unitText}` : value;
}

function shouldUseInclusiveDayDuration(
  type: ApprovalType | null,
  rule: NonNullable<ApprovalType['durationFields']>[number],
  options: string[],
  unit: 'hours' | 'days',
) {
  return unit === 'days'
    && (rule.field.includes('天数') || options.some((option) => option.includes('天')) || type?.name === '出差');
}

function calculateConfiguredDurationValue(
  type: ApprovalType | null,
  rule: NonNullable<ApprovalType['durationFields']>[number],
  data: Record<string, any>,
) {
  const options = getConfiguredSelectOptions(type, rule.field);
  const unit = rule.unit || (rule.field.includes('天数') || options.some((option) => option.includes('天')) ? 'days' : 'hours');
  const value = shouldUseInclusiveDayDuration(type, rule, options, unit)
    ? calculateInclusiveDayDurationValue(data[rule.startField], data[rule.endField])
    : calculateDurationValue(data[rule.startField], data[rule.endField], unit);
  if (!value) return '';

  return getDurationOptionMatch(formatDurationNumber(Number(value)), unit, options);
}

function createEmptyDetailRow(columns: Array<{ key: string | number }>) {
  return Object.fromEntries(columns.map((column) => [String(column.key), '']));
}

type StructuredDetailColumn = {
  key: string;
  label: string;
  placeholder: string;
  type?: string;
  options?: string[];
  unit?: 'hours' | 'days';
};

function getMemberOptionLabel(member: OrganizationSelectOptions['members'][number]) {
  const detail = [member.departmentName, member.title].filter(Boolean).join(' / ');
  return detail ? `${member.name} - ${detail}` : member.name;
}

function getMemberSearchText(member: OrganizationSelectOptions['members'][number]) {
  return [member.id, member.name, member.departmentName, member.title].filter(Boolean).join(' ');
}

function isTripCompanionField(moduleName: string | undefined, typeName: string | undefined, field: string) {
  return moduleName === '出勤休假' && typeName === '出差' && field === '同行人';
}

function getMemberSelectOptions(
  members: OrganizationSelectOptions['members'],
  options: { includeNoCompanionOption?: boolean } = {},
) {
  const memberOptions = members.map((member) => ({
    key: member.id,
    value: member.name,
    label: getMemberOptionLabel(member),
    searchText: getMemberSearchText(member),
  }));

  return options.includeNoCompanionOption ? [noCompanionOption, ...memberOptions] : memberOptions;
}

type SearchableSingleSelectOption = {
  key: string;
  value: string;
  label: string;
  searchText?: string;
};

function SearchableSingleSelect({
  value,
  options,
  placeholder,
  emptyText,
  onChange,
  icon,
  hasError,
  inputClassName,
}: {
  value: string;
  options: SearchableSingleSelectOption[];
  placeholder: string;
  emptyText: string;
  onChange: (value: string) => void;
  icon: React.ReactNode;
  hasError?: boolean;
  inputClassName?: string;
}) {
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = React.useState(false);
  const selectedOption = React.useMemo(
    () => options.find((option) => option.value === value) || null,
    [options, value],
  );
  const selectedLabel = selectedOption?.label || value;
  const [query, setQuery] = React.useState(selectedOption?.label || '');

  React.useEffect(() => {
    if (!isOpen) return undefined;

    const closeOnOutsidePress = (event: MouseEvent | TouchEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setIsOpen(false);
      setQuery(selectedOption?.label || '');
    };

    document.addEventListener('mousedown', closeOnOutsidePress);
    document.addEventListener('touchstart', closeOnOutsidePress);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsidePress);
      document.removeEventListener('touchstart', closeOnOutsidePress);
    };
  }, [isOpen, selectedOption]);

  React.useEffect(() => {
    if (!isOpen) {
      setQuery(selectedOption?.label || '');
    }
  }, [isOpen, selectedOption]);

  const normalizedQuery = query.trim().toLowerCase();
  const visibleOptions = React.useMemo(() => {
    const matchedOptions = normalizedQuery
      ? options.filter((option) => `${option.label} ${option.value} ${option.key} ${option.searchText || ''}`.toLowerCase().includes(normalizedQuery))
      : options;

    return matchedOptions.slice(0, 80);
  }, [normalizedQuery, options]);

  const handleInputChange = (nextQuery: string) => {
    setQuery(nextQuery);
    setIsOpen(true);

    if (!nextQuery.trim()) {
      onChange('');
      return;
    }

    if (value && nextQuery !== selectedOption?.label) {
      onChange('');
    }
  };

  const selectOption = (option: SearchableSingleSelectOption) => {
    onChange(option.value);
    setQuery(option.label);
    setIsOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <input
        type="search"
        autoComplete="off"
        className={cn(
          "input-field border-b border-border-silver pr-11 focus:border-interactive-blue transition-colors",
          !value && "text-light-gray",
          hasError && "border-rose-500",
          inputClassName,
        )}
        placeholder={placeholder}
        value={isOpen ? query : selectedLabel}
        onFocus={(event) => {
          setQuery(selectedOption?.label || '');
          setIsOpen(true);
          event.currentTarget.select();
        }}
        onChange={(event) => handleInputChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setIsOpen(false);
            setQuery(selectedOption?.label || '');
          }

          if (event.key === 'Enter' && isOpen && visibleOptions[0]) {
            event.preventDefault();
            selectOption(visibleOptions[0]);
          }
        }}
      />
      {value ? (
        <button
          type="button"
          onClick={() => {
            onChange('');
            setQuery('');
            setIsOpen(false);
          }}
          className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-light-gray transition-colors hover:bg-lightest-gray-background hover:text-rose-500"
          aria-label="清空选择"
        >
          <X size={14} strokeWidth={2.6} />
        </button>
      ) : (
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-light-silver">
          {icon}
        </span>
      )}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-[120] mt-2 max-h-72 overflow-y-auto rounded-2xl border border-border-silver bg-white py-2 shadow-2xl">
          {visibleOptions.length > 0 ? visibleOptions.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => selectOption(option)}
              className={cn(
                "block w-full px-4 py-2.5 text-left text-[13px] font-semibold leading-5 transition-colors hover:bg-[#e7f1ff] hover:text-interactive-blue",
                option.value === value ? "bg-[#e7f1ff] text-interactive-blue" : "text-midnight-graphite",
              )}
            >
              {option.label}
            </button>
          )) : (
            <div className="px-4 py-3 text-[13px] font-semibold text-light-gray">{emptyText}</div>
          )}
        </div>
      )}
    </div>
  );
}

function AiFormFillPanel({
  isOpen,
  mode,
  text,
  imageFile,
  imagePreview,
  message,
  messageType,
  isLoading,
  onToggle,
  onModeChange,
  onTextChange,
  onImageChange,
  onClearImage,
  onSubmit,
}: AiFormFillPanelProps) {
  return (
    <div className="rounded-[24px] border border-[#dfe7ff] bg-gradient-to-r from-[#fbf2ff] via-[#f4f7ff] to-[#eff8ff] p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex w-fit rounded-xl bg-white/70 p-1 shadow-sm">
          <button
            type="button"
            onClick={() => onModeChange('text')}
            className={cn(
              "h-10 rounded-lg px-4 text-[14px] font-bold transition-all",
              mode === 'text' ? "bg-white text-midnight-graphite shadow-sm" : "text-medium-gray hover:text-midnight-graphite",
            )}
          >
            文本填单
          </button>
          <button
            type="button"
            disabled
            title="图片 AI 识别开发中"
            className="inline-flex h-10 cursor-not-allowed items-center gap-1.5 rounded-lg bg-[#e5e5e8] px-4 text-[14px] font-bold text-light-silver opacity-80"
          >
            图片填单
            <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-black text-light-silver">开发中</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onToggle}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full px-3 text-[13px] font-bold text-medium-gray transition-colors hover:bg-white/70 hover:text-midnight-graphite"
        >
          {isOpen ? <ChevronUp size={16} strokeWidth={2.6} /> : <ChevronDown size={16} strokeWidth={2.6} />}
          {isOpen ? '收起' : '展开'}
        </button>
      </div>

      {isOpen && (
        <div className="mt-4 rounded-2xl border border-white/70 bg-white p-4 shadow-sm">
          {mode === 'text' ? (
            <textarea
              value={text}
              onChange={(event) => onTextChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey && !event.metaKey && !event.ctrlKey) {
                  event.preventDefault();
                  onSubmit();
                }
              }}
              className="min-h-[118px] w-full resize-y rounded-xl border border-transparent bg-canvas-white px-4 py-3 text-[15px] font-semibold leading-7 text-midnight-graphite outline-none transition-colors placeholder:text-light-gray focus:border-interactive-blue"
              placeholder="粘贴或输入内容到此处，AI将自动识别信息并填入表单"
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <label className="flex min-h-[118px] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[#bfd3ff] bg-canvas-white px-4 py-5 text-center transition-colors hover:border-interactive-blue">
                <ImagePlus size={24} strokeWidth={2.4} className="mb-2 text-interactive-blue" />
                <span className="text-[14px] font-bold text-midnight-graphite">
                  {imageFile ? imageFile.name : '选择图片'}
                </span>
                <span className="mt-1 text-[12px] font-semibold text-light-gray">
                  截图、拍照都可以
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(event) => {
                    onImageChange(event.currentTarget.files);
                    event.currentTarget.value = '';
                  }}
                />
              </label>
              {imagePreview && (
                <div className="relative h-[118px] w-full overflow-hidden rounded-xl border border-border-silver bg-white sm:w-[150px]">
                  <img src={imagePreview} alt="AI填单图片预览" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={onClearImage}
                    className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-medium-gray shadow-sm transition-colors hover:text-rose-500"
                    aria-label="移除图片"
                  >
                    <X size={14} strokeWidth={2.6} />
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className={cn(
              "min-h-5 text-[12px] font-semibold",
              messageType === 'error' ? "text-rose-500" : messageType === 'success' ? "text-emerald-600" : "text-light-gray",
            )}>
              {message}
            </p>
            <button
              type="button"
              disabled={isLoading}
              onClick={onSubmit}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#c68bff] to-[#72a8ff] px-5 text-[14px] font-bold text-white shadow-sm transition-all hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} strokeWidth={2.5} />}
              {isLoading ? '识别中' : 'AI识别填写'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function isMoneyInputValue(value: unknown): value is MoneyInputValue {
  return !!value
    && typeof value === 'object'
    && 'currency' in value
    && 'amount' in value;
}

function toMoneyInputValue(value: unknown): MoneyInputValue {
  if (isMoneyInputValue(value)) {
    return {
      currency: String(value.currency || 'CNY'),
      amount: String(value.amount || ''),
    };
  }

  if (typeof value === 'string') {
    const matchedCurrency = currencyOptions.find((currency) => value.toUpperCase().includes(currency));
    const matchedAmount = value.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/)?.[0] || '';
    return {
      currency: matchedCurrency || (value.includes('$') ? 'USD' : 'CNY'),
      amount: matchedAmount || value,
    };
  }

  return { currency: 'CNY', amount: '' };
}

function isFileFieldValue(value: unknown): value is FileFieldValue {
  return !!value
    && typeof value === 'object'
    && !Array.isArray(value)
    && 'text' in value
    && Array.isArray((value as FileFieldValue).attachments);
}

function toFileFieldValue(value: unknown): FileFieldValue {
  if (isFileFieldValue(value)) {
    return {
      text: String(value.text || ''),
      attachments: value.attachments,
    };
  }

  if (Array.isArray(value)) {
    return {
      text: '',
      attachments: value.filter((item): item is ApprovalAttachment => (
        !!item && typeof item === 'object' && 'name' in item && 'url' in item
      )),
    };
  }

  if (typeof value === 'string') {
    return {
      text: value,
      attachments: [],
    };
  }

  return { text: '', attachments: [] };
}

function createEmptyFileFieldValue(): FileFieldValue {
  return { text: '', attachments: [] };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function toAiFilledString(value: unknown) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean).join('、');
  }
  if (isPlainRecord(value)) {
    return String(value.text || value.value || value.name || '').trim();
  }
  return String(value).trim();
}

function normalizeAiOptionFromList(value: unknown, options: string[]) {
  const text = toAiFilledString(value);
  if (!text || options.length === 0) return text;
  const exact = options.find((option) => option === text);
  if (exact) return exact;
  const normalizedText = text.toLowerCase();
  return options.find((option) => {
    const normalizedOption = option.toLowerCase();
    return normalizedOption.includes(normalizedText) || normalizedText.includes(normalizedOption);
  }) || text;
}

function normalizeAiMemberValue(value: unknown, members: OrganizationSelectOptions['members']) {
  const text = toAiFilledString(value);
  if (!text || members.length === 0) return text;

  const normalizedText = text.toLowerCase();
  const findMatch = (matcher: (candidate: string) => boolean) => members.find((member) => {
    const candidates = [
      member.id,
      member.name,
      getMemberOptionLabel(member),
      member.departmentName,
      member.title,
    ].map((item) => String(item || '').trim().toLowerCase()).filter(Boolean);
    return candidates.some(matcher);
  });

  const exact = findMatch((candidate) => candidate === normalizedText);
  if (exact) return exact.name;

  const partial = findMatch((candidate) => (
    candidate.includes(normalizedText) || normalizedText.includes(candidate)
  ));

  return partial?.name || text;
}

function isBlankOptionalValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (typeof value === 'number') return !Number.isFinite(value);
  if (isMoneyInputValue(value)) return !String(value.amount || '').trim();
  if (isFileFieldValue(value)) return !value.text.trim() && value.attachments.length === 0;
  if (Array.isArray(value)) {
    return value.length === 0 || value.every((item) => isBlankOptionalValue(item));
  }
  if (typeof value === 'object') {
    return Object.values(value).every((item) => isBlankOptionalValue(item));
  }

  return false;
}

export default function CreateApprovalModal({ isOpen, onClose, onSuccess }: CreateApprovalModalProps) {
  const [step, setStep] = useState(1);
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);
  const [selectedType, setSelectedType] = useState<ApprovalType | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploadingFields, setUploadingFields] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [organizationOptions, setOrganizationOptions] = useState<OrganizationSelectOptions>(emptyOrganizationOptions);
  const [aiPanelOpen, setAiPanelOpen] = useState(true);
  const [aiFillMode, setAiFillMode] = useState<AiFillMode>('text');
  const [aiFillText, setAiFillText] = useState('');
  const [aiImageFile, setAiImageFile] = useState<File | null>(null);
  const [aiImagePreview, setAiImagePreview] = useState('');
  const [aiFillMessage, setAiFillMessage] = useState('');
  const [aiFillMessageType, setAiFillMessageType] = useState<AiFillMessageType>('idle');
  const [isAiFilling, setIsAiFilling] = useState(false);
  const isSubmittingRef = React.useRef(false);

  const user = auth.getCurrentUser();
  const visibleModules = getVisibleApprovalModules();

  const resetAiFillState = () => {
    setAiPanelOpen(true);
    setAiFillMode('text');
    setAiFillText('');
    setAiImageFile(null);
    setAiImagePreview('');
    setAiFillMessage('');
    setAiFillMessageType('idle');
    setIsAiFilling(false);
  };

  React.useEffect(() => {
    if (!isOpen) return undefined;

    let isCancelled = false;
    void storage.getOrganizationOptions()
      .then((options) => {
        if (!isCancelled) {
          setOrganizationOptions(options);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setOrganizationOptions(emptyOrganizationOptions);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [isOpen]);

  React.useEffect(() => {
    return () => {
      if (aiImagePreview) {
        URL.revokeObjectURL(aiImagePreview);
      }
    };
  }, [aiImagePreview]);

  const handleModuleSelect = (module: Module) => {
    setSelectedModule(module);
    setStep(2);
  };

  const handleTypeSelect = (type: ApprovalType) => {
    setSelectedType(type);
    const initialData: Record<string, any> = {};
    type.businessFields.forEach(field => {
      if (selectedModule?.name === '资金' && type.name === '批量修改' && field === '明细') {
        initialData[field] = [createEmptyBatchModifyDetail()];
      } else if (selectedModule?.name === '资金' && type.name === '资金减免' && field === '明细') {
        initialData[field] = [createEmptyFundsReductionDetail()];
      } else if (selectedModule?.name === '客户' && type.name === '客户信息' && field === '修改后内容') {
        initialData[field] = createEmptyCustomerInfoChange();
      } else if (selectedModule?.name === '供应商' && type.name === '供应商信息' && field === '内容') {
        initialData[field] = createEmptySupplierInfoChange();
      } else if (selectedModule?.name === '订单' && type.name === '项目货变更' && field === '变更为') {
        initialData[field] = createEmptyProjectCargoChange();
      } else if (selectedModule?.name === '供应商' && type.name === '报价' && field === '报价信息') {
        initialData[field] = createEmptySupplierQuotationInfo();
      } else if (getConfiguredDetailColumns(type, field).length > 0) {
        initialData[field] = [createEmptyDetailRow(getConfiguredDetailColumns(type, field))];
      } else if (isUploadOnlyField(type, field)) {
        initialData[field] = [];
      } else if (isConfiguredFileField(type, field)) {
        initialData[field] = createEmptyFileFieldValue();
      } else {
        initialData[field] = '';
      }
    });
    setFormData(initialData);
    resetAiFillState();
    setStep(3);
  };

  const handleInputChange = (
    field: string,
    valueOrUpdater: any | ((currentValue: any, currentData: Record<string, any>) => any),
  ) => {
    setFormData(prev => {
      const value = typeof valueOrUpdater === 'function'
        ? valueOrUpdater(prev[field], prev)
        : valueOrUpdater;
      const next = { ...prev, [field]: value };
      const durationRules = getConfiguredDurationRules(selectedType);
      if (durationRules.length > 0) {
        durationRules.forEach((rule) => {
          if (rule.startField !== field && rule.endField !== field) return;
          next[rule.field] = calculateConfiguredDurationValue(selectedType, rule, next);
        });
      }
      return next;
    });
    setErrors((previousErrors) => {
      if (!previousErrors[field]) return previousErrors;
      const nextErrors = { ...previousErrors };
      delete nextErrors[field];
      return nextErrors;
    });
  };

  const handleFileUpload = async (field: string, fileList: FileList | null) => {
    const files = fileList ? Array.from<File>(fileList) : [];
    if (files.length === 0) return;

    setUploadingFields(prev => ({ ...prev, [field]: true }));
    try {
      const payload = await Promise.all(
        files.map(async (file) => ({
          name: file.name,
          type: file.type || 'application/octet-stream',
          size: file.size,
          data: await readFileAsDataUrl(file),
        })),
      );
      const uploads = await storage.uploadFiles(payload);
      handleInputChange(field, uploads);
    } catch (error) {
      setErrors(prev => ({
        ...prev,
        [field]: error instanceof Error ? error.message : '文件上传失败',
      }));
    } finally {
      setUploadingFields(prev => ({ ...prev, [field]: false }));
    }
  };

  const handleFileFieldUpload = async (field: string, fileList: FileList | null) => {
    const files = fileList ? Array.from<File>(fileList) : [];
    if (files.length === 0) return;

    const uploadKey = `${field}.attachments`;
    setUploadingFields(prev => ({ ...prev, [uploadKey]: true }));
    try {
      const payload = await Promise.all(
        files.map(async (file) => ({
          name: file.name,
          type: file.type || 'application/octet-stream',
          size: file.size,
          data: await readFileAsDataUrl(file),
        })),
      );
      const uploads = await storage.uploadFiles(payload);
      handleInputChange(field, (currentValue: unknown) => ({
        ...toFileFieldValue(currentValue),
        attachments: uploads,
      }));
    } catch (error) {
      setErrors(prev => ({
        ...prev,
        [field]: error instanceof Error ? error.message : '文件上传失败',
      }));
    } finally {
      setUploadingFields(prev => ({ ...prev, [uploadKey]: false }));
    }
  };

  const handleCustomerAttachmentUpload = async (
    field: string,
    section: 'businessLicense' | 'bankVoucher',
    fileList: FileList | null,
  ) => {
    const files = fileList ? Array.from<File>(fileList) : [];
    if (files.length === 0) return;

    const uploadKey = `${field}.${section}`;
    setUploadingFields(prev => ({ ...prev, [uploadKey]: true }));

    try {
      const payload = await Promise.all(
        files.map(async (file) => ({
          name: file.name,
          type: file.type || 'application/octet-stream',
          size: file.size,
          data: await readFileAsDataUrl(file),
        })),
      );
      const uploads = await storage.uploadFiles(payload);
      handleInputChange(field, (currentValue: unknown) => ({
        ...getCustomerInfoChangeValueFrom(currentValue),
        [section]: uploads,
      }));
    } catch (error) {
      setErrors(prev => ({
        ...prev,
        [field]: error instanceof Error ? error.message : '文件上传失败',
      }));
    } finally {
      setUploadingFields(prev => ({ ...prev, [uploadKey]: false }));
    }
  };

  const handleSupplierQuotationAttachmentUpload = async (field: string, fileList: FileList | null) => {
    const files = fileList ? Array.from<File>(fileList) : [];
    if (files.length === 0) return;

    const uploadKey = `${field}.attachments`;
    setUploadingFields(prev => ({ ...prev, [uploadKey]: true }));

    try {
      const payload = await Promise.all(
        files.map(async (file) => ({
          name: file.name,
          type: file.type || 'application/octet-stream',
          size: file.size,
          data: await readFileAsDataUrl(file),
        })),
      );
      const uploads = await storage.uploadFiles(payload);
      handleInputChange(field, (currentValue: unknown) => ({
        ...getSupplierQuotationInfoValueFrom(currentValue),
        attachments: uploads,
      }));
    } catch (error) {
      setErrors(prev => ({
        ...prev,
        [field]: error instanceof Error ? error.message : '文件上传失败',
      }));
    } finally {
      setUploadingFields(prev => ({ ...prev, [uploadKey]: false }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedModule || !selectedType || !user) return;
    if (isSubmittingRef.current) return;

    const newErrors: Record<string, string> = {};
    selectedType.businessFields.forEach(field => {
      const value = formData[field];
      const isOptional = isConfiguredOptionalField(selectedType, field);
      if (isOptional && isBlankOptionalValue(value)) {
        return;
      }

      if (isUploadOnlyField(selectedType, field)) {
        const attachments = Array.isArray(value) ? value : [];
        if (attachments.length === 0) {
          newErrors[field] = '请上传文件';
        }
        return;
      }

      if (isConfiguredFileField(selectedType, field)) {
        const fileValue = toFileFieldValue(value);
        if (!fileValue.text.trim() || fileValue.attachments.length === 0) {
          newErrors[field] = '请填写内容并上传附件';
        }
        return;
      }

      if (Array.isArray(value)) {
        const columns = getStructuredDetailColumns(field);
        const hasEmptyCell = columns.length > 0
          ? value.length === 0 || value.some((row) => columns.some((column) => !String(row?.[column.key] || '').trim()))
          : value.length === 0;

        if (hasEmptyCell) {
          newErrors[field] = '请完整填写明细';
        }
        return;
      }

      if (isCustomerInfoChangeValue(value)) {
        const hasEmptyBankCell = value.bankAccounts.length === 0 || value.bankAccounts.some((row) => (
          customerBankAccountColumns.some((column) => !String(row[column.key] || '').trim())
        ));
        const hasEmptyInvoiceCell = value.invoiceInfos.length === 0 || value.invoiceInfos.some((row) => (
          customerInvoiceInfoColumns.some((column) => !String(row[column.key] || '').trim())
        ));

        if (hasEmptyBankCell || hasEmptyInvoiceCell) {
          newErrors[field] = '请完整填写修改后内容';
        }
        return;
      }

      if (isSupplierInfoChangeValue(value)) {
        const hasEmptyRoleServiceCell = value.roleServices.length === 0 || value.roleServices.some((row) => (
          supplierRoleServiceColumns.some((column) => !String(row[column.key] || '').trim())
        ));
        const hasEmptyBankCell = value.bankAccounts.length === 0 || value.bankAccounts.some((row) => (
          customerBankAccountColumns.some((column) => !String(row[column.key] || '').trim())
        ));
        const hasEmptyInvoiceCell = value.invoiceInfos.length === 0 || value.invoiceInfos.some((row) => (
          customerInvoiceInfoColumns.some((column) => !String(row[column.key] || '').trim())
        ));

        if (hasEmptyRoleServiceCell || hasEmptyBankCell || hasEmptyInvoiceCell) {
          newErrors[field] = '请完整填写内容';
        }
        return;
      }

      if (isSupplierQuotationInfoValue(value)) {
        const requiredColumns = supplierQuotationColumns.filter((column) => column.key !== 'remark');
        const hasEmptyQuotationCell = value.quotationRows.length === 0 || value.quotationRows.some((row) => (
          requiredColumns.some((column) => !String(row[column.key] || '').trim())
        ));

        if (hasEmptyQuotationCell) {
          newErrors[field] = '请完整填写报价信息';
        }
        return;
      }

      if (isProjectCargoChangeValue(value)) {
        const hasEmptyCargoChoice = !value.销售项目货 || !value.客服项目货;

        if (hasEmptyCargoChoice) {
          newErrors[field] = '请选择项目货类型';
        }
        return;
      }

      if (isConfiguredMoneyField(selectedType, field)) {
        const moneyValue = toMoneyInputValue(value);
        if (!moneyValue.currency || !moneyValue.amount || !Number.isFinite(Number(moneyValue.amount))) {
          newErrors[field] = '请填写币种和数字金额';
        }
        return;
      }

      if (isConfiguredNumericField(selectedType, field)) {
        if (!String(value || '').trim() || !Number.isFinite(Number(value))) {
          newErrors[field] = '请填写数字';
        }
        return;
      }

      if (isBlankOptionalValue(formData[field])) {
        newErrors[field] = '必填项';
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);

    const payload = {
      moduleName: selectedModule.name,
      approvalTypeName: selectedType.name,
      businessData: formData,
      applicant: user.name
    };

    handleClose();

    storage.addRecord(payload)
      .finally(() => {
        isSubmittingRef.current = false;
        setIsSubmitting(false);
      })
      .then(() => onSuccess())
      .catch((error) => {
        window.alert(error instanceof Error ? error.message : '申请提交失败，请稍后再试');
      });
  };

  const handleClose = () => {
    setStep(1);
    setSelectedModule(null);
    setSelectedType(null);
    setFormData({});
    setErrors({});
    resetAiFillState();
    onClose();
  };

  const isCustomerInfoChangeValue = (value: unknown): value is CustomerInfoChangeValue => {
    return !!value
      && typeof value === 'object'
      && Array.isArray((value as CustomerInfoChangeValue).businessLicense)
      && Array.isArray((value as CustomerInfoChangeValue).bankAccounts)
      && Array.isArray((value as CustomerInfoChangeValue).bankVoucher)
      && Array.isArray((value as CustomerInfoChangeValue).invoiceInfos);
  };

  const isSupplierQuotationInfoValue = (value: unknown): value is SupplierQuotationInfoValue => {
    return !!value
      && typeof value === 'object'
      && Array.isArray((value as SupplierQuotationInfoValue).quotationRows)
      && Array.isArray((value as SupplierQuotationInfoValue).attachments);
  };

  const isSupplierInfoChangeValue = (value: unknown): value is SupplierInfoChangeValue => {
    return !!value
      && typeof value === 'object'
      && Array.isArray((value as SupplierInfoChangeValue).roleServices)
      && Array.isArray((value as SupplierInfoChangeValue).bankAccounts)
      && Array.isArray((value as SupplierInfoChangeValue).invoiceInfos);
  };

  const isProjectCargoChangeValue = (value: unknown): value is ProjectCargoChangeValue => {
    return !!value
      && typeof value === 'object'
      && '销售项目货' in value
      && '客服项目货' in value;
  };

  const isCustomerInfoChangeField = (field: string) => {
    return selectedModule?.name === '客户' && selectedType?.name === '客户信息' && field === '修改后内容';
  };

  const isSupplierQuotationInfoField = (field: string) => {
    return selectedModule?.name === '供应商' && selectedType?.name === '报价' && field === '报价信息';
  };

  const isSupplierInfoChangeField = (field: string) => {
    return selectedModule?.name === '供应商' && selectedType?.name === '供应商信息' && field === '内容';
  };

  const isProjectCargoChangeField = (field: string) => {
    return selectedModule?.name === '订单' && selectedType?.name === '项目货变更' && field === '变更为';
  };

  const getCustomerInfoChangeValueFrom = (value: unknown): CustomerInfoChangeValue => {
    return isCustomerInfoChangeValue(value) ? value : createEmptyCustomerInfoChange();
  };

  const getCustomerInfoChangeValue = (field: string): CustomerInfoChangeValue => {
    return getCustomerInfoChangeValueFrom(formData[field]);
  };

  const getSupplierQuotationInfoValueFrom = (value: unknown): SupplierQuotationInfoValue => {
    return isSupplierQuotationInfoValue(value) ? value : createEmptySupplierQuotationInfo();
  };

  const getSupplierQuotationInfoValue = (field: string): SupplierQuotationInfoValue => {
    return getSupplierQuotationInfoValueFrom(formData[field]);
  };

  const getSupplierInfoChangeValueFrom = (value: unknown): SupplierInfoChangeValue => {
    return isSupplierInfoChangeValue(value) ? value : createEmptySupplierInfoChange();
  };

  const getSupplierInfoChangeValue = (field: string): SupplierInfoChangeValue => {
    return getSupplierInfoChangeValueFrom(formData[field]);
  };

  const updateCustomerRow = (
    field: string,
    section: 'bankAccounts' | 'invoiceInfos',
    rowIndex: number,
    key: string,
    value: string,
  ) => {
    handleInputChange(field, (currentValue: unknown) => {
      const currentFieldValue = getCustomerInfoChangeValueFrom(currentValue);
      return {
        ...currentFieldValue,
        [section]: currentFieldValue[section].map((row, index) => (
          index === rowIndex ? { ...row, [key]: value } : row
        )),
      };
    });
  };

  const addCustomerRow = (field: string, section: 'bankAccounts' | 'invoiceInfos') => {
    const nextRow = section === 'bankAccounts'
      ? createEmptyCustomerBankAccount()
      : createEmptyCustomerInvoiceInfo();
    handleInputChange(field, (currentValue: unknown) => {
      const currentFieldValue = getCustomerInfoChangeValueFrom(currentValue);
      return {
        ...currentFieldValue,
        [section]: [...currentFieldValue[section], nextRow],
      };
    });
  };

  const removeCustomerRow = (field: string, section: 'bankAccounts' | 'invoiceInfos', rowIndex: number) => {
    const fallbackRow = section === 'bankAccounts'
      ? createEmptyCustomerBankAccount()
      : createEmptyCustomerInvoiceInfo();
    handleInputChange(field, (currentValue: unknown) => {
      const currentFieldValue = getCustomerInfoChangeValueFrom(currentValue);
      const rows = currentFieldValue[section].filter((_, index) => index !== rowIndex);
      return {
        ...currentFieldValue,
        [section]: rows.length > 0 ? rows : [fallbackRow],
      };
    });
  };

  const updateSupplierRow = (
    field: string,
    section: 'roleServices' | 'bankAccounts' | 'invoiceInfos',
    rowIndex: number,
    key: string,
    value: string,
  ) => {
    handleInputChange(field, (currentValue: unknown) => {
      const currentFieldValue = getSupplierInfoChangeValueFrom(currentValue);
      return {
        ...currentFieldValue,
        [section]: currentFieldValue[section].map((row, index) => (
          index === rowIndex ? { ...row, [key]: value } : row
        )),
      };
    });
  };

  const createEmptySupplierSectionRow = (section: 'roleServices' | 'bankAccounts' | 'invoiceInfos') => {
    if (section === 'roleServices') return createEmptySupplierRoleService();
    if (section === 'bankAccounts') return createEmptyCustomerBankAccount();
    return createEmptyCustomerInvoiceInfo();
  };

  const addSupplierRow = (field: string, section: 'roleServices' | 'bankAccounts' | 'invoiceInfos') => {
    handleInputChange(field, (currentValue: unknown) => {
      const currentFieldValue = getSupplierInfoChangeValueFrom(currentValue);
      return {
        ...currentFieldValue,
        [section]: [
          ...currentFieldValue[section],
          createEmptySupplierSectionRow(section),
        ],
      };
    });
  };

  const removeSupplierRow = (field: string, section: 'roleServices' | 'bankAccounts' | 'invoiceInfos', rowIndex: number) => {
    handleInputChange(field, (currentValue: unknown) => {
      const currentFieldValue = getSupplierInfoChangeValueFrom(currentValue);
      const rows = currentFieldValue[section].filter((_, index) => index !== rowIndex);
      return {
        ...currentFieldValue,
        [section]: rows.length > 0 ? rows : [createEmptySupplierSectionRow(section)],
      };
    });
  };

  const renderCustomerAttachmentInput = (
    field: string,
    section: 'businessLicense' | 'bankVoucher',
    label: string,
  ) => {
    const value = getCustomerInfoChangeValue(field);
    const attachments = value[section];
    const uploadKey = `${field}.${section}`;
    const isUploading = !!uploadingFields[uploadKey];

    return (
      <div className="rounded-2xl border border-border-silver bg-white p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-[14px] font-bold text-midnight-graphite">{label}</p>
            <p className="text-[12px] font-semibold text-light-gray mt-1">
              {attachments.length > 0 ? attachments.map((file) => file.name).join('、') : '未上传附件'}
            </p>
          </div>
          <label className={cn(
            "h-10 px-4 rounded-lg bg-black text-white text-[13px] font-bold cursor-pointer hover:bg-zinc-800 transition-all flex items-center justify-center gap-2",
            isUploading && "pointer-events-none opacity-60",
          )}>
            <Upload size={14} />
            {isUploading ? '上传中' : '选择附件'}
            <input
              type="file"
              className="sr-only"
              multiple
              onChange={(event) => {
                const fileList = event.currentTarget.files;
                void handleCustomerAttachmentUpload(field, section, fileList);
                event.currentTarget.value = '';
              }}
            />
          </label>
        </div>
      </div>
    );
  };

  const renderCustomerEditableTable = (
    field: string,
    section: 'bankAccounts' | 'invoiceInfos',
    title: string,
    columns: Array<{ key: string | number; label: string; placeholder: string }>,
  ) => {
    const rows = getCustomerInfoChangeValue(field)[section];
    const gridTemplate = section === 'bankAccounts'
      ? "grid-cols-[1fr_1fr_1.2fr_1.3fr_52px]"
      : "grid-cols-[0.9fr_1.3fr_1fr_1.6fr_1.5fr_52px]";
    const minWidth = section === 'bankAccounts' ? "min-w-[760px]" : "min-w-[1040px]";

    return (
      <div className="rounded-2xl border border-border-silver bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-border-silver flex items-center justify-between bg-pure-white">
          <p className="text-[14px] font-bold text-midnight-graphite">{title}</p>
          <button
            type="button"
            onClick={() => addCustomerRow(field, section)}
            className="h-8 px-3 rounded-lg bg-canvas-white text-action-blue text-[12px] font-bold hover:bg-lightest-gray-background flex items-center gap-1.5"
          >
            <Plus size={13} strokeWidth={3} />
            添加
          </button>
        </div>
        <div className="overflow-x-auto no-scrollbar">
          <div style={{ minWidth }}>
            <div className={cn("grid border-b border-border-silver bg-canvas-white", gridTemplate)}>
              {columns.map((column) => (
                <div key={column.key} className="px-3 py-3 text-[12px] font-bold text-medium-gray">
                  {column.label}
                </div>
              ))}
              <div className="px-3 py-3 text-[12px] font-bold text-medium-gray text-center">操作</div>
            </div>
            {rows.map((row, rowIndex) => (
              <div key={rowIndex} className={cn("grid border-b border-border-silver last:border-b-0", gridTemplate)}>
                {columns.map((column) => (
                  <div key={column.key} className="p-2">
                    <input
                      value={row[String(column.key)]}
                      onChange={(event) => updateCustomerRow(field, section, rowIndex, String(column.key), event.target.value)}
                      className="w-full h-10 px-2 bg-canvas-white border border-transparent focus:border-interactive-blue outline-none text-[13px] font-semibold"
                      placeholder={column.placeholder}
                    />
                  </div>
                ))}
                <div className="p-2 flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => removeCustomerRow(field, section, rowIndex)}
                    className="w-9 h-9 flex items-center justify-center rounded-full text-light-gray hover:text-rose-500 hover:bg-[#ffebee] transition-colors"
                    title="删除"
                  >
                    <X size={16} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderCustomerInfoChangeInput = (field: string) => {
    return (
      <div className={cn(
        "space-y-4 rounded-[24px] border border-border-silver bg-canvas-white p-4",
        errors[field] && "border-rose-500",
      )}>
        {renderCustomerAttachmentInput(field, 'businessLicense', '营业执照')}
        {renderCustomerEditableTable(field, 'bankAccounts', '银行账户', customerBankAccountColumns)}
        {renderCustomerAttachmentInput(field, 'bankVoucher', '银行凭证')}
        {renderCustomerEditableTable(field, 'invoiceInfos', '开票信息', customerInvoiceInfoColumns)}
      </div>
    );
  };

  const renderSupplierEditableTable = (
    field: string,
    section: 'roleServices' | 'bankAccounts' | 'invoiceInfos',
    title: string,
    columns: Array<{ key: string | number; label: string; placeholder: string }>,
  ) => {
    const rows = getSupplierInfoChangeValue(field)[section];
    const gridTemplate = section === 'roleServices'
      ? "grid-cols-[1fr_2fr_52px]"
      : (section === 'bankAccounts' ? "grid-cols-[1fr_1fr_1.2fr_1.3fr_52px]" : "grid-cols-[0.9fr_1.3fr_1fr_1.6fr_1.5fr_52px]");
    const minWidth = section === 'roleServices'
      ? "min-w-[520px]"
      : (section === 'bankAccounts' ? "min-w-[760px]" : "min-w-[1040px]");

    return (
      <div className="rounded-2xl border border-border-silver bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-border-silver flex items-center justify-between bg-pure-white">
          <p className="text-[14px] font-bold text-midnight-graphite">{title}</p>
          <button
            type="button"
            onClick={() => addSupplierRow(field, section)}
            className="h-8 px-3 rounded-lg bg-canvas-white text-action-blue text-[12px] font-bold hover:bg-lightest-gray-background flex items-center gap-1.5"
          >
            <Plus size={13} strokeWidth={3} />
            添加
          </button>
        </div>
        <div className="overflow-x-auto no-scrollbar">
          <div className={minWidth}>
            <div className={cn("grid border-b border-border-silver bg-canvas-white", gridTemplate)}>
              {columns.map((column) => (
                <div key={column.key} className="px-3 py-3 text-[12px] font-bold text-medium-gray">
                  {column.label}
                </div>
              ))}
              <div className="px-3 py-3 text-[12px] font-bold text-medium-gray text-center">操作</div>
            </div>
            {rows.map((row, rowIndex) => (
              <div key={rowIndex} className={cn("grid border-b border-border-silver last:border-b-0", gridTemplate)}>
                {columns.map((column) => (
                  <div key={column.key} className="p-2">
                    <input
                      value={row[String(column.key)]}
                      onChange={(event) => updateSupplierRow(field, section, rowIndex, String(column.key), event.target.value)}
                      className="w-full h-10 px-2 bg-canvas-white border border-transparent focus:border-interactive-blue outline-none text-[13px] font-semibold"
                      placeholder={column.placeholder}
                    />
                  </div>
                ))}
                <div className="p-2 flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => removeSupplierRow(field, section, rowIndex)}
                    className="w-9 h-9 flex items-center justify-center rounded-full text-light-gray hover:text-rose-500 hover:bg-[#ffebee] transition-colors"
                    title="删除"
                  >
                    <X size={16} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderSupplierInfoChangeInput = (field: string) => {
    return (
      <div className={cn(
        "space-y-4 rounded-[24px] border border-border-silver bg-canvas-white p-4",
        errors[field] && "border-rose-500",
      )}>
        {renderSupplierEditableTable(field, 'roleServices', '角色与服务', supplierRoleServiceColumns)}
        {renderSupplierEditableTable(field, 'bankAccounts', '银行账户', customerBankAccountColumns)}
        {renderSupplierEditableTable(field, 'invoiceInfos', '开票信息', customerInvoiceInfoColumns)}
      </div>
    );
  };

  const updateSupplierQuotationRow = (
    field: string,
    rowIndex: number,
    key: string,
    value: string,
  ) => {
    handleInputChange(field, (currentValue: unknown) => {
      const currentFieldValue = getSupplierQuotationInfoValueFrom(currentValue);
      return {
        ...currentFieldValue,
        quotationRows: currentFieldValue.quotationRows.map((row, index) => (
          index === rowIndex ? { ...row, [key]: value } : row
        )),
      };
    });
  };

  const addSupplierQuotationRow = (field: string) => {
    handleInputChange(field, (currentValue: unknown) => {
      const currentFieldValue = getSupplierQuotationInfoValueFrom(currentValue);
      return {
        ...currentFieldValue,
        quotationRows: [
          ...currentFieldValue.quotationRows,
          createEmptySupplierQuotationRow(),
        ],
      };
    });
  };

  const removeSupplierQuotationRow = (field: string, rowIndex: number) => {
    handleInputChange(field, (currentValue: unknown) => {
      const currentFieldValue = getSupplierQuotationInfoValueFrom(currentValue);
      const rows = currentFieldValue.quotationRows.filter((_, index) => index !== rowIndex);
      return {
        ...currentFieldValue,
        quotationRows: rows.length > 0 ? rows : [createEmptySupplierQuotationRow()],
      };
    });
  };

  const renderSupplierQuotationInfoInput = (field: string) => {
    const value = getSupplierQuotationInfoValue(field);
    const uploadKey = `${field}.attachments`;
    const isUploading = !!uploadingFields[uploadKey];
    const fileValue = value.attachments.map((file) => file.name).join('、');

    return (
      <div className={cn(
        "rounded-[24px] border border-border-silver bg-canvas-white overflow-hidden",
        errors[field] && "border-rose-500",
      )}>
        <div className="overflow-x-auto no-scrollbar">
          <div className="min-w-[1480px]">
            <div className="grid grid-cols-[1fr_1fr_1fr_0.8fr_0.8fr_0.8fr_1fr_1.1fr_0.8fr_1.1fr_1fr_52px] border-b border-border-silver bg-pure-white">
              {supplierQuotationColumns.map((column) => (
                <div key={column.key} className="px-3 py-3 text-[12px] font-bold text-medium-gray">
                  {column.label}
                </div>
              ))}
              <div className="px-3 py-3 text-[12px] font-bold text-medium-gray text-center">操作</div>
            </div>

            {value.quotationRows.map((row, rowIndex) => (
              <div key={rowIndex} className="grid grid-cols-[1fr_1fr_1fr_0.8fr_0.8fr_0.8fr_1fr_1.1fr_0.8fr_1.1fr_1fr_52px] border-b border-border-silver bg-white last:border-b-0">
                {supplierQuotationColumns.map((column) => (
                  <div key={column.key} className="p-2">
                    <input
                      value={row[column.key]}
                      onChange={(event) => updateSupplierQuotationRow(field, rowIndex, String(column.key), event.target.value)}
                      className="w-full h-10 px-2 bg-canvas-white border border-transparent focus:border-interactive-blue outline-none text-[13px] font-semibold"
                      placeholder={column.placeholder}
                    />
                  </div>
                ))}
                <div className="p-2 flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => removeSupplierQuotationRow(field, rowIndex)}
                    className="w-9 h-9 flex items-center justify-center rounded-full text-light-gray hover:text-rose-500 hover:bg-[#ffebee] transition-colors"
                    title="删除报价明细"
                  >
                    <X size={16} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => addSupplierQuotationRow(field)}
          className="w-full h-12 bg-pure-white text-action-blue text-[13px] font-bold hover:bg-lightest-gray-background transition-colors flex items-center justify-center gap-2 border-t border-border-silver"
        >
          <Plus size={15} strokeWidth={3} />
          添加报价明细
        </button>

        <div className="px-4 py-4 border-t border-border-silver bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[14px] font-bold text-midnight-graphite">报价附件</p>
            <p className="text-[12px] font-semibold text-light-gray mt-1 truncate">
              {fileValue || '未上传附件'}
            </p>
          </div>
          <label className={cn(
            "h-10 px-4 rounded-lg bg-black text-white text-[13px] font-bold cursor-pointer hover:bg-zinc-800 transition-all flex items-center justify-center gap-2",
            isUploading && "pointer-events-none opacity-60",
          )}>
            <Upload size={14} />
            {isUploading ? '上传中' : '选择附件'}
            <input
              type="file"
              className="sr-only"
              multiple
              onChange={(event) => {
                const fileList = event.currentTarget.files;
                void handleSupplierQuotationAttachmentUpload(field, fileList);
                event.currentTarget.value = '';
              }}
            />
          </label>
        </div>
      </div>
    );
  };

  const renderProjectCargoChangeInput = (field: string) => {
    const value = isProjectCargoChangeValue(formData[field])
      ? formData[field]
      : createEmptyProjectCargoChange();

    const renderSelect = (key: keyof ProjectCargoChangeValue) => (
      <div className="flex flex-col gap-2">
        <span className="text-[12px] font-bold text-medium-gray">{key}</span>
        <select
          className={cn(
            "input-field border-b border-border-silver focus:border-interactive-blue transition-colors",
            !value[key] && "text-light-gray",
            errors[field] && "border-rose-500"
          )}
          value={value[key]}
          onChange={(event) => handleInputChange(field, {
            ...value,
            [key]: event.target.value,
          })}
        >
          <option value="">请选择</option>
          {projectCargoOptions.map(option => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </div>
    );

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {renderSelect('销售项目货')}
        {renderSelect('客服项目货')}
      </div>
    );
  };

  const getStructuredDetailColumns = (field: string): StructuredDetailColumn[] => {
    const configuredColumns = getConfiguredDetailColumns(selectedType, field);
    if (configuredColumns.length > 0) return configuredColumns as StructuredDetailColumn[];

    if (selectedModule?.name !== '资金' || field !== '明细') return [];
    if (selectedType?.name === '批量修改') return batchModifyDetailColumns as StructuredDetailColumn[];
    if (selectedType?.name === '资金减免') return fundsReductionDetailColumns as StructuredDetailColumn[];
    return [];
  };

  const createEmptyStructuredDetail = (field: string) => {
    const columns = getStructuredDetailColumns(field);
    if (columns.length > 0) return createEmptyDetailRow(columns);
    return {};
  };

  const isStructuredDetailField = (field: string) => {
    return getStructuredDetailColumns(field).length > 0;
  };

  const getStructuredDetailsFromValue = (
    field: string,
    value: unknown,
  ): Array<Record<string, string>> => {
    return Array.isArray(value) && value.length > 0 ? value : [createEmptyStructuredDetail(field)];
  };

  const getStructuredDetails = (field: string): Array<Record<string, string>> => {
    return getStructuredDetailsFromValue(field, formData[field]);
  };

  const updateStructuredDetail = (
    field: string,
    rowIndex: number,
    key: string,
    value: string,
  ) => {
    const columns = getStructuredDetailColumns(field);
    handleInputChange(field, (currentValue: unknown) => (
      getStructuredDetailsFromValue(field, currentValue).map((row, index) => (
        index === rowIndex ? fillStructuredDetailDuration({ ...row, [key]: value }, columns) : row
      ))
    ));
  };

  const addStructuredDetail = (field: string) => {
    handleInputChange(field, (currentValue: unknown) => [
      ...getStructuredDetailsFromValue(field, currentValue),
      createEmptyStructuredDetail(field),
    ]);
  };

  const removeStructuredDetail = (field: string, rowIndex: number) => {
    handleInputChange(field, (currentValue: unknown) => {
      const rows = getStructuredDetailsFromValue(field, currentValue).filter((_, index) => index !== rowIndex);
      return rows.length > 0 ? rows : [createEmptyStructuredDetail(field)];
    });
  };

  const fillStructuredDetailDuration = (
    row: Record<string, string>,
    columns: ReturnType<typeof getStructuredDetailColumns>,
  ) => {
    const startColumn = columns.find((column) => /开始/.test(column.label));
    const endColumn = columns.find((column) => /结束/.test(column.label));
    const durationColumn = columns.find((column) => /时长/.test(column.label));
    if (!startColumn || !endColumn || !durationColumn) return row;

    return {
      ...row,
      [durationColumn.key]: calculateDurationValue(
        row[startColumn.key],
        row[endColumn.key],
        durationColumn.unit || 'hours',
      ),
    };
  };

  const getAiFieldKind = (field: string): AiFormFillField['kind'] => {
    if (isUploadOnlyField(selectedType, field)) return 'upload';
    if (isConfiguredFileField(selectedType, field)) return 'file';
    if (isStructuredDetailField(field)) return 'detail';
    if (getConfiguredDurationRule(selectedType, field)) return 'duration';
    if (isConfiguredMoneyField(selectedType, field)) return 'money';
    if (isConfiguredDateTimeField(selectedType, field)) return 'datetime';
    if (isConfiguredDateField(selectedType, field)) return 'date';
    if (getConfiguredSelectOptions(selectedType, field).length > 0) return 'select';
    if (isConfiguredMemberField(selectedType, field)) return 'member';
    if (isConfiguredDepartmentField(selectedType, field)) return 'department';
    if (isConfiguredMultilineField(selectedType, field)) return 'multiline';
    if (isConfiguredNumericField(selectedType, field)) return 'number';
    return 'text';
  };

  const getAiFieldOptions = (field: string, kind: AiFormFillField['kind']) => {
    if (kind === 'select') return getConfiguredSelectOptions(selectedType, field);
    if (kind === 'member') {
      const options = organizationOptions.members.flatMap((member) => [
        member.name,
        getMemberOptionLabel(member),
      ]).filter(Boolean);
      if (isTripCompanionField(selectedModule?.name, selectedType?.name, field)) {
        options.unshift(noCompanionOption.value);
      }
      return [...new Set(options)];
    }
    if (kind === 'department') return organizationOptions.departments.map((department) => department.name);
    return [];
  };

  const buildAiFormFillFields = (): AiFormFillField[] => {
    if (!selectedType) return [];

    return selectedType.businessFields.map((field) => {
      const kind = getAiFieldKind(field);
      const columns = kind === 'detail'
        ? getStructuredDetailColumns(field).map((column) => ({
            key: String(column.key),
            label: column.label,
            type: column.type,
            options: column.options,
            unit: column.unit,
          }))
        : undefined;

      return {
        name: field,
        kind,
        required: !isConfiguredOptionalField(selectedType, field),
        options: getAiFieldOptions(field, kind),
        columns,
      };
    });
  };

  const normalizeAiDetailCell = (
    value: unknown,
    column: ReturnType<typeof getStructuredDetailColumns>[number],
  ) => {
    if (column.type === 'member') return normalizeAiMemberValue(value, organizationOptions.members);

    const options = column.type === 'department'
        ? organizationOptions.departments.map((department) => department.name)
        : (column.options || []);

    return normalizeAiOptionFromList(value, options);
  };

  const normalizeAiStructuredDetails = (field: string, value: unknown) => {
    const columns = getStructuredDetailColumns(field);
    const rows = Array.isArray(value) ? value : [value];
    const normalizedRows = rows
      .filter(isPlainRecord)
      .map((row) => {
        const nextRow = createEmptyStructuredDetail(field) as Record<string, string>;
        columns.forEach((column) => {
          nextRow[String(column.key)] = normalizeAiDetailCell(
            row[String(column.key)] ?? row[column.label],
            column,
          );
        });
        return fillStructuredDetailDuration(nextRow, columns);
      })
      .filter((row) => Object.values(row).some((cell) => String(cell || '').trim()));

    return normalizedRows.length > 0 ? normalizedRows : undefined;
  };

  const normalizeAiFilledValue = (field: string, value: unknown) => {
    if (value === null || value === undefined || isUploadOnlyField(selectedType, field)) return undefined;

    if (isStructuredDetailField(field)) {
      return normalizeAiStructuredDetails(field, value);
    }

    if (isConfiguredFileField(selectedType, field)) {
      const currentValue = toFileFieldValue(formData[field]);
      return {
        ...currentValue,
        text: toAiFilledString(value),
      };
    }

    if (isConfiguredMoneyField(selectedType, field)) {
      const currentValue = toMoneyInputValue(formData[field]);
      if (isPlainRecord(value)) {
        return {
          currency: String(value.currency || currentValue.currency || 'CNY'),
          amount: toAiFilledString(value.amount ?? value.value ?? value.money),
        };
      }

      return {
        ...currentValue,
        amount: toAiFilledString(value),
      };
    }

    const selectOptions = getConfiguredSelectOptions(selectedType, field);
    if (selectOptions.length > 0) return normalizeAiOptionFromList(value, selectOptions);

    if (isConfiguredMemberField(selectedType, field)) {
      return normalizeAiMemberValue(value, organizationOptions.members);
    }

    if (isConfiguredDepartmentField(selectedType, field)) {
      return normalizeAiOptionFromList(value, organizationOptions.departments.map((department) => department.name));
    }

    if (isPlainRecord(value) && !isProjectCargoChangeField(field)) {
      return toAiFilledString(value);
    }

    return value;
  };

  const applyAiFilledValues = (values: Record<string, unknown>) => {
    if (!selectedType) return 0;
    const nextData = { ...formData };
    const filledFields: string[] = [];

    selectedType.businessFields.forEach((field) => {
      if (!Object.prototype.hasOwnProperty.call(values, field)) return;
      const normalizedValue = normalizeAiFilledValue(field, values[field]);
      if (normalizedValue === undefined) return;
      nextData[field] = normalizedValue;
      filledFields.push(field);
    });

    getConfiguredDurationRules(selectedType).forEach((rule) => {
      nextData[rule.field] = calculateConfiguredDurationValue(selectedType, rule, nextData);
    });

    if (filledFields.length > 0) {
      setFormData(nextData);
      setErrors((previousErrors) => {
        const nextErrors = { ...previousErrors };
        filledFields.forEach((field) => delete nextErrors[field]);
        return nextErrors;
      });
    }

    return filledFields.length;
  };

  const handleAiImageChange = (files: FileList | null) => {
    void files;
    setAiFillMessage('图片 AI 识别开发中');
    setAiFillMessageType('idle');
  };

  const clearAiImage = () => {
    setAiImageFile(null);
    setAiImagePreview('');
    setAiFillMessage('');
    setAiFillMessageType('idle');
  };

  const handleAiFill = async () => {
    if (!selectedModule || !selectedType || isAiFilling) return;

    const text = aiFillText.trim();
    if (aiFillMode === 'image') {
      setAiFillMessage('图片 AI 识别开发中');
      setAiFillMessageType('idle');
      return;
    }

    if (aiFillMode === 'text' && !text) {
      setAiFillMessage('先输入要识别的内容');
      setAiFillMessageType('error');
      return;
    }

    if (aiFillMode === 'image' && !aiImageFile) {
      setAiFillMessage('先选择一张图片');
      setAiFillMessageType('error');
      return;
    }

    setIsAiFilling(true);
    setAiFillMessage('正在识别表单内容');
    setAiFillMessageType('idle');

    try {
      const image = aiFillMode === 'image' && aiImageFile
        ? {
            name: aiImageFile.name,
            type: aiImageFile.type || 'image/png',
            size: aiImageFile.size,
            data: await readFileAsDataUrl(aiImageFile),
          }
        : null;
      const response = await storage.fillApprovalFormWithAi({
        moduleName: selectedModule.name,
        approvalTypeName: selectedType.name,
        text,
        image,
        fields: buildAiFormFillFields(),
      });
      const filledCount = applyAiFilledValues(response.values || {});
      const warningText = response.warnings?.length ? `；${response.warnings.join('；')}` : '';
      setAiFillMessage(filledCount > 0
        ? `${response.summary || `已填写 ${filledCount} 个字段`}${warningText}`
        : '没有识别到能填写的字段');
      setAiFillMessageType(filledCount > 0 ? 'success' : 'error');
    } catch (error) {
      setAiFillMessage(error instanceof Error ? error.message : 'AI识别失败，请稍后再试');
      setAiFillMessageType('error');
    } finally {
      setIsAiFilling(false);
    }
  };

  const renderStructuredDetailCell = (
    field: string,
    rowIndex: number,
    row: Record<string, string>,
    column: ReturnType<typeof getStructuredDetailColumns>[number],
  ) => {
    const value = row[column.key] || '';
    const isDurationColumn = /时长/.test(column.label);
    const commonClassName = "w-full h-10 px-2 bg-canvas-white border border-transparent focus:border-interactive-blue outline-none text-[13px] font-semibold";

    if (column.type === 'select') {
      return (
        <select
          value={value}
          onChange={(event) => updateStructuredDetail(field, rowIndex, String(column.key), event.target.value)}
          className={commonClassName}
        >
          <option value="">请选择</option>
          {(column.options || []).map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      );
    }

    if (column.type === 'member') {
      const memberOptions = getMemberSelectOptions(organizationOptions.members);

      return (
        <SearchableSingleSelect
          value={value}
          options={memberOptions}
          placeholder={organizationOptions.members.length > 0 ? '搜索人员' : '暂无人员'}
          emptyText="没有找到人员"
          onChange={(nextValue) => updateStructuredDetail(field, rowIndex, String(column.key), nextValue)}
          icon={<UserRound size={14} strokeWidth={2.5} />}
          inputClassName={commonClassName}
        />
      );
    }

    if (column.type === 'department') {
      return (
        <select
          value={value}
          onChange={(event) => updateStructuredDetail(field, rowIndex, String(column.key), event.target.value)}
          className={commonClassName}
        >
          <option value="">{organizationOptions.departments.length > 0 ? '请选择部门' : '暂无部门'}</option>
          {organizationOptions.departments.map((department) => (
            <option key={department.id} value={department.name}>{department.name}</option>
          ))}
        </select>
      );
    }

    return (
      <input
        type={column.type === 'datetime' ? 'datetime-local' : column.type === 'date' ? 'date' : column.type === 'number' ? 'number' : 'text'}
        inputMode={column.type === 'number' ? 'decimal' : undefined}
        step={column.type === 'number' ? '0.01' : undefined}
        value={value}
        readOnly={isDurationColumn}
        onChange={(event) => updateStructuredDetail(field, rowIndex, String(column.key), event.target.value)}
        className={cn(commonClassName, isDurationColumn && "text-medium-gray")}
        placeholder={column.placeholder}
      />
    );
  };

  const renderStructuredDetailInput = (field: string) => {
    const columns = getStructuredDetailColumns(field);
    const rows = getStructuredDetails(field);
    const columnCount = Math.max(columns.length, 1);
    const gridTemplate = {
      gridTemplateColumns: `repeat(${columnCount}, minmax(150px, 1fr)) 52px`,
    };
    const minWidth = `${Math.max(620, columnCount * 170 + 52)}px`;

    return (
      <div className={cn(
        "border border-border-silver bg-canvas-white overflow-hidden",
        errors[field] && "border-rose-500",
      )}>
        <div className="overflow-x-auto no-scrollbar">
          <div className={minWidth}>
            <div className="grid border-b border-border-silver bg-pure-white" style={gridTemplate}>
              {columns.map((column) => (
                <div key={column.key} className="px-3 py-3 text-[12px] font-bold text-medium-gray">
                  {column.label}
                </div>
              ))}
              <div className="px-3 py-3 text-[12px] font-bold text-medium-gray text-center">操作</div>
            </div>

            {rows.map((row, rowIndex) => (
              <div key={rowIndex} className="grid border-b border-border-silver last:border-b-0 bg-white" style={gridTemplate}>
                {columns.map((column) => (
                  <div key={column.key} className="p-2">
                    {renderStructuredDetailCell(field, rowIndex, row, column)}
                  </div>
                ))}
                <div className="p-2 flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => removeStructuredDetail(field, rowIndex)}
                    className="w-9 h-9 flex items-center justify-center rounded-full text-light-gray hover:text-rose-500 hover:bg-[#ffebee] transition-colors"
                    title="删除明细"
                  >
                    <X size={16} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => addStructuredDetail(field)}
          className="w-full h-12 bg-pure-white text-action-blue text-[13px] font-bold hover:bg-lightest-gray-background transition-colors flex items-center justify-center gap-2"
        >
          <Plus size={15} strokeWidth={3} />
          <Table2 size={15} strokeWidth={2.5} />
          添加{field}
        </button>
      </div>
    );
  };

  const renderFieldInput = (field: string) => {
    if (isCustomerInfoChangeField(field)) {
      return renderCustomerInfoChangeInput(field);
    }

    if (isSupplierInfoChangeField(field)) {
      return renderSupplierInfoChangeInput(field);
    }

    if (isSupplierQuotationInfoField(field)) {
      return renderSupplierQuotationInfoInput(field);
    }

    if (isProjectCargoChangeField(field)) {
      return renderProjectCargoChangeInput(field);
    }

    if (isStructuredDetailField(field)) {
      return renderStructuredDetailInput(field);
    }

    const isDate = isConfiguredDateField(selectedType, field);
    const isDateTime = isConfiguredDateTimeField(selectedType, field);
    const isMoney = isConfiguredMoneyField(selectedType, field);
    const isNumeric = isConfiguredNumericField(selectedType, field);
    const durationRule = getConfiguredDurationRule(selectedType, field);
    const isUploadOnly = isUploadOnlyField(selectedType, field);
    const selectOptions = getConfiguredSelectOptions(selectedType, field);
    const isMemberField = isConfiguredMemberField(selectedType, field);
    const isDepartmentField = isConfiguredDepartmentField(selectedType, field);
    const isMultilineField = isConfiguredMultilineField(selectedType, field);

    if (durationRule) {
      return (
        <div className="relative">
          <input
            type="text"
            readOnly
            className={cn(
              "input-field border-b border-border-silver bg-lightest-gray-background pr-11 text-medium-gray focus:border-interactive-blue transition-colors",
              errors[field] && "border-rose-500"
            )}
            placeholder={`${durationRule.startField} 和 ${durationRule.endField} 填完后自动计算`}
            value={formData[field] || ''}
          />
          <Calculator className="absolute right-4 top-1/2 -translate-y-1/2 text-light-silver w-4 h-4 pointer-events-none" />
        </div>
      );
    }

    if (selectOptions.length > 0) {
      return (
        <div className="relative">
          <select
            className={cn(
              "input-field border-b border-border-silver pr-11 focus:border-interactive-blue transition-colors",
              !formData[field] && "text-light-gray",
              errors[field] && "border-rose-500"
            )}
            value={formData[field]}
            onChange={(event) => handleInputChange(field, event.target.value)}
          >
            <option value="">请选择{field}</option>
            {selectOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <ListChecks className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-light-silver pointer-events-none" />
        </div>
      );
    }

    if (isMemberField) {
      const memberOptions = getMemberSelectOptions(organizationOptions.members, {
        includeNoCompanionOption: isTripCompanionField(selectedModule?.name, selectedType?.name, field),
      });

      return (
        <SearchableSingleSelect
          value={String(formData[field] || '')}
          options={memberOptions}
          placeholder={organizationOptions.members.length > 0 ? `搜索${field}` : '暂无可选人员'}
          emptyText="没有找到人员"
          onChange={(nextValue) => handleInputChange(field, nextValue)}
          icon={<UserRound size={16} strokeWidth={2.5} />}
          hasError={Boolean(errors[field])}
        />
      );
    }

    if (isDepartmentField) {
      return (
        <div className="relative">
          <select
            className={cn(
              "input-field border-b border-border-silver pr-11 focus:border-interactive-blue transition-colors",
              !formData[field] && "text-light-gray",
              errors[field] && "border-rose-500"
            )}
            value={formData[field]}
            onChange={(event) => handleInputChange(field, event.target.value)}
          >
            <option value="">{organizationOptions.departments.length > 0 ? `请选择${field}` : '暂无可选部门'}</option>
            {organizationOptions.departments.map((department) => (
              <option key={department.id} value={department.name}>{department.name}</option>
            ))}
          </select>
          <Building2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-light-silver pointer-events-none" />
        </div>
      );
    }

    if (isMultilineField) {
      return (
        <div className="relative">
          <textarea
            className={cn(
              "input-field min-h-[120px] resize-y border-b border-border-silver py-3 pr-11 leading-7 focus:border-interactive-blue transition-colors",
              errors[field] && "border-rose-500"
            )}
            placeholder={`输入${field}`}
            value={formData[field]}
            onChange={(event) => handleInputChange(field, event.target.value)}
          />
          <AlignLeft className="absolute right-4 top-5 h-4 w-4 text-light-silver pointer-events-none" />
        </div>
      );
    }

    if (isConfiguredFileField(selectedType, field)) {
      const fileValue = toFileFieldValue(formData[field]);
      const attachmentNames = fileValue.attachments.map(file => file.name).join('、');
      const uploadKey = `${field}.attachments`;
      const isUploading = !!uploadingFields[uploadKey];

      return (
        <div className="space-y-3">
          <input
            type="text"
            className={cn(
              "input-field border-b border-border-silver focus:border-interactive-blue transition-colors",
              errors[field] && "border-rose-500"
            )}
            placeholder="输入备注"
            value={fileValue.text}
            onChange={(event) => handleInputChange(field, {
              ...fileValue,
              text: event.target.value,
            })}
          />
          <div className={cn(
            "flex flex-col gap-3 rounded-xl border border-border-silver bg-canvas-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
            errors[field] && "border-rose-500",
          )}>
            <span className="min-w-0 truncate text-[13px] text-light-gray font-sf-pro-text">
              {attachmentNames || '未选择文件'}
            </span>
            <label className={cn(
              "btn-secondary h-[36px] shrink-0 px-4 py-0 text-[13px] cursor-pointer",
              isUploading && "pointer-events-none opacity-60",
            )}>
              <Upload size={14} /> {isUploading ? '上传中' : '选择文件'}
              <input
                type="file"
                className="sr-only"
                multiple
                onChange={(event) => {
                  const fileList = event.currentTarget.files;
                  void handleFileFieldUpload(field, fileList);
                  event.currentTarget.value = '';
                }}
              />
            </label>
          </div>
        </div>
      );
    }

    if (isUploadOnly) {
      const attachments = Array.isArray(formData[field])
        ? formData[field] as ApprovalAttachment[]
        : [];
      const fileValue = attachments.map(file => file.name).join('、');
      const isUploading = !!uploadingFields[field];

      return (
        <div className="flex items-center gap-4 py-2">
          <label className={cn(
            "btn-secondary h-[36px] px-4 py-0 text-[13px] cursor-pointer",
            isUploading && "pointer-events-none opacity-60",
          )}>
            <Upload size={14} /> {isUploading ? '上传中' : '选择文件'}
            <input
              type="file"
              className="sr-only"
              multiple
              onChange={(event) => {
                const fileList = event.currentTarget.files;
                void handleFileUpload(field, fileList);
                event.currentTarget.value = '';
              }}
            />
          </label>
          <span className="min-w-0 truncate text-[13px] text-light-gray font-sf-pro-text">
            {fileValue || '未选择文件'}
          </span>
        </div>
      );
    }

    if (isMoney) {
      const moneyValue = toMoneyInputValue(formData[field]);

      return (
        <div className={cn(
          "grid grid-cols-[110px_minmax(0,1fr)] gap-3 border-b border-border-silver focus-within:border-interactive-blue transition-colors",
          errors[field] && "border-rose-500"
        )}>
          <select
            value={moneyValue.currency}
            onChange={(event) => handleInputChange(field, {
              ...moneyValue,
              currency: event.target.value,
            })}
            className="h-12 bg-transparent outline-none text-[14px] font-bold text-midnight-graphite"
            aria-label={`${field}币种`}
          >
            {currencyOptions.map((currency) => (
              <option key={currency} value={currency}>{currency}</option>
            ))}
          </select>
          <div className="relative">
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              className="input-field border-0 px-0 pr-9 focus:border-transparent"
              placeholder={`输入${field}`}
              value={moneyValue.amount}
              onChange={(event) => handleInputChange(field, {
                ...moneyValue,
                amount: event.target.value,
              })}
            />
            <DollarSign className="absolute right-1 top-1/2 -translate-y-1/2 text-light-silver w-4 h-4" />
          </div>
        </div>
      );
    }

    if (durationRule) {
      return (
        <div className="relative">
          <input
            type="text"
            readOnly
            className={cn(
              "input-field border-b border-border-silver bg-lightest-gray-background pr-11 text-medium-gray focus:border-interactive-blue transition-colors",
              errors[field] && "border-rose-500"
            )}
            placeholder={`${durationRule.startField} 和 ${durationRule.endField} 填完后自动计算`}
            value={formData[field] || ''}
          />
          <Calculator className="absolute right-4 top-1/2 -translate-y-1/2 text-light-silver w-4 h-4 pointer-events-none" />
        </div>
      );
    }

    if (selectOptions.length > 0) {
      return (
        <div className="relative">
          <select
            className={cn(
              "input-field border-b border-border-silver focus:border-interactive-blue transition-colors",
              !formData[field] && "text-light-gray",
              errors[field] && "border-rose-500"
            )}
            value={formData[field] || ''}
            onChange={(event) => handleInputChange(field, event.target.value)}
          >
            <option value="">请选择{field}</option>
            {selectOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <ListChecks className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-light-silver pointer-events-none" />
        </div>
      );
    }

    if (isMemberField) {
      const memberOptions = getMemberSelectOptions(organizationOptions.members, {
        includeNoCompanionOption: isTripCompanionField(selectedModule?.name, selectedType?.name, field),
      });

      return (
        <SearchableSingleSelect
          value={String(formData[field] || '')}
          options={memberOptions}
          placeholder={organizationOptions.members.length > 0 ? `搜索${field}` : '暂无人员可选'}
          emptyText="没有找到人员"
          onChange={(nextValue) => handleInputChange(field, nextValue)}
          icon={<UserRound size={16} strokeWidth={2.5} />}
          hasError={Boolean(errors[field])}
        />
      );
    }

    if (isDepartmentField) {
      return (
        <div className="relative">
          <select
            className={cn(
              "input-field border-b border-border-silver focus:border-interactive-blue transition-colors",
              !formData[field] && "text-light-gray",
              errors[field] && "border-rose-500"
            )}
            value={formData[field] || ''}
            onChange={(event) => handleInputChange(field, event.target.value)}
          >
            <option value="">{organizationOptions.departments.length > 0 ? `请选择${field}` : '暂无部门可选'}</option>
            {organizationOptions.departments.map((department) => (
              <option key={department.id} value={department.name}>{department.name}</option>
            ))}
          </select>
          <Building2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-light-silver pointer-events-none" />
        </div>
      );
    }

    if (isMultilineField) {
      return (
        <div className="relative">
          <textarea
            className={cn(
              "input-field min-h-[120px] resize-y border-b border-border-silver py-3 pr-11 leading-6 focus:border-interactive-blue transition-colors",
              errors[field] && "border-rose-500"
            )}
            placeholder={`输入${field}`}
            value={formData[field] || ''}
            onChange={(event) => handleInputChange(field, event.target.value)}
          />
          <AlignLeft className="absolute right-4 top-6 h-4 w-4 text-light-silver pointer-events-none" />
        </div>
      );
    }

    return (
      <div className="relative">
        <input
          type={isDateTime ? 'datetime-local' : isDate ? 'date' : (isNumeric ? 'number' : 'text')}
          inputMode={isNumeric ? 'decimal' : undefined}
          step={isNumeric ? '0.01' : undefined}
          className={cn(
            "input-field border-b border-border-silver focus:border-interactive-blue transition-colors",
            errors[field] && "border-rose-500"
          )}
          placeholder={`输入${field}`}
          value={formData[field]}
          onChange={(e) => handleInputChange(field, e.target.value)}
        />
        {isNumeric && <DollarSign className="absolute right-4 top-1/2 -translate-y-1/2 text-light-silver w-4 h-4" />}
        {isDate && <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 text-light-silver w-4 h-4 pointer-events-none" />}
        {isDateTime && <Clock3 className="absolute right-4 top-1/2 -translate-y-1/2 text-light-silver w-4 h-4 pointer-events-none" />}
      </div>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-midnight-graphite/40 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 20 }}
            className="bg-pure-white w-full max-w-5xl relative flex flex-col max-h-[90vh] shadow-apple-xl overflow-hidden"
          >
            <div className="px-10 py-8 border-b border-border-silver flex items-center justify-between">
              <div className="flex items-center gap-4 font-display">
                <Plus className="text-interactive-blue w-6 h-6" strokeWidth={3} />
                <h2 className="text-[24px] font-bold text-midnight-graphite tracking-tight">申请初始化</h2>
              </div>
              <button onClick={handleClose} className="w-10 h-10 flex items-center justify-center hover:bg-lightest-gray-background rounded-full transition-all text-medium-gray">
                <X size={20} strokeWidth={2} />
              </button>
            </div>

            <div className="px-10 py-6 flex items-center gap-6 border-b border-border-silver bg-canvas-white overflow-x-auto no-scrollbar">
              <div className={cn("flex items-center gap-2 shrink-0", step >= 1 ? "text-interactive-blue" : "text-light-gray")}>
                <span className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold border-2", step >= 1 ? "border-interactive-blue" : "border-light-gray")}>1</span>
                <span className="text-[13px] font-semibold whitespace-nowrap">模块选择</span>
              </div>
              <div className="w-8 h-px bg-border-silver shrink-0" />
              <div className={cn("flex items-center gap-2 shrink-0", step >= 2 ? "text-interactive-blue" : "text-light-gray")}>
                <span className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold border-2", step >= 2 ? "border-interactive-blue" : "border-light-gray")}>2</span>
                <span className="text-[13px] font-semibold whitespace-nowrap">业务类型</span>
              </div>
              <div className="w-8 h-px bg-border-silver shrink-0" />
              <div className={cn("flex items-center gap-2 shrink-0", step >= 3 ? "text-interactive-blue" : "text-light-gray")}>
                <span className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold border-2", step >= 3 ? "border-interactive-blue" : "border-light-gray")}>3</span>
                <span className="text-[13px] font-semibold whitespace-nowrap">信息录入</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-10 py-12 min-h-[400px]">
              {step === 1 && (
                <div className="space-y-4">
                  <p className="text-[14px] font-semibold text-medium-gray mb-6">选择目标业务模块</p>
                  <div className="grid grid-cols-1 gap-3">
                    {visibleModules.map(module => (
                      <button
                        key={module.name}
                        onClick={() => handleModuleSelect(module)}
                        className="flex items-center justify-between p-6 bg-canvas-white rounded-apple-img hover:bg-lightest-gray-background transition-all group border border-transparent hover:border-border-silver"
                      >
                        <div className="flex items-center gap-6">
                          <div className="w-12 h-12 rounded-full bg-pure-white flex items-center justify-center shadow-sm text-midnight-graphite">
                            <FileText size={20} strokeWidth={2} />
                          </div>
                          <div className="flex flex-col items-start">
                            <span className="text-[18px] font-bold text-midnight-graphite tracking-tight">{module.name}</span>
                            <span className="text-[13px] font-medium text-light-gray">系统功能分类</span>
                          </div>
                        </div>
                        <ChevronRight size={18} strokeWidth={2} className="text-light-silver group-hover:text-interactive-blue transition-colors" />
                      </button>
                    ))}
                    {visibleModules.length === 0 && (
                      <div className="rounded-2xl border border-border-silver bg-canvas-white p-8 text-center text-[13px] font-bold text-medium-gray">
                        暂无可发起的审批表单
                      </div>
                    )}
                  </div>
                </div>
              )}

              {step === 2 && selectedModule && (
                <div className="space-y-8 animate-in slide-in-from-right duration-500">
                  <div className="flex flex-col gap-1">
                    <p className="text-[14px] font-semibold text-medium-gray underline decoration-interactive-blue/30 underline-offset-4 decoration-2">已选模块：{selectedModule.name}</p>
                    <h3 className="text-[28px] font-bold text-midnight-graphite tracking-tight">业务类型选择</h3>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {selectedModule.approvalTypes.map(type => (
                      <button
                        key={type.name}
                        onClick={() => handleTypeSelect(type)}
                        className="flex items-center justify-between p-6 bg-canvas-white rounded-apple-img hover:bg-lightest-gray-background transition-all group border border-transparent hover:border-border-silver"
                      >
                        <span className="text-[18px] font-bold text-midnight-graphite tracking-tight">{type.name}</span>
                        <ChevronRight size={18} strokeWidth={2} className="text-light-silver group-hover:text-interactive-blue transition-colors" />
                      </button>
                    ))}
                  </div>
                  <button onClick={() => setStep(1)} className="text-[14px] font-semibold text-action-blue hover:underline mt-8">← 返回修改模块</button>
                </div>
              )}

              {step === 3 && selectedType && (
                <form onSubmit={handleSubmit} className="space-y-12 animate-in slide-in-from-right duration-500">
                  <div className="p-8 bg-midnight-graphite rounded-apple-img shadow-apple-xl">
                    <p className="text-[13px] font-semibold text-light-gray/60 uppercase tracking-widest mb-2">当前路径</p>
                    <p className="text-[21px] font-bold text-pure-white tracking-tight">
                      {selectedModule?.name} / {selectedType.name}
                    </p>
                  </div>
                  
                  <AiFormFillPanel
                    isOpen={aiPanelOpen}
                    mode={aiFillMode}
                    text={aiFillText}
                    imageFile={aiImageFile}
                    imagePreview={aiImagePreview}
                    message={aiFillMessage}
                    messageType={aiFillMessageType}
                    isLoading={isAiFilling}
                    onToggle={() => setAiPanelOpen((current) => !current)}
                    onModeChange={setAiFillMode}
                    onTextChange={(nextText) => {
                      setAiFillText(nextText);
                      if (aiFillMessageType === 'error') {
                        setAiFillMessage('');
                        setAiFillMessageType('idle');
                      }
                    }}
                    onImageChange={handleAiImageChange}
                    onClearImage={clearAiImage}
                    onSubmit={() => {
                      void handleAiFill();
                    }}
                  />

                  <div className="grid grid-cols-1 gap-10">
                    {selectedType.businessFields.map(field => (
                      <div key={field} className="space-y-3">
                        <label className="text-[15px] font-semibold text-midnight-graphite ml-1">
                          {!isConfiguredOptionalField(selectedType, field) && (
                            <span className="mr-1 align-middle text-rose-500">*</span>
                          )}
                          {field}
                        </label>
                        {renderFieldInput(field)}
                        {errors[field] && (
                          <p className="text-[13px] text-rose-500 font-medium ml-1">{errors[field]}</p>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="pt-10 flex flex-col gap-4">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="btn-primary w-full h-[52px] text-[17px] font-bold disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSubmitting && <Loader2 size={18} className="animate-spin" />}
                      确认初始化流程
                    </button>
                    <button type="button" onClick={() => setStep(2)} className="h-[52px] w-full text-[15px] font-semibold text-medium-gray hover:text-midnight-graphite">
                      返回并重选类型
                    </button>
                  </div>
                </form>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
