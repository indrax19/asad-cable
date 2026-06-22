import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PaymentMethodDoc {
  id: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  type: "bank" | "easypaisa" | "jazzcash";
  description?: string;
  createdBy: string;
  createdByRole: "admin" | "dealer";
  createdAt: number;
}

export const Route = createFileRoute("/_authenticated/payment-details")({
  component: PaymentDetailsPage,
});

function PaymentDetailsPage() {
  const [methods, setMethods] = useState<PaymentMethodDoc[]>([]);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    const unsub = onSnapshot(collection(db, "paymentMethods"), (snap) => {
      if (!isMounted.current) return;
      setMethods(
        snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<PaymentMethodDoc, "id">) }))
          .sort((a, b) => b.createdAt - a.createdAt),
      );
    });
    return () => {
      isMounted.current = false;
      unsub();
    };
  }, []);

  return (
    <div>
      <PageHeader title="Payment Methods" subtitle="Available payment methods to pay your bills" />

      <div className="grid lg:grid-cols-2 gap-4">
        {methods.map((method) => (
          <Card key={method.id}>
            <CardHeader className="pb-3">
              <div>
                <CardTitle className="text-lg">{method.bankName}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">{method.type.toUpperCase()}</p>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Account Name</p>
                <p className="font-medium text-sm">{method.accountName}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Account Number</label>
                <p className="font-mono text-sm">{method.accountNumber}</p>
              </div>
              {method.description && (
                <div>
                  <p className="text-xs text-muted-foreground">Notes</p>
                  <p className="text-sm text-foreground">{method.description}</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {methods.length === 0 && (
        <Card>
          <CardContent className="text-center text-sm text-muted-foreground py-10">
            No payment methods available yet. Please contact your dealer.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
