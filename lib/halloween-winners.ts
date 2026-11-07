import 'server-only'
import { createAdminClient } from '@/lib/supabase/server'
import { absoluteUrl, SITE_NAME } from '@/lib/seo'

export type HalloweenWinnerAdmin = {
  place: number
  score: number
  prize: string
  stars: number
  code: string | null
  expires_at: string | null
  awarded_at: string
  email_sent_at: string | null
  email_error: string | null
  redeemed: boolean
  name: string
  email: string | null
}

type WinnerRow = Omit<HalloweenWinnerAdmin, 'redeemed' | 'name' | 'email'> & {
  profiles: { full_name: string | null; email: string | null } | null
}

const WINNER_COLUMNS = 'place, score, prize, stars, code, expires_at, awarded_at, email_sent_at, email_error, profiles(full_name, email)'

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('pl-PL', { timeZone: 'Europe/Warsaw', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso))

const EMAIL_SENDER_NAME = 'Yummy Rybnik'
const EMAIL_LOGO_URL = 'https://yummyrybnik.pl/images/yummy-logo-email.png'

const BRAND = {
  ink: '#1a1220',
  orange: '#f07b1d',
  amber: '#f7a93b',
  cream: '#fbf5ec',
  muted: '#7a726a',
  line: '#eee5d8',
}

function senderAddress(from: string) {
  return from.includes('<') ? from : `${EMAIL_SENDER_NAME} <${from.trim()}>`
}

const firstNameOf = (winner: WinnerRow) => winner.profiles?.full_name?.trim().split(/\s+/)[0] || 'Graczu'
const prizeName = (winner: WinnerRow) => winner.prize.replace(/^Halloween \d+\. miejsce: /, '')

function sectionLabel(text: string) {
  return `<p style="margin:0 0 8px;font-size:10px;letter-spacing:1.6px;text-transform:uppercase;color:${BRAND.orange};font-weight:bold">${text}</p>`
}

function statsRow(place: number, score: number) {
  const cell = (label: string, value: string, divider: boolean) =>
    `<td width="50%" style="padding:12px 8px;text-align:center;${divider ? `border-right:1px solid ${BRAND.line};` : ''}">
              <p style="margin:0;font-size:10px;letter-spacing:1.4px;text-transform:uppercase;color:${BRAND.muted}">${label}</p>
              <p style="margin:3px 0 0;font-size:20px;line-height:1.2;font-weight:bold;color:${BRAND.ink}">${value}</p>
            </td>`
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;border:1px solid ${BRAND.line};border-radius:14px;border-collapse:separate">
          <tr>${cell('Miejsce', `${place}.`, true)}${cell('Twój wynik', `${score} pkt`, false)}</tr>
        </table>`
}

function highlightCard(label: string, value: string, note?: string) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px;background:${BRAND.cream};border-radius:14px;border-left:4px solid ${BRAND.orange}">
          <tr><td style="padding:14px 16px">
            <p style="margin:0;font-size:10px;letter-spacing:1.4px;text-transform:uppercase;color:${BRAND.muted};font-weight:bold">${label}</p>
            <p style="margin:4px 0 0;font-size:15px;line-height:1.4;font-weight:bold;color:${BRAND.ink}">${value}</p>
            ${note ? `<p style="margin:4px 0 0;font-size:12px;line-height:1.4;color:${BRAND.muted}">${note}</p>` : ''}
          </td></tr>
        </table>`
}

function codeTicket(code: string, expiresAt: string) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;background:${BRAND.ink};border-radius:14px">
          <tr><td style="padding:16px 14px;text-align:center">
            <p style="margin:0;font-size:10px;letter-spacing:1.6px;text-transform:uppercase;color:${BRAND.amber};font-weight:bold">Kod do odbioru przy ladzie</p>
            <p style="margin:10px 0 0;padding:10px 6px;border:1px dashed ${BRAND.amber};border-radius:10px;font-size:20px;line-height:1.2;font-weight:bold;letter-spacing:2px;font-family:'Courier New',Courier,monospace;color:#ffffff;word-break:break-all">${code}</p>
            <p style="margin:10px 0 0;font-size:12px;color:#c9bfd3">Ważny do ${formatDate(expiresAt)}</p>
          </td></tr>
        </table>`
}

function stepsList(title: string, items: string[]) {
  const rows = items
    .map(
      (item, index) => `<tr>
            <td width="30" valign="top" style="padding:0 0 10px">
              <div style="width:22px;height:22px;line-height:22px;border-radius:11px;background:${BRAND.cream};color:${BRAND.orange};font-size:12px;font-weight:bold;text-align:center">${index + 1}</div>
            </td>
            <td valign="top" style="padding:2px 0 10px;font-size:13px;line-height:1.45;color:${BRAND.ink}">${item}</td>
          </tr>`,
    )
    .join('')
  return `${sectionLabel(title)}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 10px">${rows}</table>`
}

const NEXT_GAME_TEXT =
  'Dyniowe Łowy to dopiero początek. Szykujemy kolejne gry i zabawy z nagrodami. Śledź na bieżąco stronę Yummy i Yummy Club, żeby nie przegapić startu. Zapraszamy do następnej zabawy!'

function nextGameCard() {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border:1px dashed ${BRAND.orange};border-radius:14px;border-collapse:separate">
          <tr><td style="padding:14px 16px;text-align:center">
            <p style="margin:0;font-size:10px;letter-spacing:1.6px;text-transform:uppercase;color:${BRAND.orange};font-weight:bold">To nie koniec zabawy</p>
            <p style="margin:6px 0 0;font-size:15px;line-height:1.35;font-weight:bold;color:${BRAND.ink}">Kolejna gra już wkrótce</p>
            <p style="margin:6px 0 0;font-size:13px;line-height:1.5;color:#4a423c">${NEXT_GAME_TEXT}</p>
          </td></tr>
        </table>`
}

function ctaButton(label: string, href: string) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px"><tr><td align="center">
          <a href="${href}" style="display:block;background:${BRAND.orange};color:#ffffff;text-decoration:none;font-weight:bold;font-size:14px;padding:13px 20px;border-radius:12px;text-align:center">${label}</a>
        </td></tr></table>`
}

function emailLayout({ preheader, eyebrow, heading, subheading, firstName, intro, content }: { preheader: string; eyebrow: string; heading: string; subheading: string; firstName: string; intro: string; content: string }) {
  const siteUrl = absoluteUrl('/')
  return `<!doctype html>
<html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${heading}</title></head>
<body style="margin:0;padding:0;background:#f3eee7;font-family:Helvetica,Arial,sans-serif;color:${BRAND.ink};-webkit-text-size-adjust:100%">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3eee7"><tr><td align="center" style="padding:20px 10px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:460px;background:#ffffff;border-radius:18px;overflow:hidden">
      <tr><td style="background:${BRAND.ink};padding:22px 20px;text-align:center">
        <img src="${EMAIL_LOGO_URL}" width="84" alt="Yummy Rybnik" style="display:block;margin:0 auto 16px;border:0;outline:none;width:84px;height:auto">
        <p style="margin:0;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:${BRAND.amber};font-weight:bold">${eyebrow}</p>
        <h1 style="margin:8px 0 0;font-size:22px;line-height:1.25;font-weight:bold;color:#ffffff">${heading}</h1>
        <p style="margin:6px 0 0;font-size:13px;line-height:1.45;color:#c9bfd3">${subheading}</p>
      </td></tr>
      <tr><td style="height:4px;line-height:4px;font-size:0;background:${BRAND.orange}">&nbsp;</td></tr>
      <tr><td style="padding:22px 20px 6px;font-size:14px;line-height:1.55">
        <p style="margin:0 0 8px;font-weight:bold">Cześć ${escapeHtml(firstName)},</p>
        <p style="margin:0 0 18px;color:#4a423c">${intro}</p>
        ${content}
        <p style="margin:0 0 20px;font-size:13px;line-height:1.5;color:#4a423c">Smacznego,<br><strong style="color:${BRAND.ink}">Zespół ${EMAIL_SENDER_NAME}</strong></p>
      </td></tr>
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:460px"><tr><td style="padding:16px 16px 0;text-align:center;font-size:11px;line-height:1.5;color:#9a918a">
      <a href="${siteUrl}" style="color:#9a918a;text-decoration:none;font-weight:bold">${EMAIL_SENDER_NAME}</a> · Yummy Club<br>
      Otrzymujesz tę wiadomość, bo wziąłeś udział w grze Dyniowe Łowy.
    </td></tr></table>
  </td></tr></table>
</body></html>`
}

function runnerUpEmail(winner: WinnerRow) {
  const firstName = firstNameOf(winner)
  const clubUrl = absoluteUrl('/yummy-club')
  const subject = `${winner.place}. miejsce w Dyniowych Łowach – dziękujemy za grę!`
  const html = emailLayout({
    preheader: `Zająłeś ${winner.place}. miejsce. Na Twoim koncie czeka +${winner.stars} Stars.`,
    eyebrow: 'Dyniowe Łowy · Wyniki',
    heading: `Świetna gra – ${winner.place}. miejsce!`,
    subheading: 'Jesteś w ścisłej czołówce rankingu.',
    firstName,
    intro: 'Dziękujemy, że grałeś z nami w Dyniowe Łowy. Do podium zabrakło naprawdę niewiele, a w podziękowaniu za walkę mamy dla Ciebie mały bonus.',
    content: `${statsRow(winner.place, winner.score)}
        ${highlightCard('Bonus za grę', `+${winner.stars} Stars`, 'Już są na Twoim koncie Yummy Club.')}
        <div style="height:6px;line-height:6px;font-size:0">&nbsp;</div>
        ${stepsList('Co dalej', [
          'Wymieniaj Stars na nagrody w Yummy Club.',
          'Zbieraj Stars przy każdym zamówieniu.',
          'W następnej grze zawalcz o podium. Trzymamy kciuki!',
        ])}
        ${nextGameCard()}
        ${ctaButton('Przejdź do Yummy Club', clubUrl)}`,
  })
  const text = `Cześć ${firstName},\n\nDziękujemy za grę w Dyniowe Łowy! Zająłeś ${winner.place}. miejsce z wynikiem ${winner.score} pkt.\nW podziękowaniu dodaliśmy Ci +${winner.stars} Stars – są już na Twoim koncie Yummy Club.\n\n${NEXT_GAME_TEXT}\n\n${clubUrl}\n\nSmacznego,\nZespół ${EMAIL_SENDER_NAME}`
  return { subject, html, text }
}

function winnerEmail(winner: WinnerRow) {
  if (!winner.code || !winner.expires_at) return runnerUpEmail(winner)
  const firstName = firstNameOf(winner)
  const clubUrl = absoluteUrl('/yummy-club')
  const prize = prizeName(winner)
  const subject = `Gratulacje! ${winner.place}. miejsce w Dyniowych Łowach – odbierz nagrodę`
  const html = emailLayout({
    preheader: `Twoja nagroda czeka w Yummy. Kod: ${winner.code}`,
    eyebrow: 'Dyniowe Łowy · Zwycięzca',
    heading: `Gratulacje – ${winner.place}. miejsce!`,
    subheading: 'Stanąłeś na podium. Nagroda czeka na Ciebie w Yummy.',
    firstName,
    intro: 'Rozgrywka zakończona, a Ty jesteś wśród najlepszych graczy Dyniowych Łowów. Poniżej znajdziesz swoją nagrodę i kod do odbioru.',
    content: `${statsRow(winner.place, winner.score)}
        ${highlightCard('Twoja nagroda', escapeHtml(prize))}
        ${codeTicket(winner.code, winner.expires_at)}
        ${stepsList('Jak odebrać nagrodę', [
          'Odwiedź Yummy w Rybniku przed upływem ważności kodu.',
          'Podaj kod przy ladzie przed złożeniem zamówienia.',
          'Odbierz nagrodę i smacznego!',
        ])}
        ${nextGameCard()}
        ${ctaButton('Zobacz kod w Yummy Club', clubUrl)}`,
  })
  const text = `Cześć ${firstName},\n\nGratulacje! Zająłeś ${winner.place}. miejsce w Dyniowych Łowach (${winner.score} pkt).\n\nTwoja nagroda: ${prize}\nKod do odbioru przy ladzie: ${winner.code}\nWażny do ${formatDate(winner.expires_at)}.\n\nJak odebrać: odwiedź Yummy w Rybniku, podaj kod przy ladzie przed złożeniem zamówienia i odbierz nagrodę. Kod znajdziesz też w Yummy Club.\n\n${NEXT_GAME_TEXT}\n\n${clubUrl}\n\nSmacznego,\nZespół ${EMAIL_SENDER_NAME}`
  return { subject, html, text }
}

/** Przykładowe maile (podium i miejsca 4–10) do podglądu wyglądu – bez zapisu w bazie. */
export function halloweenEmailSamples(firstName = 'Darek') {
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  const base = { awarded_at: new Date().toISOString(), email_sent_at: null, email_error: null, profiles: { full_name: firstName, email: null } }
  return [
    winnerEmail({ ...base, place: 1, score: 4820, prize: 'Halloween 1. miejsce: Zestaw dla dwóch', stars: 0, code: 'DYNIA-TEST', expires_at: expires }),
    winnerEmail({ ...base, place: 5, score: 3110, prize: 'Halloween 5. miejsce: 20 Stars', stars: 20, code: null, expires_at: null }),
  ]
}

async function sendResendEmail(to: string, winner: WinnerRow) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL
  if (!apiKey || !from) return 'Brak konfiguracji Resend (RESEND_API_KEY / RESEND_FROM_EMAIL).'
  const { subject, html, text } = winnerEmail(winner)
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `halloween-winner-${winner.code ?? `place-${winner.place}-${winner.awarded_at}`}`,
    },
    body: JSON.stringify({ from: senderAddress(from), to: [to], subject, html, text }),
  })
  if (response.ok) return null
  const body = (await response.json().catch(() => null)) as { message?: string } | null
  return body?.message?.slice(0, 300) || `Resend HTTP ${response.status}`
}

export async function sendPendingWinnerEmails() {
  const admin = createAdminClient()
  const { data, error } = await admin.from('halloween_winners').select(WINNER_COLUMNS).is('email_sent_at', null)
  if (error) throw error
  let sent = 0
  for (const winner of (data ?? []) as unknown as WinnerRow[]) {
    const email = winner.profiles?.email
    const failure = email ? await sendResendEmail(email, winner) : 'Zwycięzca nie ma adresu e-mail.'
    await admin
      .from('halloween_winners')
      .update(failure ? { email_error: failure } : { email_sent_at: new Date().toISOString(), email_error: null })
      .eq('place', winner.place)
    if (!failure) sent++
  }
  return sent
}

/** Idempotentne: zapisuje zwycięzców po końcu gry i wysyła brakujące maile. */
export async function finalizeHalloween() {
  const { data, error } = await createAdminClient().rpc('halloween_finalize')
  if (error) throw error
  const result = data as { finalized: boolean; created: number }
  const emailsSent = result.finalized ? await sendPendingWinnerEmails() : 0
  return { ...result, emailsSent }
}

export async function loadWinnersAdmin(): Promise<HalloweenWinnerAdmin[]> {
  const admin = createAdminClient()
  const { data, error } = await admin.from('halloween_winners').select(WINNER_COLUMNS).order('place')
  if (error) throw error
  const rows = (data ?? []) as unknown as WinnerRow[]
  if (rows.length === 0) return []
  const codes = rows.flatMap((row) => (row.code ? [row.code] : []))
  const { data: open } = codes.length ? await admin.from('reward_redemptions').select('code').in('code', codes) : { data: [] }
  const openCodes = new Set((open ?? []).map((row) => row.code as string))
  return rows.map(({ profiles, ...row }) => ({
    ...row,
    name: profiles?.full_name?.trim() || 'Bez imienia',
    email: profiles?.email ?? null,
    redeemed: !!row.code && !!row.expires_at && !openCodes.has(row.code) && new Date(row.expires_at) > new Date(),
  }))
}
