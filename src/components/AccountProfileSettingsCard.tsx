import React from 'react';
import { Camera, KeyRound, Loader2, Save, Trash2, UserRound } from 'lucide-react';
import { auth } from '../auth';
import { storage } from '../storage';
import { User } from '../types';
import { cn } from '../lib/utils';

interface AccountProfileSettingsCardProps {
  activeUsername?: string;
}

const maxSourceAvatarBytes = 8 * 1024 * 1024;
const maxStoredAvatarLength = 300 * 1024;
const avatarSize = 256;

function getInitial(name?: string, username?: string) {
  return (name || username || 'U').trim().charAt(0).toUpperCase() || 'U';
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('头像图片读取失败'));
    image.src = src;
  });
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('头像图片读取失败'));
    reader.readAsDataURL(file);
  });
}

async function fileToAvatarDataUrl(file: File) {
  if (!file.type.startsWith('image/')) {
    throw new Error('请选择图片文件');
  }

  if (file.size > maxSourceAvatarBytes) {
    throw new Error('头像图片不能超过 8MB');
  }

  const source = await readFileAsDataUrl(file);
  const image = await loadImage(source);
  const canvas = document.createElement('canvas');
  canvas.width = avatarSize;
  canvas.height = avatarSize;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('当前浏览器无法处理头像图片');

  const scale = Math.max(avatarSize / image.width, avatarSize / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  const x = (avatarSize - width) / 2;
  const y = (avatarSize - height) / 2;

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, avatarSize, avatarSize);
  context.drawImage(image, x, y, width, height);

  const avatarUrl = canvas.toDataURL('image/jpeg', 0.86);
  if (avatarUrl.length > maxStoredAvatarLength) {
    throw new Error('头像处理后仍然过大，请换一张更简单的图片');
  }

  return avatarUrl;
}

export default function AccountProfileSettingsCard({ activeUsername }: AccountProfileSettingsCardProps) {
  const sessionUser = auth.getSessionUser();
  const currentUser = auth.getCurrentUser();
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [profile, setProfile] = React.useState<User | null>(null);
  const [avatarUrl, setAvatarUrl] = React.useState('');
  const [initialAvatarUrl, setInitialAvatarUrl] = React.useState('');
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState('');

  const isSuperAdminProfile = profile?.role === 'developer';
  const isDeveloperOverride = Boolean(
    sessionUser?.role === 'developer' &&
    profile?.username &&
    profile.username !== sessionUser.username,
  );
  const requiresCurrentPassword = Boolean(newPassword && !isDeveloperOverride);
  const hasAvatarChange = avatarUrl !== initialAvatarUrl;
  const canSave = Boolean(profile && (hasAvatarChange || newPassword));

  const loadProfile = React.useCallback(async () => {
    if (!activeUsername) {
      setProfile(null);
      setAvatarUrl('');
      setInitialAvatarUrl('');
      return;
    }

    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      const accountProfile = await storage.getAccountProfile();
      const nextProfile = accountProfile?.username && accountProfile.name
        ? accountProfile
        : auth.getCurrentUser();

      if (!nextProfile) {
        throw new Error('账号资料加载失败');
      }

      setProfile(nextProfile);
      setAvatarUrl(nextProfile.avatarUrl || '');
      setInitialAvatarUrl(nextProfile.avatarUrl || '');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '账号资料加载失败');
    } finally {
      setIsLoading(false);
    }
  }, [activeUsername]);

  React.useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const handleAvatarFile = async (file?: File) => {
    if (!file || isSaving) return;

    setError('');
    setMessage('');

    try {
      setAvatarUrl(await fileToAvatarDataUrl(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : '头像处理失败');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!profile || isSaving || !canSave) return;

    setError('');
    setMessage('');

    if (isSuperAdminProfile) {
      setError('超管资料由环境变量管理，请切换到具体用户后再设置');
      return;
    }

    if (newPassword) {
      if (newPassword.length < 6) {
        setError('新密码至少 6 位');
        return;
      }

      if (newPassword !== confirmPassword) {
        setError('两次输入的新密码不一致');
        return;
      }

      if (requiresCurrentPassword && !currentPassword) {
        setError('请输入当前密码');
        return;
      }
    }

    setIsSaving(true);

    try {
      const updatedProfile = await storage.updateAccountProfile({
        ...(hasAvatarChange ? { avatarUrl } : {}),
        ...(newPassword ? {
          password: newPassword,
          ...(requiresCurrentPassword ? { currentPassword } : {}),
        } : {}),
      });

      setProfile(updatedProfile);
      setAvatarUrl(updatedProfile.avatarUrl || '');
      setInitialAvatarUrl(updatedProfile.avatarUrl || '');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      auth.updateStoredUser(updatedProfile);
      window.dispatchEvent(new CustomEvent('mj-account-profile-updated', { detail: updatedProfile }));
      setMessage('账号资料已保存');
    } catch (err) {
      setError(err instanceof Error ? err.message : '账号资料保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  const displayName = profile?.name || currentUser?.name || activeUsername || '当前账号';
  const displayUsername = profile?.username || currentUser?.username || activeUsername || '';
  const cardSummary = '头像与密码';
  const initial = getInitial(displayName, displayUsername);

  return (
    <section className="mj-mobile-card overflow-hidden sm:rounded-[8px] sm:border-border-silver sm:p-4 sm:shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-start sm:gap-3">
        <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full bg-lightest-gray-background text-midnight-graphite sm:flex">
          <UserRound size={18} strokeWidth={2.4} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3 border-b border-black/[0.045] px-4 py-2.5 sm:border-b-0 sm:px-0 sm:py-0">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] bg-[#f1f6ff] text-interactive-blue sm:hidden">
                <UserRound size={18} strokeWidth={2.4} />
              </span>
              <div className="min-w-0">
                <h2 className="text-[16px] font-semibold text-midnight-graphite sm:text-[15px] sm:font-bold">账号资料</h2>
                <p className="mt-1 truncate text-[12px] font-medium leading-5 text-light-gray sm:font-semibold sm:text-medium-gray">
                  {profile || currentUser ? cardSummary : '读取账号资料中...'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={isLoading || isSaving || !canSave}
              className="flex h-8 shrink-0 items-center justify-center gap-1 text-[12px] font-semibold text-interactive-blue transition-colors hover:text-action-blue disabled:cursor-not-allowed disabled:text-light-silver sm:gap-1.5 sm:rounded-full sm:bg-midnight-graphite sm:px-3.5 sm:text-white sm:shadow-none sm:hover:bg-deep-gray"
            >
              {isSaving ? <Loader2 size={14} strokeWidth={2.5} className="animate-spin" /> : <Save size={14} strokeWidth={2.5} className="hidden sm:block" />}
              保存
            </button>
          </div>

          {(message || error) && (
            <p className={`mx-4 mt-3 text-[12px] font-semibold sm:mx-0 ${error ? 'text-[#c62828]' : 'text-[#2e7d32]'}`}>
              {error || message}
            </p>
          )}

          <div className="grid gap-0 sm:mt-4 sm:gap-4 lg:grid-cols-[220px_1fr]">
            <div className="flex items-center gap-3 border-b border-black/[0.045] px-4 py-2.5 sm:flex-col sm:items-start sm:gap-3 sm:border-b-0 sm:px-0 sm:py-0">
              <div className="h-12 w-12 overflow-hidden rounded-[15px] border border-black/[0.04] bg-lightest-gray-background text-midnight-graphite sm:h-24 sm:w-24 sm:rounded-full sm:border-border-silver">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="账号头像" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[22px] font-semibold sm:text-[30px]">
                    {initial}
                  </div>
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-wrap gap-2 sm:flex-none">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading || isSaving || isSuperAdminProfile}
                  className="flex h-8 items-center justify-center gap-1.5 rounded-full border border-black/[0.06] bg-[#f6f7fb] px-3.5 text-[12px] font-semibold text-midnight-graphite transition-colors hover:bg-lightest-gray-background disabled:cursor-not-allowed disabled:opacity-50 sm:h-9 sm:border-border-silver sm:bg-white sm:px-4"
                >
                  <Camera size={14} strokeWidth={2.5} />
                  选择头像
                </button>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => setAvatarUrl('')}
                    disabled={isLoading || isSaving || isSuperAdminProfile}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-black/[0.06] bg-[#f6f7fb] text-medium-gray transition-colors hover:bg-lightest-gray-background hover:text-[#c62828] disabled:opacity-50 sm:h-9 sm:w-9 sm:border-border-silver sm:bg-white"
                    aria-label="移除头像"
                    title="移除头像"
                  >
                    <Trash2 size={14} strokeWidth={2.5} />
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={(event) => void handleAvatarFile(event.target.files?.[0])}
                />
              </div>
            </div>

            <div className={cn("grid gap-0 px-4 py-0.5 sm:gap-3 sm:px-0 sm:py-0", isSuperAdminProfile && "opacity-60")}>
              <div className="flex items-center gap-2 py-1.5 text-[12px] font-semibold text-light-gray sm:py-0">
                <KeyRound size={14} strokeWidth={2.5} />
                密码
              </div>
              {!isDeveloperOverride && (
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  disabled={isLoading || isSaving || isSuperAdminProfile}
                  className="input-field min-h-[39px] border-b border-black/[0.045] py-2 text-[14px] sm:border-border-silver"
                  placeholder="当前密码"
                  autoComplete="current-password"
                />
              )}
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                disabled={isLoading || isSaving || isSuperAdminProfile}
                className="input-field min-h-[39px] border-b border-black/[0.045] py-2 text-[14px] sm:border-border-silver"
                placeholder={isDeveloperOverride ? '设置新密码' : '新密码'}
                autoComplete="new-password"
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                disabled={isLoading || isSaving || isSuperAdminProfile}
                className="input-field min-h-[39px] py-2 text-[14px] sm:border-border-silver"
                placeholder="再次输入新密码"
                autoComplete="new-password"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
