import { doc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import type { UserDoc } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;
const CYCLE_DAYS = 30;

export function paymentStatusOf(c: UserDoc): "paid" | "unpaid" | "partial" | "overdue" {
  const pending = c.pendingAmount ?? 0;
  if (pending <= 0) return "paid";
  if (c.nextDueDate && Date.now() > c.nextDueDate) return "overdue";
  if (pending < (c.monthlyFee ?? 0)) return "partial";
  return "unpaid";
}

export function addDays(ts: number, days: number) {
  return ts + days * DAY_MS;
}

export const CYCLE = CYCLE_DAYS;

/**
 * Rolling 30-day billing model: next due date = lastPaymentDate + 30 days.
 * No auto-billing cron is needed — pending stays as the unpaid balance until
 * a payment is received, then nextDueDate is recomputed from payment date.
 * Kept as a no-op for backward compatibility with existing call sites.
 */
export async function runAutoBillingForCustomer(_c: UserDoc): Promise<void> {
  return;
}

