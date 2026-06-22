import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export interface PaymentMethodDoc {
  id: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  type: "bank" | "easypaisa" | "jazzcash";
  description?: string;
  createdBy: string;
  createdByRole: "admin" | "dealer";
  dealerId?: string;
  createdAt: number;
}

export const Route = createFileRoute("/_authenticated/payment-methods")({
  component: PaymentMethodsPage,
});

function PaymentMethodsPage() {
  const { role, user } = useAuth();
  const isAdmin = role === "admin";
  const isDealer = role === "dealer";
  const [methods, setMethods] = useState<PaymentMethodDoc[]>([]);
  const [editing, setEditing] = useState<PaymentMethodDoc | null>(null);
  const [open, setOpen] = useState(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    const unsub = onSnapshot(collection(db, "paymentMethods"), (snap) => {
      if (!isMounted.current) return;
      setMethods(
        snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<PaymentMethodDoc, "id">) }))
          .sort((a, b) => b.createdAt - a.createdAt),
      );
    });
    return () => {
      isMounted.current = false;
      unsub();
    };
  }, []);

  const isEditable = (method: PaymentMethodDoc) => {
    if (isAdmin) return true;
    if (isDealer && method.createdByRole === "dealer" && method.createdBy === user?.uid)
      return true;
    return false;
  };

  return (
    <div>
      <PageHeader
        title={isAdmin ? "Payment Methods" : "My Payment Methods"}
        subtitle={
          isAdmin ? "Manage payment details for customers" : "Add and manage your payment accounts"
        }
        actions={
          isAdmin && (
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
                  Add Method
                </Button>
              </DialogTrigger>
              <PaymentMethodDialog
                key={editing?.id ?? "new"}
                initial={editing}
                onDone={() => {
                  setOpen(false);
                  setEditing(null);
                }}
              />
            </Dialog>
          )
        }
      />

      <div className="grid lg:grid-cols-2 gap-4">
        {methods.map((method) => {
          const canEdit = isEditable(method);

          return (
            <Card key={method.id}>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{method.bankName}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {method.type.toUpperCase()}
                    </p>
                    {isAdmin && method.createdByRole === "dealer" && (
                      <p className="text-xs text-muted-foreground mt-1">Added by dealer</p>
                    )}
                  </div>
                  {canEdit && (
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditing(method);
                          setOpen(true);
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={async () => {
                          if (confirm(`Delete ${method.bankName}?`)) {
                            await deleteDoc(doc(db, "paymentMethods", method.id));
                            toast.success("Deleted");
                          }
                        }}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Account Name</p>
                  <p className="font-medium text-sm">{method.accountName}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Account Number</label>
                  <p className="font-mono text-sm">{method.accountNumber}</p>
                </div>
                {method.description && (
                  <div>
                    <p className="text-xs text-muted-foreground">Notes</p>
                    <p className="text-sm text-foreground">{method.description}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {methods.length === 0 && (
        <Card>
          <CardContent className="text-center text-sm text-muted-foreground py-10">
            {isAdmin || isDealer
              ? "No payment methods yet. Add your first method."
              : "No payment methods available."}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PaymentMethodDialog({
  initial,
  onDone,
}: {
  initial: PaymentMethodDoc | null;
  onDone: () => void;
}) {
  const { user, role } = useAuth();
  const [bankName, setBankName] = useState(initial?.bankName ?? "");
  const [accountName, setAccountName] = useState(initial?.accountName ?? "");
  const [accountNumber, setAccountNumber] = useState(initial?.accountNumber ?? "");
  const [type, setType] = useState<"bank" | "easypaisa" | "jazzcash">(initial?.type ?? "bank");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankName || !accountName || !accountNumber) {
      toast.error("Fill all required fields");
      return;
    }
    setBusy(true);
    try {
      if (initial) {
        await updateDoc(doc(db, "paymentMethods", initial.id), {
          bankName,
          accountName,
          accountNumber,
          type,
          description,
        });
        toast.success("Updated");
      } else {
        await addDoc(collection(db, "paymentMethods"), {
          bankName,
          accountName,
          accountNumber,
          type,
          description,
          createdBy: user?.uid || "",
          createdByRole: role || "admin",
          createdAt: Date.now(),
        });
        toast.success("Added");
      }
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>{initial ? "Edit" : "Add"} Payment Method</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="type">Type</Label>
          <select
            id="type"
            value={type}
            onChange={(e) => setType(e.target.value as any)}
            className="w-full h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="bank">Bank</option>
            <option value="easypaisa">EasyPaisa</option>
            <option value="jazzcash">JazzCash</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bankName">Bank/Service Name *</Label>
          <Input
            id="bankName"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            placeholder="e.g., HBL, UBL, JazzCash"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="accountName">Account Name *</Label>
          <Input
            id="accountName"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            placeholder="Account holder name"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="accountNumber">Account/Phone Number *</Label>
          <Input
            id="accountNumber"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            placeholder="16 digit account or phone number"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="description">Additional Notes</Label>
          <Input
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional instructions for customers"
          />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
