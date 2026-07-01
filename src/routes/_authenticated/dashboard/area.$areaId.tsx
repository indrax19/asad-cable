import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { collection, onSnapshot, doc, getDoc, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Users,
  UserCheck,
  UserX,
  CheckCircle2,
  AlertCircle,
  Clock,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fmtPKR, fmtDate } from "@/lib/utils-format";
import type { UserDoc, PaymentDoc, AreaDoc } from "@/lib/types";
import { paymentStatusOf } from "@/lib/billing";
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard/area/$areaId")({
  component: AreaDashboardPage,
});

function AreaDashboardPage() {
  const { areaId } = Route.useParams();
  const { role, user } = useAuth();
  const [area, setArea] = useState<AreaDoc | null>(null);
  const [dealers, setDealers] = useState<UserDoc[]>([]);
  const [assignedDealer, setAssignedDealer] = useState<UserDoc | null>(null);
  const [customers, setCustomers] = useState<UserDoc[]>([]);
  const [payments, setPayments] = useState<PaymentDoc[]>([]);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [filterType, setFilterType] = useState<string | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    const fetchArea = async () => {
      const snap = await getDoc(doc(db, "areas", areaId));
      if (isMounted.current && snap.exists()) {
        const areaData = { id: snap.id, ...(snap.data() as Omit<AreaDoc, "id">) };

        // Check if dealer has access to this area
        if (role === "dealer" && user) {
          if (!(user.assignedAreaIds ?? []).includes(areaId)) {
            setPermissionDenied(true);
            return;
          }
        }

        setArea(areaData);
      }
    };
    fetchArea();
    return () => {
      isMounted.current = false;
    };
  }, [areaId, role, user]);

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

  useEffect(() => {
    if (!area) return;
    if (area.dealerIds.length > 0) {
      const dealer = dealers.find((d) => area.dealerIds.includes(d.uid));
      setAssignedDealer(dealer || null);
    }
  }, [area, dealers]);

  useEffect(() => {
    isMounted.current = true;
    const qUsers = query(
      collection(db, "users"),
      where("areaId", "==", areaId),
      where("role", "==", "customer"),
    );
    const unsub = onSnapshot(qUsers, (snap) => {
      if (!isMounted.current) return;
      const list = snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<UserDoc, "uid">) }));
      setCustomers(list);
    });
    return () => {
      isMounted.current = false;
      unsub();
    };
  }, [areaId]);

  useEffect(() => {
    isMounted.current = true;
    const unsub = onSnapshot(
      query(collection(db, "payments"), where("areaId", "==", areaId)),
      (snap) => {
        if (!isMounted.current) return;
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PaymentDoc, "id">) }));
        setPayments(list.sort((a, b) => b.date - a.date));
      },
    );
    return () => {
      isMounted.current = false;
      unsub();
    };
  }, [areaId]);

  // Separate active and reversed payments
  const activePayments = payments.filter((p) => p.status !== "reversed");
  const reversedPayments = payments.filter((p) => p.status === "reversed");

  if (permissionDenied) {
    return <div className="p-10 text-center text-muted-foreground">403 — You don't have access to this area</div>;
  }

  if (!area) {
    return <div className="p-10 text-center text-muted-foreground">Loading...</div>;
  }

  const total = customers.length;
  const activeList = customers.filter((c) => c.connectionStatus !== "disabled");
  const active = activeList.length;
  const disabledList = customers.filter((c) => c.connectionStatus === "disabled");
  const disabled = disabledList.length;
  const activeCustomers = activeList;
  const paidList = activeCustomers.filter((c) => (c.pendingAmount ?? 0) <= 0);
  const paid = paidList.length;
  const unpaidList = activeCustomers.filter((c) => (c.pendingAmount ?? 0) > 0);
  const unpaid = unpaidList.length;
  const overdueList = activeCustomers.filter((c) => paymentStatusOf(c) === "overdue");
  const overdue = overdueList.length;
  const pendingRecovery = activeCustomers.reduce((sum, c) => sum + (c.pendingAmount ?? 0), 0);

  const getFilteredUsers = () => {
    switch (filterType) {
      case "total":
        return customers;
      case "active":
        return activeList;
      case "disabled":
        return disabledList;
      case "paid":
        return paidList;
      case "unpaid":
        return unpaidList;
      case "overdue":
        return overdueList;
      default:
        return [];
    }
  };

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthlyRevenue = activePayments
    .filter((p) => p.date >= monthStart.getTime())
    .reduce((s, p) => s + p.amount, 0);

  const trend = Array.from({ length: 6 }).map((_, idx) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - idx));
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    const next = new Date(d);
    next.setMonth(next.getMonth() + 1);
    const amount = activePayments
      .filter((p) => p.date >= d.getTime() && p.date < next.getTime())
      .reduce((s, p) => s + p.amount, 0);
    return { month: d.toLocaleString("en", { month: "short" }), amount };
  });

  const statusData = [
    { name: "Paid", value: paid, color: "var(--color-success)" },
    { name: "Unpaid", value: unpaid - overdue, color: "var(--color-warning)" },
    { name: "Overdue", value: overdue, color: "var(--color-destructive)" },
  ].filter((d) => d.value > 0);

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">{area.name}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Area Code: {area.code}</p>
        </div>
        {assignedDealer && (
          <div className="text-right bg-muted/50 px-4 py-3 rounded-lg whitespace-nowrap">
            <p className="text-sm text-muted-foreground">Assigned Dealer</p>
            <p className="text-lg font-semibold">{assignedDealer.name}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard title="Total Users" value={total} icon={Users} onClick={() => setFilterType("total")} />
        <StatCard title="Active" value={active} icon={UserCheck} tone="success" onClick={() => setFilterType("active")} />
        <StatCard title="Disabled" value={disabled} icon={UserX} onClick={() => setFilterType("disabled")} />
        <StatCard title="Paid" value={paid} icon={CheckCircle2} tone="success" onClick={() => setFilterType("paid")} />
        <StatCard title="Unpaid" value={unpaid} icon={AlertCircle} tone="warning" onClick={() => setFilterType("unpaid")} />
        <StatCard title="Overdue" value={overdue} icon={Clock} tone="danger" onClick={() => setFilterType("overdue")} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mt-3 md:mt-4">
        <StatCard
          title="Monthly Revenue"
          value={fmtPKR(monthlyRevenue)}
          icon={TrendingUp}
          tone="info"
        />
        <StatCard
          title="Pending Recovery"
          value={fmtPKR(pendingRecovery)}
          icon={Wallet}
          tone="danger"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mt-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Collections — Last 6 months</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="month" stroke="var(--color-muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="amount"
                  stroke="var(--color-primary)"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Payment Status</CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length === 0 ? (
              <div className="text-sm text-muted-foreground py-12 text-center">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={85}
                  >
                    {statusData.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      padding: "8px 12px",
                    }}
                    formatter={(value) => [String(value), "Count"]}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mt-4">
        <Card>
          <CardHeader>
            <CardTitle>Recent Payments</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.slice(0, 6).map((p) => (
                  <TableRow key={p.id} className={p.status === "reversed" ? "bg-destructive/5" : ""}>
                    <TableCell>
                      {p.customerName ?? p.customerId?.slice(0, 6) ?? "Unknown"}
                    </TableCell>
                    <TableCell className="capitalize">{p.method}</TableCell>
                    <TableCell>{fmtDate(p.date)}</TableCell>
                    <TableCell className="text-right font-medium">{fmtPKR(p.amount)}</TableCell>
                    <TableCell>
                      {p.status === "reversed" ? (
                        <span className="text-xs font-medium text-destructive">Reversed</span>
                      ) : (
                        <span className="text-xs font-medium text-success">Active</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {payments.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-sm text-muted-foreground py-8"
                    >
                      No payments yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Overdue Users</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Pending</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers
                  .filter((c) => paymentStatusOf(c) === "overdue")
                  .slice(0, 6)
                  .map((c) => (
                    <TableRow key={c.uid}>
                      <TableCell>{c.name}</TableCell>
                      <TableCell>{fmtDate(c.nextDueDate)}</TableCell>
                      <TableCell className="font-medium">{fmtPKR(c.pendingAmount)}</TableCell>
                      <TableCell>
                        <StatusBadge status="overdue" />
                      </TableCell>
                    </TableRow>
                  ))}
                {customers.filter((c) => paymentStatusOf(c) === "overdue").length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center text-sm text-muted-foreground py-8"
                    >
                      All caught up
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={filterType !== null} onOpenChange={(open) => !open && setFilterType(null)}>
        <DialogContent className="w-full max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-center justify-between sticky top-0 bg-background z-10">
            <DialogTitle>
              {filterType === "total" && "All Users"}
              {filterType === "active" && "Active Users"}
              {filterType === "disabled" && "Disabled Users"}
              {filterType === "paid" && "Paid Users"}
              {filterType === "unpaid" && "Unpaid Users"}
              {filterType === "overdue" && "Overdue Users"}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {getFilteredUsers().length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No users found</p>
            ) : (
              <div className="space-y-3">
                {getFilteredUsers().map((c) => (
                  <div
                    key={c.uid}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{c.name}</p>
                      <p className="text-sm text-muted-foreground">{c.phone}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{fmtPKR(c.pendingAmount ?? 0)}</p>
                      <StatusBadge status={paymentStatusOf(c)} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
