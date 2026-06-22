import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  arrayUnion,
  arrayRemove,
  addDoc,
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  signInWithEmailAndPassword,
  updatePassword as fbUpdatePassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth, db, getSecondaryAuth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Power, Download, Eye, Trash2, Key, MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/status-badge";
import type { AreaDoc, UserDoc, DealerRecoveryDoc } from "@/lib/types";
import { fmtPKR, fmtDate, fmtCNIC, fmtPhone } from "@/lib/utils-format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dealers")({
  component: DealersPage,
});

function DealersPage() {
  const { role } = useAuth();
  const [dealers, setDealers] = useState<UserDoc[]>([]);
  const [areas, setAreas] = useState<AreaDoc[]>([]);
  const [editing, setEditing] = useState<UserDoc | null>(null);
  const [open, setOpen] = useState(false);
  const [selectedDealer, setSelectedDealer] = useState<UserDoc | null>(null);
  const [resetPasswordDealer, setResetPasswordDealer] = useState<UserDoc | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    const u1 = onSnapshot(query(collection(db, "users"), where("role", "==", "dealer")), (snap) => {
      if (!isMounted.current) return;
      setDealers(snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<UserDoc, "uid">) })));
    });
    const u2 = onSnapshot(collection(db, "areas"), (snap) => {
      if (!isMounted.current) return;
      setAreas(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AreaDoc, "id">) })));
    });
    return () => {
      isMounted.current = false;
      u1();
      u2();
    };
  }, []);

  if (role !== "admin")
    return <div className="p-10 text-center text-muted-foreground">403 — Forbidden</div>;

  const filteredDealers = dealers.filter((d) =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (d.phone && d.phone.includes(searchQuery)) ||
    (d.email && d.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (d.cnic && d.cnic.includes(searchQuery))
  );

  const toggleStatus = async (d: UserDoc) => {
    const next = d.status === "active" ? "disabled" : "active";
    await updateDoc(doc(db, "users", d.uid), { status: next });
    toast.success(`Dealer ${next}`);
  };

  const deleteDealer = async (d: UserDoc) => {
    if (!confirm(`Delete "${d.name}"? This action cannot be undone.`)) return;
    try {
      await deleteDoc(doc(db, "users", d.uid));
      const assignedAreas = areas.filter((a) => a.dealerIds.includes(d.uid));
      for (const area of assignedAreas) {
        await updateDoc(doc(db, "areas", area.id), { dealerIds: arrayRemove(d.uid) });
      }
      toast.success("Dealer deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  return (
    <div>
      <PageHeader
        title="Dealers"
        subtitle="Manage dealers and area assignments"
        actions={
          <Dialog
            open={open}
            onOpenChange={(o) => {
              setOpen(o);
              if (!o) setEditing(null);
            }}
          >
            <DialogTrigger asChild>
              <Button onClick={() => setEditing(null)}>
                <Plus className="size-4 mr-1" />
                Add Dealer
              </Button>
            </DialogTrigger>
            <DealerDialog
              key={editing?.uid ?? "new"}
              initial={editing}
              areas={areas}
              onDone={() => {
                setOpen(false);
                setEditing(null);
              }}
            />
          </Dialog>
        }
      />
      <Card>
        <CardContent className="p-0">
          <div className="p-4 border-b">
            <Input
              placeholder="Search dealers by name, phone, email, or CNIC..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>CNIC</TableHead>
                <TableHead>Areas</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-28"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDealers.map((d) => {
                const areaNames = areas
                  .filter((a) => a.dealerIds.includes(d.uid))
                  .map((a) => a.name)
                  .join(", ");
                return (
                  <TableRow key={d.uid}>
                    <TableCell className="font-medium">
                      {d.name}
                      <div className="text-xs text-muted-foreground">{d.email}</div>
                    </TableCell>
                    <TableCell>{fmtPhone(d.phone)}</TableCell>
                    <TableCell>{fmtCNIC(d.cnic)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {areaNames || "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={d.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="outline" className="text-xs h-8">
                            Actions
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem
                            onClick={() => setSelectedDealer(d)}
                            className="cursor-pointer"
                          >
                            <Eye className="size-4 mr-2 text-blue-600" />
                            <span>View Recovery & Payments</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setEditing(d);
                              setOpen(true);
                            }}
                            className="cursor-pointer"
                          >
                            <Pencil className="size-4 mr-2 text-amber-600" />
                            <span>Edit Dealer</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setResetPasswordDealer(d)}
                            className="cursor-pointer"
                          >
                            <Key className="size-4 mr-2 text-purple-600" />
                            <span>Reset Password</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => toggleStatus(d)}
                            className="cursor-pointer"
                          >
                            <Power className="size-4 mr-2 text-orange-600" />
                            <span>{d.status === "active" ? "Disable" : "Enable"}</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => deleteDealer(d)}
                            className="cursor-pointer text-destructive"
                          >
                            <Trash2 className="size-4 mr-2" />
                            <span>Delete Dealer</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredDealers.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-sm text-muted-foreground py-10"
                  >
                    {searchQuery ? "No dealers match your search." : "No dealers yet."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedDealer && (
        <DealerRecoveryDrawer dealer={selectedDealer} onClose={() => setSelectedDealer(null)} />
      )}

      {resetPasswordDealer && (
        <ResetPasswordDialog
          dealer={resetPasswordDealer}
          onClose={() => setResetPasswordDealer(null)}
        />
      )}
    </div>
  );
}

function DealerDialog({
  initial,
  areas,
  onDone,
}: {
  initial: UserDoc | null;
  areas: AreaDoc[];
  onDone: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [cnic, setCnic] = useState(initial?.cnic ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [assignedAreaIds, setAssignedAreaIds] = useState<string[]>(initial?.assignedAreaIds ?? []);
  const [canManageCustomers, setCanManageCustomers] = useState(
    initial?.canManageCustomers ?? false,
  );
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const formatCNIC = (value: string) => {
    const clean = value.replace(/\D/g, "");
    if (clean.length <= 5) return clean;
    if (clean.length <= 12) return `${clean.slice(0, 5)}-${clean.slice(5)}`;
    return `${clean.slice(0, 5)}-${clean.slice(5, 12)}-${clean.slice(12, 13)}`;
  };

  const toggle = (id: string) =>
    setAssignedAreaIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) {
      toast.error("Name and email are required");
      return;
    }
    setBusy(true);
    try {
      if (initial) {
        const updatePayload: any = {
          name,
          email,
          phone,
          cnic,
          address,
          assignedAreaIds,
          canManageCustomers,
        };

        if (password) {
          updatePayload.password = password;
          try {
            const sec = getSecondaryAuth();
            const cred = await signInWithEmailAndPassword(
              sec,
              initial.email ?? "",
              (initial.email ?? "").split("@")[0],
            );

            await fbUpdatePassword(cred.user, password);
            await fbSignOut(sec);
          } catch (err) {
            console.error("Password update error:", err);
            toast.error("Could not update password in Firebase");
            throw err;
          }
        }

        await updateDoc(doc(db, "users", initial.uid), updatePayload);
        for (const a of areas) {
          const has = a.dealerIds.includes(initial.uid);
          const should = assignedAreaIds.includes(a.id);
          if (has && !should)
            await updateDoc(doc(db, "areas", a.id), { dealerIds: arrayRemove(initial.uid) });
          if (!has && should)
            await updateDoc(doc(db, "areas", a.id), { dealerIds: arrayUnion(initial.uid) });
        }
        toast.success("Dealer updated");
      } else {
        if (!password || password.length < 6) {
          toast.error("Password must be at least 6 characters");
          return;
        }
        const sec = getSecondaryAuth();
        const cred = await createUserWithEmailAndPassword(sec, email, password);
        await setDoc(doc(db, "users", cred.user.uid), {
          name,
          email,
          password,
          phone,
          cnic,
          address,
          role: "dealer",
          status: "active",
          assignedAreaIds,
          canManageCustomers,
          createdAt: Date.now(),
        });
        for (const id of assignedAreaIds) {
          await updateDoc(doc(db, "areas", id), { dealerIds: arrayUnion(cred.user.uid) });
        }
        await fbSignOut(sec);
        toast.success("Dealer created");
      }
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{initial ? "Edit Dealer" : "Add New Dealer"}</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Email (login)</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Password {initial && "(Optional)"}</Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={initial ? "Leave blank to keep unchanged" : "Enter password"}
                required={!initial}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-14-14zM10 4a6 6 0 016 6v.5a1 1 0 01-2 0V10a4 4 0 00-4-4H8a1 1 0 010-2h2zM10 16a6 6 0 01-6-6v-.5a1 1 0 01-2 0V10a8 8 0 008 8h2a1 1 0 010-2h-2z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 3a7 7 0 100 14 7 7 0 000-14zm0 2a5 5 0 110 10 5 5 0 010-10z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>CNIC</Label>
            <Input
              value={cnic}
              onChange={(e) => setCnic(formatCNIC(e.target.value))}
              placeholder="XXXXX-XXXXXXX-X"
              maxLength={15}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Address</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Assigned Areas</Label>
          <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
            {areas.length === 0 && (
              <div className="text-sm text-muted-foreground">No areas yet.</div>
            )}
            {areas.map((a) => (
              <label key={a.id} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={assignedAreaIds.includes(a.id)}
                  onCheckedChange={() => toggle(a.id)}
                />
                <span>
                  {a.name} <span className="text-muted-foreground">({a.code})</span>
                </span>
              </label>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            checked={canManageCustomers}
            onCheckedChange={(checked) => setCanManageCustomers(checked === true)}
          />
          <span className="text-sm">Allow adding & editing customers</span>
        </label>
        <DialogFooter>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : initial ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function ResetPasswordDialog({ dealer, onClose }: { dealer: UserDoc; onClose: () => void }) {
  const [busy, setBusy] = useState(false);

  const handleResetPassword = async () => {
    setBusy(true);
    try {
      await sendPasswordResetEmail(auth, dealer.email!);
      toast.success(`Password reset email sent to ${dealer.email}`);
      onClose();
    } catch (err) {
      console.error("Reset error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to send reset email");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset Password — {dealer.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
            <p className="text-sm text-blue-900">
              <strong>Email:</strong> {dealer.email}
            </p>
          </div>
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
            <p className="text-xs text-amber-900">
              ⚠️ A password reset link will be sent to the dealer's email. They can use it to set a new password.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleResetPassword} disabled={busy}>
            {busy ? "Sending…" : "Send Reset Email"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DealerRecoveryDrawer({ dealer, onClose }: { dealer: UserDoc; onClose: () => void }) {
  const [recoveries, setRecoveries] = useState<DealerRecoveryDoc[]>([]);
  const [recoveryAmount, setRecoveryAmount] = useState("");
  const [paymentReceived, setPaymentReceived] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    const unsubscribe = onSnapshot(
      query(collection(db, "dealer_recoveries"), where("dealerId", "==", dealer.uid)),
      (snap) => {
        if (!isMounted.current) return;
        setRecoveries(
          snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<DealerRecoveryDoc, "id">) }))
            .sort((a, b) => b.date - a.date),
        );
      },
    );
    return () => {
      isMounted.current = false;
      unsubscribe();
    };
  }, [dealer.uid]);

  const handleAddRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryAmount || !paymentReceived) {
      toast.error("Enter recovery and payment amounts");
      return;
    }
    setBusy(true);
    try {
      if (editingId) {
        await updateDoc(doc(db, "dealer_recoveries", editingId), {
          recoveryAmount: Number(recoveryAmount),
          paymentReceived: Number(paymentReceived),
          notes: notes || null,
        });
        toast.success("Entry updated");
        setEditingId(null);
      } else {
        await addDoc(collection(db, "dealer_recoveries"), {
          dealerId: dealer.uid,
          dealerName: dealer.name,
          date: Date.now(),
          recoveryAmount: Number(recoveryAmount),
          paymentReceived: Number(paymentReceived),
          notes: notes || null,
          createdAt: Date.now(),
        });
        toast.success("Recovery entry added");
      }
      setRecoveryAmount("");
      setPaymentReceived("");
      setNotes("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (entry: DealerRecoveryDoc) => {
    setEditingId(entry.id);
    setRecoveryAmount(String(entry.recoveryAmount));
    setPaymentReceived(String(entry.paymentReceived));
    setNotes(entry.notes || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setRecoveryAmount("");
    setPaymentReceived("");
    setNotes("");
  };

  const monthlyTotals = recoveries.reduce(
    (acc, r) => {
      const d = new Date(r.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!acc[key]) acc[key] = { recovery: 0, payment: 0 };
      acc[key].recovery += r.recoveryAmount;
      acc[key].payment += r.paymentReceived;
      return acc;
    },
    {} as Record<string, { recovery: number; payment: number }>,
  );

  const downloadReport = () => {
    const csv = [
      ["Dealer Recovery Report", dealer.name],
      ["Generated", new Date().toLocaleString()],
      [""],
      ["Date", "Recovery Amount", "Payment Received", "Notes"],
      ...recoveries.map((r) => [
        fmtDate(r.date),
        `Rs ${fmtPKR(r.recoveryAmount)}`,
        `Rs ${fmtPKR(r.paymentReceived)}`,
        r.notes || "",
      ]),
      [""],
      ["Month", "Total Recovery", "Total Payment"],
      ...Object.entries(monthlyTotals)
        .sort()
        .reverse()
        .map(([month, { recovery, payment }]) => [
          month,
          `Rs ${fmtPKR(recovery)}`,
          `Rs ${fmtPKR(payment)}`,
        ]),
    ];

    const csvContent = csv.map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${dealer.name}-recovery-report-${new Date().getTime()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const currentMonthKey = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  })();
  const currentMonthData = monthlyTotals[currentMonthKey] || { recovery: 0, payment: 0 };

  const todayData = (() => {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const todayEnd = todayStart + 24 * 60 * 60 * 1000;
    const todayEntries = recoveries.filter((r) => r.date >= todayStart && r.date < todayEnd);
    return {
      recovery: todayEntries.reduce((sum, r) => sum + r.recoveryAmount, 0),
      payment: todayEntries.reduce((sum, r) => sum + r.paymentReceived, 0),
    };
  })();

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{dealer.name}</SheetTitle>
          <SheetDescription>
            {fmtPhone(dealer.phone)} • {fmtCNIC(dealer.cnic)}
          </SheetDescription>
        </SheetHeader>
        <div className="p-4 space-y-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-4">
              <div className="text-xs text-blue-700 font-medium mb-1">Today's Recovery</div>
              <div className="text-2xl font-bold text-blue-900 mb-1">
                Rs {fmtPKR(todayData.recovery)}
              </div>
              <div className="text-xs text-blue-600">Payment: Rs {fmtPKR(todayData.payment)}</div>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-lg p-4">
              <div className="text-xs text-purple-700 font-medium mb-1">This Month</div>
              <div className="text-2xl font-bold text-purple-900 mb-1">
                Rs {fmtPKR(currentMonthData.recovery)}
              </div>
              <div className="text-xs text-purple-600">
                Payment: Rs {fmtPKR(currentMonthData.payment)}
              </div>
            </div>
          </div>
          <Tabs defaultValue="entry">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="entry">Add Entry</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
              <TabsTrigger value="monthly">Monthly Summary</TabsTrigger>
            </TabsList>

            <TabsContent value="entry" className="mt-6 space-y-4">
              {editingId && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-900 font-medium">Editing last entry</p>
                </div>
              )}

              <form onSubmit={handleAddRecovery} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Recovery Amount (Rs)</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={recoveryAmount}
                      onChange={(e) => setRecoveryAmount(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Payment Received (Rs)</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={paymentReceived}
                      onChange={(e) => setPaymentReceived(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {recoveryAmount && paymentReceived && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="text-sm text-amber-900 font-medium mb-2">Summary</div>
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <div className="text-amber-700">Recovery</div>
                        <div className="font-bold text-lg">Rs {fmtPKR(Number(recoveryAmount))}</div>
                      </div>
                      <div>
                        <div className="text-green-700">Payment</div>
                        <div className="font-bold text-lg text-green-600">
                          Rs {fmtPKR(Number(paymentReceived))}
                        </div>
                      </div>
                      <div>
                        <div
                          className={`${Number(recoveryAmount) - Number(paymentReceived) >= 0 ? "text-orange-700" : "text-green-700"}`}
                        >
                          Pending
                        </div>
                        <div
                          className={`font-bold text-lg ${Number(recoveryAmount) - Number(paymentReceived) >= 0 ? "text-orange-600" : "text-green-600"}`}
                        >
                          Rs {fmtPKR(Math.abs(Number(recoveryAmount) - Number(paymentReceived)))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>
                    Notes <span className="text-muted-foreground text-xs">(Optional)</span>
                  </Label>
                  <Input
                    placeholder="Add notes (optional)"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1" disabled={busy}>
                    {busy ? "Saving…" : editingId ? "Update Entry" : "Add Today's Entry"}
                  </Button>
                  {editingId && (
                    <Button type="button" variant="outline" onClick={cancelEdit} disabled={busy}>
                      Cancel
                    </Button>
                  )}
                </div>
              </form>
            </TabsContent>

            <TabsContent value="history" className="mt-6">
              <Table className="text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Recovery</TableHead>
                    <TableHead className="text-right">Payment</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recoveries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No entries yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    recoveries.map((r, idx) => (
                      <TableRow key={r.id} className={idx === 0 ? "bg-blue-50" : ""}>
                        <TableCell>{fmtDate(r.date)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {fmtPKR(r.recoveryAmount)}
                        </TableCell>
                        <TableCell className="text-right font-medium text-green-600">
                          {fmtPKR(r.paymentReceived)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {r.notes || "—"}
                        </TableCell>
                        <TableCell>
                          {idx === 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => startEdit(r)}
                              className="text-xs"
                            >
                              Edit
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="monthly" className="mt-6 space-y-4">
              <div className="flex gap-2 mb-4">
                <Button onClick={downloadReport} variant="outline" size="sm">
                  <Download className="size-4 mr-2" />
                  Download Report
                </Button>
              </div>
              <Table className="text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right">Total Recovery</TableHead>
                    <TableHead className="text-right">Total Payment</TableHead>
                    <TableHead className="text-right">Difference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(monthlyTotals)
                    .sort()
                    .reverse()
                    .map(([month, { recovery, payment }]) => {
                      const diff = recovery - payment;
                      return (
                        <TableRow key={month}>
                          <TableCell className="font-medium">{month}</TableCell>
                          <TableCell className="text-right">{fmtPKR(recovery)}</TableCell>
                          <TableCell className="text-right text-green-600">
                            {fmtPKR(payment)}
                          </TableCell>
                          <TableCell
                            className={`text-right font-medium ${diff >= 0 ? "text-orange-600" : "text-green-600"}`}
                          >
                            {fmtPKR(Math.abs(diff))} {diff >= 0 ? "pending" : "excess"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
