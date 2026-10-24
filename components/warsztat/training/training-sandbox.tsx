'use client'

import { createContext, useContext } from 'react'
import type { PaymentMethod, PaymentPart } from '@/lib/fiscal-receipt'
import type { KitchenOrder } from '../order-data'
import type { DocumentRequest } from '../use-document-printer'

export type TrainingPayment = { method?: PaymentMethod; split?: PaymentPart[]; buyerNip?: string }

/**
 * While the training mode is on, the real workshop dialogs hand every write (new order, payment, receipt)
 * to this sandbox instead of the API or the printer, so nothing leaves the browser.
 */
export type TrainingSandbox = {
  createOrder: (order: KitchenOrder) => KitchenOrder
  recordPayment: (databaseId: string, payment: TrainingPayment) => void
  undoPayment: (databaseId: string) => void
  issueDocument: (databaseId: string, request: DocumentRequest) => void
}

export const TrainingSandboxContext = createContext<TrainingSandbox | null>(null)

export const useTrainingSandbox = () => useContext(TrainingSandboxContext)

export const TRAINING_NOTE = 'Tryb szkoleniowy – nic nie trafiło do bazy, na kuchnię ani na drukarkę.'
