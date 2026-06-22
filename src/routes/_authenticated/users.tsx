import { createFileRoute, useSearch, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  addDoc,
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  signInWithEmailAndPassword,
  updatePassword as fbUpdatePassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { db, auth, getSecondaryAuth } from "@/lib/firebase";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Pencil,
  Trash2,
  Receipt,
  Power,
  Search,
  MapPin,
  Map,
  MessageCircle,
  Send,
  KeyRound,
  MoreVertical,
  Eye,
  EyeOff,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

function buildWhatsAppReminder(c: UserDoc, packages: PackageDoc[]): string | null {
  const raw = (c.phone ?? "").replace(/[^\d]/g, "");
  if (!raw) return null;
  // Default to Pakistan country code if local 03xx number
  const intl = raw.startsWith("0") ? "92" + raw.slice(1) : raw;
  const due = c.nextDueDate
    ? new Date(c.nextDueDate).toLocaleDateString("en-PK", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";
  const pending = `Rs ${Number(c.pendingAmount ?? 0).toLocaleString("en-PK")}`;
  const pkg = packages.find((p) => p.id === c.packageId);
  const packageName = pkg?.name ?? "Package";

  const message = `Assalam-o-Alaikum ${c.name},

Umeed hai aap khairiyat se honge.

Yeh aapki internet bill payment ka friendly reminder hai:

📦 Package: ${packageName}
💰 Monthly Fee: Rs ${Number(c.monthlyFee ?? 0).toLocaleString("en-PK")}
⚠️ Pending Amount: ${pending}
📅 Due Date: ${due}

*Payment Methods:*
🏧 JazzCash
💳 Bank Transfer

Baraye meharbani due date ${due} se pehle payment kar dein takay service bina kisi interruption ke jari rahe.

Shukriya!
ASAD Cable & Internet`;
  return `https://wa.me/${intl}?text=${encodeURIComponent(message)}`;
}

function sendWhatsAppReminder(c: UserDoc, packages: PackageDoc[]) {
  const url = buildWhatsAppReminder(c, packages);
  if (!url) {
    toast.error("No phone number saved for this customer");
    return;
  }
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.click();
}
import { StatusBadge } from "@/components/status-badge";
import { fmtPKR, fmtDate, fmtCNIC, fmtPhone, fmtDateTimeText } from "@/lib/utils-format";
import type {
  AreaDoc,
  PackageDoc,
  UserDoc,
  PaymentDoc,
  PaymentMethod,
} from "@/lib/types";
import { paymentStatusOf, CYCLE, addDays } from "@/lib/billing";
import { toast } from "sonner";
import { reversePayment, reassignPayment } from "@/lib/payment-correction";

export const Route = createFileRoute("/_authenticated/users")({
  component: UsersPage,
  validateSearch: (search: Record<string, unknown>) => ({
    status: (search.status as string) || "all",
    due: (search.due as string) || "all",
  }),
});

function UsersPage() {
  const { user, role } = useAuth();
  const searchParams = useSearch({ from: "/_authenticated/users" });
  const navigate = useNavigate({ from: "/_authenticated/users" });
  const [customers, setCustomers] = useState<UserDoc[]>([]);
  const [areas, setAreas] = useState<AreaDoc[]>([]);
  const [packages, setPackages] = useState<PackageDoc[]>([]);
  const [editing, setEditing] = useState<UserDoc | null>(null);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<UserDoc | null>(null);
  const [payOpen, setPayOpen] = useState<UserDoc | null>(null);
  const [selectedForReminder, setSelectedForReminder] = useState<Set<string>>(new Set());
  const [bulkRemindersOpen, setBulkRemindersOpen] = useState(false);
  const [bulkSending, setBulkSending] = useState(false);
  const isMounted = useRef(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(searchParams.status);
  const [areaFilter, setAreaFilter] = useState("all");
  const [dueFilter, setDueFilter] = useState(searchParams.due);
  const [page, setPage] = useState(1);
  const PER = 15;

  useEffect(() => {
    isMounted.current = true;
    const u1 = onSnapshot(
      query(collection(db, "users"), where("role", "==", "customer")),
      (snap) => {
        if (!isMounted.current) return;
        const all = snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<UserDoc, "uid">) }));
        const scoped =
          role === "dealer" && user
            ? all.filter((c) => (user.assignedAreaIds ?? []).includes(c.areaId ?? ""))
            : all;
        setCustomers(scoped);
      },
    );
    const u2 = onSnapshot(collection(db, "areas"), (snap) => {
      if (!isMounted.current) return;
      setAreas(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AreaDoc, "id">) })));
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
    const now = Date.now();
    const weekFromNow = now + 7 * 24 * 60 * 60 * 1000;

    const result = customers.filter((c) => {
      if (
        search &&
        !`${c.name} ${c.phone ?? ""} ${c.cnic ?? ""}`.toLowerCase().includes(search.toLowerCase())
      )
        return false;
      if (statusFilter !== "all") {
        if (statusFilter === "active" && c.connectionStatus === "disabled") return false;
        if (statusFilter === "disabled" && c.connectionStatus !== "disabled") return false;
        if (["paid", "unpaid", "partial", "overdue"].includes(statusFilter) && paymentStatusOf(c) !== statusFilter) return false;
      }
      if (areaFilter !== "all" && c.areaId !== areaFilter) return false;
      if (dueFilter === "thisweek") {
        const dueDate = c.nextDueDate ?? 0;
        if (dueDate < now || dueDate > weekFromNow) return false;
      }
      return true;
    });

    result.sort((a, b) => {
      if (dueFilter === "thisweek") {
        return (a.nextDueDate ?? 0) - (b.nextDueDate ?? 0);
      }
      return (b.createdAt ?? 0) - (a.createdAt ?? 0);
    });

    return result;
  }, [customers, search, statusFilter, areaFilter, dueFilter]);

  const pageItems = filtered.slice((page - 1) * PER, page * PER);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER));

  const toggleSelection = (uid: string) => {
    const newSet = new Set(selectedForReminder);
    if (newSet.has(uid)) {
      newSet.delete(uid);
    } else {
      newSet.add(uid);
    }
    setSelectedForReminder(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedForReminder.size === filtered.length) {
      setSelectedForReminder(new Set());
    } else {
      setSelectedForReminder(new Set(filtered.map((c) => c.uid)));
    }
  };

  const sendBulkReminders = () => {
    if (selectedForReminder.size === 0) {
      toast.error("Select users to send reminders");
      return;
    }
    setBulkRemindersOpen(true);
  };

  return (
    <div className="w-full">
      <PageHeader
        title="Users"
        subtitle="Customer billing management"
        actions={
          (role === "admin" || (role === "dealer" && user?.canManageCustomers)) && (
            <Dialog
              open={open}
              onOpenChange={(o) => {
                setOpen(o);
                if (!o) setEditing(null);
              }}
            >
              <DialogTrigger asChild>
                <Button size="sm" className="text-xs sm:text-sm" onClick={() => setEditing(null)}>
                  <Plus className="size-3 sm:size-4 mr-1" />
                  <span className="hidden sm:inline">Add Customer</span>
                  <span className="sm:hidden">Add</span>
                </Button>
              </DialogTrigger>
              <CustomerDialog
                key={editing?.uid ?? "new"}
                initial={editing}
                areas={areas}
                packages={packages}
                user={user}
                onDone={() => {
                  setOpen(false);
                  setEditing(null);
                }}
              />
            </Dialog>
          )
        }
      />

      <Card className="mb-4">
        <CardContent className="p-2 sm:p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3">
            <div className="relative sm:col-span-1 lg:col-span-2">
              <Search className="size-3 sm:size-4 absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-7 sm:pl-9 h-9 sm:h-10 text-xs sm:text-sm"
                placeholder="Search name, phone, CNIC…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <select
              className="h-9 sm:h-10 rounded-md border bg-background px-2 sm:px-3 text-xs sm:text-sm"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
                navigate({ search: (prev) => ({ ...prev, status: e.target.value }) });
              }}
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid</option>
              <option value="partial">Partial</option>
              <option value="overdue">Overdue</option>
            </select>
            <select
              className="h-9 sm:h-10 rounded-md border bg-background px-2 sm:px-3 text-xs sm:text-sm"
              value={dueFilter}
              onChange={(e) => {
                setDueFilter(e.target.value);
                setPage(1);
                navigate({ search: (prev) => ({ ...prev, due: e.target.value }) });
              }}
            >
              <option value="all">All dates</option>
              <option value="thisweek">Due this week</option>
            </select>
            <select
              className="h-9 sm:h-10 rounded-md border bg-background px-2 sm:px-3 text-xs sm:text-sm"
              value={areaFilter}
              onChange={(e) => {
                setAreaFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">All areas</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {selectedForReminder.size > 0 && (
        <Card className="mb-4 border-blue-200 bg-blue-50">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium text-blue-900">
                {selectedForReminder.size} customer{selectedForReminder.size !== 1 ? "s" : ""}{" "}
                selected
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedForReminder(new Set())}
                  className="text-xs"
                >
                  Clear
                </Button>
                <Button
                  size="sm"
                  onClick={sendBulkReminders}
                  disabled={bulkSending}
                  className="text-xs bg-green-600 hover:bg-green-700 text-white"
                >
                  <Send className="size-3 mr-1.5" />
                  {bulkSending ? "Sending..." : "Send WhatsApp Reminders"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="hidden sm:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selectedForReminder.size === filtered.length && filtered.length > 0}
                      onCheckedChange={() => toggleSelectAll()}
                    />
                  </TableHead>
                  <TableHead className="text-xs sm:text-sm">Name</TableHead>
                  <TableHead className="text-xs sm:text-sm">Username</TableHead>
                  <TableHead className="text-xs sm:text-sm">Package</TableHead>
                  <TableHead className="text-right text-xs sm:text-sm">Monthly</TableHead>
                  <TableHead className="text-xs sm:text-sm">Due Date</TableHead>
                  <TableHead className="text-right text-xs sm:text-sm">Pending</TableHead>
                  <TableHead className="text-xs sm:text-sm">Status</TableHead>
                  <TableHead className="text-xs sm:text-sm"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map((c) => {
                  const pkg = packages.find((p) => p.id === c.packageId);
                  const st = paymentStatusOf(c);
                  return (
                    <TableRow
                      key={c.uid}
                      className={`cursor-pointer text-xs sm:text-sm ${c.connectionStatus === "disabled" ? "opacity-50" : ""}`}
                      onClick={() => setSelected(c)}
                    >
                      <TableCell
                        className="px-2 py-2 sm:py-3 w-10"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={selectedForReminder.has(c.uid)}
                          onCheckedChange={() => toggleSelection(c.uid)}
                        />
                      </TableCell>
                      <TableCell className="px-2 sm:px-4 py-2 sm:py-3">
                        <div className="font-medium text-xs sm:text-sm">{c.name}</div>
                        <div className="text-xs text-muted-foreground">{fmtPhone(c.phone)}</div>
                      </TableCell>
                      <TableCell className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm">
                        {c.username ?? "—"}
                      </TableCell>
                      <TableCell className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm">
                        {pkg?.name ?? "—"}
                      </TableCell>
                      <TableCell className="text-right px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm">
                        {fmtPKR(c.monthlyFee)}
                      </TableCell>
                      <TableCell className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm">
                        {fmtDate(c.nextDueDate)}
                      </TableCell>
                      <TableCell className="text-right px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium">
                        <div>{fmtPKR(c.pendingAmount)}</div>
                        {(c.advanceBalance ?? 0) > 0 && (
                          <div className="text-xs text-success">− {fmtPKR(c.advanceBalance)}</div>
                        )}
                      </TableCell>
                      <TableCell className="px-2 sm:px-4 py-2 sm:py-3">
                        <StatusBadge status={st} />
                      </TableCell>
                      <TableCell
                        className="px-2 sm:px-4 py-2 sm:py-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="outline" className="text-xs h-7 sm:h-8 px-2">
                              Actions
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem
                              onClick={() => setPayOpen(c)}
                              className="cursor-pointer"
                            >
                              <Receipt className="size-3.5 mr-2 text-blue-600" />
                              <span>Receive Payment</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => sendWhatsAppReminder(c, packages)}
                              className="cursor-pointer"
                            >
                              <MessageCircle className="size-3.5 mr-2 text-green-600" />
                              <span>Send WhatsApp Reminder</span>
                            </DropdownMenuItem>
                            {c.email && (
                              <DropdownMenuItem
                                onClick={async () => {
                                  try {
                                    await sendPasswordResetEmail(auth, c.email!);
                                    toast.success(`Reset email sent to ${c.email}`);
                                  } catch (err) {
                                    toast.error(
                                      err instanceof Error ? err.message : "Failed to send reset email"
                                    );
                                  }
                                }}
                                className="cursor-pointer"
                              >
                                <KeyRound className="size-3.5 mr-2 text-purple-600" />
                                <span>Send Password Reset</span>
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {(role === "admin" ||
                              (role === "dealer" &&
                                user?.canManageCustomers &&
                                (user?.assignedAreaIds ?? []).includes(c.areaId ?? ""))) && (
                              <>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setEditing(c);
                                    setOpen(true);
                                  }}
                                  className="cursor-pointer"
                                >
                                  <Pencil className="size-3.5 mr-2 text-amber-600" />
                                  <span>Edit Customer</span>
                                </DropdownMenuItem>
                                {role === "admin" && (
                                  <>
                                    <DropdownMenuItem
                                      onClick={async () => {
                                        const next =
                                          c.connectionStatus === "disabled" ? "active" : "disabled";
                                        await updateDoc(doc(db, "users", c.uid), {
                                          connectionStatus: next,
                                        });
                                        toast.success(`Connection ${next}`);
                                      }}
                                      className="cursor-pointer"
                                    >
                                      <Power className="size-3.5 mr-2 text-orange-600" />
                                      <span>
                                        {c.connectionStatus === "disabled" ? "Activate" : "Disable"}
                                      </span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={async () => {
                                        if (confirm(`Delete ${c.name}?`)) {
                                          await deleteDoc(doc(db, "users", c.uid));
                                          toast.success("Deleted");
                                        }
                                      }}
                                      className="cursor-pointer text-destructive"
                                    >
                                      <Trash2 className="size-3.5 mr-2" />
                                      <span>Delete Customer</span>
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {pageItems.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="text-center text-xs sm:text-sm text-muted-foreground py-8 sm:py-10"
                    >
                      No customers found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="sm:hidden space-y-2 p-2">
            {pageItems.map((c) => {
              const pkg = packages.find((p) => p.id === c.packageId);
              const st = paymentStatusOf(c);
              return (
                <div
                  key={c.uid}
                  className={`border rounded-lg p-3 cursor-pointer transition-colors hover:bg-muted/50 ${c.connectionStatus === "disabled" ? "opacity-50" : ""}`}
                  onClick={() => setSelected(c)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{fmtPhone(c.phone)}</div>
                      {c.username && (
                        <div className="text-xs text-muted-foreground mt-0.5">@{c.username}</div>
                      )}
                    </div>
                    <StatusBadge status={st} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-2 text-xs">
                    <div>
                      <div className="text-muted-foreground">Package</div>
                      <div className="font-medium">{pkg?.name ?? "—"}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Monthly</div>
                      <div className="font-medium">{fmtPKR(c.monthlyFee)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-muted-foreground">Pending</div>
                      <div className="font-medium text-red-600">{fmtPKR(c.pendingAmount)}</div>
                      {(c.advanceBalance ?? 0) > 0 && (
                        <div className="text-xs text-success">− {fmtPKR(c.advanceBalance)}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 text-xs" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="outline" className="flex-1 h-8 text-xs">
                          Actions
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => setPayOpen(c)} className="cursor-pointer">
                          <Receipt className="size-4 mr-2 text-blue-600" />
                          <span>Receive Payment</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => sendWhatsAppReminder(c, packages)}
                          className="cursor-pointer"
                        >
                          <MessageCircle className="size-4 mr-2 text-green-600" />
                          <span>Send Reminder</span>
                        </DropdownMenuItem>
                        {c.email && (
                          <DropdownMenuItem
                            onClick={async () => {
                              try {
                                await sendPasswordResetEmail(auth, c.email!);
                                toast.success(`Reset email sent to ${c.email}`);
                              } catch (err) {
                                toast.error(
                                  err instanceof Error ? err.message : "Failed to send reset email"
                                );
                              }
                            }}
                            className="cursor-pointer"
                          >
                            <KeyRound className="size-4 mr-2 text-purple-600" />
                            <span>Reset Password</span>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        {(role === "admin" ||
                          (role === "dealer" &&
                            user?.canManageCustomers &&
                            (user?.assignedAreaIds ?? []).includes(c.areaId ?? ""))) && (
                          <>
                            <DropdownMenuItem
                              onClick={() => {
                                setEditing(c);
                                setOpen(true);
                              }}
                              className="cursor-pointer"
                            >
                              <Pencil className="size-4 mr-2 text-amber-600" />
                              <span>Edit</span>
                            </DropdownMenuItem>
                            {role === "admin" && (
                              <>
                                <DropdownMenuItem
                                  onClick={async () => {
                                    const next =
                                      c.connectionStatus === "disabled" ? "active" : "disabled";
                                    await updateDoc(doc(db, "users", c.uid), {
                                      connectionStatus: next,
                                    });
                                    toast.success(`Connection ${next}`);
                                  }}
                                  className="cursor-pointer"
                                >
                                  <Power className="size-4 mr-2 text-orange-600" />
                                  <span>
                                    {c.connectionStatus === "disabled" ? "Activate" : "Disable"}
                                  </span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={async () => {
                                    if (confirm(`Delete ${c.name}?`)) {
                                      await deleteDoc(doc(db, "users", c.uid));
                                      toast.success("Deleted");
                                    }
                                  }}
                                  className="cursor-pointer text-destructive"
                                >
                                  <Trash2 className="size-4 mr-2" />
                                  <span>Delete</span>
                                </DropdownMenuItem>
                              </>
                            )}
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
            {pageItems.length === 0 && (
              <div className="text-center text-xs text-muted-foreground py-8">
                No customers found.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between mt-3 gap-2 text-xs sm:text-sm px-1">
        <div className="text-muted-foreground">{filtered.length} customers</div>
        <div className="flex items-center gap-1 sm:gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="text-xs h-7 sm:h-8 px-2 sm:px-3"
          >
            Prev
          </Button>
          <span className="text-xs">
            {page} / {totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="text-xs h-7 sm:h-8 px-2 sm:px-3"
          >
            Next
          </Button>
        </div>
      </div>

      <CustomerDrawer
        customer={selected}
        onClose={() => setSelected(null)}
        packages={packages}
        areas={areas}
      />
      {payOpen && <ReceivePaymentDialog customer={payOpen} onClose={() => setPayOpen(null)} />}
      <BulkRemindersDialog
        open={bulkRemindersOpen}
        selectedUids={selectedForReminder}
        customers={customers}
        packages={packages}
        onClose={() => {
          setBulkRemindersOpen(false);
          setSelectedForReminder(new Set());
        }}
      />
    </div>
  );
}

export const formatPhoneNumber = (value: string): string => {
  // Sirf digits rakhna
  let cleaned = value.replace(/\D/g, "");

  // Pakistan country code remove
  if (cleaned.startsWith("92")) {
    cleaned = "0" + cleaned.slice(2);
  }

  // ensure leading 0
  if (!cleaned.startsWith("0")) {
    cleaned = "0" + cleaned;
  }

  // limit to 11 digits (030xxxxxxxx)
  cleaned = cleaned.slice(0, 11);

  return cleaned;
};

export const formatCNICNumber = (value: string): string => {
  // Remove all non-numeric characters
  const cleaned = value.replace(/\D/g, "").slice(0, 13);

  // Format: 12345-1234567-1
  if (cleaned.length <= 5) {
    return cleaned;
  }

  if (cleaned.length <= 12) {
    return `${cleaned.slice(0, 5)}-${cleaned.slice(5)}`;
  }

  return `${cleaned.slice(0, 5)}-${cleaned.slice(5, 12)}-${cleaned.slice(12)}`;
};

function CustomerDialog({
  initial,
  areas,
  packages,
  user,
  onDone,
}: {
  initial: UserDoc | null;
  areas: AreaDoc[];
  packages: PackageDoc[];
  user: UserDoc | null;
  onDone: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [username, setUsername] = useState(initial?.username ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [password, setPassword] = useState(initial?.password ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [cnic, setCnic] = useState(initial?.cnic ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [packageId, setPackageId] = useState(initial?.packageId ?? "");
  const [areaId, setAreaId] = useState(initial?.areaId ?? "");
  const [latitude, setLatitude] = useState(initial?.latitude ?? 0);
  const [longitude, setLongitude] = useState(initial?.longitude ?? 0);
  const [activationDate, setActivationDate] = useState(
    initial?.activationDate ? new Date(initial.activationDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
  );
  const [busy, setBusy] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const pkg = packages.find((p) => p.id === packageId);

  const captureLocation = async () => {
    setGeoLoading(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject);
      });
      setLatitude(pos.coords.latitude);
      setLongitude(pos.coords.longitude);
      toast.success("Location captured");
    } catch {
      toast.error("Could not get location. Check permissions.");
    } finally {
      setGeoLoading(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!packageId || !areaId) {
      toast.error("Pick package and area");
      return;
    }
    setBusy(true);
    try {
      const area = areas.find((a) => a.id === areaId);
      const dealerId = area?.dealerIds?.[0]; // first dealer of area
      if (initial) {
        const activationTs = new Date(activationDate).getTime();
        const updatePayload: Record<string, unknown> = {
          name,
          username,
          phone,
          cnic,
          address,
          packageId,
          areaId,
          dealerId: dealerId ?? null,
          monthlyFee: pkg?.monthlyPrice ?? initial.monthlyFee,
          activationDate: activationTs,
          activationDateText: fmtDateTimeText(activationTs),
          nextDueDate: activationTs,
          nextDueDateText: fmtDateTimeText(activationTs),
          ...(latitude !== 0 && { latitude }),
          ...(longitude !== 0 && { longitude }),
        };
        if (email && email !== initial.email) updatePayload.email = email;
        if (password) updatePayload.password = password;
        await updateDoc(doc(db, "users", initial.uid), updatePayload);

        if (password && initial.email) {
          try {
            const sec = getSecondaryAuth();
            const cred = await signInWithEmailAndPassword(
              sec,
              initial.email,
              initial.email.split("@")[0],
            );
            await fbUpdatePassword(cred.user, password);
            await fbSignOut(sec);
            toast.success("Customer and password updated");
          } catch (err) {
            toast.success("Customer updated. Note: Password update failed - use 'Send Password Reset' to reset.");
          }
        } else {
          toast.success("Customer updated");
        }
      } else {
        const sec = getSecondaryAuth();
        const loginEmail = email || `${phone || Date.now()}@isp.local`;
        const loginPwd = password || "12345678";
        const cred = await createUserWithEmailAndPassword(sec, loginEmail, loginPwd);
        const activationTs = new Date(activationDate).getTime();
        await setDoc(doc(db, "users", cred.user.uid), {
          name,
          username,
          email: loginEmail,
          password: loginPwd,
          phone,
          cnic,
          address,
          role: "customer",
          status: "active",
          packageId,
          areaId,
          dealerId: dealerId ?? null,
          activationDate: activationTs,
          activationDateText: fmtDateTimeText(activationTs),
          monthlyFee: pkg?.monthlyPrice ?? 0,
          nextDueDate: activationTs,
          nextDueDateText: fmtDateTimeText(activationTs),
          pendingAmount: pkg?.monthlyPrice ?? 0,
          lastBillGeneratedDate: 0,
          connectionStatus: "active",
          paymentStatus: "unpaid",
          ...(latitude !== 0 && { latitude }),
          ...(longitude !== 0 && { longitude }),
          createdAt: Date.now(),
          createdAtText: fmtDateTimeText(Date.now()),
        });
        await fbSignOut(sec);
        toast.success(`Customer created. Login: ${loginEmail} / ${loginPwd}`);
      }
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogContent className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader className="sticky top-0 bg-background z-10">
        <DialogTitle>{initial ? "Edit" : "Add"} Customer</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4 pb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              required
              className="h-10"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Username</Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Display name (optional)"
              className="h-10"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Phone</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
              placeholder="+92 303 XXXXXXX"
              maxLength={17}
              className="h-10"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">CNIC</Label>
            <Input
              value={cnic}
              onChange={(e) => setCnic(formatCNICNumber(e.target.value))}
              placeholder="XXXXX-XXXXXXX-X"
              maxLength={15}
              className="h-10"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Address</Label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street address"
              className="h-10"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Login Email {initial && "(optional)"}</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={initial ? "Leave blank to keep unchanged" : "Auto-generated if empty"}
              required={!initial}
              className="h-10"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Password {initial && "(optional)"}</Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={initial ? "Leave blank to keep unchanged" : "Auto-generated if empty"}
                className="h-10 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Package *</Label>
            <select
              className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={packageId}
              onChange={(e) => setPackageId(e.target.value)}
              required
            >
              <option value="">Select package</option>
              {packages
                .filter((p) => p.status === "active")
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {fmtPKR(p.monthlyPrice)}
                  </option>
                ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Area *</Label>
            <select
              className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={areaId}
              onChange={(e) => setAreaId(e.target.value)}
              required
            >
              <option value="">Select area</option>
              {areas
                .filter((a) => {
                  if (user?.role === "admin") return true;
                  return user?.assignedAreaIds?.includes(a.id) ?? false;
                })
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Activation Date *</Label>
            <Input
              type="date"
              value={activationDate}
              onChange={(e) => setActivationDate(e.target.value)}
              required
              className="h-10"
            />
          </div>
        </div>

        <div className="border-t pt-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-3">
            <Label className="text-sm font-medium flex-1">Location Coordinates</Label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={captureLocation}
              disabled={geoLoading}
              className="w-full sm:w-auto"
            >
              <MapPin className="size-4 mr-2" />
              {geoLoading ? "Getting…" : "Capture Location"}
            </Button>
          </div>
          {(latitude !== 0 || longitude !== 0) && (
            <div className="text-sm bg-muted/50 p-3 rounded-md space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Latitude:</span>
                <span className="font-medium">{latitude.toFixed(6)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Longitude:</span>
                <span className="font-medium">{longitude.toFixed(6)}</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="sticky bottom-0 bg-background pt-4 border-t">
          <Button type="submit" disabled={busy} className="w-full sm:w-auto">
            {busy ? "Saving…" : initial ? "Save Changes" : "Create Customer"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function ReceivePaymentDialog({ customer, onClose }: { customer: UserDoc; onClose: () => void }) {
  const { user } = useAuth();
  const [amount, setAmount] = useState(customer.pendingAmount ?? customer.monthlyFee ?? 0);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [customDueDate, setCustomDueDate] = useState<string>("");

  const pendingAmount = customer.pendingAmount ?? 0;
  const paymentAmount = Number(amount);
  const overpayment = Math.max(0, paymentAmount - pendingAmount);
  const newPending = Math.max(0, pendingAmount - paymentAmount);
  const newAdvance = (customer.advanceBalance ?? 0) + overpayment;

  const setTimeToMidnightPlusOne = (timestamp: number): number => {
    const date = new Date(timestamp);
    date.setHours(0, 1, 0, 0);
    return date.getTime();
  };

  const getDefaultNextDueDate = () => {
    const now = Date.now();
    const futureDate = addDays(now, CYCLE);
    return setTimeToMidnightPlusOne(futureDate);
  };

  const getFinalDueDate = () => {
    if (customDueDate) {
      const dateTime = new Date(customDueDate).getTime();
      return setTimeToMidnightPlusOne(dateTime);
    }
    return getDefaultNextDueDate();
  };

  const getMonthsCovered = () => {
    const monthlyFee = customer.monthlyFee ?? 0;
    if (monthlyFee <= 0) return [];

    const numMonths = Math.ceil(paymentAmount / monthlyFee);
    const now = new Date();
    const months = [];

    for (let i = 0; i < numMonths; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = d.toLocaleDateString("en-PK", { month: "short", year: "numeric" });
      months.unshift(monthName);
    }

    return months;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setBusy(true);
    try {
      const now = Date.now();
      const monthsCovered = getMonthsCovered();
      const forMonths = monthsCovered.length > 0 ? monthsCovered : undefined;

      await addDoc(collection(db, "payments"), {
        customerId: customer.uid,
        customerName: customer.name,
        amount: Number(amount),
        method,
        notes,
        date: now,
        dateText: fmtDateTimeText(now),
        receivedByUid: user.uid,
        receivedByName: user.name,
        dealerId: customer.dealerId ?? null,
        areaId: customer.areaId ?? null,
        ...(forMonths && { forMonths }),
        // snapshot previous state for reversal
        prevPendingAmount: customer.pendingAmount ?? 0,
        prevAdvanceBalance: customer.advanceBalance ?? 0,
        prevNextDueDate: customer.nextDueDate,
        prevPaymentStatus: customer.paymentStatus,
      });
      const pendingBefore = customer.pendingAmount ?? 0;
      const newPending = Math.max(0, pendingBefore - Number(amount));
      const overpayment = Math.max(0, Number(amount) - pendingBefore);
      const newAdvance = (customer.advanceBalance ?? 0) + overpayment;
      const nextDueDate = getFinalDueDate();

      await updateDoc(doc(db, "users", customer.uid), {
        pendingAmount: newPending,
        advanceBalance: newAdvance,
        lastPaymentDate: now,
        lastPaymentDateText: fmtDateTimeText(now),
        nextDueDate,
        nextDueDateText: fmtDateTimeText(nextDueDate),
        paymentStatus: newPending <= 0 ? "paid" : "partial",
      });
      toast.success("Payment received");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const defaultDueDate = new Date(getDefaultNextDueDate());
  const defaultDueDateStr = defaultDueDate.toISOString().split("T")[0];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100vw-1rem)] sm:w-full max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="sticky top-0 bg-background z-10 pb-2">
          <DialogTitle className="text-base sm:text-lg break-words pr-6">
            Receive Payment — {customer.name}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="rounded-md bg-muted/50 p-3 text-xs sm:text-sm flex flex-wrap gap-x-3 gap-y-1">
            <span>
              Pending:{" "}
              <span className="font-semibold">{fmtPKR(customer.pendingAmount)}</span>
            </span>
            <span className="text-muted-foreground">
              Monthly: {fmtPKR(customer.monthlyFee)}
            </span>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Amount (PKR)</Label>
            <Input
              type="number"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              required
              className="h-11 text-base"
            />
          </div>
          {(overpayment > 0 || newAdvance > 0) && (
            <div className="rounded-md bg-success/10 border border-success/30 p-3 text-xs sm:text-sm space-y-1">
              <div>
                <span className="text-muted-foreground">Pending after payment:</span>{" "}
                <span className="font-medium">{fmtPKR(newPending)}</span>
              </div>
              {overpayment > 0 && (
                <div>
                  <span className="text-muted-foreground">Overpayment → Advance:</span>{" "}
                  <span className="font-medium text-success">{fmtPKR(overpayment)}</span>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Next month pending:</span>{" "}
                <span className="font-medium">
                  {fmtPKR(Math.max(0, (customer.monthlyFee ?? 0) - newAdvance))}
                </span>
              </div>
            </div>
          )}
          {getMonthsCovered().length > 0 && (
            <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-xs sm:text-sm">
              <div className="text-muted-foreground">Covers months:</div>
              <div className="font-medium text-blue-900 break-words">
                {getMonthsCovered().join(", ")}
              </div>
            </div>
          )}
          <div className="border-t pt-3">
            <Label className="text-sm font-medium block mb-2">Next Payment Due Date</Label>
            <div className="space-y-2">
              <div className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
                Default (30 days): {defaultDueDate.toLocaleDateString("en-PK")}
              </div>
              <Input
                type="date"
                value={customDueDate}
                onChange={(e) => setCustomDueDate(e.target.value)}
                min={defaultDueDateStr}
                className="h-11 text-sm"
              />
              {customDueDate && (
                <div className="text-xs text-blue-600 break-words">
                  Custom date: {new Date(customDueDate).toLocaleDateString("en-PK")}
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Method</Label>
              <select
                className="w-full h-11 rounded-md border bg-background px-3 text-sm"
                value={method}
                onChange={(e) => setMethod(e.target.value as PaymentMethod)}
              >
                <option value="cash">Cash</option>
                <option value="bank">Bank Transfer</option>
                <option value="jazzcash">JazzCash</option>
                <option value="easypaisa">EasyPaisa</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Notes</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="h-11"
              />
            </div>
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="w-full sm:w-auto h-11"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy} className="w-full sm:w-auto h-11">
              {busy ? "Saving…" : "Receive Payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


function CustomerDrawer({
  customer,
  onClose,
  packages,
  areas,
}: {
  customer: UserDoc | null;
  onClose: () => void;
  packages: PackageDoc[];
  areas: AreaDoc[];
}) {
  const { user, role } = useAuth();
  const [payments, setPayments] = useState<PaymentDoc[]>([]);
  const [selectedPayment, setSelectedPayment] = useState<PaymentDoc | null>(null);
  const [correctionMode, setCorrectionMode] = useState<"reversal" | "reassignment" | null>(null);
  const [allCustomers, setAllCustomers] = useState<UserDoc[]>([]);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    if (!customer) return;
    const u1 = onSnapshot(
      query(collection(db, "payments"), where("customerId", "==", customer.uid)),
      (snap) => {
        if (!isMounted.current) return;
        setPayments(
          snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<PaymentDoc, "id">) }))
            .sort((a, b) => b.date - a.date),
        );
      },
    );
    const u2 = onSnapshot(
      query(collection(db, "users"), where("role", "==", "customer")),
      (snap) => {
        if (!isMounted.current) return;
        setAllCustomers(
          snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<UserDoc, "uid">) }))
        );
      }
    );
    return () => {
      isMounted.current = false;
      u1();
      u2();
    };
  }, [customer]);

  if (!customer) return null;
  const pkg = packages.find((p) => p.id === customer.packageId);
  const area = areas.find((a) => a.id === customer.areaId);

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{customer.name}</SheetTitle>
          <SheetDescription>
            {customer.phone} · {customer.cnic}
          </SheetDescription>
        </SheetHeader>
        <div className="p-4">
          <Tabs defaultValue="overview">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="payments">Payments ({payments.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="space-y-3 mt-4 text-sm">
              <InfoRow label="Email" value={customer.email} />
              {customer.password && <PasswordInfoRow password={customer.password} />}
              <InfoRow label="Package" value={pkg?.name} />
              <InfoRow label="Area" value={area?.name} />
              <InfoRow label="Address" value={customer.address} />
              <InfoRow label="Monthly Fee" value={fmtPKR(customer.monthlyFee)} />
              <InfoRow label="Activated" value={fmtDate(customer.activationDate)} />
              <InfoRow label="Last Payment" value={fmtDate(customer.lastPaymentDate)} />
              <InfoRow label="Next Due" value={fmtDate(customer.nextDueDate)} />
              <InfoRow label="Pending Amount" value={fmtPKR(customer.pendingAmount)} />
              {(customer.advanceBalance ?? 0) > 0 && (
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Advance Balance</span>
                  <span className="font-medium text-success">
                    {fmtPKR(customer.advanceBalance)}
                  </span>
                </div>
              )}
              <InfoRow label="Status" value={<StatusBadge status={paymentStatusOf(customer)} />} />
              <InfoRow
                label="Connection"
                value={<StatusBadge status={customer.connectionStatus ?? "active"} />}
              />
              {(customer.latitude || customer.longitude) && (
                <div className="pt-3 border-t">
                  <Button
                    className="w-full"
                    onClick={() => {
                      const lat = customer.latitude || 0;
                      const lon = customer.longitude || 0;
                      window.open(`https://www.google.com/maps?q=${lat},${lon}`, "_blank");
                    }}
                  >
                    <Map className="size-4 mr-2" />
                    Open Location on Google Maps
                  </Button>
                </div>
              )}
            </TabsContent>
            <TabsContent value="payments" className="mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>For Months</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => {
                    const isReversed = p.status === "reversed";
                    const canCorrect =
                      role === "admin" || (role === "dealer" && p.receivedByUid === user?.uid);

                    return (
                      <TableRow key={p.id} className={isReversed ? "opacity-50" : ""}>
                        <TableCell>{fmtDate(p.date)}</TableCell>
                        <TableCell className="text-sm">
                          {p.forMonths && p.forMonths.length > 0 ? p.forMonths.join(", ") : "—"}
                        </TableCell>
                        <TableCell className="capitalize">{p.method}</TableCell>
                        <TableCell className="text-right">{fmtPKR(p.amount)}</TableCell>
                        <TableCell className="text-xs">
                          {isReversed ? (
                            <span className="text-destructive">Reversed</span>
                          ) : (
                            <span className="text-success">Active</span>
                          )}
                        </TableCell>
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
                  {payments.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center text-sm text-muted-foreground py-6"
                      >
                        No payments yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </div>

        {selectedPayment && correctionMode === "reversal" && (
          <PaymentReversalDialog
            payment={selectedPayment}
            user={user}
            onClose={() => {
              setSelectedPayment(null);
              setCorrectionMode(null);
            }}
          />
        )}

        {selectedPayment && correctionMode === "reassignment" && (
          <PaymentReassignmentDialog
            payment={selectedPayment}
            customers={allCustomers}
            user={user}
            onClose={() => {
              setSelectedPayment(null);
              setCorrectionMode(null);
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function PaymentReversalDialog({
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
              <span className="text-muted-foreground">Amount: </span>
              <span className="font-medium">{fmtPKR(payment.amount)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Method: </span>
              <span className="font-medium capitalize">{payment.method}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Date: </span>
              <span className="font-medium">{fmtDate(payment.date)}</span>
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

function PaymentReassignmentDialog({
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
              <span className="text-muted-foreground">Amount: </span>
              <span className="font-medium">{fmtPKR(payment.amount)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Date: </span>
              <span className="font-medium">{fmtDate(payment.date)}</span>
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

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between border-b pb-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value ?? "—"}</span>
    </div>
  );
}

function PasswordInfoRow({ password }: { password?: string }) {
  const [showPassword, setShowPassword] = useState(false);
  return (
    <div className="flex justify-between border-b pb-2 items-center">
      <span className="text-muted-foreground">Password</span>
      <div className="flex items-center gap-2">
        <span className="font-medium">{showPassword ? password : "••••••••"}</span>
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="text-gray-500 hover:text-gray-700"
        >
          {showPassword ? (
            <EyeOff className="size-4" />
          ) : (
            <Eye className="size-4" />
          )}
        </button>
      </div>
    </div>
  );
}

function BulkRemindersDialog({
  open,
  selectedUids,
  customers,
  packages,
  onClose,
}: {
  open: boolean;
  selectedUids: Set<string>;
  customers: UserDoc[];
  packages: PackageDoc[];
  onClose: () => void;
}) {
  const [copiedUid, setCopiedUid] = useState<string | null>(null);

  const reminders = Array.from(selectedUids)
    .map((uid) => {
      const customer = customers.find((c) => c.uid === uid);
      if (!customer) return null;
      const url = buildWhatsAppReminder(customer, packages);
      return { customer, url };
    })
    .filter((item): item is { customer: UserDoc; url: string } => item !== null && item.url !== null);

  const openWhatsApp = (url: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyToClipboard = (url: string, uid: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUid(uid);
    toast.success("Link copied!");
    setTimeout(() => setCopiedUid(null), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send WhatsApp Reminders</DialogTitle>
        </DialogHeader>
        {reminders.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            No customers with phone numbers selected
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {reminders.length} customer{reminders.length !== 1 ? "s" : ""} ready to send reminders
            </p>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {reminders.map(({ customer, url }) => (
                <div
                  key={customer.uid}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{customer.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{customer.phone}</div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(url, customer.uid)}
                      className="text-xs"
                    >
                      {copiedUid === customer.uid ? "✓ Copied" : "Copy"}
                    </Button>
                    <Button
                      size="sm"
                      className="text-xs bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => openWhatsApp(url)}
                    >
                      Open
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="pt-3 border-t space-y-2">
              <p className="text-xs text-muted-foreground">
                💡 Click "Open" to send each reminder, or "Copy" to copy the WhatsApp link
              </p>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
