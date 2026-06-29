export type Role = "admin" | "dealer" | "customer";
export type EntityStatus = "active" | "disabled";
export type PaymentStatus = "paid" | "unpaid" | "partial" | "overdue";
export type ConnectionStatus = "active" | "suspended" | "disabled";
export type PaymentMethod = "cash" | "bank" | "jazzcash" | "easypaisa";

export interface UserDoc {
  uid: string;
  name: string;
  username?: string;
  email?: string;
  phone?: string;
  cnic?: string;
  address?: string;
  password?: string;
  role: Role;
  status: EntityStatus;
  photoURL?: string;
  createdAt: number;
  // dealer
  assignedAreaIds?: string[];
  canManageCustomers?: boolean;
  // customer
  packageId?: string;
  areaId?: string;
  dealerId?: string;
  activationDate?: number;
  monthlyFee?: number;
  discount?: number;
  lastPaymentDate?: number;
  nextDueDate?: number;
  pendingAmount?: number;
  advanceBalance?: number;
  lastBillGeneratedDate?: number;
  connectionStatus?: ConnectionStatus;
  paymentStatus?: PaymentStatus;
  latitude?: number;
  longitude?: number;
}

export interface AreaDoc {
  id: string;
  name: string;
  code: string;
  dealerIds: string[];
  status: EntityStatus;
  createdAt: number;
  latitude?: number;
  longitude?: number;
}

export interface PackageDoc {
  id: string;
  name: string;
  speed: string;
  monthlyPrice: number;
  installationCharges: number;
  status: EntityStatus;
  description?: string;
  createdAt: number;
}

export interface PaymentDoc {
  id: string;
  customerId: string;
  customerName?: string;
  amount: number;
  method: PaymentMethod;
  date: number;
  notes?: string;
  receivedByUid: string;
  receivedByName?: string;
  dealerId?: string;
  areaId?: string;
  forMonths?: string[];
  // previous state snapshot (for reversal)
  prevPendingAmount?: number;
  prevAdvanceBalance?: number;
  prevNextDueDate?: number;
  prevPaymentStatus?: PaymentStatus;
  // correction tracking
  status?: "active" | "reversed";
  reversedAt?: number;
  reversedByUid?: string;
  reversedByName?: string;
  reversalReason?: string;
}

export interface PaymentCorrectionDoc {
  id: string;
  paymentId: string;
  correctionType: "reversal" | "reassignment";
  reason: string;
  // reversal fields
  reversedAmount?: number;
  reversedCustomerId?: string;
  reversedCustomerName?: string;
  // reassignment fields
  oldCustomerId?: string;
  oldCustomerName?: string;
  newCustomerId?: string;
  newCustomerName?: string;
  // audit fields
  correctedByUid: string;
  correctedByName?: string;
  correctedByRole: Role;
  createdAt: number;
}

export interface DealerRecoveryDoc {
  id: string;
  dealerId: string;
  dealerName: string;
  date: number;
  recoveryAmount: number;
  paymentReceived: number;
  notes?: string;
  createdAt: number;
}

export interface AdvertisementDoc {
  id: string;
  imageUrl: string;
  link?: string;
  title?: string;
  status: EntityStatus;
  createdAt: number;
}
