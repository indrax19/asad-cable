import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { fbUser, role, loading } = useAuth();
  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  if (!fbUser) return <Navigate to="/login" />;
  if (role === "customer") return <Navigate to="/my-bills" />;
  return <Navigate to="/dashboard" />;
}
