import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, MoreVertical } from "lucide-react";
import { fmtPKR, fmtDate } from "@/lib/utils-format";
import type { PaymentDoc, UserDoc, PackageDoc } from "@/lib/types";
import { StatCard } from "@/components/stat-card";
import { Receipt, TrendingUp, Users } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { reversePayment, reassignPayment } from "@/lib/payment-correction";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/payments")({
  component: PaymentsPage,
});

function PaymentsPage() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [payments, setPayments] = useState<PaymentDoc[]>([]);
  const [customers, setCustomers] = useState<UserDoc[]>([]);
  const [packages, setPackages] = useState<PackageDoc[]>([]);
  const [search, setSearch] = useState("");
  const [method, setMethod] = useState("all");
  const [selectedUser, setSelectedUser] = useState<UserDoc | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<PaymentDoc | null>(null);
  const [correctionMode, setCorrectionMode] = useState<"reversal" | "reassignment" | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    const u1 = onSnapshot(collection(db, "payments"), (snap) => {
      if (!isMounted.current) return;
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PaymentDoc, "id">) }));
      const scoped =
        role === "dealer" && user
          ? list.filter((p) => (user.assignedAreaIds ?? []).includes(p.areaId ?? ""))
          : list;
      setPayments(scoped.sort((a, b) => b.date - a.date));
    });
    const u2 = onSnapshot(collection(db, "users"), (snap) => {
      if (!isMounted.current) return;
      setCustomers(snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<UserDoc, "uid">) })));
    });
    const u3 = onSnapshot(collection(db, "packages"), (snap) => {
      if (!isMounted.current) return;
      setPackages(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PackageDoc, "id">) })));
    });
    return () => {
      isMounted.current = false;
      u1();
      u2();
      u3();
    };
  }, [role, user]);

  const filtered = useMemo(() => {
    return payments.filter((p) => {
      if (method !== "all" && p.method !== method) return false;
      if (
        search &&
        !`${p.customerName ?? ""} ${p.notes ?? ""}`.toLowerCase().includes(search.toLowerCase())
      )
        return false;
      return true;
    });
  }, [payments, search, method]);

  const total = filtered.reduce((s, p) => s + p.amount, 0);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const activePayments = payments.filter((p) => p.status !== "reversed");
  const monthTotal = activePayments
    .filter((p) => p.date >= monthStart.getTime())
    .reduce((s, p) => s + p.amount, 0);
  const uniqueCustomers = new Set(activePayments.map((p) => p.customerId)).size;

  return (
    <div>
      <PageHeader title="Payments" subtitle="Payment history and collections" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <StatCard title="This Month" value={fmtPKR(monthTotal)} icon={TrendingUp} tone="success" />
        <StatCard
          title="Total Collected"
          value={fmtPKR(activePayments.reduce((s, p) => s + p.amount, 0))}
          icon={Receipt}
          tone="info"
        />
        <StatCard title="Paying Customers" value={uniqueCustomers} icon={Users} />
      </div>

      <Card className="mb-4">
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative md:col-span-2">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search customer or notes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
          >
            <option value="all">All methods</option>
            <option value="cash">Cash</option>
            <option value="bank">Bank</option>
            <option value="jazzcash">JazzCash</option>
            <option value="easypaisa">EasyPaisa</option>
          </select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Package</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Received By</TableHead>
                <TableHead className="text-right">Pending (PKR)</TableHead>
                <TableHead className="text-right">Amount (PKR)</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => {
                const customer = customers.find((c) => c.uid === p.customerId);
                const pkg = customer ? packages.find((pkg) => pkg.id === customer.packageId) : null;
                const isReversed = p.status === "reversed";
                const canCorrect =
                  role === "admin" || (role === "dealer" && p.receivedByUid === user?.uid);

                return (
                  <TableRow key={p.id} className={isReversed ? "opacity-50" : ""}>
                    <TableCell>{fmtDate(p.date)}</TableCell>
                    <TableCell className="font-medium">
                      {customer ? (
                        <button
                          onClick={() => setSelectedUser(customer)}
                          className="text-primary hover:underline cursor-pointer"
                        >
                          {customer.name}
                        </button>
                      ) : (
                        (p.customerName ?? p.customerId?.slice(0, 6) ?? "Unknown")
                      )}
                      {isReversed && <div className="text-xs text-muted-foreground">Reversed</div>}
                    </TableCell>
                    <TableCell className="text-sm">{pkg?.name ?? "—"}</TableCell>
                    <TableCell className="capitalize text-sm">{p.method}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p.receivedByName ?? "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium text-sm">
                      {customer ? fmtPKR(customer.pendingAmount ?? 0) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold">{fmtPKR(p.amount)}</TableCell>
                    <TableCell>
                      {!isReversed && canCorrect && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedPayment(p);
                                setCorrectionMode("reversal");
                              }}
                            >
                              Reverse Payment
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedPayment(p);
                                setCorrectionMode("reassignment");
                              }}
                            >
                              Reassign Payment
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center text-sm text-muted-foreground py-10"
                  >
                    No payments found.
                  </TableCell>
                </TableRow>
              )}
              {filtered.length > 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-right font-semibold">
                    Filtered total
                  </TableCell>
                  <TableCell className="text-right font-semibold">{fmtPKR(total)}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>User Profile</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div>
                <div className="text-sm text-muted-foreground">Name</div>
                <div className="font-medium">{selectedUser.name}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Email</div>
                <div className="font-medium">{selectedUser.email}</div>
              </div>
              {selectedUser.phone && (
                <div>
                  <div className="text-sm text-muted-foreground">Phone</div>
                  <div className="font-medium">{selectedUser.phone}</div>
                </div>
              )}
              {selectedUser.address && (
                <div>
                  <div className="text-sm text-muted-foreground">Address</div>
                  <div className="font-medium">{selectedUser.address}</div>
                </div>
              )}
              <div>
                <div className="text-sm text-muted-foreground">Status</div>
                <div className="mt-1">
                  <StatusBadge status={selectedUser.connectionStatus} />
                </div>
              </div>
              {selectedUser.pendingAmount && selectedUser.pendingAmount > 0 && (
                <div>
                  <div className="text-sm text-muted-foreground">Pending Amount</div>
                  <div className="font-medium">{fmtPKR(selectedUser.pendingAmount)}</div>
                </div>
              )}
              {selectedUser.nextDueDate && (
                <div>
                  <div className="text-sm text-muted-foreground">Next Due Date</div>
                  <div className="font-medium">{fmtDate(selectedUser.nextDueDate)}</div>
                </div>
              )}
              <Button
                onClick={() => {
                  setSelectedUser(null);
                  navigate({ to: `/users/${selectedUser.uid}` });
                }}
                className="w-full"
              >
                View Full Profile
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {selectedPayment && correctionMode === "reversal" && (
        <ReversalDialog
          payment={selectedPayment}
          user={user}
          onClose={() => {
            setSelectedPayment(null);
            setCorrectionMode(null);
          }}
        />
      )}

      {selectedPayment && correctionMode === "reassignment" && (
        <ReassignmentDialog
          payment={selectedPayment}
          customers={customers}
          user={user}
          onClose={() => {
            setSelectedPayment(null);
            setCorrectionMode(null);
          }}
        />
      )}
    </div>
  );
}

function ReversalDialog({
  payment,
  user,
  onClose,
}: {
  payment: PaymentDoc;
  user: any;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!reason.trim()) {
      toast.error("Please provide a reason");
      return;
    }
    setBusy(true);
    try {
      await reversePayment({
        payment,
        reason,
        correctedByUid: user.uid,
        correctedByName: user.name,
        correctedByRole: user.role,
      });
      toast.success("Payment reversed successfully");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reverse payment");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reverse Payment</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-md bg-muted/50 p-3 space-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">Customer: </span>
              <span className="font-medium">{payment.customerName}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Amount: </span>
              <span className="font-medium">{fmtPKR(payment.amount)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Method: </span>
              <span className="font-medium capitalize">{payment.method}</span>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reversal-reason">Reason (mandatory)</Label>
            <Textarea
              id="reversal-reason"
              placeholder="Why is this payment being reversed?"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={submit} disabled={busy}>
            {busy ? "Reversing…" : "Reverse Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReassignmentDialog({
  payment,
  customers,
  user,
  onClose,
}: {
  payment: PaymentDoc;
  customers: UserDoc[];
  user: any;
  onClose: () => void;
}) {
  const [newCustomerId, setNewCustomerId] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const availableCustomers = customers.filter(
    (c) => c.role === "customer" && c.uid !== payment.customerId
  );

  const submit = async () => {
    if (!newCustomerId) {
      toast.error("Please select a customer");
      return;
    }
    if (!reason.trim()) {
      toast.error("Please provide a reason");
      return;
    }
    setBusy(true);
    try {
      const newCustomer = customers.find((c) => c.uid === newCustomerId);
      if (!newCustomer) throw new Error("Customer not found");

      await reassignPayment({
        payment,
        newCustomerId,
        newCustomerName: newCustomer.name,
        reason,
        correctedByUid: user.uid,
        correctedByName: user.name,
        correctedByRole: user.role,
      });
      toast.success("Payment reassigned successfully");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reassign payment");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reassign Payment</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-md bg-muted/50 p-3 space-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">Current Customer: </span>
              <span className="font-medium">{payment.customerName}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Amount: </span>
              <span className="font-medium">{fmtPKR(payment.amount)}</span>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-customer">Reassign to Customer</Label>
            <select
              id="new-customer"
              className="w-full h-10 rounded-md border bg-background px-3 text-sm"
              value={newCustomerId}
              onChange={(e) => setNewCustomerId(e.target.value)}
            >
              <option value="">Select customer…</option>
              {availableCustomers.map((c) => (
                <option key={c.uid} value={c.uid}>
                  {c.name} ({c.phone})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reassignment-reason">Reason (mandatory)</Label>
            <Textarea
              id="reassignment-reason"
              placeholder="Why is this payment being reassigned?"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Reassigning…" : "Reassign Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
