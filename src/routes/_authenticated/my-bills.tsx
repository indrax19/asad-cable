import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { collection, onSnapshot, query, where, doc, getDoc } from "firebase/firestore";
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
import { StatusBadge } from "@/components/status-badge";
import { StatCard } from "@/components/stat-card";
import { fmtPKR, fmtDate } from "@/lib/utils-format";
import { Wallet, Calendar, CheckCircle2 } from "lucide-react";
import type { PaymentDoc, PackageDoc, UserDoc } from "@/lib/types";
import { paymentStatusOf } from "@/lib/billing";

export const Route = createFileRoute("/_authenticated/my-bills")({
  component: MyBillsPage,
});

function MyBillsPage() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<PaymentDoc[]>([]);
  const [pkg, setPkg] = useState<PackageDoc | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    if (!user) return;
    const u1 = onSnapshot(
      query(collection(db, "payments"), where("customerId", "==", user.uid)),
      (snap) => {
        if (isMounted.current) {
          setPayments(
            snap.docs
              .map((d) => ({ id: d.id, ...(d.data() as Omit<PaymentDoc, "id">) }))
              .sort((a, b) => b.date - a.date),
          );
        }
      },
    );
    if (user.packageId) {
      getDoc(doc(db, "packages", user.packageId)).then((s) => {
        if (isMounted.current && s.exists()) {
          setPkg({ id: s.id, ...(s.data() as Omit<PackageDoc, "id">) });
        }
      });
    }
    return () => {
      isMounted.current = false;
      u1();
    };
  }, [user]);

  if (!user) return null;
  const status = paymentStatusOf(user);

  return (
    <div>
      <PageHeader title="My Bills" subtitle={`Welcome, ${user.name}`} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard
          title="Pending Amount"
          value={fmtPKR(user.pendingAmount)}
          icon={Wallet}
          tone={user.pendingAmount && user.pendingAmount > 0 ? "danger" : "success"}
        />
        <StatCard
          title="Advance Balance"
          value={fmtPKR(user.advanceBalance)}
          icon={Wallet}
          tone={user.advanceBalance && user.advanceBalance > 0 ? "success" : "default"}
        />
        <StatCard
          title="Next Due Date"
          value={fmtDate(user.nextDueDate)}
          icon={Calendar}
          tone="warning"
        />
        <StatCard
          title="Status"
          value={status}
          icon={CheckCircle2}
          tone={status === "paid" ? "success" : "danger"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="overflow-x-auto">
          <CardHeader>
            <CardTitle>Connection</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <Row k="Package" v={pkg?.name ?? "—"} />
            <Row k="Speed" v={pkg?.speed ?? "—"} />
            <Row k="Monthly Fee" v={fmtPKR(user.monthlyFee)} />
            <Row k="Activated" v={fmtDate(user.activationDate)} />
            <Row k="Last Payment" v={fmtDate(user.lastPaymentDate)} />
            <Row k="Pending Amount" v={fmtPKR(user.pendingAmount)} />
            <Row k="Advance Balance" v={fmtPKR(user.advanceBalance)} />
            <Row k="Connection" v={<StatusBadge status={user.connectionStatus ?? "active"} />} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Payments</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.slice(0, 8).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{fmtDate(p.date)}</TableCell>
                    <TableCell className="capitalize">{p.method}</TableCell>
                    <TableCell className="text-right font-medium">{fmtPKR(p.amount)}</TableCell>
                  </TableRow>
                ))}
                {payments.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-center text-sm text-muted-foreground py-6"
                    >
                      No payments yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between border-b pb-2">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}
