import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  arrayRemove,
  arrayUnion,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import type { AreaDoc, UserDoc } from "@/lib/types";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/areas")({
  component: AreasPage,
});

function AreasPage() {
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const [areas, setAreas] = useState<AreaDoc[]>([]);
  const [dealers, setDealers] = useState<UserDoc[]>([]);
  const [customers, setCustomers] = useState<UserDoc[]>([]);
  const [editing, setEditing] = useState<AreaDoc | null>(null);
  const [open, setOpen] = useState(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    const u1 = onSnapshot(collection(db, "areas"), (snap) => {
      if (!isMounted.current) return;
      setAreas(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AreaDoc, "id">) })));
    });
    const u2 = onSnapshot(query(collection(db, "users"), where("role", "==", "dealer")), (snap) => {
      if (!isMounted.current) return;
      setDealers(snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<UserDoc, "uid">) })));
    });
    const u3 = onSnapshot(
      query(collection(db, "users"), where("role", "==", "customer")),
      (snap) => {
        if (!isMounted.current) return;
        setCustomers(snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<UserDoc, "uid">) })));
      },
    );
    return () => {
      isMounted.current = false;
      u1();
      u2();
      u3();
    };
  }, []);

  if (!isAdmin)
    return <div className="p-10 text-center text-muted-foreground">403 — Forbidden</div>;

  return (
    <div>
      <PageHeader
        title="Areas"
        subtitle="Manage service areas and dealer assignments"
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
                Add Area
              </Button>
            </DialogTrigger>
            <AreaDialog
              key={editing?.id ?? "new"}
              initial={editing}
              dealers={dealers}
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
                <TableHead>Code</TableHead>
                <TableHead>Dealers</TableHead>
                <TableHead>Users</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {areas.map((a) => {
                const dealerNames = dealers
                  .filter((d) => a.dealerIds.includes(d.uid))
                  .map((d) => d.name)
                  .join(", ");
                const userCount = customers.filter((c) => c.areaId === a.id).length;
                return (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell>{a.code}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {dealerNames || "—"}
                    </TableCell>
                    <TableCell>{userCount}</TableCell>
                    <TableCell>
                      <StatusBadge status={a.status} />
                    </TableCell>
                    <TableCell className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditing(a);
                          setOpen(true);
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={async () => {
                          if (confirm(`Delete area "${a.name}"?`)) {
                            // Remove area from all assigned dealers
                            for (const dealerId of a.dealerIds) {
                              await updateDoc(doc(db, "users", dealerId), {
                                assignedAreaIds: arrayRemove(a.id)
                              });
                            }
                            await deleteDoc(doc(db, "areas", a.id));
                            toast.success("Deleted");
                          }
                        }}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {areas.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-sm text-muted-foreground py-10"
                  >
                    No areas yet.
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

function AreaDialog({
  initial,
  dealers,
  onDone,
}: {
  initial: AreaDoc | null;
  dealers: UserDoc[];
  onDone: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [code, setCode] = useState(initial?.code ?? "");
  const [dealerIds, setDealerIds] = useState<string[]>(initial?.dealerIds ?? []);
  const [status, setStatus] = useState<"active" | "disabled">(initial?.status ?? "active");
  const [dealerSearch, setDealerSearch] = useState("");

  const toggle = (id: string) =>
    setDealerIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const filteredDealers = dealers.filter((d) =>
    d.name.toLowerCase().includes(dealerSearch.toLowerCase()) ||
    (d.phone && d.phone.includes(dealerSearch)) ||
    (d.email && d.email.toLowerCase().includes(dealerSearch.toLowerCase()))
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { name, code, dealerIds, status, createdAt: initial?.createdAt ?? Date.now() };
    if (initial) {
      // Sync dealer assignments on update
      const previousDealerIds = initial.dealerIds;

      // Remove this area from dealers that are no longer assigned
      for (const dealerId of previousDealerIds) {
        if (!dealerIds.includes(dealerId)) {
          await updateDoc(doc(db, "users", dealerId), {
            assignedAreaIds: arrayRemove(initial.id)
          });
        }
      }

      // Add this area to dealers that are newly assigned
      for (const dealerId of dealerIds) {
        if (!previousDealerIds.includes(dealerId)) {
          await updateDoc(doc(db, "users", dealerId), {
            assignedAreaIds: arrayUnion(initial.id)
          });
        }
      }

      await updateDoc(doc(db, "areas", initial.id), payload);
      toast.success("Updated");
    } else {
      const areaRef = await addDoc(collection(db, "areas"), payload);

      // Sync new area to assigned dealers
      for (const dealerId of dealerIds) {
        await updateDoc(doc(db, "users", dealerId), {
          assignedAreaIds: arrayUnion(areaRef.id)
        });
      }

      toast.success("Created");
    }
    onDone();
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{initial ? "Edit" : "Add"} Area</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Code</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} required />
          </div>
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
        <div className="space-y-2">
          <Label>Assigned Dealers</Label>
          <Input
            placeholder="Search dealers by name, phone, or email..."
            value={dealerSearch}
            onChange={(e) => setDealerSearch(e.target.value)}
            className="mb-2"
          />
          <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
            {dealers.length === 0 && (
              <div className="text-sm text-muted-foreground">
                No dealers yet. Add dealers first.
              </div>
            )}
            {filteredDealers.length === 0 && dealers.length > 0 && (
              <div className="text-sm text-muted-foreground">
                No dealers match your search.
              </div>
            )}
            {filteredDealers.map((d) => (
              <label key={d.uid} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={dealerIds.includes(d.uid)}
                  onCheckedChange={() => toggle(d.uid)}
                />
                <span>
                  {d.name} <span className="text-muted-foreground">({d.phone ?? d.email})</span>
                </span>
              </label>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button type="submit">{initial ? "Save" : "Create"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
