import React from 'react';
import { Download, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { clearBackupSession, readBackupSession } from '../backupAuth';

function getDownloadedFileName(disposition: string | null) {
  const match = disposition?.match(/filename="([^"]+)"/i);
  return match?.[1] || 'backup.zip';
}

export default function BackupPage() {
  const [session, setSession] = React.useState(() => readBackupSession());
  const [message, setMessage] = React.useState('');
  const [isDownloading, setIsDownloading] = React.useState(false);

  React.useEffect(() => {
    if (!session) {
      window.location.replace('/');
    }
  }, [session]);

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
          clearBackupSession();
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
    clearBackupSession();
    setSession(null);
    setMessage('');
  };

  if (!session) return null;

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
            <ShieldCheck size={28} strokeWidth={2.2} />
          </div>
          <h1 className="text-[24px] font-bold tracking-tight">管理员数据导出</h1>
          <p className="mt-2 text-[13px] font-semibold text-medium-gray">
            认证已通过，可以下载当前持久化数据备份。
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.99 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="rounded-apple-img border border-border-silver bg-pure-white p-6 shadow-sm"
        >
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
