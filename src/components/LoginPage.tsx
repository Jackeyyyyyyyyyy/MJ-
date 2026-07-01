import React, { useEffect, useState } from 'react';
import { auth } from '../auth';
import { loginBackup } from '../backupAuth';
import { isPlatformPasskeyAvailable, loginWithPasskey } from '../lib/passkeys';
import { motion } from 'motion/react';
import { Fingerprint, Loader2 } from 'lucide-react';

interface LoginPageProps {
  onLogin: () => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberDevice, setRememberDevice] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPasskeySubmitting, setIsPasskeySubmitting] = useState(false);
  const [canUsePasskey, setCanUsePasskey] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    void isPlatformPasskeyAvailable().then((available) => {
      if (!isCancelled) setCanUsePasskey(available);
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const user = await auth.login(username, password, { rememberDevice });
      if (user) {
        onLogin();
      } else {
        const isBackupLogin = await loginBackup(username, password);
        if (isBackupLogin) {
          window.location.assign('/backup');
        } else {
          setError('认证失败：请核对账号或密码');
        }
      }
    } catch {
      setError('认证服务暂不可用，请稍后再试');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasskeyLogin = async () => {
    if (isSubmitting || isPasskeySubmitting) return;

    setError('');
    setIsPasskeySubmitting(true);

    try {
      await loginWithPasskey(username.trim() || undefined, { rememberDevice });
      onLogin();
    } catch (err) {
      const nextMessage = err instanceof DOMException && err.name === 'NotAllowedError'
        ? '这次没有完成 Face ID 验证。'
        : err instanceof Error ? err.message : '通行密钥登录失败';
      setError(nextMessage);
    } finally {
      setIsPasskeySubmitting(false);
    }
  };

  const inputClassName = "h-[52px] w-full rounded-2xl border border-transparent bg-[#f1f2f6] px-4 text-[15px] font-medium text-midnight-graphite outline-none transition-all placeholder:text-light-gray focus:border-[#b8d7ff] focus:bg-white focus:ring-4 focus:ring-[#1677ff]/10";

  return (
    <div className="flex min-h-screen flex-col items-center bg-[#f5f5f8] px-5 py-8 font-sans text-midnight-graphite antialiased">
      <div className="flex w-full max-w-[360px] flex-1 flex-col justify-center">
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42 }}
          className="mb-10 flex flex-col items-center"
        >
          <img
            src="/mj-logo.png"
            alt="MJ 审批"
            className="mb-4 h-[68px] w-[68px] object-contain"
          />
          <h1 className="text-[23px] font-semibold tracking-tight">MJ 审批</h1>
          <p className="mt-2 text-[13px] font-medium text-medium-gray">欢迎回来</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.36, delay: 0.08 }}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-3">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={inputClassName}
                placeholder="账号"
                autoComplete="username"
                required
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClassName}
                placeholder="密码"
                autoComplete="current-password"
                required
              />
            </div>

            <label className="flex cursor-pointer select-none items-center gap-2.5 px-1 text-[13px] font-medium text-medium-gray">
              <input
                type="checkbox"
                checked={rememberDevice}
                onChange={(e) => setRememberDevice(e.target.checked)}
                className="peer sr-only"
              />
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border border-[#d7d9df] bg-white transition-colors peer-checked:border-[#1677ff] peer-checked:bg-[#1677ff]">
                <span className={`${rememberDevice ? 'block' : 'hidden'} h-2 w-1 rotate-45 border-b-2 border-r-2 border-white`} />
              </span>
              <span>记住此设备</span>
            </label>

            {error && (
              <p className="rounded-2xl bg-[#fff1f1] px-3 py-2 text-center text-[12px] font-semibold text-[#d32f2f] animate-in fade-in slide-in-from-top-1">
                {error}
              </p>
            )}

            <button 
              type="submit" 
              disabled={isSubmitting || isPasskeySubmitting}
              className="mt-2 h-[50px] w-full rounded-full bg-[#1677ff] text-[15px] font-semibold text-white shadow-[0_8px_18px_rgba(22,119,255,0.18)] transition-all hover:bg-[#0f6fe8] active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-[#b7c9e8] disabled:shadow-none"
            >
              {isSubmitting ? '认证中' : '安全登录'}
            </button>

            <button
              type="button"
              onClick={() => void handlePasskeyLogin()}
              disabled={!canUsePasskey || isSubmitting || isPasskeySubmitting}
              className="flex h-[48px] w-full items-center justify-center gap-2 rounded-full border border-transparent bg-white text-[14px] font-semibold text-midnight-graphite shadow-[0_1px_2px_rgba(16,24,40,0.04)] ring-1 ring-black/[0.035] transition-all hover:bg-[#fbfbfd] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {isPasskeySubmitting ? (
                <Loader2 size={17} strokeWidth={2.5} className="animate-spin" />
              ) : (
                <Fingerprint size={17} strokeWidth={2.5} />
              )}
              {isPasskeySubmitting ? '验证中' : 'Face ID / 通行密钥登录'}
            </button>
          </form>
        </motion.div>

      </div>
      <footer className="w-full text-center">
        <p className="text-[11px] font-medium text-light-gray">
          © 2026 MJ审批. All rights reserved.
        </p>
      </footer>
    </div>
  );

}
