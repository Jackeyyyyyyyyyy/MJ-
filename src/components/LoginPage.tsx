import React, { useState } from 'react';
import { auth } from '../auth';
import { motion } from 'motion/react';

interface LoginPageProps {
  onLogin: () => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const user = await auth.login(username, password);
      if (user) {
        onLogin();
      } else {
        setError('认证失败：请核对账号或密码');
      }
    } catch {
      setError('认证服务暂不可用，请稍后再试');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#fafafa] font-sans antialiased text-midnight-graphite px-6 py-10">
      <div className="w-full max-w-[360px]">
        
        {/* Logo 极其简约 */}
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="flex flex-col items-center mb-16"
        >
          <img
            src="/mj-logo.png"
            alt="MJ 审批"
            className="mb-5 h-20 w-20 object-contain"
          />
          <h1 className="text-[24px] font-bold tracking-tight">MJ 审批</h1>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.99 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="space-y-8"
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-0">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-transparent border-b border-border-silver py-4 text-[15px] focus:border-black outline-none transition-colors placeholder:text-light-silver font-medium"
                placeholder="账号"
                autoComplete="username"
                required
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-transparent border-b border-border-silver py-4 text-[15px] focus:border-black outline-none transition-colors placeholder:text-light-silver font-medium mt-2"
                placeholder="密码"
                autoComplete="current-password"
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
              disabled={isSubmitting}
              className="w-full h-12 bg-black text-white rounded-xl text-[14px] font-bold hover:bg-zinc-800 transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 mt-4"
            >
              {isSubmitting ? '认证中' : '安全登录'}
            </button>
          </form>
        </motion.div>

        <footer className="mt-24 text-center">
          <p className="text-[11px] font-bold text-light-gray">
            Copyright (C) 2026 MJ 审批. All Rights Reserved
          </p>
        </footer>
      </div>
    </div>
  );

}
