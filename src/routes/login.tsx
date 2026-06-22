import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { signInWithEmailAndPassword, signInWithPopup, sendPasswordResetEmail } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Mail, Eye, EyeOff, CheckCircle, ArrowLeft } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [userName, setUserName] = useState("");
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetBusy, setResetBusy] = useState(false);

  const ensureProfile = async (uid: string, name: string, emailAddr: string) => {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) {
      await setDoc(doc(db, "users", uid), {
        name,
        email: emailAddr,
        role: "admin",
        status: "active",
        createdAt: Date.now(),
      });
    }
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const snap = await getDoc(doc(db, "users", cred.user.uid));
      if (snap.exists()) {
        const userData = snap.data() as any;
        if (userData.status === "disabled") {
          await auth.signOut();
          toast.error("Your account has been disabled. Please contact the administrator.");
          return;
        }
      }
      try {
        const displayName = cred.user.displayName ?? email.split("@")[0];
        await ensureProfile(cred.user.uid, displayName, email);
        setUserName(displayName);
      } catch (err) {
        console.warn("Failed to sync profile:", err);
        setUserName(email.split("@")[0]);
      }
      setLoginSuccess(true);
      setTimeout(() => {
        nav({ to: "/" });
      }, 1500);
    } catch (err) {
      const error = err as any;
      if (
        error?.code === "auth/invalid-credential" ||
        error?.code === "auth/user-not-found" ||
        error?.code === "auth/wrong-password"
      ) {
        toast.error("Invalid email or password");
      } else if (error?.code === "auth/network-request-failed") {
        toast.error("Network error. Please check your connection and try again.");
      } else {
        toast.error("Login failed. Please try again.");
      }
      console.error("Login error:", err);
    } finally {
      setBusy(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) {
      toast.error("Please enter your email address");
      return;
    }
    setResetBusy(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      toast.success("Password reset email sent! Check your inbox.");
      setShowResetDialog(false);
      setResetEmail("");
    } catch (err) {
      const error = err as any;
      if (error?.code === "auth/user-not-found") {
        toast.error("No account found with this email address");
      } else if (error?.code === "auth/network-request-failed") {
        toast.error("Network error. Please check your connection.");
      } else {
        toast.error("Failed to send reset email. Please try again.");
      }
      console.error("Reset error:", err);
    } finally {
      setResetBusy(false);
    }
  };

  if (loginSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-blue-50 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="mb-6 inline-flex items-center justify-center w-16 h-16 rounded-full bg-teal-100">
            <CheckCircle className="w-8 h-8 text-teal-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome back, {userName}!</h2>
          <p className="text-gray-600 mb-6">Redirecting to your dashboard...</p>
          <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-teal-600 animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2 bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-teal-600 via-teal-700 to-blue-800 p-12 text-white">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <img
              src="https://cdn.builder.io/api/v1/image/assets%2F518d4435749b420eb67d4c19800a67f3%2F7e03c52884ca4f978cc752b14e5add8b?format=webp&width=800&height=1200"
              alt="ASAD Logo"
              className="w-10 h-10 rounded-lg shadow-lg"
            />
          </div>
          <h2 className="text-3xl font-bold">ASAD Cable & Internet</h2>
        </div>
        <div>
          <h1 className="text-5xl font-bold leading-tight mb-5">
            Manage Bills,
            <br />
            Track Payments,
            <br />
            Grow Business.
          </h1>
          <p className="text-teal-100 text-lg max-w-lg leading-relaxed">
            Complete billing management system for ISP operators. Track customers, manage dealers,
            monitor areas, and recover dues effortlessly.
          </p>
        </div>
        <div className="space-y-3 text-sm text-teal-100">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-teal-300"></div>
            <span>Real-time payment tracking</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-teal-300"></div>
            <span>Multi-user dashboard</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-teal-300"></div>
            <span>WhatsApp reminders</span>
          </div>
        </div>
        <p className="text-xs text-teal-200">
          © {new Date().getFullYear()} ASAD Cable & Internet. All rights reserved.
        </p>
      </div>

      <div className="flex flex-col items-center justify-center p-6 sm:p-8">
        <Card className="w-full max-w-md border-0 shadow-xl bg-white">
          <CardHeader className="pb-8 pt-8 px-8 text-center">
            <div className="flex justify-center mb-4">
              <img
                src="https://cdn.builder.io/api/v1/image/assets%2F518d4435749b420eb67d4c19800a67f3%2F7e03c52884ca4f978cc752b14e5add8b?format=webp&width=800&height=1200"
                alt="ASAD Logo"
                className="w-12 h-12 rounded-lg"
              />
            </div>
            <CardTitle className="text-3xl font-bold text-gray-900">
              ASAD <br /> Cable & Internet
            </CardTitle>
            <CardDescription className="text-gray-600 mt-3 text-base">
              Sign in to your billing dashboard
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 px-8 pb-8">
            {!busy && (
              <form onSubmit={handleEmail} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-gray-700 font-semibold text-sm">
                    Email Address
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-teal-600 pointer-events-none" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="admin@asad.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-12 h-12 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-teal-500 focus:ring-teal-500"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-gray-700 font-semibold text-sm">
                    Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pr-12 h-12 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-teal-500 focus:ring-teal-500"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-teal-600 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full h-12 mt-2 bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white font-semibold rounded-lg transition-all shadow-md hover:shadow-lg"
                  disabled={busy}
                >
                  {busy ? "Signing in…" : "Sign in"}
                </Button>
                <Button
                  type="button"
                  variant="link"
                  className="w-full text-teal-600 hover:text-teal-700 text-sm"
                  onClick={() => setShowResetDialog(true)}
                >
                  Forgot password?
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-gray-500 text-xs mt-8 max-w-md">
          By signing in, you agree to our terms of service. For support, contact your administrator.
        </p>
      </div>

      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Enter your email address and we'll send you a link to reset your password.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email">Email Address</Label>
              <Input
                id="reset-email"
                type="email"
                placeholder="your@email.com"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={resetBusy}
                className="flex-1 bg-teal-600 hover:bg-teal-700"
              >
                {resetBusy ? "Sending…" : "Send Reset Link"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowResetDialog(false);
                  setResetEmail("");
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
