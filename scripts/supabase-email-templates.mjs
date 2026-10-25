// Generates Yummy-branded Polish auth e-mail templates and (with --push) applies them
// to the Supabase project via the Management API.
//
//   node scripts/supabase-email-templates.mjs          -> writes HTML to supabase/email-templates
//   node --env-file=.env.local scripts/supabase-email-templates.mjs --push
//
// --push requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_ACCESS_TOKEN (personal access token
// from https://supabase.com/dashboard/account/tokens). Project API keys cannot change auth config.

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RED = '#e2261c'
const RED_DARK = '#b51a12'
const RED_SOFT = '#fde8e4'
const CREAM = '#f7f1ea'
const INK = '#1a1513'
const BODY = '#4a403b'
const MUTED = '#7a6e67'
const LINE = '#f0e6dc'

function button(href, label) {
  return `
                <tr>
                  <td align="center" style="padding:16px 36px 32px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="center" style="border-radius:999px;background-color:${RED};">
                          <a href="${href}" style="display:inline-block;padding:16px 36px;font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:999px;">
                            ${label}
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>`
}

function codeBox(code) {
  return `
                <tr>
                  <td align="center" style="padding:8px 36px 32px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="background-color:${CREAM};border-radius:14px;border:1px dashed ${RED};">
                      <tr>
                        <td align="center" style="padding:18px 32px;font-family:'Courier New',Courier,monospace;font-size:32px;font-weight:bold;letter-spacing:8px;color:${INK};">
                          ${code}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>`
}

function infoBox(html, tone = 'red') {
  const bg = tone === 'red' ? RED_SOFT : CREAM
  const color = tone === 'red' ? RED_DARK : BODY
  return `
                <tr>
                  <td style="padding:0 36px 36px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${bg};border-radius:14px;">
                      <tr>
                        <td style="padding:18px 20px;font-size:14px;line-height:1.6;color:${color};">
                          ${html}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>`
}

function fallbackLink(href) {
  return `
                <tr>
                  <td style="padding:0 36px 36px;border-top:1px solid ${LINE};">
                    <p style="margin:24px 0 8px;font-size:13px;line-height:1.6;color:${MUTED};">
                      Przycisk nie działa? Skopiuj ten link do przeglądarki:
                    </p>
                    <p style="margin:0;font-size:12px;line-height:1.5;word-break:break-all;">
                      <a href="${href}" style="color:${RED};text-decoration:underline;">${href}</a>
                    </p>
                  </td>
                </tr>`
}

function layout({ title, preheader, eyebrow, heading, paragraphs, blocks, footerNote }) {
  const text = paragraphs
    .map(
      (p) =>
        `                    <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${BODY};">\n                      ${p}\n                    </p>`,
    )
    .join('\n')

  return `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:${CREAM};font-family:Arial,Helvetica,sans-serif;color:${INK};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    ${preheader}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${CREAM};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
          <tr>
            <td align="center" style="padding:0 0 24px;">
              <a href="{{ .SiteURL }}" style="text-decoration:none;">
                <img src="https://yummyrybnik.pl/images/yummy-logo-email.png" width="160" height="96" alt="Yummy" style="display:block;border:0;outline:none;width:160px;height:auto;">
              </a>
            </td>
          </tr>
          <tr>
            <td style="background-color:#ffffff;border-radius:20px;overflow:hidden;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="height:6px;background-color:${RED};font-size:0;line-height:0;">&nbsp;</td>
                </tr>
                <tr>
                  <td style="padding:40px 36px 12px;">
                    <p style="margin:0 0 12px;font-size:13px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:${RED};">
                      ${eyebrow}
                    </p>
                    <h1 style="margin:0 0 16px;font-size:28px;line-height:1.2;font-weight:800;color:${INK};">
                      ${heading}
                    </h1>
${text}
                  </td>
                </tr>${blocks.join('')}
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:24px 16px 0;font-size:12px;line-height:1.6;color:${MUTED};">
              ${footerNote}<br>
              &copy; Yummy &middot; <a href="{{ .SiteURL }}" style="color:${MUTED};text-decoration:underline;">Odwiedź naszą stronę</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`
}

const confirmUrl = (type, next) =>
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=${type}&amp;next=${encodeURIComponent(next)}`

const SIGNUP_URL = confirmUrl("signup", "/yummy-club/aktywowano")
const RECOVERY_URL = confirmUrl("recovery", "/yummy-club/nowe-haslo")
const MAGIC_URL = confirmUrl("magiclink", "/yummy-club")
const INVITE_URL = confirmUrl("invite", "/yummy-club/nowe-haslo")
const EMAIL_CHANGE_URL = confirmUrl("email_change", "/yummy-club")

export const templates = [
  {
    file: 'confirm-signup.html',
    subjectKey: 'mailer_subjects_confirmation',
    contentKey: 'mailer_templates_confirmation_content',
    subject: '{{ .Token }} – Twój kod do Yummy Club',
    html: layout({
      title: 'Twój kod aktywacyjny Yummy Club',
      preheader: 'Twój kod aktywacyjny Yummy Club: {{ .Token }}',
      eyebrow: 'Yummy Club',
      heading: 'Witaj w klubie!',
      paragraphs: [
        'Dzięki za rejestrację w Yummy Club. Wpisz poniższy kod na stronie rejestracji, aby potwierdzić adres e-mail i aktywować konto.',
      ],
      blocks: [
        codeBox('{{ .Token }}'),
        infoBox('<strong>Kod jest ważny przez 1 godzinę.</strong> Nikomu go nie podawaj – zespół Yummy nigdy o niego nie poprosi.', 'cream'),
        infoBox('<strong>Co dalej?</strong> Zbieraj punkty przy każdym zamówieniu i wymieniaj je na darmowe burgery, frytki i napoje.'),
      ],
      footerNote: 'Jeśli to nie Ty zakładałeś konto, po prostu zignoruj tę wiadomość.',
    }),
  },
  {
    file: 'reset-password.html',
    subjectKey: 'mailer_subjects_recovery',
    contentKey: 'mailer_templates_recovery_content',
    subject: 'Ustaw nowe hasło do Yummy Club',
    html: layout({
      title: 'Ustaw nowe hasło do Yummy Club',
      preheader: 'Otrzymaliśmy prośbę o zmianę hasła do Twojego konta Yummy.',
      eyebrow: 'Zmiana hasła',
      heading: 'Zapomniałeś hasła? Spoko.',
      paragraphs: [
        'Otrzymaliśmy prośbę o zmianę hasła do konta <strong>{{ .Email }}</strong>. Kliknij przycisk poniżej i ustaw nowe hasło – Twoje punkty czekają.',
      ],
      blocks: [
        button(RECOVERY_URL, 'Ustaw nowe hasło'),
        infoBox('<strong>Link jest ważny przez 1 godzinę</strong> i można go użyć tylko raz. Jeśli wygaśnie, poproś o nowy na stronie logowania.', 'cream'),
        fallbackLink(RECOVERY_URL),
      ],
      footerNote: 'Nie prosiłeś o zmianę hasła? Zignoruj tę wiadomość – Twoje hasło pozostanie bez zmian.',
    }),
  },
  {
    file: 'magic-link.html',
    subjectKey: 'mailer_subjects_magic_link',
    contentKey: 'mailer_templates_magic_link_content',
    subject: 'Twój link do logowania w Yummy',
    html: layout({
      title: 'Twój link do logowania w Yummy',
      preheader: 'Zaloguj się do Yummy jednym kliknięciem.',
      eyebrow: 'Logowanie',
      heading: 'Zaloguj się jednym kliknięciem',
      paragraphs: ['Kliknij przycisk poniżej, aby zalogować się na konto <strong>{{ .Email }}</strong>. Bez wpisywania hasła.'],
      blocks: [
        button(MAGIC_URL, 'Zaloguj się'),
        infoBox('Link jest jednorazowy i wygasa po 1 godzinie. Możesz też użyć kodu: <strong>{{ .Token }}</strong>', 'cream'),
        fallbackLink(MAGIC_URL),
      ],
      footerNote: 'Jeśli to nie Ty próbowałeś się zalogować, zignoruj tę wiadomość.',
    }),
  },
  {
    file: 'invite-user.html',
    subjectKey: 'mailer_subjects_invite',
    contentKey: 'mailer_templates_invite_content',
    subject: 'Zaproszenie do Yummy',
    html: layout({
      title: 'Zaproszenie do Yummy',
      preheader: 'Zostałeś zaproszony do Yummy. Przyjmij zaproszenie i ustaw hasło.',
      eyebrow: 'Zaproszenie',
      heading: 'Zapraszamy do Yummy!',
      paragraphs: [
        'Ktoś z zespołu Yummy założył dla Ciebie konto na adres <strong>{{ .Email }}</strong>. Kliknij przycisk poniżej, aby przyjąć zaproszenie.',
      ],
      blocks: [button(INVITE_URL, 'Przyjmuję zaproszenie'), fallbackLink(INVITE_URL)],
      footerNote: 'Nie spodziewałeś się tego zaproszenia? Po prostu zignoruj tę wiadomość.',
    }),
  },
  {
    file: 'change-email.html',
    subjectKey: 'mailer_subjects_email_change',
    contentKey: 'mailer_templates_email_change_content',
    subject: 'Potwierdź zmianę adresu e-mail w Yummy',
    html: layout({
      title: 'Potwierdź zmianę adresu e-mail w Yummy',
      preheader: 'Potwierdź, że chcesz zmienić adres e-mail swojego konta Yummy.',
      eyebrow: 'Zmiana adresu e-mail',
      heading: 'Potwierdź nowy adres',
      paragraphs: [
        'Poproszono o zmianę adresu e-mail konta z <strong>{{ .Email }}</strong> na <strong>{{ .NewEmail }}</strong>. Kliknij przycisk, aby to potwierdzić.',
      ],
      blocks: [button(EMAIL_CHANGE_URL, 'Potwierdzam zmianę'), fallbackLink(EMAIL_CHANGE_URL)],
      footerNote: 'Jeśli to nie Ty zmieniałeś adres, zignoruj tę wiadomość i zmień hasło do konta.',
    }),
  },
  {
    file: 'reauthentication.html',
    subjectKey: 'mailer_subjects_reauthentication',
    contentKey: 'mailer_templates_reauthentication_content',
    subject: 'Twój kod weryfikacyjny Yummy',
    html: layout({
      title: 'Twój kod weryfikacyjny Yummy',
      preheader: 'Twój jednorazowy kod weryfikacyjny Yummy.',
      eyebrow: 'Weryfikacja',
      heading: 'Potwierdź, że to Ty',
      paragraphs: ['Aby dokończyć tę operację na koncie Yummy, wpisz poniższy jednorazowy kod:'],
      blocks: [codeBox('{{ .Token }}'), infoBox('Nikomu nie podawaj tego kodu. Zespół Yummy nigdy o niego nie poprosi.')],
      footerNote: 'Jeśli to nie Ty, zignoruj tę wiadomość i zmień hasło do konta.',
    }),
  },
  {
    file: 'notification-password-changed.html',
    subjectKey: 'mailer_subjects_password_changed_notification',
    contentKey: 'mailer_templates_password_changed_notification_content',
    enabledKey: 'mailer_notifications_password_changed_enabled',
    subject: 'Hasło do Twojego konta Yummy zostało zmienione',
    html: layout({
      title: 'Hasło do Twojego konta Yummy zostało zmienione',
      preheader: 'Hasło do Twojego konta Yummy zostało właśnie zmienione.',
      eyebrow: 'Bezpieczeństwo konta',
      heading: 'Hasło zostało zmienione',
      paragraphs: ['Informujemy, że hasło do konta <strong>{{ .Email }}</strong> zostało właśnie zmienione.'],
      blocks: [
        infoBox('<strong>To nie Ty?</strong> Od razu zresetuj hasło na stronie logowania Yummy Club, korzystając z opcji „Nie pamiętasz hasła?”.'),
      ],
      footerNote: 'Jeśli to Ty zmieniałeś hasło, nie musisz nic robić.',
    }),
  },
  {
    file: 'notification-email-changed.html',
    subjectKey: 'mailer_subjects_email_changed_notification',
    contentKey: 'mailer_templates_email_changed_notification_content',
    enabledKey: 'mailer_notifications_email_changed_enabled',
    subject: 'Adres e-mail Twojego konta Yummy został zmieniony',
    html: layout({
      title: 'Adres e-mail Twojego konta Yummy został zmieniony',
      preheader: 'Adres e-mail Twojego konta Yummy został zmieniony.',
      eyebrow: 'Bezpieczeństwo konta',
      heading: 'Adres e-mail zmieniony',
      paragraphs: [
        'Adres e-mail Twojego konta został zmieniony z <strong>{{ .OldEmail }}</strong> na <strong>{{ .Email }}</strong>.',
      ],
      blocks: [infoBox('<strong>To nie Ty?</strong> Skontaktuj się z nami jak najszybciej, abyśmy mogli zabezpieczyć Twoje konto.')],
      footerNote: 'Jeśli to Ty zmieniałeś adres, nie musisz nic robić.',
    }),
  },
]

async function writeFiles() {
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'email-templates')
  await mkdir(dir, { recursive: true })
  await Promise.all(templates.map((t) => writeFile(path.join(dir, t.file), t.html)))
  console.log(`Zapisano ${templates.length} szablonów w ${dir}`)
}

async function push() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const token = process.env.SUPABASE_ACCESS_TOKEN
  if (!url || !token) throw new Error('Brak NEXT_PUBLIC_SUPABASE_URL lub SUPABASE_ACCESS_TOKEN')
  const ref = new URL(url).hostname.split('.')[0]

  const body = { mailer_otp_length: 6, smtp_max_frequency: 120 }
  for (const t of templates) {
    body[t.subjectKey] = t.subject
    body[t.contentKey] = t.html
    if (t.enabledKey) body[t.enabledKey] = true
  }

  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Supabase API ${res.status}: ${await res.text()}`)
  const config = await res.json()
  for (const t of templates) {
    const ok = config[t.subjectKey] === t.subject && config[t.contentKey] === t.html
    console.log(`${ok ? 'OK ' : 'ERR'} ${t.subjectKey}`)
  }
}

await writeFiles()
if (process.argv.includes('--push')) await push()
