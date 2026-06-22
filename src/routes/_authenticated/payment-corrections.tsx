import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search } from "lucide-react";
import { fmtPKR, fmtDate } from "@/lib/utils-format";
import type { PaymentCorrectionDoc, PaymentDoc } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/payment-corrections")({
  component: PaymentCorrectionsPage,
});

function PaymentCorrectionsPage() {
  const { user, role } = useAuth();
  const [corrections, setCorrections] = useState<PaymentCorrectionDoc[]>([]);
  const [payments, setPayments] = useState<PaymentDoc[]>([]);
  const [search, setSearch] = useState("");
  const [type, setType] = useState<"all" | "reversal" | "reassignment">("all");
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    const u1 = onSnapshot(collection(db, "paymentCorrections"), (snap) => {
      if (!isMounted.current) return;
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<PaymentCorrectionDoc, "id">),
      }));
      setCorrections(list.sort((a, b) => b.createdAt - a.createdAt));
    });

    const u2 = onSnapshot(collection(db, "payments"), (snap) => {
      if (!isMounted.current) return;
      setPayments(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PaymentDoc, "id">) }))
      );
    });

    return () => {
      isMounted.current = false;
      u1();
      u2();
    };
  }, []);

  const filtered = useMemo(() => {
    return corrections.filter((c) => {
      if (type !== "all" && c.correctionType !== type) return false;
      if (
        search &&
        !`${c.oldCustomerName ?? ""} ${c.newCustomerName ?? ""} ${c.reversedCustomerName ?? ""} ${c.reason ?? ""}`
          .toLowerCase()
          .includes(search.toLowerCase())
      )
        return false;
      return true;
    });
  }, [corrections, search, type]);

  if (role !== "admin") {
    return (
      <div className="p-4 text-center">
        <p className="text-muted-foreground">Only admins can view payment corrections.</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Payment Corrections"
        subtitle="Audit log of all payment reversals and reassignments"
      />

      <Card className="mb-4">
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative md:col-span-2">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search customer or reason…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={type}
            onChange={(e) => setType(e.target.value as "all" | "reversal" | "reassignment")}
          >
            <option value="all">All types</option>
            <option value="reversal">Reversals</option>
            <option value="reassignment">Reassignments</option>
          </select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Corrected By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => {
                const payment = payments.find((p) => p.id === c.paymentId);
                const isReversal = c.correctionType === "reversal";

                return (
                  <TableRow key={c.id}>
                    <TableCell className="text-sm">{fmtDate(c.createdAt)}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          isReversal
                            ? "bg-red-100 text-red-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {isReversal ? "Reversal" : "Reassignment"}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {isReversal ? (
                        <div>
                          <div className="font-medium">{c.reversedCustomerName}</div>
                          <div className="text-xs text-muted-foreground">Reversed</div>
                        </div>
                      ) : (
                        <div>
                          <div className="text-xs text-muted-foreground">
                            {c.oldCustomerName} →
                          </div>
                          <div className="font-medium">{c.newCustomerName}</div>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {payment ? fmtPKR(payment.amount) : "—"}
                    </TableCell>
                    <TableCell className="text-sm max-w-xs truncate">
                      {c.reason}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.correctedByName} ({c.correctedByRole})
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-sm text-muted-foreground py-10"
                  >
                    No corrections found.
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
