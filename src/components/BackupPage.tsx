import React from 'react';
import { Download, ShieldCheck, Upload } from 'lucide-react';
import { motion } from 'motion/react';
import { clearBackupSession, readBackupSession } from '../backupAuth';

const TEXT = {
  expired: '\u767b\u5f55\u5df2\u8fc7\u671f\uff0c\u8bf7\u91cd\u65b0\u8ba4\u8bc1',
  downloadFailed: '\u4e0b\u8f7d\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5',
  backupFailed: '\u5907\u4efd\u751f\u6210\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5',
  downloadStarted: '\u5907\u4efd\u6587\u4ef6\u5df2\u5f00\u59cb\u4e0b\u8f7d',
  selectZip: '\u8bf7\u9009\u62e9 .zip \u5907\u4efd\u6587\u4ef6',
  confirmUpload: '\u4e0a\u4f20\u8be5\u5907\u4efd\u5e76\u8986\u76d6\u5f53\u524d volume \u6570\u636e\uff1f',
  uploadFailed: '\u5907\u4efd\u4e0a\u4f20\u5931\u8d25',
  uploadDone: '\u5907\u4efd\u5df2\u4e0a\u4f20\uff0c\u5f53\u524d volume \u6570\u636e\u5df2\u66ff\u6362',
  title: '\u7ba1\u7406\u5458\u6570\u636e\u5907\u4efd',
  subtitle: '\u8ba4\u8bc1\u5df2\u901a\u8fc7\uff0c\u53ef\u4ee5\u4e0b\u8f7d\u6216\u4e0a\u4f20\u6301\u4e45\u5316\u6570\u636e\u5907\u4efd\u3002',
  logout: '\u9000\u51fa\u5907\u4efd\u5165\u53e3',
};

function getDownloadedFileName(disposition: string | null) {
  const match = disposition?.match(/filename="([^"]+)"/i);
  return match?.[1] || 'backup.zip';
}

export default function BackupPage() {
  const [session, setSession] = React.useState(() => readBackupSession());
  const [message, setMessage] = React.useState('');
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (!session) {
      window.location.replace('/');
    }
  }, [session]);

  const expireSession = () => {
    clearBackupSession();
    setSession(null);
    setMessage(TEXT.expired);
  };

  const handleDownload = async () => {
    const currentSession = readBackupSession();
    if (!currentSession) {
      expireSession();
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
          expireSession();
        } else {
          setMessage(TEXT.backupFailed);
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
      setMessage(TEXT.downloadStarted);
    } catch {
      setMessage(TEXT.downloadFailed);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.zip')) {
      setMessage(TEXT.selectZip);
      return;
    }

    if (!window.confirm(TEXT.confirmUpload)) return;

    const currentSession = readBackupSession();
    if (!currentSession) {
      expireSession();
      return;
    }

    setMessage('');
    setIsUploading(true);

    try {
      const response = await fetch('/api/backup/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${currentSession.token}`,
          'Content-Type': 'application/zip',
        },
        body: file,
      });

      if (!response.ok) {
        if (response.status === 401) {
          expireSession();
        } else {
          const detail = await response.json().catch(() => null) as { error?: string } | null;
          setMessage(detail?.error || TEXT.uploadFailed);
        }
        return;
      }

      setMessage(TEXT.uploadDone);
    } catch {
      setMessage(TEXT.uploadFailed);
    } finally {
      setIsUploading(false);
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
          <h1 className="text-[24px] font-bold tracking-tight">{TEXT.title}</h1>
          <p className="mt-2 text-[13px] font-semibold text-medium-gray">
            {TEXT.subtitle}
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
              disabled={isDownloading || isUploading}
              className="btn-primary w-full"
            >
              <Download size={17} strokeWidth={2.3} />
              <span>{isDownloading ? 'Preparing Backup' : 'Download Backup'}</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip,application/zip"
              onChange={handleUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={handleUploadClick}
              disabled={isDownloading || isUploading}
              className="btn-secondary w-full"
            >
              <Upload size={17} strokeWidth={2.3} />
              <span>{isUploading ? 'Uploading Backup' : 'Upload Backup'}</span>
            </button>
            <button
              type="button"
              onClick={handleLogout}
              disabled={isDownloading || isUploading}
              className="btn-secondary w-full"
            >
              {TEXT.logout}
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
