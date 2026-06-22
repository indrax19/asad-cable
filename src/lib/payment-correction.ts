import {
  collection,
  doc,
  updateDoc,
  addDoc,
  getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { PaymentDoc, UserDoc, PaymentCorrectionDoc, Role } from "@/lib/types";

interface ReversePaymentParams {
  payment: PaymentDoc;
  reason: string;
  correctedByUid: string;
  correctedByName: string;
  correctedByRole: Role;
}

interface ReassignPaymentParams {
  payment: PaymentDoc;
  newCustomerId: string;
  newCustomerName: string;
  reason: string;
  correctedByUid: string;
  correctedByName: string;
  correctedByRole: Role;
}

async function getCustomer(uid: string): Promise<UserDoc | null> {
  const docRef = doc(db, "users", uid);
  const snap = await getDoc(docRef);
  return snap.exists() ? { uid: snap.id, ...(snap.data() as Omit<UserDoc, "uid">) } : null;
}

export async function reversePayment({
  payment,
  reason,
  correctedByUid,
  correctedByName,
  correctedByRole,
}: ReversePaymentParams): Promise<void> {
  const customer = await getCustomer(payment.customerId);
  if (!customer) throw new Error("Customer not found");

  const now = Date.now();

  // Mark payment as reversed
  await updateDoc(doc(db, "payments", payment.id), {
    status: "reversed",
    reversedAt: now,
    reversedByUid: correctedByUid,
    reversedByName: correctedByName,
    reversalReason: reason,
  });

  // Create correction audit record
  await addDoc(collection(db, "paymentCorrections"), {
    paymentId: payment.id,
    correctionType: "reversal",
    reason,
    reversedAmount: payment.amount,
    reversedCustomerId: payment.customerId,
    reversedCustomerName: payment.customerName,
    correctedByUid,
    correctedByName,
    correctedByRole,
    createdAt: now,
  } as PaymentCorrectionDoc);

  // Restore to previous state (before payment was received)
  const restorePending = payment.prevPendingAmount ?? (customer.pendingAmount ?? 0) + payment.amount;
  const restoreAdvance = payment.prevAdvanceBalance ?? Math.max(0, (customer.advanceBalance ?? 0) - payment.amount);
  const restoreDueDate = payment.prevNextDueDate ?? customer.nextDueDate;
  const restorePaymentStatus = payment.prevPaymentStatus ?? "unpaid";

  await updateDoc(doc(db, "users", payment.customerId), {
    pendingAmount: restorePending,
    advanceBalance: restoreAdvance,
    nextDueDate: restoreDueDate,
    paymentStatus: restorePaymentStatus,
  });
}

export async function reassignPayment({
  payment,
  newCustomerId,
  newCustomerName,
  reason,
  correctedByUid,
  correctedByName,
  correctedByRole,
}: ReassignPaymentParams): Promise<void> {
  if (newCustomerId === payment.customerId) {
    throw new Error("Cannot reassign to the same customer");
  }

  const oldCustomer = await getCustomer(payment.customerId);
  const newCustomer = await getCustomer(newCustomerId);

  if (!oldCustomer) throw new Error("Old customer not found");
  if (!newCustomer) throw new Error("New customer not found");

  const now = Date.now();

  // Update payment with new customer
  await updateDoc(doc(db, "payments", payment.id), {
    customerId: newCustomerId,
    customerName: newCustomerName,
  });

  // Create correction audit record
  await addDoc(collection(db, "paymentCorrections"), {
    paymentId: payment.id,
    correctionType: "reassignment",
    reason,
    oldCustomerId: payment.customerId,
    oldCustomerName: payment.customerName,
    newCustomerId,
    newCustomerName,
    correctedByUid,
    correctedByName,
    correctedByRole,
    createdAt: now,
  } as PaymentCorrectionDoc);

  // Restore old customer billing (remove payment)
  const oldPending = (oldCustomer.pendingAmount ?? 0) + payment.amount;
  const oldAdvance = Math.max(0, (oldCustomer.advanceBalance ?? 0) - payment.amount);
  const oldPaymentStatus =
    oldPending <= 0
      ? "paid"
      : oldPending < (oldCustomer.monthlyFee ?? 0)
        ? "partial"
        : "unpaid";

  await updateDoc(doc(db, "users", payment.customerId), {
    pendingAmount: oldPending,
    advanceBalance: oldAdvance,
    paymentStatus: oldPaymentStatus,
  });

  // Apply payment to new customer
  const newPending = Math.max(0, (newCustomer.pendingAmount ?? 0) - payment.amount);
  const overpayment = Math.max(0, payment.amount - (newCustomer.pendingAmount ?? 0));
  const newAdvance = (newCustomer.advanceBalance ?? 0) + overpayment;
  const newPaymentStatus =
    newPending <= 0
      ? "paid"
      : newPending < (newCustomer.monthlyFee ?? 0)
        ? "partial"
        : "unpaid";

  await updateDoc(doc(db, "users", newCustomerId), {
    pendingAmount: newPending,
    advanceBalance: newAdvance,
    paymentStatus: newPaymentStatus,
  });
}
