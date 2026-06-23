import { doc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import type { UserDoc } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;
const CYCLE_DAYS = 30;

export function paymentStatusOf(c: UserDoc): "paid" | "unpaid" | "partial" | "overdue" {
  const pending = c.pendingAmount ?? 0;
  if (c.nextDueDate && Date.now() > c.nextDueDate) return "overdue";
  if (pending <= 0) return "paid";
  if (pending < (c.monthlyFee ?? 0)) return "partial";
  return "unpaid";
}

export function addDays(ts: number, days: number) {
  return ts + days * DAY_MS;
}

export const CYCLE = CYCLE_DAYS;

/**
 * Auto-billing: when a customer is overdue (due date passed), automatically
 * generate a new bill by adding the monthly fee to pending amount and extending
 * the due date by 30 days.
 */
export async function runAutoBillingForCustomer(c: UserDoc): Promise<void> {
  const now = Date.now();
  const isOverdue = c.nextDueDate && now > c.nextDueDate;
  const hasNoBalance = (c.pendingAmount ?? 0) <= 0;

  if (!isOverdue || !hasNoBalance) return;

  const newPending = (c.monthlyFee ?? 0);
  const newNextDueDate = addDays(now, CYCLE);

  await updateDoc(doc(db, "users", c.uid), {
    pendingAmount: newPending,
    nextDueDate: newNextDueDate,
    paymentStatus: newPending > 0 ? "unpaid" : "paid",
  });
}
