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
    <section className="mj-mobile-card-soft overflow-hidden lg:rounded-lg lg:border-border-silver lg:bg-white lg:shadow-none">
      <div className="flex flex-col lg:flex-row lg:items-stretch">
        <header className="flex flex-col justify-center gap-1.5 px-3.5 pb-1.5 pt-3 lg:w-[240px] lg:border-r lg:border-border-silver lg:px-5 lg:py-4">
          <div>
            <h1 className="text-[15.5px] leading-tight font-semibold text-midnight-graphite lg:text-[22px] lg:font-bold">{title}</h1>
            <p className="mt-0.5 text-[10.5px] font-medium text-[#858994] lg:text-[12px] lg:font-semibold">{subtitle}</p>
          </div>
          {action}
        </header>

        <div className={cn(
          "grid flex-1 border-t border-black/[0.035] divide-x divide-black/[0.035] lg:border-t-0 lg:divide-border-silver lg:grid-cols-4",
          items.length >= 5 ? "grid-cols-5" : "grid-cols-4",
          items.length === 3 && "grid-cols-3"
        )}>
          {items.map((item) => (
            <div key={item.label} className="flex min-h-[54px] flex-col items-center justify-center gap-1 px-1.5 py-2 lg:min-h-[72px] lg:flex-row lg:items-center lg:justify-between lg:gap-3 lg:px-4">
              <div className={cn(
                "flex h-6 w-6 items-center justify-center rounded-[9px] lg:hidden",
                item.bg || "bg-lightest-gray-background",
                item.tone || "text-midnight-graphite",
              )}>
                <item.icon size={13} strokeWidth={2.35} />
              </div>
              <div className="min-w-0 flex flex-col items-center gap-1 lg:items-start">
                <span className="max-w-[64px] truncate text-[9.5px] leading-none font-medium text-[#858994] lg:max-w-none lg:text-[11px] lg:font-semibold">{item.label}</span>
                <span className="text-[16px] leading-none font-semibold text-midnight-graphite lg:text-[24px] lg:font-bold">{item.value}</span>
              </div>
              <div className={cn(
                "hidden w-8 h-8 rounded-lg lg:flex items-center justify-center shrink-0",
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
