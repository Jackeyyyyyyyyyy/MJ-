import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronRight, Upload, Calendar, DollarSign, FileText, Plus } from 'lucide-react';
import { approvalSchema } from '../approvalSchema';
import { storage } from '../storage';
import { auth } from '../auth';
import { cn } from '../lib/utils';
import { ApprovalAttachment, Module, ApprovalType } from '../types';

interface CreateApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error(`读取文件失败：${file.name}`));
    reader.readAsDataURL(file);
  });
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
    type.businessFields.forEach(field => initialData[field] = '');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedModule || !selectedType || !user) return;

    const newErrors: Record<string, string> = {};
    selectedType.businessFields.forEach(field => {
      if (!formData[field]) {
        newErrors[field] = '必填项';
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    await storage.addRecord({
      moduleName: selectedModule.name,
      approvalTypeName: selectedType.name,
      businessData: formData,
      applicant: user.name
    });

    await onSuccess();
    handleClose();
  };

  const handleClose = () => {
    setStep(1);
    setSelectedModule(null);
    setSelectedType(null);
    setFormData({});
    setErrors({});
    onClose();
  };

  const renderFieldInput = (field: string) => {
    const isDate = field.includes('日期') || field.includes('时间');
    const isMoney = field.includes('金额') || field.includes('价格') || field.includes('利润') || field.includes('汇率');
    const isFile = field.includes('附件');
    const isSelect = field.includes('状态') || field.includes('类型') || field.includes('模式');

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

    if (isSelect) {
      return (
        <select 
          className="input-field border-b border-border-silver focus:border-interactive-blue"
          value={formData[field]}
          onChange={(e) => handleInputChange(field, e.target.value)}
        >
          <option value="">选择{field}</option>
          <option value="选项1">普通模式</option>
          <option value="选项2">加急模式</option>
          <option value="选项3">特殊申请</option>
        </select>
      );
    }

    return (
      <div className="relative">
        <input
          type={isDate ? 'date' : (isMoney ? 'number' : 'text')}
          className={cn(
            "input-field border-b border-border-silver focus:border-interactive-blue transition-colors",
            errors[field] && "border-rose-500"
          )}
          placeholder={`输入${field}`}
          value={formData[field]}
          onChange={(e) => handleInputChange(field, e.target.value)}
        />
        {isMoney && <DollarSign className="absolute right-4 top-1/2 -translate-y-1/2 text-light-silver w-4 h-4" />}
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
            className="bg-pure-white w-full max-w-2xl relative flex flex-col max-h-[90vh] shadow-apple-xl overflow-hidden"
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
