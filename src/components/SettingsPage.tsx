import React from 'react';
import AccountProfileSettingsCard from './AccountProfileSettingsCard';
import NotificationSettingsCard from './NotificationSettingsCard';
import PasskeySettingsCard from './PasskeySettingsCard';

interface SettingsPageProps {
  activeUsername?: string;
}

export default function SettingsPage({ activeUsername }: SettingsPageProps) {
  return (
    <div className="mx-auto flex w-full max-w-[880px] flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="text-[12px] font-black uppercase tracking-wider text-light-gray">Settings</p>
        <h1 className="text-[28px] font-black tracking-tight text-midnight-graphite">设置</h1>
      </div>

      <div className="grid gap-4">
        <AccountProfileSettingsCard activeUsername={activeUsername} />
        <NotificationSettingsCard activeUsername={activeUsername} />
        <PasskeySettingsCard activeUsername={activeUsername} />
      </div>
    </div>
  );
}
