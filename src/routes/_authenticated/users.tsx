import { createFileRoute, useSearch, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
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
  db,
} from "@/lib/supabase-store";
import {
  sendPasswordResetEmail,
  createManagedUser,
  updateManagedUser,
  deleteManagedUser,
} from "@/lib/supabase-auth";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  FileDown,
  FileUp,
  Download,
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
import type { AreaDoc, PackageDoc, UserDoc, PaymentDoc, PaymentMethod } from "@/lib/types";
import { paymentStatusOf, CYCLE, addDays, runAutoBillingForCustomer } from "@/lib/billing";
import { toast } from "sonner";
import { reversePayment, reassignPayment } from "@/lib/payment-correction";

export const Route = createFileRoute("/_authenticated/users")({
  component: UsersPage,
});

function formatDaysRemaining(nextDueDate?: number) {
  if (!nextDueDate) return "Not set";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiryDate = new Date(nextDueDate);
  expiryDate.setHours(0, 0, 0, 0);
  const days = Math.round((expiryDate.getTime() - today.getTime()) / 86400000);

  if (days < 0) return `${Math.abs(days)} days overdue`;
  if (days === 0) return "Expires today";
  return `${days} days left`;
}

function expiryClassName(nextDueDate?: number) {
  if (!nextDueDate) return "text-muted-foreground";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiryDate = new Date(nextDueDate);
  expiryDate.setHours(0, 0, 0, 0);
  return expiryDate.getTime() < today.getTime() ? "text-destructive" : "text-muted-foreground";
}

function UsersPage() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const searchParams = useSearch({ from: "/_authenticated/users" });
  const customerIdParam = (searchParams as { customerId?: string })?.customerId;
  const [customers, setCustomers] = useState<UserDoc[]>([]);
  const [areas, setAreas] = useState<AreaDoc[]>([]);
  const [packages, setPackages] = useState<PackageDoc[]>([]);
  const [editing, setEditing] = useState<UserDoc | null>(null);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<UserDoc | null>(null);
  const [selectedCustomerDetails, setSelectedCustomerDetails] = useState<UserDoc | null>(null);
  const [payOpen, setPayOpen] = useState<UserDoc | null>(null);
  const [selectedForReminder, setSelectedForReminder] = useState<Set<string>>(new Set());
  const [bulkRemindersOpen, setBulkRemindersOpen] = useState(false);
  const [bulkSending, setBulkSending] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const isMounted = useRef(true);

  const [search, setSearch] = useState("");
  const [areaFilter, setAreaFilter] = useState("all");
  const statusParam = (searchParams as { status?: string })?.status;
  const [paymentStatus, setPaymentStatus] = useState<string>(
    statusParam === "paid" || statusParam === "partial" || statusParam === "unpaid"
      ? statusParam
      : "all",
  );
  const [statusFilter, setStatusFilter] = useState<string>(
    statusParam === "active" ? "active" : statusParam === "disabled" ? "disabled" : "all",
  );
  const [dueFilter, setDueFilter] = useState<string>(statusParam === "overdue" ? "overdue" : "all");
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

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

        // Auto-billing: check overdue customers and generate new bills
        scoped.forEach((c) => {
          runAutoBillingForCustomer(c);
        });
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

  useEffect(() => {
    if (!customerIdParam || customers.length === 0) return;
    const customer = customers.find((c) => c.uid === customerIdParam);
    if (customer) setSelectedCustomerDetails(customer);
  }, [customerIdParam, customers]);

  const filtered = useMemo(() => {
    const result = customers.filter((c) => {
      if (
        search &&
        !`${c.name} ${c.username ?? ""} ${c.phone ?? ""} ${c.cnic ?? ""}`
          .toLowerCase()
          .includes(search.toLowerCase())
      )
        return false;
      if (areaFilter !== "all" && c.areaId !== areaFilter) return false;
      if (
        paymentStatus !== "all" &&
        paymentStatusOf(c) !== paymentStatus &&
        !(
          (paymentStatus === "paid" && paymentStatusOf(c) === "partial") ||
          (paymentStatus === "unpaid" && paymentStatusOf(c) === "overdue")
        )
      )
        return false;
      if (statusFilter === "active" && c.connectionStatus !== "active") return false;
      if (statusFilter === "disabled" && c.connectionStatus !== "disconnected") return false;
      if (dueFilter === "overdue") {
        const status = paymentStatusOf(c);
        if (status !== "overdue") return false;
      }
      return true;
    });

    result.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

    return result;
  }, [customers, search, areaFilter, paymentStatus, statusFilter, dueFilter]);

  const effectivePerPage = itemsPerPage === 0 ? filtered.length : itemsPerPage;
  const pageItems = filtered.slice((page - 1) * effectivePerPage, page * effectivePerPage);
  const totalPages = Math.max(1, Math.ceil(filtered.length / effectivePerPage));

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

  const exportUsers = () => {
    const exportRows = customers.map((customer) => {
      const rawCustomer = customer as unknown as Record<string, unknown>;
      const packageName = packages.find((item) => item.id === customer.packageId)?.name ?? "";
      const areaName = areas.find((item) => item.id === customer.areaId)?.name ?? "";
      const rawValues = Object.fromEntries(
        Object.entries(rawCustomer)
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => [
            key,
            Array.isArray(value)
              ? value.join(", ")
              : value && typeof value === "object"
                ? JSON.stringify(value)
                : value,
          ]),
      );
      return {
        ...rawValues,
        Package: packageName,
        Area: areaName,
      };
    });
    const headers = Array.from(new Set(exportRows.flatMap((row) => Object.keys(row))));
    const sheet = XLSX.utils.json_to_sheet(exportRows, { header: headers });
    sheet["!cols"] = headers.map((header) => ({
      wch: Math.min(Math.max(header.length + 4, 14), 32),
    }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Users");
    XLSX.writeFile(workbook, "users-export.xlsx", { compression: true });
    toast.success(`${customers.length} users exported`);
  };

  return (
    <div className="w-full">
      <PageHeader
        title="Users"
        subtitle="Customer billing management"
        actions={
          (role === "admin" || (role === "dealer" && user?.canManageCustomers)) && (
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-xs sm:flex-none sm:text-sm"
                  onClick={exportUsers}
                >
                  <Download className="size-3 sm:size-4 mr-1" />
                  <span className="hidden sm:inline">Export Users</span>
                  <span className="sm:hidden">Export</span>
                </Button>
                <Dialog open={importOpen} onOpenChange={setImportOpen}>
                  <DialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-xs sm:flex-none sm:text-sm"
                    >
                      <FileUp className="size-3 sm:size-4 mr-1" />
                      <span className="hidden sm:inline">Import Excel</span>
                      <span className="sm:hidden">Import</span>
                    </Button>
                  </DialogTrigger>
                  <CustomerImportDialog areas={areas} packages={packages} user={user} />
                </Dialog>
              </div>
              <div className="hidden h-6 w-px bg-border sm:block" aria-hidden="true" />
              <Dialog
                open={open}
                onOpenChange={(o) => {
                  setOpen(o);
                  if (!o) setEditing(null);
                }}
              >
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    className="w-full text-xs sm:w-auto sm:text-sm"
                    onClick={() => setEditing(null)}
                  >
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
            </div>
          )
        }
      />

      {selectedCustomerDetails && (
        <Card className="mb-4">
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle>{selectedCustomerDetails.name}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                @{selectedCustomerDetails.username ?? "—"}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setSelectedCustomerDetails(null);
                navigate({ to: "/users" });
              }}
            >
              Close
            </Button>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <InfoRow label="Name" value={selectedCustomerDetails.name} />
            <InfoRow label="Username" value={selectedCustomerDetails.username} />
            <InfoRow label="Email" value={selectedCustomerDetails.email} />
            <InfoRow label="Phone" value={selectedCustomerDetails.phone} />
            <InfoRow label="CNIC" value={selectedCustomerDetails.cnic} />
            <InfoRow label="Address" value={selectedCustomerDetails.address} />
            <InfoRow
              label="Area"
              value={[
                areas.find((a) => a.id === selectedCustomerDetails.areaId)?.name,
                selectedCustomerDetails.username,
              ]
                .filter(Boolean)
                .join(" — ")}
            />
            <InfoRow
              label="Package"
              value={packages.find((p) => p.id === selectedCustomerDetails.packageId)?.name}
            />
            <InfoRow label="Monthly Fee" value={fmtPKR(selectedCustomerDetails.monthlyFee)} />
            <InfoRow label="Discount" value={fmtPKR(selectedCustomerDetails.discount)} />
            <InfoRow label="Activated" value={fmtDate(selectedCustomerDetails.activationDate)} />
            <InfoRow
              label="Last Payment"
              value={fmtDate(selectedCustomerDetails.lastPaymentDate)}
            />
            <InfoRow label="Next Due" value={fmtDate(selectedCustomerDetails.nextDueDate)} />
            <InfoRow
              label="Expires In"
              value={formatDaysRemaining(selectedCustomerDetails.nextDueDate)}
            />
            <InfoRow label="Pending Amount" value={fmtPKR(selectedCustomerDetails.pendingAmount)} />
            <InfoRow
              label="Advance Balance"
              value={fmtPKR(selectedCustomerDetails.advanceBalance)}
            />
            <InfoRow label="Payment Status" value={paymentStatusOf(selectedCustomerDetails)} />
            <InfoRow
              label="Connection"
              value={selectedCustomerDetails.connectionStatus ?? "active"}
            />
          </CardContent>
        </Card>
      )}

      <Card className="mb-4">
        <CardContent className="p-2 sm:p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
            <div className="relative sm:col-span-1">
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
              value={areaFilter}
              onChange={(e) => {
                setAreaFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">All areas</option>
              {areas.map((a) => {
                const areaUsernames = customers
                  .filter((c) => c.areaId === a.id && c.username)
                  .map((c) => c.username)
                  .join(", ");
                return (
                  <option key={a.id} value={a.id}>
                    {a.name}
                    {areaUsernames ? ` — ${areaUsernames}` : ""}
                  </option>
                );
              })}
            </select>
            <select
              className="h-9 sm:h-10 rounded-md border bg-background px-2 sm:px-3 text-xs sm:text-sm"
              value={paymentStatus}
              onChange={(e) => {
                setPaymentStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">All payment status</option>
              <option value="paid">Paid</option>
              <option value="partial">Partial Paid</option>
              <option value="unpaid">Unpaid</option>
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
                  <TableHead className="text-xs sm:text-sm">Expires In</TableHead>
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
                      <TableCell
                        className={`px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm ${expiryClassName(c.nextDueDate)}`}
                      >
                        {formatDaysRemaining(c.nextDueDate)}
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
                                      err instanceof Error
                                        ? err.message
                                        : "Failed to send reset email",
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
                      colSpan={10}
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
                      <div className="font-medium text-sm">{c.username ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{fmtPhone(c.phone)}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{c.name}</div>
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
                  <div
                    className={`flex items-center justify-between border-t pt-2 text-xs ${expiryClassName(c.nextDueDate)}`}
                  >
                    <span>Expires</span>
                    <span className="font-medium">{formatDaysRemaining(c.nextDueDate)}</span>
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
                                  err instanceof Error ? err.message : "Failed to send reset email",
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

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mt-3 gap-3 text-xs sm:text-sm px-1">
        <div className="flex items-center gap-3">
          <div className="text-muted-foreground">{filtered.length} customers</div>
          <select
            className="h-8 rounded-md border bg-background px-2 text-xs"
            value={itemsPerPage}
            onChange={(e) => {
              const val = e.target.value === "all" ? 0 : Number(e.target.value);
              setItemsPerPage(val);
              setPage(1);
            }}
          >
            <option value={50}>50 per page</option>
            <option value={100}>100 per page</option>
            <option value={1000}>1000 per page</option>
            <option value="all">All</option>
          </select>
        </div>
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

type ImportCustomer = {
  rowNumber: number;
  name: string;
  username: string;
  email: string;
  password: string;
  phone: string;
  cnic: string;
  address: string;
  package: PackageDoc;
  area: AreaDoc;
  activationDate: number;
  discount: number;
  latitude?: number;
  longitude?: number;
};

type ImportResult = {
  created: number;
  errors: string[];
};

const customerImportColumns = [
  "Name",
  "Username",
  "Login Email",
  "Password",
  "Phone",
  "CNIC",
  "Address",
  "Package",
  "Area",
  "Activation Date",
  "Discount",
  "Latitude",
  "Longitude",
];

function importKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function importText(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return "";
}

function importNumber(value: string): number | null {
  if (!value) return null;
  const number = Number(value.replace(/,/g, ""));
  return Number.isFinite(number) ? number : null;
}

function importDate(value: string): number | null {
  if (!value) return new Date().setHours(0, 0, 0, 0);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setHours(0, 0, 0, 0);
  return parsed.getTime();
}

function matchesImportReference<T extends { id: string; name: string }>(
  value: string,
  items: T[],
): T | undefined {
  const key = importKey(value);
  return items.find((item) => importKey(item.id) === key || importKey(item.name) === key);
}

function CustomerImportDialog({
  areas,
  packages,
  user,
}: {
  areas: AreaDoc[];
  packages: PackageDoc[];
  user: UserDoc | null;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const availablePackages = packages.filter((item) => item.status === "active");

  const downloadTemplate = () => {
    const workbook = XLSX.utils.book_new();
    const customersSheet = XLSX.utils.aoa_to_sheet([customerImportColumns]);
    customersSheet["!cols"] = customerImportColumns.map((column) => ({
      wch: Math.max(column.length + 4, 16),
    }));
    const packagesSheet = XLSX.utils.json_to_sheet(
      availablePackages.map((item) => ({
        ID: item.id,
        Name: item.name,
        "Monthly Price": item.monthlyPrice,
      })),
    );
    const areasSheet = XLSX.utils.json_to_sheet(
      areas.map((item) => ({ ID: item.id, Name: item.name, Code: item.code })),
    );
    XLSX.utils.book_append_sheet(workbook, customersSheet, "Customers");
    XLSX.utils.book_append_sheet(workbook, packagesSheet, "Packages");
    XLSX.utils.book_append_sheet(workbook, areasSheet, "Areas");
    XLSX.writeFile(workbook, "customer-import-template.xlsx", { compression: true });
  };

  const importCustomers = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setBusy(true);
    setResult(null);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) throw new Error("The workbook does not contain a worksheet");

      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
        raw: false,
        dateNF: "yyyy-mm-dd",
      });
      if (!rows.length) throw new Error("The first worksheet does not contain any customer rows");

      const allowedAreas = areas.filter(
        (area) => user?.role === "admin" || (user?.assignedAreaIds ?? []).includes(area.id),
      );
      const preparedCustomers: ImportCustomer[] = [];
      const validationErrors: string[] = [];
      const importEmails = new Set<string>();

      rows.forEach((sourceRow, index) => {
        const rowNumber = index + 2;
        const row = Object.fromEntries(
          Object.entries(sourceRow).map(([key, value]) => [importKey(key), value]),
        );
        const name = importText(row, ["name"]);
        const username = importText(row, ["username"]);
        const email = importText(row, ["loginemail", "email"]);
        const password = importText(row, ["password"]);
        const phone = importText(row, ["phone"]);
        const cnic = importText(row, ["cnic"]);
        const address = importText(row, ["address"]);
        const packageValue = importText(row, ["package", "packageid"]);
        const areaValue = importText(row, ["area", "areaid"]);
        const activationValue = importText(row, ["activationdate"]);
        const discountInput = importText(row, ["discount"]);
        const discountValue = discountInput ? importNumber(discountInput) : 0;
        const latitudeValue = importText(row, ["latitude"]);
        const longitudeValue = importText(row, ["longitude"]);
        const latitude = latitudeValue ? importNumber(latitudeValue) : null;
        const longitude = longitudeValue ? importNumber(longitudeValue) : null;
        const packageItem = matchesImportReference(packageValue, availablePackages);
        const area = matchesImportReference(areaValue, allowedAreas);
        const activationDate = importDate(activationValue);

        if (!name) validationErrors.push(`Row ${rowNumber}: Name is required`);
        if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
          validationErrors.push(`Row ${rowNumber}: enter a valid Login Email`);
        }
        if (password.length < 6)
          validationErrors.push(`Row ${rowNumber}: Password must be at least 6 characters`);
        if (importEmails.has(email.toLowerCase()))
          validationErrors.push(`Row ${rowNumber}: Login Email is duplicated`);
        if (email) importEmails.add(email.toLowerCase());
        if (!packageItem)
          validationErrors.push(`Row ${rowNumber}: Package does not match an existing package`);
        if (!area) validationErrors.push(`Row ${rowNumber}: Area does not match an available area`);
        if (discountValue === null || discountValue < 0) {
          validationErrors.push(`Row ${rowNumber}: Discount must be a valid positive number`);
        }
        if (packageItem && discountValue !== null && discountValue > packageItem.monthlyPrice) {
          validationErrors.push(`Row ${rowNumber}: Discount cannot exceed the package price`);
        }
        if (!activationDate)
          validationErrors.push(`Row ${rowNumber}: Activation Date must be valid`);
        if (latitudeValue && latitude === null)
          validationErrors.push(`Row ${rowNumber}: Latitude must be a number`);
        if (longitudeValue && longitude === null)
          validationErrors.push(`Row ${rowNumber}: Longitude must be a number`);

        if (
          name &&
          email &&
          password.length >= 6 &&
          packageItem &&
          area &&
          activationDate &&
          discountValue !== null &&
          discountValue >= 0 &&
          discountValue <= packageItem.monthlyPrice &&
          (!latitudeValue || latitude !== null) &&
          (!longitudeValue || longitude !== null)
        ) {
          preparedCustomers.push({
            rowNumber,
            name,
            username,
            email,
            password,
            phone: phone ? formatPhoneNumber(phone) : "",
            cnic: cnic ? formatCNICNumber(cnic) : "",
            address,
            package: packageItem,
            area,
            activationDate,
            discount: discountValue,
            ...(latitude !== null && { latitude }),
            ...(longitude !== null && { longitude }),
          });
        }
      });

      if (validationErrors.length) {
        setResult({ created: 0, errors: validationErrors });
        toast.error("Fix the highlighted Excel rows before importing");
        return;
      }

      const secondaryAuth = true; // Placeholder for migration
      let created = 0;
      const importErrors: string[] = [];
      for (const customer of preparedCustomers) {
        try {
          const credential = await createManagedUser(customer.email, customer.password, {
            name: customer.name,
            username: customer.username,
            email: customer.email,
            phone: customer.phone,
            cnic: customer.cnic,
            address: customer.address,
            role: "customer",
            status: "active",
            packageId: customer.package.id,
            areaId: customer.area.id,
            dealerId: customer.area.dealerIds?.[0] ?? null,
            activationDate: customer.activationDate,
            activationDateText: fmtDateTimeText(customer.activationDate),
          });
          const now = Date.now();
          const monthlyFee = Math.max(0, customer.package.monthlyPrice - customer.discount);
          await setDoc(doc(db, "users", credential.user.uid), {
            name: customer.name,
            username: customer.username,
            email: customer.email,
            phone: customer.phone,
            cnic: customer.cnic,
            address: customer.address,
            role: "customer",
            status: "active",
            packageId: customer.package.id,
            areaId: customer.area.id,
            dealerId: customer.area.dealerIds?.[0] ?? null,
            activationDate: customer.activationDate,
            activationDateText: fmtDateTimeText(customer.activationDate),
            monthlyFee,
            discount: customer.discount,
            nextDueDate: customer.activationDate,
            nextDueDateText: fmtDateTimeText(customer.activationDate),
            pendingAmount: monthlyFee,
            lastBillGeneratedDate: 0,
            connectionStatus: "active",
            paymentStatus: "unpaid",
            ...(customer.latitude !== undefined && { latitude: customer.latitude }),
            ...(customer.longitude !== undefined && { longitude: customer.longitude }),
            createdAt: now,
            createdAtText: fmtDateTimeText(now),
            passwordUpdatedAt: now,
          });
          created += 1;
        } catch (error) {
          importErrors.push(
            `Row ${customer.rowNumber}: ${error instanceof Error ? error.message : "Customer could not be created"}`,
          );
        }
      }

      setResult({ created, errors: importErrors });
      if (importErrors.length) {
        toast.error(`${created} customers imported; ${importErrors.length} could not be created`);
      } else {
        toast.success(`${created} customers imported successfully`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to read the Excel file";
      setResult({ created: 0, errors: [message] });
      toast.error(message);
    } finally {
      event.target.value = "";
      setBusy(false);
    }
  };

  return (
    <DialogContent className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Import Customers from Excel</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="rounded-md border bg-muted/50 p-3 text-sm space-y-1">
          <p>
            Import every customer field, including their login password, package, area, and
            activation details.
          </p>
          <p className="text-muted-foreground">
            Package and Area accept the matching name or ID from the reference sheets in the
            template. Discount, Latitude, and Longitude are optional.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={downloadTemplate}
            className="w-full sm:w-auto"
          >
            <FileDown className="size-4 mr-2" />
            Download Excel Template
          </Button>
          <Label
            htmlFor="customer-import-file"
            className="flex h-10 w-full sm:w-auto cursor-pointer items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <FileUp className="size-4 mr-2" />
            {busy ? "Importing…" : "Choose Excel File"}
          </Label>
          <Input
            id="customer-import-file"
            type="file"
            accept=".xlsx,.xls"
            onChange={importCustomers}
            disabled={busy}
            className="sr-only"
          />
        </div>
        {result && (
          <div className="space-y-2 rounded-md border p-3 text-sm">
            {result.created > 0 && (
              <p className="font-medium text-success">{result.created} customers imported.</p>
            )}
            {result.errors.length > 0 && (
              <div className="space-y-1">
                <p className="font-medium text-destructive">
                  {result.errors.length} row issue{result.errors.length === 1 ? "" : "s"}:
                </p>
                <ul className="max-h-48 list-disc space-y-1 overflow-y-auto pl-5 text-muted-foreground">
                  {result.errors.map((error, index) => (
                    <li key={`${index}-${error}`}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </DialogContent>
  );
}

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
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [cnic, setCnic] = useState(initial?.cnic ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [packageId, setPackageId] = useState(initial?.packageId ?? "");
  const [areaId, setAreaId] = useState(initial?.areaId ?? "");
  const [latitude, setLatitude] = useState(initial?.latitude ?? 0);
  const [longitude, setLongitude] = useState(initial?.longitude ?? 0);
  const [activationDate, setActivationDate] = useState(
    initial?.activationDate
      ? new Date(initial.activationDate).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0],
  );
  const [discount, setDiscount] = useState(initial?.discount ?? 0);
  const [busy, setBusy] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const pkg = packages.find((p) => p.id === packageId);
  const packagePrice = pkg?.monthlyPrice ?? 0;
  const finalMonthlyFee = Math.max(0, packagePrice - discount);

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
          monthlyFee: finalMonthlyFee,
          discount: discount,
          activationDate: activationTs,
          activationDateText: fmtDateTimeText(activationTs),
          nextDueDate: activationTs,
          nextDueDateText: fmtDateTimeText(activationTs),
          ...(latitude !== 0 && { latitude }),
          ...(longitude !== 0 && { longitude }),
        };
        if (email && email !== initial.email) updatePayload.email = email;
        if (password) {
          updatePayload.passwordUpdatedAt = Date.now();
        }

        if (password && initial.email) {
          try {
            await updateManagedUser(initial.uid, updatePayload, email || initial.email, password);
            toast.success("Customer and password updated");
          } catch (err) {
            toast.success(
              "Customer updated. Note: Password update failed - use 'Send Password Reset' to reset.",
            );
          }
        } else {
          await updateManagedUser(initial.uid, updatePayload);
          toast.success("Customer updated");
        }
        await updateDoc(doc(db, "users", initial.uid), updatePayload);
      } else {
        const loginEmail = email || `${phone || Date.now()}@isp.local`;
        const loginPwd = password || "12345678";
        const profile = {
          name,
          username,
          email: loginEmail,
          phone,
          cnic,
          address,
          role: "customer",
          status: "active",
          packageId,
          areaId,
          dealerId: dealerId ?? null,
          activationDate: new Date(activationDate).getTime(),
          activationDateText: fmtDateTimeText(new Date(activationDate).getTime()),
          monthlyFee: finalMonthlyFee,
          discount: discount,
          nextDueDate: new Date(activationDate).getTime(),
          nextDueDateText: fmtDateTimeText(new Date(activationDate).getTime()),
          pendingAmount: finalMonthlyFee,
          lastBillGeneratedDate: 0,
          connectionStatus: "active",
          paymentStatus: "unpaid",
          ...(latitude !== 0 && { latitude }),
          ...(longitude !== 0 && { longitude }),
          createdAt: Date.now(),
          createdAtText: fmtDateTimeText(Date.now()),
          passwordUpdatedAt: Date.now(),
        };
        const cred = await createManagedUser(loginEmail, loginPwd, profile);
        const activationTs = new Date(activationDate).getTime();
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
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
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
          {packageId && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Discount</Label>
              <div className="space-y-1">
                <Input
                  type="number"
                  value={discount}
                  onChange={(e) => setDiscount(Math.max(0, Number(e.target.value)))}
                  placeholder="Enter discount amount"
                  min="0"
                  max={packagePrice}
                  className="h-10"
                />
                <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                  <div>Package Price: {fmtPKR(packagePrice)}</div>
                  <div>Discount: {fmtPKR(discount)}</div>
                  <div className="font-medium text-foreground">
                    Final Monthly Fee: {fmtPKR(finalMonthlyFee)}
                  </div>
                </div>
              </div>
            </div>
          )}
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
              Pending: <span className="font-semibold">{fmtPKR(customer.pendingAmount)}</span>
            </span>
            <span className="text-muted-foreground">Monthly: {fmtPKR(customer.monthlyFee)}</span>
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
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="h-11" />
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
          snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<UserDoc, "uid">) })),
        );
      },
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
              <InfoRow label="Password" value="Managed securely" />
              <InfoRow
                label="Password updated"
                value={
                  customer.passwordUpdatedAt ? fmtDate(customer.passwordUpdatedAt) : "Not recorded"
                }
              />
              <InfoRow label="Package" value={pkg?.name} />
              <InfoRow label="Area" value={area?.name} />
              <InfoRow label="Address" value={customer.address} />
              <InfoRow label="Monthly Fee" value={fmtPKR(customer.monthlyFee)} />
              <InfoRow label="Activated" value={fmtDate(customer.activationDate)} />
              <InfoRow label="Last Payment" value={fmtDate(customer.lastPaymentDate)} />
              <InfoRow label="Next Due" value={fmtDate(customer.nextDueDate)} />
              <InfoRow label="Expires In" value={formatDaysRemaining(customer.nextDueDate)} />
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
            user={user!}
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
            user={user!}
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
  user: UserDoc;
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
  user: UserDoc;
  onClose: () => void;
}) {
  const [newCustomerId, setNewCustomerId] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const availableCustomers = customers.filter(
    (c) => c.role === "customer" && c.uid !== payment.customerId,
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
    .filter(
      (item): item is { customer: UserDoc; url: string } => item !== null && item.url !== null,
    );

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
