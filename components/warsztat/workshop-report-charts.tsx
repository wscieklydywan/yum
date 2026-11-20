'use client'

import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { DaySummary } from '@/lib/day-report-types'

export const CHART_COLORS = ['#d71f16', '#201d1a', '#f59e0b', '#8b827a', '#16a34a']

const money = (value: number) => value.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })

type TooltipPayload = { active?: boolean; payload?: { value: number; payload: Record<string, unknown> }[]; label?: string | number }

function HourTooltip({ active, payload, label }: TooltipPayload) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-[#e5ded6] bg-white px-3 py-2 text-[12px] shadow-lg">
      <p className="font-semibold text-[#756e67]">{`${label}:00 – ${label}:59`}</p>
      <p className="font-extrabold tabular-nums text-[#201d1a]">{payload[0].value} zam.</p>
    </div>
  )
}

export function HourChart({ byHour }: { byHour: DaySummary['byHour'] }) {
  const counts = new Map(byHour.map((entry) => [entry.hour, entry.orders]))
  const first = Math.min(...byHour.map((entry) => entry.hour))
  const last = Math.max(...byHour.map((entry) => entry.hour))
  const data = Array.from({ length: last - first + 1 }, (_, index) => ({ hour: first + index, orders: counts.get(first + index) ?? 0 }))
  const peak = data.reduce((top, entry) => (entry.orders > top.orders ? entry : top), data[0])

  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="flex items-baseline justify-between gap-3 text-[12px] text-[#756e67]">
        <span>Szczyt: <b className="text-[#201d1a]">{peak.hour}:00</b></span>
        <span className="tabular-nums">{peak.orders} zam. / h</span>
      </figcaption>
      <div className="h-48 w-full sm:h-56" role="img" aria-label={`Wykres zamówień wg godzin, najwięcej o ${peak.hour}:00 (${peak.orders})`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
            <defs>
              <linearGradient id="hourFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#d71f16" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#d71f16" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#efe9e2" strokeDasharray="4 4" />
            <XAxis dataKey="hour" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#8b827a' }} tickFormatter={(hour) => `${hour}`} interval="preserveStartEnd" minTickGap={12} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#8b827a' }} width={40} />
            <Tooltip content={<HourTooltip />} cursor={{ stroke: '#d71f16', strokeOpacity: 0.3, strokeWidth: 1 }} />
            <Area type="monotone" dataKey="orders" stroke="#d71f16" strokeWidth={2.5} fill="url(#hourFill)" dot={{ r: 3, fill: '#fff', stroke: '#d71f16', strokeWidth: 2 }} activeDot={{ r: 5, fill: '#d71f16', stroke: '#fff', strokeWidth: 2 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </figure>
  )
}

export function TypeDonut({ byType }: { byType: DaySummary['byType'] }) {
  const total = byType.reduce((sum, entry) => sum + entry.revenue, 0)
  const orders = byType.reduce((sum, entry) => sum + entry.orders, 0)

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <div className="relative size-36 shrink-0" role="img" aria-label="Udział typów zamówień w obrocie">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={byType} dataKey="revenue" nameKey="name" innerRadius="68%" outerRadius="100%" paddingAngle={byType.length > 1 ? 3 : 0} cornerRadius={6} stroke="none" isAnimationActive={false}>
              {byType.map((entry, index) => <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-extrabold tabular-nums leading-none">{orders}</span>
          <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#8b827a]">zam.</span>
        </div>
      </div>
      <ul className="flex w-full min-w-0 flex-col gap-2.5">
        {byType.map((entry, index) => <li key={entry.name} className="flex items-center gap-2.5 text-[13px]">
          <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate font-semibold">{entry.name}</span>
          <span className="shrink-0 tabular-nums text-[#8b827a]">{total ? Math.round((entry.revenue / total) * 100) : 0}%</span>
          <span className="w-24 shrink-0 text-right font-bold tabular-nums">{money(entry.revenue)}</span>
        </li>)}
      </ul>
    </div>
  )
}
