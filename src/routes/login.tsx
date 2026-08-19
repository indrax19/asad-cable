import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle, Eye, EyeOff, Mail } from "lucide-react";
import { toast } from "sonner";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({ component: LoginPage });

const logoUrl =
  "https://cdn.builder.io/api/v1/image/assets%2F518d4435749b420eb67d4c19800a67f3%2F7e03c52884ca4f978cc752b14e5add8b?format=webp&width=800&height=1200";

function LoginPage() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [userName, setUserName] = useState("");
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetBusy, setResetBusy] = useState(false);

  const handleSignIn = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isSupabaseConfigured) {
      toast.error("Supabase is not configured. Add the project URL to enable sign in.");
      return;
    }

    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;

      await refresh();
      setUserName(data.user.user_metadata.name ?? data.user.email?.split("@")[0] ?? "there");
      setLoginSuccess(true);
      window.setTimeout(() => navigate({ to: "/" }), 1200);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to sign in. Please try again.";
      toast.error(message);
      console.error("Login error:", error);
    } finally {
      setBusy(false);
    }
  };

  const handleResetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isSupabaseConfigured) {
      toast.error("Supabase is not configured. Add the project URL to reset your password.");
      return;
    }

    setResetBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
        redirectTo: `${window.location.origin}/login`,
      });
      if (error) throw error;
      toast.success("Password reset email sent. Check your inbox.");
      setShowResetDialog(false);
      setResetEmail("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to send the reset email.";
      toast.error(message);
      console.error("Reset password error:", error);
    } finally {
      setResetBusy(false);
    }
  };

  if (loginSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-teal-50 to-blue-50 p-4">
        <div className="max-w-sm text-center">
          <div className="mb-6 inline-flex size-16 items-center justify-center rounded-full bg-teal-100">
            <CheckCircle className="size-8 text-teal-600" />
          </div>
          <h2 className="mb-2 text-2xl font-bold text-gray-900">Welcome back, {userName}!</h2>
          <p className="mb-6 text-gray-600">Redirecting to your dashboard...</p>
          <div className="h-1 w-full overflow-hidden rounded-full bg-gray-200">
            <div className="h-full bg-teal-600 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 lg:grid-cols-2">
      <aside className="hidden flex-col justify-between bg-gradient-to-br from-teal-600 via-teal-700 to-blue-800 p-12 text-white lg:flex">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <img src={logoUrl} alt="ASAD Logo" className="size-10 rounded-lg shadow-lg" />
          </div>
          <h2 className="text-3xl font-bold">ASAD Cable & Internet</h2>
        </div>
        <div>
          <h1 className="mb-5 text-5xl font-bold leading-tight">
            Manage Bills,
            <br />
            Track Payments,
            <br />
            Grow Business.
          </h1>
          <p className="max-w-lg text-lg leading-relaxed text-teal-100">
            Complete billing management system for ISP operators. Track customers, manage dealers, monitor areas, and recover dues effortlessly.
          </p>
        </div>
        <div className="space-y-3 text-sm text-teal-100">
          {[
            "Real-time payment tracking",
            "Multi-user dashboard",
            "WhatsApp reminders",
          ].map((feature) => (
            <div key={feature} className="flex items-center gap-3">
              <div className="size-2 rounded-full bg-teal-300" />
              <span>{feature}</span>
            </div>
          ))}
          <p className="pt-6 text-xs text-teal-200">© {new Date().getFullYear()} ASAD Cable & Internet. All rights reserved.</p>
        </div>
      </aside>

      <main className="flex items-center justify-center p-6 sm:p-10">
        <Card className="w-full max-w-md border-0 shadow-xl">
          <CardHeader className="space-y-2 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-teal-100 lg:hidden">
              <img src={logoUrl} alt="ASAD Logo" className="size-9 rounded-lg" />
            </div>
            <CardTitle className="text-2xl">Welcome back</CardTitle>
            <CardDescription>Sign in to manage your cable business.</CardDescription>
          </CardHeader>
          <CardContent>
            {!isSupabaseConfigured && (
              <p className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Supabase configuration is incomplete. Sign in will be available after the project URL is added.
              </p>
            )}
            <form onSubmit={handleSignIn} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="admin@asad.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="password">Password</Label>
                  <button
                    type="button"
                    onClick={() => {
                      setResetEmail(email);
                      setShowResetDialog(true);
                    }}
                    className="text-sm font-medium text-teal-700 hover:text-teal-800 hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full bg-teal-600 hover:bg-teal-700" disabled={busy || !isSupabaseConfigured}>
                {busy ? "Signing in..." : "Sign in"}
              </Button>
            </form>
            <p className="mt-6 text-center text-sm text-muted-foreground">
              New to ASAD Cable?{" "}
              <Link to="/signup" className="font-medium text-teal-700 hover:text-teal-800 hover:underline">
                Create an account
              </Link>
            </p>
          </CardContent>
        </Card>
      </main>

      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset your password</DialogTitle>
            <DialogDescription>Enter your email address and we will send you a password-reset link.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email">Email address</Label>
              <Input
                id="reset-email"
                type="email"
                autoComplete="email"
                value={resetEmail}
                onChange={(event) => setResetEmail(event.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full bg-teal-600 hover:bg-teal-700" disabled={resetBusy || !isSupabaseConfigured}>
              {resetBusy ? "Sending..." : "Send reset link"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
