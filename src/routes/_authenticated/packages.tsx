import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { StatusBadge } from "@/components/status-badge";
import { fmtPKR } from "@/lib/utils-format";
import type { PackageDoc } from "@/lib/types";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/packages")({
  component: PackagesPage,
});

function PackagesPage() {
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const [items, setItems] = useState<PackageDoc[]>([]);
  const [editing, setEditing] = useState<PackageDoc | null>(null);
  const [open, setOpen] = useState(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    const unsub = onSnapshot(collection(db, "packages"), (snap) => {
      if (!isMounted.current) return;
      setItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PackageDoc, "id">) })));
    });
    return () => {
      isMounted.current = false;
      unsub();
    };
  }, []);

  if (!isAdmin) return <Forbidden />;

  return (
    <div>
      <PageHeader
        title="Packages"
        subtitle="Manage internet packages"
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
                Add Package
              </Button>
            </DialogTrigger>
            <PackageDialog
              key={editing?.id ?? "new"}
              initial={editing}
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Speed</TableHead>
                <TableHead className="text-right">Monthly</TableHead>
                <TableHead className="text-right">Install</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.speed}</TableCell>
                  <TableCell className="text-right">{fmtPKR(p.monthlyPrice)}</TableCell>
                  <TableCell className="text-right">{fmtPKR(p.installationCharges)}</TableCell>
                  <TableCell>
                    <StatusBadge status={p.status} />
                  </TableCell>
                  <TableCell className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setEditing(p);
                        setOpen(true);
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={async () => {
                        if (confirm(`Delete package "${p.name}"?`)) {
                          await deleteDoc(doc(db, "packages", p.id));
                          toast.success("Deleted");
                        }
                      }}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-sm text-muted-foreground py-10"
                  >
                    No packages yet. Add your first package.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function PackageDialog({ initial, onDone }: { initial: PackageDoc | null; onDone: () => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [speed, setSpeed] = useState(initial?.speed ?? "");
  const [monthlyPrice, setMonthlyPrice] = useState(initial?.monthlyPrice ?? 0);
  const [installationCharges, setInstallationCharges] = useState(initial?.installationCharges ?? 0);
  const [description, setDescription] = useState(initial?.description ?? "");
  const [status, setStatus] = useState<"active" | "disabled">(initial?.status ?? "active");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name,
      speed,
      monthlyPrice: Number(monthlyPrice),
      installationCharges: Number(installationCharges),
      description,
      status,
      createdAt: initial?.createdAt ?? Date.now(),
    };
    if (initial) {
      await updateDoc(doc(db, "packages", initial.id), payload);
      toast.success("Package updated");
    } else {
      await addDoc(collection(db, "packages"), payload);
      toast.success("Package added");
    }
    onDone();
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{initial ? "Edit" : "Add"} Package</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        <div className="space-y-1.5">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Speed</Label>
            <Input
              value={speed}
              onChange={(e) => setSpeed(e.target.value)}
              placeholder="10 Mbps"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <select
              className="w-full h-10 rounded-md border bg-background px-3 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value as "active" | "disabled")}
            >
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Monthly Price (PKR)</Label>
            <Input
              type="number"
              value={monthlyPrice}
              onChange={(e) => setMonthlyPrice(Number(e.target.value))}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Installation Charges</Label>
            <Input
              type="number"
              value={installationCharges}
              onChange={(e) => setInstallationCharges(Number(e.target.value))}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Description</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <DialogFooter>
          <Button type="submit">{initial ? "Save" : "Create"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function Forbidden() {
  return (
    <div className="p-10 text-center text-muted-foreground">
      403 — You don't have access to this page.
    </div>
  );
}
