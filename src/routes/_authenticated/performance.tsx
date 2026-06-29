import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fmtPKR } from "@/lib/utils-format";
import type { UserDoc, PaymentDoc, AreaDoc } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download } from "lucide-react";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/_authenticated/performance")({
  component: PerformancePage,
});

function PerformancePage() {
  const { user, role } = useAuth();
  const [customers, setCustomers] = useState<UserDoc[]>([]);
  const [payments, setPayments] = useState<PaymentDoc[]>([]);
  const [areas, setAreas] = useState<AreaDoc[]>([]);
  const [dealers, setDealers] = useState<UserDoc[]>([]);
  const [filterMonth, setFilterMonth] = useState<string>("current");
  const [filterStartDate, setFilterStartDate] = useState<string>("");
  const [filterEndDate, setFilterEndDate] = useState<string>("");
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    const qUsers = query(collection(db, "users"), where("role", "==", "customer"));
    const unsub = onSnapshot(qUsers, (snap) => {
      if (!isMounted.current) return;
      const list = snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<UserDoc, "uid">) }));
      const scoped =
        role === "dealer" && user
          ? list.filter((c) => (user.assignedAreaIds ?? []).includes(c.areaId ?? ""))
          : list;
      setCustomers(scoped);
    });
    return () => {
      isMounted.current = false;
      unsub();
    };
  }, [role, user]);

  useEffect(() => {
    isMounted.current = true;
    const unsub = onSnapshot(collection(db, "payments"), (snap) => {
      if (!isMounted.current) return;
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PaymentDoc, "id">) }));
      const activePayments = list.filter((p) => p.status !== "reversed");
      const scoped =
        role === "dealer" && user
          ? activePayments.filter((p) => (user.assignedAreaIds ?? []).includes(p.areaId ?? ""))
          : activePayments;
      setPayments(scoped.sort((a, b) => b.date - a.date));
    });
    return () => {
      isMounted.current = false;
      unsub();
    };
  }, [role, user]);

  useEffect(() => {
    isMounted.current = true;
    const unsub = onSnapshot(collection(db, "areas"), (snap) => {
      if (!isMounted.current) return;
      setAreas(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AreaDoc, "id">) })));
    });
    return () => {
      isMounted.current = false;
      unsub();
    };
  }, []);

  useEffect(() => {
    if (role !== "admin") return;
    isMounted.current = true;
    const unsub = onSnapshot(
      query(collection(db, "users"), where("role", "==", "dealer")),
      (snap) => {
        if (!isMounted.current) return;
        setDealers(snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<UserDoc, "uid">) })));
      },
    );
    return () => {
      isMounted.current = false;
      unsub();
    };
  }, [role]);

  const getFilterDateRange = () => {
    const now = new Date();
    let startDate = new Date();
    let endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);

    if (filterMonth === "current") {
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
    } else if (filterMonth === "last-30") {
      startDate.setDate(now.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);
    } else if (filterMonth === "last-90") {
      startDate.setDate(now.getDate() - 90);
      startDate.setHours(0, 0, 0, 0);
    } else if (filterMonth === "all") {
      startDate = new Date(0);
    } else if (filterMonth === "custom" && filterStartDate && filterEndDate) {
      startDate = new Date(filterStartDate);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(filterEndDate);
      endDate.setHours(23, 59, 59, 999);
    }

    return { startDate, endDate };
  };

  const { startDate, endDate } = getFilterDateRange();

  // Dealer performance data (admin view) - current month only
  const currentMonthStart = new Date();
  currentMonthStart.setDate(1);
  currentMonthStart.setHours(0, 0, 0, 0);
  const currentMonthEnd = new Date();
  currentMonthEnd.setHours(23, 59, 59, 999);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const dealerPerformance = dealers.map((dealer) => {
    const dealerAreas = areas.filter((a) => a.dealerIds.includes(dealer.uid));
    const dealerCustomers = customers.filter((c) => dealerAreas.some((a) => a.id === c.areaId));
    const dealerPayments = payments.filter((p) => p.dealerId === dealer.uid);
    const currentMonthPayments = dealerPayments.filter((p) => p.date >= currentMonthStart.getTime() && p.date <= currentMonthEnd.getTime());
    const todayPayments = dealerPayments.filter((p) => p.date >= todayStart.getTime() && p.date <= todayEnd.getTime());
    const dealerMonthlyRevenue = currentMonthPayments.reduce((s, p) => s + p.amount, 0);
    const dealerTodayRevenue = todayPayments.reduce((s, p) => s + p.amount, 0);
    const dealerPendingRecovery = dealerCustomers.reduce((sum, c) => sum + (c.pendingAmount ?? 0), 0);
    return {
      dealer,
      areas: dealerAreas,
      monthlyRevenue: dealerMonthlyRevenue,
      todayRevenue: dealerTodayRevenue,
      pendingRecovery: dealerPendingRecovery,
    };
  });

  // Area performance data (admin view)
  const areaPerformance = areas.map((area) => {
    const areaCustomers = customers.filter((c) => c.areaId === area.id);
    const areaPayments = payments.filter((p) => p.areaId === area.id);
    const filteredPayments = areaPayments.filter((p) => p.date >= startDate.getTime() && p.date <= endDate.getTime());
    const areaMonthlyRevenue = filteredPayments.reduce((s, p) => s + p.amount, 0);
    const areaPendingRecovery = areaCustomers.reduce((sum, c) => sum + (c.pendingAmount ?? 0), 0);
    return {
      area,
      monthlyRevenue: areaMonthlyRevenue,
      pendingRecovery: areaPendingRecovery,
      totalRevenue: areaPayments.reduce((s, p) => s + p.amount, 0),
    };
  });

  const exportToExcel = (tableType: "dealer" | "area") => {
    const data = tableType === "dealer" ? dealerPerformance : areaPerformance;
    const rows = data.map((perf) => {
      if (tableType === "dealer") {
        return {
          Dealer: perf.dealer.name,
          Areas: perf.areas.map((a) => a.name).join(", ") || "—",
          "Today's Payment": perf.todayRevenue,
          "Monthly Revenue": perf.monthlyRevenue,
          "Pending Recovery": perf.pendingRecovery,
        };
      } else {
        return {
          Area: perf.area.name,
          "Monthly Revenue": perf.monthlyRevenue,
          "Pending Recovery": perf.pendingRecovery,
          "Total Revenue": perf.totalRevenue,
        };
      }
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, tableType === "dealer" ? "Dealer" : "Area");

    const fileName = `${tableType}-performance-${new Date().toISOString().split("T")[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  return (
    <div className="performance-page space-y-6">
      <PageHeader title="Performance" subtitle="Dealer and area performance metrics" />

      {role === "admin" && (
        <Card className="filter-card border-0 shadow-sm bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">Filters & Reports</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="filter-group space-y-2">
                <label className="text-xs uppercase tracking-wider font-semibold text-slate-700 dark:text-slate-300">Time Period</label>
                <Select value={filterMonth} onValueChange={setFilterMonth}>
                  <SelectTrigger className="h-10 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current">Current Month</SelectItem>
                    <SelectItem value="last-30">Last 30 Days</SelectItem>
                    <SelectItem value="last-90">Last 90 Days</SelectItem>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="custom">Custom Date Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {filterMonth === "custom" && (
                <>
                  <div className="filter-group space-y-2">
                    <label className="text-xs uppercase tracking-wider font-semibold text-slate-700 dark:text-slate-300">Start Date</label>
                    <Input
                      type="date"
                      value={filterStartDate}
                      onChange={(e) => setFilterStartDate(e.target.value)}
                      className="h-10 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                    />
                  </div>
                  <div className="filter-group space-y-2">
                    <label className="text-xs uppercase tracking-wider font-semibold text-slate-700 dark:text-slate-300">End Date</label>
                    <Input
                      type="date"
                      value={filterEndDate}
                      onChange={(e) => setFilterEndDate(e.target.value)}
                      className="h-10 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                    />
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {role === "admin" && dealerPerformance.length > 0 && (
        <Card className="dealer-card border-0 shadow-md overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-b border-blue-200 dark:border-blue-800">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-xl font-bold text-blue-900 dark:text-blue-100">Dealer Performance</CardTitle>
                <p className="text-sm text-blue-600 dark:text-blue-300 mt-1">{dealerPerformance.length} dealers</p>
              </div>
              <Button
                onClick={() => exportToExcel("dealer")}
                variant="default"
                size="sm"
                className="w-full sm:w-auto gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Download className="w-4 h-4" />
                Export Excel
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-100 dark:bg-slate-800">
                  <TableRow className="border-slate-200 dark:border-slate-700 hover:bg-transparent">
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300 py-3">Dealer</TableHead>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300 py-3">Areas</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300 py-3">Today's Payment</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300 py-3">Monthly Revenue</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300 py-3">Pending Recovery</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dealerPerformance.map((perf, idx) => (
                    <TableRow key={perf.dealer.uid} className={`border-slate-200 dark:border-slate-700 ${idx % 2 === 1 ? 'bg-slate-50 dark:bg-slate-900/30' : ''} hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors`}>
                      <TableCell className="font-semibold text-slate-900 dark:text-white py-4">{perf.dealer.name}</TableCell>
                      <TableCell className="text-sm text-slate-600 dark:text-slate-400 py-4">{perf.areas.map((a) => a.name).join(", ") || "—"}</TableCell>
                      <TableCell className="text-right font-bold text-blue-600 dark:text-blue-400 py-4">{fmtPKR(perf.todayRevenue)}</TableCell>
                      <TableCell className="text-right font-bold text-green-600 dark:text-green-400 py-4">{fmtPKR(perf.monthlyRevenue)}</TableCell>
                      <TableCell className="text-right font-bold text-red-600 dark:text-red-400 py-4">{fmtPKR(perf.pendingRecovery)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {role === "admin" && areaPerformance.length > 0 && (
        <Card className="area-card border-0 shadow-md overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-b border-purple-200 dark:border-purple-800">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-xl font-bold text-purple-900 dark:text-purple-100">Area Performance</CardTitle>
                <p className="text-sm text-purple-600 dark:text-purple-300 mt-1">{areaPerformance.length} areas</p>
              </div>
              <Button
                onClick={() => exportToExcel("area")}
                variant="default"
                size="sm"
                className="w-full sm:w-auto gap-2 bg-purple-600 hover:bg-purple-700 text-white"
              >
                <Download className="w-4 h-4" />
                Export Excel
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-100 dark:bg-slate-800">
                  <TableRow className="border-slate-200 dark:border-slate-700 hover:bg-transparent">
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300 py-3">Area</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300 py-3">Monthly Revenue</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300 py-3">Pending Recovery</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300 py-3">Total Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {areaPerformance.map((perf, idx) => (
                    <TableRow key={perf.area.id} className={`border-slate-200 dark:border-slate-700 ${idx % 2 === 1 ? 'bg-slate-50 dark:bg-slate-900/30' : ''} hover:bg-purple-50 dark:hover:bg-purple-950/20 transition-colors`}>
                      <TableCell className="font-semibold text-slate-900 dark:text-white py-4">{perf.area.name}</TableCell>
                      <TableCell className="text-right font-bold text-green-600 dark:text-green-400 py-4">{fmtPKR(perf.monthlyRevenue)}</TableCell>
                      <TableCell className="text-right font-bold text-red-600 dark:text-red-400 py-4">{fmtPKR(perf.pendingRecovery)}</TableCell>
                      <TableCell className="text-right font-bold text-purple-600 dark:text-purple-400 py-4">{fmtPKR(perf.totalRevenue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
