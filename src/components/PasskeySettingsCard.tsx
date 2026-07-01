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
    <section className="mj-mobile-card overflow-hidden sm:rounded-[8px] sm:border-border-silver sm:p-4 sm:shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-start sm:gap-3">
        <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full bg-lightest-gray-background text-midnight-graphite sm:flex">
          <Fingerprint size={18} strokeWidth={2.4} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3 border-b border-black/[0.045] px-4 py-3 sm:border-b-0 sm:px-0 sm:py-0">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] bg-[#eef5ff] text-[#1677ff] sm:hidden">
                <Fingerprint size={18} strokeWidth={2.4} />
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-[16px] font-semibold text-midnight-graphite sm:text-[15px] sm:font-bold">Face ID / 通行密钥</h2>
                <p className="mt-0.5 line-clamp-2 text-[12px] font-medium leading-[18px] text-light-gray sm:text-medium-gray">
                  {supported
                    ? isPlatformAvailable
                      ? '绑定后可用 Face ID、Touch ID 或设备密码登录。'
                      : '当前设备可使用通行密钥，是否支持 Face ID 由系统决定。'
                    : '通行密钥需要 HTTPS 或本机安全地址，并使用支持的浏览器。'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void handleRegister()}
              disabled={!supported || isUpdating}
              className="flex h-8 shrink-0 items-center justify-center gap-1 text-[12px] font-semibold text-interactive-blue transition-colors hover:text-action-blue disabled:cursor-not-allowed disabled:text-light-silver sm:gap-1.5 sm:rounded-full sm:bg-midnight-graphite sm:px-4 sm:text-white sm:shadow-none sm:hover:bg-deep-gray"
            >
              {isUpdating ? <Loader2 size={14} strokeWidth={2.5} className="animate-spin" /> : <KeyRound size={14} strokeWidth={2.5} className="hidden sm:block" />}
              配置
            </button>
          </div>

          {(message || error) && (
            <p className={`mx-4 mt-3 text-[12px] font-semibold sm:mx-0 ${error ? 'text-[#c62828]' : 'text-[#2e7d32]'}`}>
              {error || message}
            </p>
          )}

          <div className="overflow-hidden bg-white sm:mt-4 sm:rounded-[8px] sm:border sm:border-border-silver">
            {isLoading && (
              <div className="flex h-14 items-center justify-center gap-2 text-[12px] font-semibold text-medium-gray">
                <Loader2 size={14} strokeWidth={2.5} className="animate-spin" />
                读取通行密钥
              </div>
            )}

            {!isLoading && passkeys.length === 0 && (
              <div className="px-4 py-2.5 text-[12px] font-medium text-light-gray">
                还没有绑定通行密钥
              </div>
            )}

            {!isLoading && passkeys.map((passkey) => (
              <div key={passkey.id} className="flex items-center justify-between gap-3 border-b border-black/[0.045] px-4 py-3 last:border-b-0 sm:border-border-silver">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-midnight-graphite">{passkey.name}</p>
                  <p className="mt-1 text-[11px] font-medium text-light-gray">
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
