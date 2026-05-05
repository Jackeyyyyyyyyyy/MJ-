import React, { useState } from 'react';
import { auth } from '../auth';
import { cn } from '../lib/utils';
import { ShieldCheck, User as UserIcon, Layout } from 'lucide-react';
import { motion } from 'motion/react';

interface LoginPageProps {
  onLogin: () => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('123456');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const user = auth.login(username, password);
    if (user) {
      onLogin();
    } else {
      setError('认证失败：请核对身份标识或访问密钥');
    }
  };

  const accounts = [
    { id: 'applicant', label: '申请人', icon: UserIcon, desc: '提交及追踪单据' },
    { id: 'approver', label: '审核员', icon: ShieldCheck, desc: '流程审批与管控' },
    { id: 'boss', label: '老板', icon: Layout, desc: '全局监控与决策' },
  ];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#fafafa] font-sans antialiased text-midnight-graphite">
      <div className="w-full max-w-[360px] px-6">
        
        {/* Logo 极其简约 */}
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="flex flex-col items-center mb-16"
        >
          <h1 className="text-[24px] font-bold tracking-tight">MJ 审批</h1>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.99 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="space-y-12"
        >
          {/* 身份标识 - 极简图标 */}
          <div className="flex justify-center gap-10">
            {accounts.filter(a => a.id !== 'developer').map((acc) => (
              <button
                key={acc.id}
                onClick={() => setUsername(acc.id)}
                className="group relative flex flex-col items-center"
              >
                <div className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500",
                  username === acc.id 
                    ? "bg-black text-white shadow-xl scale-110" 
                    : "bg-white border border-border-silver text-light-gray group-hover:border-medium-gray"
                )}>
                  <acc.icon size={20} strokeWidth={2} />
                </div>
                <span className={cn(
                  "absolute -bottom-7 text-[12px] font-bold tracking-tight transition-all duration-300",
                  username === acc.id ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
                )}>
                  {acc.label}
                </span>
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 pt-4">
            <div className="space-y-0">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-transparent border-b border-border-silver py-4 text-[15px] focus:border-black outline-none transition-colors placeholder:text-light-silver font-medium"
                placeholder="标识"
                required
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-transparent border-b border-border-silver py-4 text-[15px] focus:border-black outline-none transition-colors placeholder:text-light-silver font-medium mt-2"
                placeholder="密码"
                required
              />
            </div>

            {error && (
              <p className="text-[12px] text-rose-500 font-bold text-center animate-in fade-in slide-in-from-top-1">
                {error}
              </p>
            )}

            <button 
              type="submit" 
              className="w-full h-12 bg-black text-white rounded-xl text-[14px] font-bold hover:bg-zinc-800 transition-all active:scale-[0.98] mt-4"
            >
              Continue
            </button>
          </form>
        </motion.div>

        <footer className="mt-24 text-center">
          <p className="text-[11px] font-bold text-light-silver tracking-[0.2em] uppercase">
            Encrypted // Biometric Ready
          </p>
        </footer>
      </div>
    </div>
  );

}
