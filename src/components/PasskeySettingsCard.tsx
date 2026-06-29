import React from 'react';
import { Fingerprint, KeyRound, Loader2, Trash2 } from 'lucide-react';
import { registerPasskey, isPlatformPasskeyAvailable, isPasskeySupported } from '../lib/passkeys';
import { storage } from '../storage';
import { PasskeyCredentialSummary } from '../types';
import { formatLocalDateTime } from '../lib/time';

interface PasskeySettingsCardProps {
  activeUsername?: string;
}

export default function PasskeySettingsCard({ activeUsername }: PasskeySettingsCardProps) {
  const [passkeys, setPasskeys] = React.useState<PasskeyCredentialSummary[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [isPlatformAvailable, setIsPlatformAvailable] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState('');

  const supported = isPasskeySupported();

  const loadPasskeys = React.useCallback(async () => {
    if (!activeUsername) {
      setPasskeys([]);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      setPasskeys(await storage.getPasskeys());
    } catch (err) {
      setError(err instanceof Error ? err.message : '通行密钥加载失败');
    } finally {
      setIsLoading(false);
    }
  }, [activeUsername]);

  React.useEffect(() => {
    void loadPasskeys();
  }, [loadPasskeys]);

  React.useEffect(() => {
    let isCancelled = false;

    void isPlatformPasskeyAvailable().then((available) => {
      if (!isCancelled) setIsPlatformAvailable(available);
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  const handleRegister = async () => {
    if (isUpdating) return;

    setIsUpdating(true);
    setError('');
    setMessage('');

    try {
      await registerPasskey();
      setMessage('已绑定通行密钥，下次登录可以直接使用 Face ID。');
      await loadPasskeys();
    } catch (err) {
      const nextMessage = err instanceof DOMException && err.name === 'NotAllowedError'
        ? '这次没有完成 Face ID 验证。'
        : err instanceof Error ? err.message : '通行密钥绑定失败';
      setError(nextMessage);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async (passkey: PasskeyCredentialSummary) => {
    if (isUpdating || !window.confirm(`删除通行密钥「${passkey.name}」？`)) return;

    setIsUpdating(true);
    setError('');
    setMessage('');

    try {
      await storage.deletePasskey(passkey.id);
      setMessage('通行密钥已删除。');
      await loadPasskeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除通行密钥失败');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <section className="rounded-[8px] border border-border-silver bg-white p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-lightest-gray-background text-midnight-graphite">
          <Fingerprint size={21} strokeWidth={2.5} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[16px] font-black text-midnight-graphite">Face ID / 通行密钥</h2>
              <p className="mt-1 text-[13px] font-semibold leading-5 text-medium-gray">
                {supported
                  ? isPlatformAvailable
                    ? '绑定后可用 Face ID、Touch ID 或设备密码登录。'
                    : '当前设备可使用通行密钥，是否支持 Face ID 由系统决定。'
                  : '通行密钥需要 HTTPS 或本机安全地址，并使用支持的浏览器。'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleRegister()}
              disabled={!supported || isUpdating}
              className="flex h-9 shrink-0 items-center justify-center gap-2 rounded-full bg-midnight-graphite px-4 text-[12px] font-black text-white transition-colors hover:bg-deep-gray disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isUpdating ? <Loader2 size={14} strokeWidth={2.5} className="animate-spin" /> : <KeyRound size={14} strokeWidth={2.5} />}
              配置通行密钥
            </button>
          </div>

          {(message || error) && (
            <p className={`mt-4 text-[12px] font-bold ${error ? 'text-[#c62828]' : 'text-[#2e7d32]'}`}>
              {error || message}
            </p>
          )}

          <div className="mt-5 overflow-hidden rounded-[8px] border border-border-silver">
            {isLoading && (
              <div className="flex h-16 items-center justify-center gap-2 text-[12px] font-bold text-medium-gray">
                <Loader2 size={14} strokeWidth={2.5} className="animate-spin" />
                读取通行密钥
              </div>
            )}

            {!isLoading && passkeys.length === 0 && (
              <div className="px-4 py-4 text-[12px] font-bold text-medium-gray">
                还没有绑定通行密钥
              </div>
            )}

            {!isLoading && passkeys.map((passkey) => (
              <div key={passkey.id} className="flex items-center justify-between gap-3 border-b border-border-silver px-4 py-3 last:border-b-0">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-black text-midnight-graphite">{passkey.name}</p>
                  <p className="mt-1 text-[11px] font-semibold text-medium-gray">
                    {passkey.lastUsedAt
                      ? `上次使用：${formatLocalDateTime(passkey.lastUsedAt, 'date-time')}`
                      : `绑定时间：${formatLocalDateTime(passkey.createdAt, 'date-time')}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDelete(passkey)}
                  disabled={isUpdating}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-medium-gray transition-colors hover:bg-lightest-gray-background hover:text-[#c62828] disabled:opacity-50"
                  aria-label="删除通行密钥"
                  title="删除通行密钥"
                >
                  <Trash2 size={15} strokeWidth={2.4} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
