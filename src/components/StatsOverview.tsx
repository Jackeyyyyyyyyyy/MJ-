import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '../lib/utils';

export interface StatsOverviewItem {
  label: string;
  value: number;
  icon: LucideIcon;
  tone?: string;
  bg?: string;
}

interface StatsOverviewProps {
  title: string;
  subtitle: string;
  items: StatsOverviewItem[];
  action?: React.ReactNode;
}

export default function StatsOverview({ title, subtitle, items, action }: StatsOverviewProps) {
  return (
    <section className="bg-white border border-border-silver rounded-lg overflow-hidden">
      <div className="flex flex-col lg:flex-row lg:items-stretch">
        <header className="px-5 py-4 lg:w-[240px] border-b lg:border-b-0 lg:border-r border-border-silver flex flex-col justify-center gap-3">
          <div>
            <h1 className="text-[22px] font-bold tracking-tight">{title}</h1>
            <p className="text-[12px] text-light-gray font-semibold mt-1">{subtitle}</p>
          </div>
          {action}
        </header>

        <div className="grid grid-cols-2 lg:grid-cols-4 flex-1 divide-x-0 lg:divide-x divide-y lg:divide-y-0 divide-border-silver">
          {items.map((item) => (
            <div key={item.label} className="min-h-[72px] px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0 flex flex-col gap-1">
                <span className="text-[11px] font-bold text-light-gray tracking-widest">{item.label}</span>
                <span className="text-[24px] leading-none font-bold text-midnight-graphite tracking-tight">{item.value}</span>
              </div>
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                item.bg || "bg-lightest-gray-background",
                item.tone || "text-midnight-graphite",
              )}>
                <item.icon size={16} strokeWidth={2.5} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
