import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, FileText } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { fmtPKR, fmtDate } from "@/lib/utils-format";
import type { PaymentDoc, UserDoc, AreaDoc, PackageDoc } from "@/lib/types";
import { paymentStatusOf } from "@/lib/billing";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/status-badge";

export const Route = createFileRoute("/_authenticated/reports")({
  component: ReportsPage,
});

type ReportType = "monthly" | "area" | "dealer" | "pending" | "paidvsunpaid";

function ReportsPage() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [type, setType] = useState<ReportType>("monthly");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserDoc | null>(null);

  const [payments, setPayments] = useState<PaymentDoc[]>([]);
  const [customers, setCustomers] = useState<UserDoc[]>([]);
  const [dealers, setDealers] = useState<UserDoc[]>([]);
  const [areas, setAreas] = useState<AreaDoc[]>([]);
  const [packages, setPackages] = useState<PackageDoc[]>([]);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    const u1 = onSnapshot(collection(db, "payments"), (snap) => {
      if (!isMounted.current) return;
      setPayments(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PaymentDoc, "id">) })));
    });
    const u2 = onSnapshot(
      query(collection(db, "users"), where("role", "==", "customer")),
      (snap) => {
        if (!isMounted.current) return;
        setCustomers(snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<UserDoc, "uid">) })));
      },
    );
    const u3 = onSnapshot(query(collection(db, "users"), where("role", "==", "dealer")), (snap) => {
      if (!isMounted.current) return;
      setDealers(snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<UserDoc, "uid">) })));
    });
    const u4 = onSnapshot(collection(db, "areas"), (snap) => {
      if (!isMounted.current) return;
      setAreas(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AreaDoc, "id">) })));
    });
    const u5 = onSnapshot(collection(db, "packages"), (snap) => {
      if (!isMounted.current) return;
      setPackages(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PackageDoc, "id">) })));
    });
    return () => {
      isMounted.current = false;
      u1();
      u2();
      u3();
      u4();
      u5();
    };
  }, []);

  const getPeriodDates = () => {
    if (startDate && endDate) {
      return [new Date(startDate).getTime(), new Date(endDate).getTime() + 86400000]; // +1 day for end date
    }
    const periodStart = new Date(year, month - 1, 1).getTime();
    const periodEnd = new Date(year, month, 1).getTime();
    return [periodStart, periodEnd];
  };

  const [periodStart, periodEnd] = getPeriodDates();
  const scopedPayments =
    role === "dealer" && user
      ? payments.filter((p) => (user.assignedAreaIds ?? []).includes(p.areaId ?? ""))
      : payments;
  const scopedCustomers =
    role === "dealer" && user
      ? customers.filter((c) => (user.assignedAreaIds ?? []).includes(c.areaId ?? ""))
      : customers;
  const periodPayments = scopedPayments
    .filter((p) => p.status !== "reversed")
    .filter((p) => p.date >= periodStart && p.date < periodEnd)
    .sort((a, b) => b.date - a.date);

  const { headers, rows, title, showTotals, totalRevenue, totalPending } = useMemo(() => {
    switch (type) {
      case "monthly": {
        const data = periodPayments.map((p) => {
          const customer = scopedCustomers.find((c) => c.uid === p.customerId);
          const pkg = customer ? packages.find((pkg) => pkg.id === customer.packageId) : null;
          return [
            fmtDate(p.date),
            p.customerName ?? "—",
            pkg?.name ?? "—",
            p.method,
            p.receivedByName ?? "—",
            customer?.pendingAmount ?? 0,
            p.amount,
          ];
        });
        const totalRev = periodPayments.reduce((sum, p) => sum + p.amount, 0);
        const totalPend = scopedCustomers.reduce((sum, c) => sum + (c.pendingAmount ?? 0), 0);
        return {
          title: `Monthly Summary — ${month}/${year}`,
          headers: ["Date", "Customer", "Package", "Method", "Received By", "Pending (PKR)", "Amount (PKR)"],
          rows: data,
          showTotals: true,
          totalRevenue: totalRev,
          totalPending: totalPend,
        };
      }
      case "area": {
        const map = new Map<string, number>();
        periodPayments.forEach((p) =>
          map.set(p.areaId ?? "—", (map.get(p.areaId ?? "—") ?? 0) + p.amount),
        );
        const data = Array.from(map.entries()).map(([id, amt]) => {
          const a = areas.find((x) => x.id === id);
          const cust = scopedCustomers.filter((c) => c.areaId === id).length;
          return [a?.name ?? "Unassigned", cust, amt];
        });
        const totalRev = Array.from(map.values()).reduce((sum, amt) => sum + amt, 0);
        const totalPend = scopedCustomers.reduce((sum, c) => sum + (c.pendingAmount ?? 0), 0);
        return {
          title: `Area-Wise — ${month}/${year}`,
          headers: ["Area", "Customers", "Collected (PKR)"],
          rows: data,
          showTotals: true,
          totalRevenue: totalRev,
          totalPending: totalPend,
        };
      }
      case "dealer": {
        const map = new Map<string, number>();
        periodPayments.forEach((p) =>
          map.set(p.dealerId ?? "—", (map.get(p.dealerId ?? "—") ?? 0) + p.amount),
        );
        const data = Array.from(map.entries()).map(([id, amt]) => {
          const d = dealers.find((x) => x.uid === id);
          const dealer = dealers.find((x) => x.uid === id);
          const dealerAreaIds = dealer?.assignedAreaIds ?? [];
          const cust = scopedCustomers.filter((c) => dealerAreaIds.includes(c.areaId ?? "")).length;
          return [d?.name ?? "Unassigned", cust, amt];
        });
        const totalRev = Array.from(map.values()).reduce((sum, amt) => sum + amt, 0);
        const totalPend = scopedCustomers.reduce((sum, c) => sum + (c.pendingAmount ?? 0), 0);
        return {
          title: `Dealer-Wise — ${month}/${year}`,
          headers: ["Dealer", "Customers", "Collected (PKR)"],
          rows: data,
          showTotals: true,
          totalRevenue: totalRev,
          totalPending: totalPend,
        };
      }
      case "pending": {
        const pending = scopedCustomers.filter((c) => (c.pendingAmount ?? 0) > 0);
        const totalPend = pending.reduce((sum, c) => sum + (c.pendingAmount ?? 0), 0);
        return {
          title: `Pending Recovery`,
          headers: ["Customer", "Phone", "Area", "Due Date", "Pending (PKR)"],
          rows: pending.map((c) => [
            c.name,
            c.phone ?? "—",
            areas.find((a) => a.id === c.areaId)?.name ?? "—",
            fmtDate(c.nextDueDate),
            c.pendingAmount ?? 0,
          ]),
          showTotals: true,
          totalRevenue: 0,
          totalPending: totalPend,
        };
      }
      case "paidvsunpaid": {
        const paid = scopedCustomers.filter((c) => paymentStatusOf(c) === "paid").length;
        const unpaid = scopedCustomers.filter((c) => paymentStatusOf(c) === "unpaid").length;
        const overdue = scopedCustomers.filter((c) => paymentStatusOf(c) === "overdue").length;
        const partial = scopedCustomers.filter((c) => paymentStatusOf(c) === "partial").length;
        return {
          title: `Paid vs Unpaid`,
          headers: ["Status", "Count"],
          rows: [
            ["Paid", paid],
            ["Unpaid", unpaid],
            ["Partial", partial],
            ["Overdue", overdue],
          ],
          showTotals: false,
          totalRevenue: 0,
          totalPending: 0,
        };
      }
    }
  }, [type, periodPayments, scopedCustomers, areas, dealers, packages, month, year]);

  const exportExcel = () => {
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `${title}.xlsx`);
  };

  const exportPdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(title, 14, 16);
    autoTable(doc, {
      head: [headers],
      body: rows.map((r) => r.map(String)),
      startY: 22,
      styles: { fontSize: 9 },
    });
    doc.save(`${title}.pdf`);
  };

  return (
    <div className="w-full">
      <PageHeader title="Reports" subtitle="Export collection and recovery reports" />

      <Card className="mb-4">
        <CardContent className="p-3 sm:p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2 sm:gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs sm:text-sm">Type</Label>
              <select
                className="w-full h-9 sm:h-10 rounded-md border bg-background px-2 sm:px-3 text-xs sm:text-sm"
                value={type}
                onChange={(e) => setType(e.target.value as ReportType)}
              >
                <option value="monthly">Monthly Summary</option>
                <option value="area">Area-Wise</option>
                <option value="dealer">Dealer-Wise</option>
                <option value="pending">Pending Recovery</option>
                <option value="paidvsunpaid">Paid vs Unpaid</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs sm:text-sm">Year</Label>
              <select
                className="w-full h-9 sm:h-10 rounded-md border bg-background px-2 sm:px-3 text-xs sm:text-sm"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
              >
                {[0, 1, 2].map((i) => {
                  const y = now.getFullYear() - i;
                  return (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs sm:text-sm">Month</Label>
              <select
                className="w-full h-9 sm:h-10 rounded-md border bg-background px-2 sm:px-3 text-xs sm:text-sm"
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
              >
                {Array.from({ length: 12 }).map((_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {new Date(0, i).toLocaleString("en", { month: "short" })}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs sm:text-sm">Start Date</Label>
              <input
                type="date"
                className="w-full h-9 sm:h-10 rounded-md border bg-background px-2 sm:px-3 text-xs sm:text-sm"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs sm:text-sm">End Date</Label>
              <input
                type="date"
                className="w-full h-9 sm:h-10 rounded-md border bg-background px-2 sm:px-3 text-xs sm:text-sm"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="flex items-end gap-1 sm:gap-2 col-span-1 sm:col-span-2 lg:col-span-1">
              <Button
                variant="outline"
                onClick={exportExcel}
                size="sm"
                className="flex-1 text-xs sm:text-sm h-9 sm:h-10"
              >
                <Download className="size-3 sm:size-4 mr-1" />
                <span className="hidden sm:inline">Excel</span>
                <span className="sm:hidden">XL</span>
              </Button>
              <Button
                variant="outline"
                onClick={exportPdf}
                size="sm"
                className="flex-1 text-xs sm:text-sm h-9 sm:h-10"
              >
                <FileText className="size-3 sm:size-4 mr-1" />
                <span className="hidden sm:inline">PDF</span>
                <span className="sm:hidden">PDF</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="p-3 sm:p-6">
          <CardTitle className="text-base sm:text-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <div className="min-w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  {headers.map((h) => (
                    <TableHead
                      key={h}
                      className="text-xs sm:text-sm whitespace-nowrap px-2 sm:px-4"
                    >
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={i}>
                    {r.map((c, j) => {
                      const isLastCol = j === r.length - 1;
                      const isMoneyCol = headers[j]?.includes("PKR");
                      const isRightAlign = typeof c === "number" && (isLastCol || isMoneyCol);
                      const isCustomerCol =
                        j === 0 &&
                        (type === "monthly" || type === "pending") &&
                        headers[j] === "Customer";
                      const customer = isCustomerCol
                        ? customers.find((cust) => cust.name === c)
                        : null;
                      return (
                        <TableCell
                          key={j}
                          className={`text-xs sm:text-sm px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap ${isRightAlign ? "text-right font-medium" : ""}`}
                        >
                          {customer ? (
                            <button
                              onClick={() => setSelectedUser(customer)}
                              className="text-primary hover:underline cursor-pointer font-medium"
                            >
                              {c}
                            </button>
                          ) : isMoneyCol && typeof c === "number" ? (
                            fmtPKR(c)
                          ) : (
                            c
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={headers.length}
                      className="text-center text-xs sm:text-sm text-muted-foreground py-8 sm:py-10"
                    >
                      No data for this period.
                    </TableCell>
                  </TableRow>
                )}
                {showTotals && rows.length > 0 && (
                  <>
                    <TableRow className="border-t-2 bg-muted/50">
                      {type === "monthly" || type === "pending" ? (
                        <>
                          <TableCell
                            colSpan={headers.length - 1}
                            className="text-xs sm:text-sm font-semibold px-2 sm:px-4 py-2 sm:py-3"
                          >
                            Total
                          </TableCell>
                          <TableCell className="text-xs sm:text-sm text-right font-semibold px-2 sm:px-4 py-2 sm:py-3">
                            {fmtPKR(totalRevenue || totalPending)}
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell
                            colSpan={headers.length - 1}
                            className="text-xs sm:text-sm font-semibold px-2 sm:px-4 py-2 sm:py-3"
                          >
                            Total
                          </TableCell>
                          <TableCell className="text-xs sm:text-sm text-right font-semibold px-2 sm:px-4 py-2 sm:py-3">
                            {fmtPKR(totalRevenue)}
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                    {type !== "pending" && (totalRevenue > 0 || totalPending > 0) && (
                      <TableRow className="bg-muted/30">
                        <TableCell
                          colSpan={headers.length - 1}
                          className="text-xs sm:text-sm font-semibold px-2 sm:px-4 py-2 sm:py-3"
                        >
                          Total Pending
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm text-right font-semibold px-2 sm:px-4 py-2 sm:py-3">
                          {fmtPKR(totalPending)}
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                )}
              </TableBody>
            </Table>
          </div>
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
    </div>
  );
}
