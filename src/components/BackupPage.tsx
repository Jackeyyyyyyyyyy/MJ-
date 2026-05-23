import React from 'react';
import { Download, LockKeyhole, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';

interface BackupSession {
  token: string;
  expiresAt: number;
}

const BACKUP_SESSION_KEY = 'mj_backup_session';

function readBackupSession(): BackupSession | null {
  const raw = sessionStorage.getItem(BACKUP_SESSION_KEY);
  if (!raw) return null;

  try {
    const session = JSON.parse(raw) as Partial<BackupSession>;
    if (!session.token || !session.expiresAt || Date.now() > session.expiresAt) {
      sessionStorage.removeItem(BACKUP_SESSION_KEY);
      return null;
    }

    return {
      token: session.token,
      expiresAt: session.expiresAt,
    };
  } catch {
    sessionStorage.removeItem(BACKUP_SESSION_KEY);
    return null;
  }
}

function getDownloadedFileName(disposition: string | null) {
  const match = disposition?.match(/filename="([^"]+)"/i);
  return match?.[1] || 'backup.tar.gz';
}

export default function BackupPage() {
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [session, setSession] = React.useState<BackupSession | null>(() => readBackupSession());
  const [message, setMessage] = React.useState('');
  const [isLoggingIn, setIsLoggingIn] = React.useState(false);
  const [isDownloading, setIsDownloading] = React.useState(false);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('');
    setIsLoggingIn(true);

    try {
      const response = await fetch('/api/backup/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      if (!response.ok) {
        setMessage(response.status === 401 ? '认证失败：请核对账号或密码' : '备份入口暂不可用');
        return;
      }

      const nextSession = await response.json() as BackupSession;
      sessionStorage.setItem(BACKUP_SESSION_KEY, JSON.stringify(nextSession));
      setSession(nextSession);
      setPassword('');
      setMessage('');
    } catch {
      setMessage('服务暂不可用，请稍后再试');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleDownload = async () => {
    const currentSession = readBackupSession();
    if (!currentSession) {
      setSession(null);
      setMessage('登录已过期，请重新认证');
      return;
    }

    setMessage('');
    setIsDownloading(true);

    try {
      const response = await fetch('/api/backup/download', {
        headers: {
          Authorization: `Bearer ${currentSession.token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          sessionStorage.removeItem(BACKUP_SESSION_KEY);
          setSession(null);
          setMessage('登录已过期，请重新认证');
        } else {
          setMessage('备份生成失败，请稍后再试');
        }
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = getDownloadedFileName(response.headers.get('Content-Disposition'));
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setMessage('备份文件已开始下载');
    } catch {
      setMessage('下载失败，请稍后再试');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem(BACKUP_SESSION_KEY);
    setSession(null);
    setMessage('');
  };

  return (
    <div className="min-h-screen bg-canvas-white text-midnight-graphite font-sans antialiased px-6 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-80px)] w-full max-w-[420px] flex-col justify-center">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-12 flex flex-col items-center text-center"
        >
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-pure-white shadow-sm">
            {session ? <ShieldCheck size={28} strokeWidth={2.2} /> : <LockKeyhole size={28} strokeWidth={2.2} />}
          </div>
          <h1 className="text-[24px] font-bold tracking-tight">管理员数据导出</h1>
          <p className="mt-2 text-[13px] font-semibold text-medium-gray">
            {session ? '认证已通过，可以下载当前持久化数据备份。' : '请输入管理员凭据以继续。'}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.99 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="rounded-apple-img border border-border-silver bg-pure-white p-6 shadow-sm"
        >
          {session ? (
            <div className="space-y-5">
              <button
                type="button"
                onClick={handleDownload}
                disabled={isDownloading}
                className="btn-primary w-full"
              >
                <Download size={17} strokeWidth={2.3} />
                <span>{isDownloading ? 'Preparing Backup' : 'Download Backup'}</span>
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="btn-secondary w-full"
              >
                退出备份入口
              </button>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-3">
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="input-field text-[15px]"
                  placeholder="账号"
                  autoComplete="username"
                  required
                />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="input-field text-[15px]"
                  placeholder="密码"
                  autoComplete="current-password"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isLoggingIn}
                className="btn-primary w-full"
              >
                {isLoggingIn ? '认证中' : '进入备份入口'}
              </button>
            </form>
          )}

          {message && (
            <p className="mt-5 text-center text-[12px] font-bold text-medium-gray">
              {message}
            </p>
          )}
        </motion.div>
      </div>
    </div>
  );
}
