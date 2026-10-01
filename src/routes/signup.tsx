import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff, Mail } from "lucide-react";
import { toast } from "sonner";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/signup")({ component: SignupPage });

const logoUrl =
  "https://cdn.builder.io/api/v1/image/assets%2F518d4435749b420eb67d4c19800a67f3%2F7e03c52884ca4f978cc752b14e5add8b?format=webp&width=800&height=1200";

function SignupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleSignUp = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isSupabaseConfigured) {
      toast.error("Supabase is not configured. Add the project URL to create an account.");
      return;
    }

    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
          data: { name: name.trim(), signupSource: "self-service" },
        },
      });
      if (error) throw error;
      if (!data.user) throw new Error("Account could not be created. Please try again.");

      if (data.session) {
        toast.success("Account created successfully.");
        navigate({ to: "/" });
        return;
      }

      toast.success("Account created. Check your email to confirm it, then sign in.");
      navigate({ to: "/login" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create the account. Please try again.";
      toast.error(message);
      console.error("Signup error:", error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 p-6">
      <div className="mb-6 flex items-center gap-2">
        <img src={logoUrl} alt="ASAD Logo" className="size-10 rounded-lg" />
        <div className="text-lg font-bold">ASAD Cable & Internet</div>
      </div>
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle>Create account</CardTitle>
          <CardDescription>Register with your email and password to get started.</CardDescription>
        </CardHeader>
        <CardContent>
          {!isSupabaseConfigured && (
            <p className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Supabase configuration is incomplete. Account creation will be available after the project URL is added.
            </p>
          )}
          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={6}
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
              <p className="text-xs text-muted-foreground">Use at least 6 characters.</p>
            </div>
            <Button type="submit" className="w-full bg-teal-600 hover:bg-teal-700" disabled={busy || !isSupabaseConfigured}>
              {busy ? "Creating account..." : "Create account"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="font-medium text-teal-700 hover:text-teal-800 hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
