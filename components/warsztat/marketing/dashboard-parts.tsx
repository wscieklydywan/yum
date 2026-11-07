'use client'

import type { ReactNode } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowDownRight, ArrowUpRight, ChevronRight, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { trendPercent, trendPoints, type ActivityDay, type Trend } from '@/lib/marketing-dashboard'

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('rounded-2xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]', className)}>{children}</div>
}

export function CardHeading({ icon: Icon, title, action }: { icon?: LucideIcon; title: string; action?: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <h3 className="flex min-w-0 items-center gap-2 text-sm font-extrabold text-zinc-900 sm:text-base">
        {Icon && <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />}
        <span className="truncate">{title}</span>
      </h3>
      {action}
    </div>
  )
}

export function TrendBadge({ trend, invert = false, points = false, className }: { trend: Trend; invert?: boolean; points?: boolean; className?: string }) {
  const percent = points ? trendPoints(trend) : trendPercent(trend)
  const up = percent >= 0
  const good = invert ? !up : up
  const Icon = up ? ArrowUpRight : ArrowDownRight
  return (
    <span className={cn('inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-bold tabular-nums', good ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400', className)}>
      <Icon className="size-3" aria-hidden="true" />
      {Math.abs(percent)}{points ? ' pp' : '%'}
      <span className="sr-only">{up ? 'wzrost' : 'spadek'} względem tego samego okresu poprzedniego miesiąca</span>
    </span>
  )
}

export function KpiCard({ icon: Icon, value, label, trend, invert, points, hint }: { icon: LucideIcon; value: string; label: string; trend?: Trend; invert?: boolean; points?: boolean; hint?: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-2xl bg-zinc-900 p-3 text-white sm:p-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary sm:size-11">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <p className="min-w-0 max-w-full truncate text-lg font-black leading-tight tabular-nums sm:text-2xl">{value}</p>
          {trend && <TrendBadge trend={trend} invert={invert} points={points} />}
        </div>
        <p className="truncate text-[11px] text-white/60 sm:text-xs">{label}</p>
        {hint && <p className="hidden truncate text-[11px] text-white/40 sm:block">{hint}</p>}
      </div>
    </div>
  )
}

const shortDay = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })

export type ActivityMetric = 'customers' | 'orders' | 'revenue'

const metricLabel: Record<ActivityMetric, (value: number) => string> = {
  customers: (value) => `${value} aktywnych klientów`,
  orders: (value) => `${value} zamówień klubowych`,
  revenue: (value) => `${value.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł obrotu`,
}

export function ActivityChart({ data, metric }: { data: ActivityDay[]; metric: ActivityMetric }) {
  return (
    <div className="h-44 w-full sm:h-52" role="img" aria-label={`Wykres dzienny z ostatnich 30 dni: ${metric === 'customers' ? 'aktywni klienci' : metric === 'orders' ? 'zamówienia klubowe' : 'obrót klubu'}`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="mk-activity" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#f0f0f0" />
          <XAxis dataKey="date" tickFormatter={shortDay} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={28} tick={{ fontSize: 11, fill: '#71717a' }} />
          <YAxis allowDecimals={metric === 'revenue'} tickLine={false} axisLine={false} width={44} tick={{ fontSize: 11, fill: '#71717a' }} tickFormatter={(value: number) => (metric === 'revenue' && value >= 1000 ? `${Math.round(value / 100) / 10}k` : String(value))} />
          <Tooltip
            cursor={{ stroke: '#e4e4e7' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const point = payload[0].payload as ActivityDay
              return (
                <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs shadow-lg">
                  <p className="font-bold text-zinc-900">{shortDay(point.date)}</p>
                  {(['customers', 'orders', 'revenue'] as const).map((key) => (
                    <p key={key} className={cn(key === metric ? 'font-bold text-zinc-900' : 'text-zinc-500')}>{metricLabel[key](point[key])}</p>
                  ))}
                </div>
              )
            }}
          />
          <Area type="monotone" dataKey={metric} stroke="var(--primary)" strokeWidth={2.5} fill="url(#mk-activity)" activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export type StatusTone = 'on' | 'off' | 'soon'

export function StatusPill({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold', tone === 'on' && 'bg-emerald-50 text-emerald-700', tone === 'off' && 'bg-zinc-100 text-zinc-500', tone === 'soon' && 'bg-amber-50 text-amber-700')}>
      <span className={cn('size-1.5 rounded-full', tone === 'on' && 'bg-emerald-500', tone === 'off' && 'bg-zinc-400', tone === 'soon' && 'bg-amber-500')} aria-hidden="true" />
      {children}
    </span>
  )
}

export type ProgramStat = { label: string; value: string; tone?: StatusTone }

export function ProgramCard({ icon: Icon, title, description, status, stats, featured, onOpen }: { icon: LucideIcon; title: string; description: string; status: { tone: StatusTone; label: string }; stats: ProgramStat[]; featured?: boolean; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        featured ? 'border-transparent bg-gradient-to-br from-primary to-[#a3140d] text-white' : 'border-zinc-200/80 bg-white text-zinc-900',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={cn('flex size-11 items-center justify-center rounded-xl', featured ? 'bg-white/15' : 'bg-primary/10 text-primary')}>
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <span className={cn('flex size-8 items-center justify-center rounded-full transition-transform group-hover:translate-x-0.5', featured ? 'bg-white/15' : 'bg-zinc-100 text-zinc-600')}>
          <ChevronRight className="size-4" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-3 text-base font-extrabold leading-tight">{title}</p>
      <p className={cn('mt-1 text-xs leading-relaxed', featured ? 'text-white/75' : 'text-zinc-500')}>{description}</p>
      <div className="mt-3">
        {featured ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-bold"><span className="size-1.5 rounded-full bg-emerald-300" aria-hidden="true" />{status.label}</span>
        ) : (
          <StatusPill tone={status.tone}>{status.label}</StatusPill>
        )}
      </div>
      <dl className={cn('mt-auto grid grid-cols-3 gap-2 border-t pt-3 mt-4', featured ? 'border-white/15' : 'border-zinc-100')}>
        {stats.map((stat) => (
          <div key={stat.label} className="min-w-0 text-center">
            <dd className={cn('truncate text-sm font-black tabular-nums', !featured && stat.tone === 'on' && 'text-emerald-600', !featured && stat.tone === 'off' && 'text-zinc-400', !featured && stat.tone === 'soon' && 'text-amber-600')}>{stat.value}</dd>
            <dt className={cn('truncate text-[10px] font-medium', featured ? 'text-white/65' : 'text-zinc-500')}>{stat.label}</dt>
          </div>
        ))}
      </dl>
    </button>
  )
}

export function ModuleTile({ icon: Icon, title, detail, status, featured, onOpen }: { icon: LucideIcon; title: string; detail: string; status: { tone: StatusTone; label: string }; featured?: boolean; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'group flex min-w-0 items-center gap-3 rounded-2xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:p-4',
        featured ? 'border-transparent bg-gradient-to-br from-primary to-[#a3140d] text-white' : 'border-zinc-200/80 bg-white text-zinc-900 hover:bg-zinc-50',
      )}
    >
      <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl', featured ? 'bg-white/15' : 'bg-primary/10 text-primary')}>
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex min-w-0 items-center justify-between gap-2">
          <span className="truncate text-sm font-extrabold sm:text-base">{title}</span>
          {featured ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-bold"><span className="size-1.5 rounded-full bg-emerald-300" aria-hidden="true" />{status.label}</span>
          ) : (
            <span className="shrink-0"><StatusPill tone={status.tone}>{status.label}</StatusPill></span>
          )}
        </span>
        <span className={cn('truncate text-xs', featured ? 'text-white/75' : 'text-zinc-500')}>{detail}</span>
      </span>
      <ChevronRight className={cn('size-4 shrink-0 transition-transform group-hover:translate-x-0.5', featured ? 'text-white/70' : 'text-zinc-400')} aria-hidden="true" />
    </button>
  )
}

export function RowButton({ icon: Icon, title, detail, onClick, iconClass, trailing }: { icon: LucideIcon; title: string; detail?: string; onClick: () => void; iconClass?: string; trailing?: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="group flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary">
      <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700', iconClass)}>
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-zinc-900">{title}</span>
        {detail && <span className="block truncate text-xs text-zinc-500">{detail}</span>}
      </span>
      {trailing}
      <ChevronRight className="size-4 shrink-0 text-zinc-400 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
    </button>
  )
}
