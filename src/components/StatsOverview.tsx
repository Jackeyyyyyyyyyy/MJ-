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
    <section className="overflow-hidden rounded-[16px] border border-black/[0.05] bg-white lg:bg-white lg:border-border-silver lg:rounded-lg">
      <div className="flex flex-col lg:flex-row lg:items-stretch">
        <header className="px-4 pt-3 pb-2 border-b border-black/[0.04] lg:px-5 lg:py-4 lg:w-[240px] lg:border-b-0 lg:border-r lg:border-border-silver flex flex-col justify-center gap-3">
          <div>
            <h1 className="text-[19px] leading-tight font-semibold text-midnight-graphite lg:text-[22px] lg:font-bold">{title}</h1>
            <p className="hidden text-[11px] text-light-gray font-medium mt-0.5 lg:block lg:text-[12px] lg:font-semibold lg:mt-1">{subtitle}</p>
          </div>
          {action}
        </header>

        <div className={cn(
          "grid flex-1 divide-x divide-black/[0.04] lg:divide-border-silver lg:grid-cols-4",
          items.length >= 5 ? "grid-cols-5" : "grid-cols-4",
          items.length === 3 && "grid-cols-3"
        )}>
          {items.map((item) => (
            <div key={item.label} className="min-h-[48px] px-2 py-2 flex flex-col items-center justify-center gap-1 lg:min-h-[72px] lg:px-4 lg:py-3 lg:flex-row lg:items-center lg:justify-between lg:gap-3">
              <div className="min-w-0 flex flex-col items-center gap-1 lg:items-start">
                <span className="text-[10px] leading-none font-medium text-light-gray whitespace-nowrap lg:text-[11px] lg:font-bold lg:tracking-widest">{item.label}</span>
                <span className="text-[18px] leading-none font-semibold text-midnight-graphite lg:text-[24px] lg:font-bold">{item.value}</span>
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
