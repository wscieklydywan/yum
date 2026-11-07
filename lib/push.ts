import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/server'

export type PushStation = 'kitchen' | 'cashier'

type VapidKeys = { publicKey: string; privateKey: string }

let cachedKeys: VapidKeys | null = null

/** The key pair lives in the database (service-role only) so push works without extra env setup. */
export async function getVapidKeys(): Promise<VapidKeys> {
  if (cachedKeys) return cachedKeys
  const admin = createAdminClient()
  const { data } = await admin.from('push_vapid_keys').select('public_key, private_key').eq('id', 1).maybeSingle()
  if (data) return (cachedKeys = { publicKey: data.public_key, privateKey: data.private_key })

  const generated = webpush.generateVAPIDKeys()
  await admin.from('push_vapid_keys').upsert({ id: 1, public_key: generated.publicKey, private_key: generated.privateKey }, { onConflict: 'id', ignoreDuplicates: true })
  const { data: stored } = await admin.from('push_vapid_keys').select('public_key, private_key').eq('id', 1).single()
  return (cachedKeys = { publicKey: stored!.public_key, privateKey: stored!.private_key })
}

type PushPayload = { title: string; body: string; tag: string }

/** Sends a "new order" push to every device registered for the station; dead subscriptions are removed. */
export async function sendStationPush(station: PushStation, payload: PushPayload) {
  try {
    const admin = createAdminClient()
    const [{ data: subscriptions }, keys] = await Promise.all([
      admin.from('push_subscriptions').select('endpoint, p256dh, auth').eq('station', station),
      getVapidKeys(),
    ])
    if (!subscriptions?.length) return
    const body = JSON.stringify({ ...payload, url: '/warsztat' })
    const options = {
      vapidDetails: { subject: 'mailto:kontakt@yummy.pl', publicKey: keys.publicKey, privateKey: keys.privateKey },
      TTL: 15 * 60,
      urgency: 'high' as const,
      topic: payload.tag.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32),
    }
    const expired: string[] = []
    await Promise.all(subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, body, options)
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) expired.push(subscription.endpoint)
      }
    }))
    if (expired.length) await admin.from('push_subscriptions').delete().in('endpoint', expired)
  } catch (error) {
    console.error('Push send failed', error)
  }
}

export const newOrderPush = (number: number | string, description: string): PushPayload => ({
  title: `Nowe zamówienie #${number}`,
  body: description,
  tag: `new-#${number}`,
})

export const kitchenOrderPush = (number: number | string, description: string): PushPayload => ({
  title: `Do zrobienia: #${number}`,
  body: description,
  tag: `kitchen-#${number}`,
})
