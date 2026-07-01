import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  UserCheck,
  UserX,
  CheckCircle2,
  AlertCircle,
  Clock,
  TrendingUp,
  Wallet,
  ChevronRight,
  MapPin,
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
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { useNavigate } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  component: DashboardPage,
});

function DashboardPage() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<UserDoc[]>([]);
  const [payments, setPayments] = useState<PaymentDoc[]>([]);
  const [areas, setAreas] = useState<AreaDoc[]>([]);
  const [dealers, setDealers] = useState<UserDoc[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserDoc | null>(null);
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

  useEffect(() => {
    isMounted.current = true;
    const unsub = onSnapshot(collection(db, "packages"), (snap) => {
      if (!isMounted.current) return;
      setPackages(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    });
    return () => {
      isMounted.current = false;
      unsub();
    };
  }, []);

  const total = customers.length;
  const active = customers.filter((c) => c.connectionStatus !== "disabled").length;
  const disabled = customers.filter((c) => c.connectionStatus === "disabled").length;
  const activeCustomers = customers.filter((c) => c.connectionStatus !== "disabled");
  const paid = activeCustomers.filter((c) => (c.pendingAmount ?? 0) <= 0).length;
  const unpaid = activeCustomers.filter((c) => (c.pendingAmount ?? 0) > 0).length;
  const overdue = activeCustomers.filter((c) => paymentStatusOf(c) === "overdue").length;
  const pendingRecovery = activeCustomers.reduce((sum, c) => sum + (c.pendingAmount ?? 0), 0);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthlyRevenue = payments
    .filter((p) => p.date >= monthStart.getTime())
    .reduce((s, p) => s + p.amount, 0);

  // Monthly trend (last 6 months)
  const trend = Array.from({ length: 6 }).map((_, idx) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - idx));
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    const next = new Date(d);
    next.setMonth(next.getMonth() + 1);
    const amount = payments
      .filter((p) => p.date >= d.getTime() && p.date < next.getTime())
      .reduce((s, p) => s + p.amount, 0);
    return { month: d.toLocaleString("en", { month: "short" }), amount };
  });

  // Next 5 days due dates
  const nextFiveDays = Array.from({ length: 5 }).map((_, idx) => {
    const d = new Date();
    d.setDate(d.getDate() + idx);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const dueDateData = nextFiveDays.map((date) => {
    const count = customers.filter((c) => {
      const dueDate = new Date(c.nextDueDate ?? 0);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate.getTime() === date.getTime();
    }).length;
    return {
      date: date.toLocaleDateString("en", { month: "short", day: "numeric" }),
      count,
    };
  });

  const statusData = [
    { name: "Paid", value: paid, color: "var(--color-success)" },
    { name: "Unpaid", value: unpaid - overdue, color: "var(--color-warning)" },
    { name: "Overdue", value: overdue, color: "var(--color-destructive)" },
  ].filter((d) => d.value > 0);

  const handleStatClick = (status?: string, due?: string) => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (due) params.set("due", due);
    const search = params.toString();
    navigate({ to: `/users${search ? "?" + search : ""}` });
  };

  return (
    <div>
      <PageHeader title="Dashboard" subtitle={`Welcome back, ${user?.name}`} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <div onClick={() => handleStatClick()} className="cursor-pointer hover:opacity-90 transition-opacity">
          <StatCard title="Total Users" value={total} icon={Users} />
        </div>
        <div onClick={() => handleStatClick("active")} className="cursor-pointer hover:opacity-90 transition-opacity">
          <StatCard title="Active" value={active} icon={UserCheck} tone="success" />
        </div>
        <div onClick={() => handleStatClick("disabled")} className="cursor-pointer hover:opacity-90 transition-opacity">
          <StatCard title="Disabled" value={disabled} icon={UserX} />
        </div>
        <div onClick={() => handleStatClick("paid")} className="cursor-pointer hover:opacity-90 transition-opacity">
          <StatCard title="Paid" value={paid} icon={CheckCircle2} tone="success" />
        </div>
        <div onClick={() => handleStatClick("unpaid")} className="cursor-pointer hover:opacity-90 transition-opacity">
          <StatCard title="Unpaid" value={unpaid} icon={AlertCircle} tone="warning" />
        </div>
        <div onClick={() => handleStatClick("overdue")} className="cursor-pointer hover:opacity-90 transition-opacity">
          <StatCard title="Overdue" value={overdue} icon={Clock} tone="danger" />
        </div>
        <div>
          <StatCard
            title="Monthly Revenue"
            value={fmtPKR(monthlyRevenue)}
            icon={TrendingUp}
            tone="info"
          />
        </div>
        <div>
          <StatCard
            title="Pending Recovery"
            value={fmtPKR(pendingRecovery)}
            icon={Wallet}
            tone="danger"
          />
        </div>
      </div>

      {((role === "admin" && areas.length > 0) || (role === "dealer" && user?.assignedAreaIds && user.assignedAreaIds.length > 0)) && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-4">Areas</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {areas
              .filter((area) => role === "admin" || (user?.assignedAreaIds ?? []).includes(area.id))
              .map((area) => {
                const assignedDealers = dealers.filter((d) => area.dealerIds.includes(d.uid));
                const areaCustomers = customers.filter((c) => c.areaId === area.id);
                return (
                  <button
                    key={area.id}
                    onClick={() => navigate({ to: `/dashboard/area/${area.id}` })}
                    className="text-left"
                  >
                    <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="font-semibold text-base">{area.name}</h3>
                            <p className="text-sm text-muted-foreground">{area.code}</p>
                          </div>
                          <StatusBadge status={area.status} />
                        </div>
                        <div className="space-y-2 text-sm">
                          {role === "admin" && (
                            <div>
                              <span className="text-muted-foreground">Dealers: </span>
                              <span className="font-medium">
                                {assignedDealers.length > 0
                                  ? assignedDealers.map((d) => d.name).join(", ")
                                  : "—"}
                              </span>
                            </div>
                          )}
                          <div>
                            <span className="text-muted-foreground">Users: </span>
                            <span className="font-medium">{areaCustomers.length}</span>
                          </div>
                        </div>
                        {(area.latitude || area.longitude) && (
                          <div className="mt-3 pt-3 border-t flex items-center gap-2 text-xs text-muted-foreground">
                            <MapPin className="size-3" />
                            <span>
                              {area.latitude?.toFixed(4)}, {area.longitude?.toFixed(4)}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center justify-end mt-3 text-primary">
                          <ChevronRight className="size-4" />
                        </div>
                      </CardContent>
                    </Card>
                  </button>
                );
              })}
          </div>
        </div>
      )}

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

      <div className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle>Due Dates — Next 5 Days</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={dueDateData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="date" stroke="var(--color-muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                  }}
                />
                <Bar dataKey="count" fill="var(--color-primary)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mt-4">
        <Card>
          <CardHeader>
            <CardTitle>Recent Payments</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="h-80 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.slice(0, 20).map((p) => {
                    const paymentCustomer = customers.find((c) => c.uid === p.customerId);
                    return (
                      <TableRow key={p.id}>
                        <TableCell>
                          {paymentCustomer ? (
                            <button
                              onClick={() => setSelectedUser(paymentCustomer)}
                              className="text-primary hover:underline font-medium cursor-pointer"
                            >
                              {paymentCustomer.name}
                            </button>
                          ) : (
                            (p.customerName ?? p.customerId?.slice(0, 6) ?? "Unknown")
                          )}
                        </TableCell>
                        <TableCell className="capitalize">{p.method}</TableCell>
                        <TableCell>{fmtDate(p.date)}</TableCell>
                        <TableCell className="text-right font-medium">{fmtPKR(p.amount)}</TableCell>
                      </TableRow>
                    );
                  })}
                  {payments.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center text-sm text-muted-foreground py-8"
                      >
                        No payments yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Overdue Users</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="h-80 overflow-y-auto">
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
                    .slice(0, 20)
                    .map((c) => (
                      <TableRow key={c.uid}>
                        <TableCell>
                          <button
                            onClick={() => setSelectedUser(c)}
                            className="text-primary hover:underline font-medium cursor-pointer"
                          >
                            {c.name}
                          </button>
                        </TableCell>
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
            </div>
          </CardContent>
        </Card>
      </div>

      {customers.length > 0 && (
        <div className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Users</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-80 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Package</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customers
                      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
                      .slice(0, 20)
                      .map((c) => {
                        const pkg = packages.find((p) => p.id === c.packageId);
                        return (
                          <TableRow key={c.uid}>
                            <TableCell>
                              <button
                                onClick={() => setSelectedUser(c)}
                                className="text-primary hover:underline font-medium cursor-pointer"
                              >
                                {c.name}
                              </button>
                            </TableCell>
                            <TableCell className="text-sm">{pkg?.name ?? "—"}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{c.email}</TableCell>
                            <TableCell className="text-sm">{c.phone ?? "—"}</TableCell>
                            <TableCell>
                              <StatusBadge status={c.connectionStatus} />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    {customers.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center text-sm text-muted-foreground py-8"
                        >
                          No users yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

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
