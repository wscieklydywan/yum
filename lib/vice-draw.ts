import { randomInt } from 'node:crypto'
import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { LOTTERY_END, LOTTERY_START } from '@/lib/vice-lottery'
import { absoluteUrl } from '@/lib/seo'
import { ctaButton, EMAIL_SENDER_NAME, emailLayout, highlightCard, senderAddress, stepsList } from '@/lib/halloween-winners'

export type ViceDrawStats = { participants: number; tickets: number }

export type ViceWinner = {
  name: string
  phoneHint: string | null
  tickets: number
  ticketNumber: number
  totalTickets: number
  participants: number
  drawnAt: string
}

/** Workshop-only view of a draw: full contact details and the manual e-mail status. */
export type ViceDrawAdmin = ViceWinner & {
  id: string
  contact: { name: string | null; phone: string | null; email: string | null }
  emailSentAt: string | null
  emailError: string | null
}

export type ViceDrawState = ViceDrawStats & { canDraw: boolean; winner: ViceWinner | null; names: string[] }

type OrderLine = { name?: string; quantity?: number; cancelled?: boolean }
type OrderRow = { customer_id: string | null; phone: string | null; customer: string | null; items: unknown }
type Entry = { key: string; tickets: number; name: string | null; phone: string | null; email: string | null }

const PAGE = 1000
const VICE_SET_NAME = /^vice\s+zestaw/i
const STATS_TTL_MS = 30_000

export function countViceSets(items: unknown): number {
  if (!Array.isArray(items)) return 0
  return (items as OrderLine[]).reduce((sum, line) => {
    if (!line || line.cancelled || !VICE_SET_NAME.test(line.name ?? '')) return sum
    return sum + Math.max(1, Math.floor(Number(line.quantity) || 1))
  }, 0)
}

function normalizePhone(phone: string | null | undefined) {
  const digits = (phone ?? '').replace(/\D/g, '').replace(/^48(?=\d{9}$)/, '')
  return digits.length >= 9 ? digits : null
}

/** "Jan Kowalski" -> "Jan K." so the public widget never shows full surnames. */
export function maskName(name: string | null | undefined) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'Gracz Yummy City'
  const [first, ...rest] = parts
  return rest.length ? `${first} ${rest[rest.length - 1][0].toUpperCase()}.` : first
}

const phoneHint = (phone: string | null) => (phone ? `••• ••• ${phone.slice(-3)}` : null)

/**
 * One person = Yummy Club account, or the phone number for guest orders (merged into the account when the
 * phone matches its profile). Orders don't store e-mail, so anonymous orders without a phone can't enter.
 * Every VICE Zestaw in a completed order during the campaign is one ticket.
 */
export async function getViceDrawEntries(): Promise<Entry[]> {
  const admin = createAdminClient()
  const entries = new Map<string, Entry>()

  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from('orders')
      .select('customer_id, phone, customer, items')
      .eq('status', 'handed_off')
      .gte('created_at', LOTTERY_START)
      .lte('created_at', LOTTERY_END)
      .order('created_at', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw error
    for (const order of (data ?? []) as OrderRow[]) {
      const sets = countViceSets(order.items)
      if (!sets) continue
      const phone = normalizePhone(order.phone)
      const key = order.customer_id ? `user:${order.customer_id}` : phone ? `phone:${phone}` : null
      if (!key) continue
      const entry = entries.get(key) ?? { key, tickets: 0, name: null, phone: null, email: null }
      entry.tickets += sets
      entry.name ||= order.customer?.trim() || null
      entry.phone ||= phone
      entries.set(key, entry)
    }
    if (!data || data.length < PAGE) break
  }

  const userIds = [...entries.keys()].filter((key) => key.startsWith('user:')).map((key) => key.slice(5))
  for (let index = 0; index < userIds.length; index += 200) {
    const { data, error } = await admin.from('profiles').select('id, full_name, email, phone').in('id', userIds.slice(index, index + 200))
    if (error) throw error
    for (const profile of data ?? []) {
      const entry = entries.get(`user:${profile.id}`)
      if (!entry) continue
      entry.name = profile.full_name?.trim() || entry.name || profile.email?.split('@')[0] || null
      entry.email = profile.email ?? null
      const profilePhone = normalizePhone(profile.phone)
      if (profilePhone) entry.phone = profilePhone
      const guest = profilePhone ? entries.get(`phone:${profilePhone}`) : undefined
      if (guest) {
        entry.tickets += guest.tickets
        entries.delete(guest.key)
      }
    }
  }

  return [...entries.values()]
}

let statsCache: { at: number; value: ViceDrawStats & { names: string[] } } | null = null

export async function getViceDrawStats() {
  if (statsCache && Date.now() - statsCache.at < STATS_TTL_MS) return statsCache.value
  const entries = await getViceDrawEntries()
  const value = {
    participants: entries.length,
    tickets: entries.reduce((sum, entry) => sum + entry.tickets, 0),
    names: [...new Set(entries.map((entry) => maskName(entry.name)))].slice(0, 80),
  }
  statsCache = { at: Date.now(), value }
  return value
}

type DrawRow = {
  id: string
  email_sent_at: string | null
  email_error: string | null
  winner_name: string | null
  winner_phone: string | null
  winner_email: string | null
  winner_tickets: number
  ticket_number: number
  total_tickets: number
  participants: number
  drawn_at: string
}

function toWinner(row: DrawRow): ViceWinner {
  return {
    name: maskName(row.winner_name),
    phoneHint: phoneHint(row.winner_phone),
    tickets: row.winner_tickets,
    ticketNumber: row.ticket_number,
    totalTickets: row.total_tickets,
    participants: row.participants,
    drawnAt: row.drawn_at,
  }
}

function toAdmin(row: DrawRow): ViceDrawAdmin {
  return {
    ...toWinner(row),
    id: row.id,
    contact: { name: row.winner_name, phone: row.winner_phone, email: row.winner_email },
    emailSentAt: row.email_sent_at,
    emailError: row.email_error,
  }
}

async function getLatestDrawRow() {
  const { data, error } = await createAdminClient().from('vice_draws').select('*').order('drawn_at', { ascending: false }).limit(1).maybeSingle()
  if (error) throw error
  return (data as DrawRow | null) ?? null
}

export async function getLatestWinner() {
  const row = await getLatestDrawRow()
  return row ? toWinner(row) : null
}

export const VICE_WINNER_TAG = 'vice-winner'

/**
 * The public result only changes when a manager draws, so it lives in the shared Next.js data cache and is
 * invalidated by the draw itself. The hourly revalidate is only a safety net for rows edited directly in Supabase.
 */
export const getCachedLatestWinner = unstable_cache(getLatestWinner, ['vice-latest-winner'], {
  tags: [VICE_WINNER_TAG],
  revalidate: 3600,
})

export async function getLatestDrawAdmin() {
  const row = await getLatestDrawRow()
  return row ? toAdmin(row) : null
}

function winnerEmail(row: DrawRow) {
  const firstName = row.winner_name?.trim().split(/\s+/)[0] || 'Graczu'
  const clubUrl = absoluteUrl('/yummy-club')
  const odds = ((row.winner_tickets / row.total_tickets) * 100).toLocaleString('pl-PL', { maximumFractionDigits: 1 })
  const subject = 'Wygrałeś losowanie GTA VI w Yummy City!'
  const html = emailLayout({
    preheader: 'Twój los został wylosowany. Odbierz nagrodę w Yummy.',
    eyebrow: 'Yummy City · Losowanie GTA VI',
    heading: 'Gratulacje – wygrałeś!',
    subheading: `Spośród ${row.participants} uczestników i ${row.total_tickets} losów wypadło na Ciebie.`,
    firstName,
    intro: 'Dziękujemy za udział w akcji VICE Zestaw. Twój los został wylosowany jako zwycięski. Poniżej znajdziesz szczegóły i to, jak odebrać nagrodę.',
    content: `${highlightCard('Zwycięski los', `#${row.ticket_number} z ${row.total_tickets}`, `Miałeś ${row.winner_tickets} ${row.winner_tickets === 1 ? 'los' : 'losy'} (szansa ${odds}%).`)}
        ${stepsList('Jak odebrać nagrodę', [
          'Odpowiedz na tego maila lub zadzwoń do nas, żeby potwierdzić odbiór.',
          'Na odbiór nagrody masz 7 dni od tej wiadomości.',
          'Przy odbiorze w Yummy w Rybniku przedstaw się imieniem i numerem telefonu z zamówienia.',
        ])}
        ${ctaButton('Przejdź do Yummy Club', clubUrl)}`,
    footerNote: 'Otrzymujesz tę wiadomość, bo kupiłeś VICE Zestaw i wziąłeś udział w losowaniu GTA VI.',
  })
  const text = `Cześć ${firstName},\n\nGratulacje! Wygrałeś losowanie GTA VI w Yummy City.\nZwycięski los: #${row.ticket_number} z ${row.total_tickets} (miałeś ${row.winner_tickets}).\n\nJak odebrać: odpowiedz na tego maila lub zadzwoń do nas w ciągu 7 dni. Przy odbiorze w Yummy w Rybniku przedstaw się imieniem i numerem telefonu z zamówienia.\n\n${clubUrl}\n\nSmacznego,\nZespół ${EMAIL_SENDER_NAME}`
  return { subject, html, text }
}

export type SendResult = { ok: true; draw: ViceDrawAdmin } | { ok: false; status: number; error: string }

/** Manually triggered from the workshop; the idempotency key stops a double-click from sending twice. */
export async function sendViceWinnerEmail(drawId: string): Promise<SendResult> {
  const admin = createAdminClient()
  const { data, error } = await admin.from('vice_draws').select('*').eq('id', drawId).maybeSingle()
  if (error) throw error
  const row = data as DrawRow | null
  if (!row) return { ok: false, status: 404, error: 'Nie znaleziono losowania.' }
  if (!row.winner_email) return { ok: false, status: 409, error: 'Zwycięzca nie ma adresu e-mail – skontaktuj się telefonicznie.' }

  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL
  if (!apiKey || !from) return { ok: false, status: 500, error: 'Brak konfiguracji Resend (RESEND_API_KEY / RESEND_FROM_EMAIL).' }

  const { subject, html, text } = winnerEmail(row)
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `vice-winner-${row.id}-${row.email_sent_at ?? 'first'}`,
    },
    body: JSON.stringify({ from: senderAddress(from), to: [row.winner_email], subject, html, text }),
  })
  const failure = response.ok
    ? null
    : ((await response.json().catch(() => null)) as { message?: string } | null)?.message?.slice(0, 300) || `Resend HTTP ${response.status}`

  const { data: updated, error: updateError } = await admin
    .from('vice_draws')
    .update(failure ? { email_error: failure } : { email_sent_at: new Date().toISOString(), email_error: null })
    .eq('id', row.id)
    .select('*')
    .single()
  if (updateError) throw updateError
  if (failure) return { ok: false, status: 502, error: failure }
  return { ok: true, draw: toAdmin(updated as DrawRow) }
}

/** Weighted draw: pick one ticket uniformly with a CSPRNG, the owner of that ticket wins. */
export async function drawViceWinner(drawnBy: string) {
  const entries = await getViceDrawEntries()
  const total = entries.reduce((sum, entry) => sum + entry.tickets, 0)
  if (!total) return null

  const ticket = randomInt(total)
  let cursor = 0
  const winner = entries.find((entry) => (cursor += entry.tickets) > ticket)!

  const { data, error } = await createAdminClient()
    .from('vice_draws')
    .insert({
      winner_key: winner.key,
      winner_name: winner.name,
      winner_phone: winner.phone,
      winner_email: winner.email,
      winner_tickets: winner.tickets,
      ticket_number: ticket + 1,
      total_tickets: total,
      participants: entries.length,
      drawn_by: drawnBy,
    })
    .select('*')
    .single()
  if (error) throw error
  return toWinner(data as DrawRow)
}
