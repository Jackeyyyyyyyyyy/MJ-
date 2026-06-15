import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronRight, Upload, Calendar, DollarSign, FileText, Plus } from 'lucide-react';
import { approvalSchema } from '../approvalSchema';
import { storage } from '../storage';
import { auth } from '../auth';
import { cn } from '../lib/utils';
import { ApprovalAttachment, Module, ApprovalType } from '../types';

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
  return isConfiguredMoneyField(type, field) || field.includes('汇率');
}

function isConfiguredFileField(type: ApprovalType | null, field: string) {
  return Array.isArray(type?.fileFields) && type.fileFields.includes(field);
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

export default function CreateApprovalModal({ isOpen, onClose, onSuccess }: CreateApprovalModalProps) {
  const [step, setStep] = useState(1);
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);
  const [selectedType, setSelectedType] = useState<ApprovalType | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploadingFields, setUploadingFields] = useState<Record<string, boolean>>({});

  const user = auth.getCurrentUser();

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
      } else if (isConfiguredFileField(type, field)) {
        initialData[field] = createEmptyFileFieldValue();
      } else {
        initialData[field] = '';
      }
    });
    setFormData(initialData);
    setStep(3);
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      const newErrors = { ...errors };
      delete newErrors[field];
      setErrors(newErrors);
    }
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
      const currentValue = toFileFieldValue(formData[field]);
      handleInputChange(field, {
        ...currentValue,
        attachments: uploads,
      });
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
      const currentValue = getCustomerInfoChangeValue(field);
      handleInputChange(field, {
        ...currentValue,
        [section]: uploads,
      });
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
      const currentValue = getSupplierQuotationInfoValue(field);
      handleInputChange(field, {
        ...currentValue,
        attachments: uploads,
      });
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

    const newErrors: Record<string, string> = {};
    selectedType.businessFields.forEach(field => {
      const value = formData[field];
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

      if (!formData[field]) {
        newErrors[field] = '必填项';
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const payload = {
      moduleName: selectedModule.name,
      approvalTypeName: selectedType.name,
      businessData: formData,
      applicant: user.name
    };

    handleClose();

    storage.addRecord(payload)
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

  const getCustomerInfoChangeValue = (field: string): CustomerInfoChangeValue => {
    const value = formData[field];
    return isCustomerInfoChangeValue(value) ? value : createEmptyCustomerInfoChange();
  };

  const getSupplierQuotationInfoValue = (field: string): SupplierQuotationInfoValue => {
    const value = formData[field];
    return isSupplierQuotationInfoValue(value) ? value : createEmptySupplierQuotationInfo();
  };

  const getSupplierInfoChangeValue = (field: string): SupplierInfoChangeValue => {
    const value = formData[field];
    return isSupplierInfoChangeValue(value) ? value : createEmptySupplierInfoChange();
  };

  const updateCustomerRows = (
    field: string,
    section: 'bankAccounts' | 'invoiceInfos',
    rows: Array<CustomerBankAccountRow | CustomerInvoiceInfoRow>,
  ) => {
    handleInputChange(field, {
      ...getCustomerInfoChangeValue(field),
      [section]: rows,
    });
  };

  const updateCustomerRow = (
    field: string,
    section: 'bankAccounts' | 'invoiceInfos',
    rowIndex: number,
    key: string,
    value: string,
  ) => {
    const rows = getCustomerInfoChangeValue(field)[section].map((row, index) => (
      index === rowIndex ? { ...row, [key]: value } : row
    ));
    updateCustomerRows(field, section, rows);
  };

  const addCustomerRow = (field: string, section: 'bankAccounts' | 'invoiceInfos') => {
    const nextRow = section === 'bankAccounts'
      ? createEmptyCustomerBankAccount()
      : createEmptyCustomerInvoiceInfo();
    updateCustomerRows(field, section, [...getCustomerInfoChangeValue(field)[section], nextRow]);
  };

  const removeCustomerRow = (field: string, section: 'bankAccounts' | 'invoiceInfos', rowIndex: number) => {
    const rows = getCustomerInfoChangeValue(field)[section].filter((_, index) => index !== rowIndex);
    const fallbackRow = section === 'bankAccounts'
      ? createEmptyCustomerBankAccount()
      : createEmptyCustomerInvoiceInfo();
    updateCustomerRows(field, section, rows.length > 0 ? rows : [fallbackRow]);
  };

  const updateSupplierRows = (
    field: string,
    section: 'roleServices' | 'bankAccounts' | 'invoiceInfos',
    rows: Array<SupplierRoleServiceRow | CustomerBankAccountRow | CustomerInvoiceInfoRow>,
  ) => {
    handleInputChange(field, {
      ...getSupplierInfoChangeValue(field),
      [section]: rows,
    });
  };

  const updateSupplierRow = (
    field: string,
    section: 'roleServices' | 'bankAccounts' | 'invoiceInfos',
    rowIndex: number,
    key: string,
    value: string,
  ) => {
    const rows = getSupplierInfoChangeValue(field)[section].map((row, index) => (
      index === rowIndex ? { ...row, [key]: value } : row
    ));
    updateSupplierRows(field, section, rows);
  };

  const createEmptySupplierSectionRow = (section: 'roleServices' | 'bankAccounts' | 'invoiceInfos') => {
    if (section === 'roleServices') return createEmptySupplierRoleService();
    if (section === 'bankAccounts') return createEmptyCustomerBankAccount();
    return createEmptyCustomerInvoiceInfo();
  };

  const addSupplierRow = (field: string, section: 'roleServices' | 'bankAccounts' | 'invoiceInfos') => {
    updateSupplierRows(field, section, [
      ...getSupplierInfoChangeValue(field)[section],
      createEmptySupplierSectionRow(section),
    ]);
  };

  const removeSupplierRow = (field: string, section: 'roleServices' | 'bankAccounts' | 'invoiceInfos', rowIndex: number) => {
    const rows = getSupplierInfoChangeValue(field)[section].filter((_, index) => index !== rowIndex);
    updateSupplierRows(field, section, rows.length > 0 ? rows : [createEmptySupplierSectionRow(section)]);
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

  const updateSupplierQuotationRows = (field: string, rows: SupplierQuotationRow[]) => {
    handleInputChange(field, {
      ...getSupplierQuotationInfoValue(field),
      quotationRows: rows,
    });
  };

  const updateSupplierQuotationRow = (
    field: string,
    rowIndex: number,
    key: string,
    value: string,
  ) => {
    const rows = getSupplierQuotationInfoValue(field).quotationRows.map((row, index) => (
      index === rowIndex ? { ...row, [key]: value } : row
    ));
    updateSupplierQuotationRows(field, rows);
  };

  const addSupplierQuotationRow = (field: string) => {
    updateSupplierQuotationRows(field, [
      ...getSupplierQuotationInfoValue(field).quotationRows,
      createEmptySupplierQuotationRow(),
    ]);
  };

  const removeSupplierQuotationRow = (field: string, rowIndex: number) => {
    const rows = getSupplierQuotationInfoValue(field).quotationRows.filter((_, index) => index !== rowIndex);
    updateSupplierQuotationRows(field, rows.length > 0 ? rows : [createEmptySupplierQuotationRow()]);
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

  const getStructuredDetailColumns = (field: string) => {
    if (selectedModule?.name !== '资金' || field !== '明细') return [];
    if (selectedType?.name === '批量修改') return batchModifyDetailColumns;
    if (selectedType?.name === '资金减免') return fundsReductionDetailColumns;
    return [];
  };

  const createEmptyStructuredDetail = () => {
    if (selectedType?.name === '资金减免') return createEmptyFundsReductionDetail();
    return createEmptyBatchModifyDetail();
  };

  const isStructuredDetailField = (field: string) => {
    return getStructuredDetailColumns(field).length > 0;
  };

  const getStructuredDetails = (field: string): Array<Record<string, string>> => {
    const value = formData[field];
    return Array.isArray(value) && value.length > 0 ? value : [createEmptyStructuredDetail()];
  };

  const updateStructuredDetail = (
    field: string,
    rowIndex: number,
    key: string,
    value: string,
  ) => {
    const rows = getStructuredDetails(field).map((row, index) => (
      index === rowIndex ? { ...row, [key]: value } : row
    ));
    handleInputChange(field, rows);
  };

  const addStructuredDetail = (field: string) => {
    handleInputChange(field, [...getStructuredDetails(field), createEmptyStructuredDetail()]);
  };

  const removeStructuredDetail = (field: string, rowIndex: number) => {
    const rows = getStructuredDetails(field).filter((_, index) => index !== rowIndex);
    handleInputChange(field, rows.length > 0 ? rows : [createEmptyStructuredDetail()]);
  };

  const renderStructuredDetailInput = (field: string) => {
    const columns = getStructuredDetailColumns(field);
    const rows = getStructuredDetails(field);
    const gridTemplate = selectedType?.name === '资金减免'
      ? "grid-cols-[1.05fr_1fr_1fr_0.95fr_1fr_0.95fr_52px]"
      : "grid-cols-[1.05fr_1fr_1fr_0.9fr_1fr_0.95fr_1fr_52px]";
    const minWidth = selectedType?.name === '资金减免' ? "min-w-[840px]" : "min-w-[980px]";

    return (
      <div className={cn(
        "border border-border-silver bg-canvas-white overflow-hidden",
        errors[field] && "border-rose-500",
      )}>
        <div className="overflow-x-auto no-scrollbar">
          <div className={minWidth}>
            <div className={cn("grid border-b border-border-silver bg-pure-white", gridTemplate)}>
              {columns.map((column) => (
                <div key={column.key} className="px-3 py-3 text-[12px] font-bold text-medium-gray">
                  {column.label}
                </div>
              ))}
              <div className="px-3 py-3 text-[12px] font-bold text-medium-gray text-center">操作</div>
            </div>

            {rows.map((row, rowIndex) => (
              <div key={rowIndex} className={cn("grid border-b border-border-silver last:border-b-0 bg-white", gridTemplate)}>
                {columns.map((column) => (
                  <div key={column.key} className="p-2">
                    <input
                      type={column.type === 'number' ? 'number' : 'text'}
                      inputMode={column.type === 'number' ? 'decimal' : undefined}
                      value={row[column.key]}
                      onChange={(event) => updateStructuredDetail(field, rowIndex, String(column.key), event.target.value)}
                      className="w-full h-10 px-2 bg-canvas-white border border-transparent focus:border-interactive-blue outline-none text-[13px] font-semibold"
                      placeholder={column.placeholder}
                    />
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
          添加明细
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

    const isDate = field.includes('日期') || field.includes('时间');
    const isMoney = isConfiguredMoneyField(selectedType, field);
    const isNumeric = isConfiguredNumericField(selectedType, field);
    const isFile = field.includes('附件');

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
            placeholder={`输入${field}`}
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

    if (isFile) {
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

    return (
      <div className="relative">
        <input
          type={isDate ? 'date' : (isNumeric ? 'number' : 'text')}
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
                    {approvalSchema.modules.map(module => (
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
                  
                  <div className="grid grid-cols-1 gap-10">
                    {selectedType.businessFields.map(field => (
                      <div key={field} className="space-y-3">
                        <label className="text-[15px] font-semibold text-midnight-graphite ml-1">
                          {field}
                        </label>
                        {renderFieldInput(field)}
                        {errors[field] && (
                          <p className="text-[13px] text-rose-500 font-medium ml-1">该项为必填业务数据</p>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="pt-10 flex flex-col gap-4">
                    <button type="submit" className="btn-primary w-full h-[52px] text-[17px] font-bold">
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
