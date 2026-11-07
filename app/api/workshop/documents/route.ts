import { NextResponse } from 'next/server'
import type { FiscalReceipt } from '@/lib/fiscal-receipt'
import { dbError, requireCashier } from '@/lib/workshop-documents'

export type PendingDocumentSummary = { id: string; kind: FiscalReceipt['kind']; orderNumber: string; total: number; createdAt: string }

/** Every document still waiting for printer confirmation, newest first – used by the global „Odzyskaj paragon” recovery. */
export async function GET() {
  const auth = await requireCashier()
  if ('error' in auth) return auth.error
  const { data, error } = await auth.admin
    .from('order_documents')
    .select('id, kind, payload, total_grosze, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(20)
    .returns<{ id: string; kind: FiscalReceipt['kind']; payload: FiscalReceipt; total_grosze: number; created_at: string }[]>()
  if (error) return dbError(error.message, 'Nie udało się wczytać zaległych paragonów.')
  const documents: PendingDocumentSummary[] = (data ?? []).map((row) => ({
    id: row.id,
    kind: row.kind,
    orderNumber: row.payload?.orderNumber ?? '',
    total: row.total_grosze,
    createdAt: row.created_at,
  }))
  return NextResponse.json({ documents })
}
