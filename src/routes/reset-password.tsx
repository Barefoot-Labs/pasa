import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { FundaLogo } from "@/components/funda/Logo";
import { toast } from "sonner";
import { Loader2, CheckCircle2, ArrowLeft } from "lucide-react";
import { friendlyAuthError } from "@/lib/auth-errors";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"request" | "update" | "done">("request");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Supabase sends the user back here with a recovery token in the URL hash.
  // onAuthStateChange fires with event "PASSWORD_RECOVERY" when the token is valid.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setMode("update");
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const onRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return toast.error("Enter your email address");
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) return toast.error(friendlyAuthError(error));
    setMode("done");
  };

  const onUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) return toast.error("Password must be at least 6 characters");
    if (newPassword !== confirmPassword) return toast.error("Passwords do not match");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (error) return toast.error(friendlyAuthError(error));
    toast.success("Password updated. You can now sign in.");
    navigate({ to: "/auth" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex justify-center"><FundaLogo /></div>

        {/* ── Step 1: Request reset email ── */}
        {mode === "request" && (
          <Card className="p-8 space-y-5">
            <div>
              <h1 className="text-xl font-semibold">Forgot your password?</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Enter your email and we'll send you a reset link.
              </p>
            </div>
            <form onSubmit={onRequest} className="space-y-4">
              <div>
                <Label htmlFor="rp-email">Email address</Label>
                <Input
                  id="rp-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
                  placeholder="you@example.com"
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
              >
                {loading ? <Loader2 className="size-4 animate-spin" /> : "Send reset link"}
              </Button>
            </form>
            <div className="text-center">
              <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                <ArrowLeft className="size-3.5" /> Back to sign in
              </Link>
            </div>
          </Card>
        )}

        {/* ── Step 2: Email sent confirmation ── */}
        {mode === "done" && (
          <Card className="p-8 text-center space-y-4">
            <CheckCircle2 className="size-10 text-green-500 mx-auto" />
            <div>
              <h2 className="font-semibold text-lg">Check your email</h2>
              <p className="text-sm text-muted-foreground mt-1">
                We sent a reset link to{" "}
                <span className="font-medium text-foreground">{email}</span>.
                Click the link to set a new password.
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Didn't receive it? Check your spam folder or{" "}
              <button className="text-accent hover:underline" onClick={() => setMode("request")}>
                try again
              </button>.
            </p>
            <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              <ArrowLeft className="size-3.5" /> Back to sign in
            </Link>
          </Card>
        )}

        {/* ── Step 3: Set new password (after clicking email link) ── */}
        {mode === "update" && (
          <Card className="p-8 space-y-5">
            <div>
              <h1 className="text-xl font-semibold">Set new password</h1>
              <p className="text-sm text-muted-foreground mt-1">Choose a strong password.</p>
            </div>
            <form onSubmit={onUpdate} className="space-y-4">
              <div>
                <Label htmlFor="np">New password</Label>
                <Input
                  id="np"
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  autoFocus
                  placeholder="Min. 6 characters"
                />
              </div>
              <div>
                <Label htmlFor="cp">Confirm password</Label>
                <Input
                  id="cp"
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Repeat password"
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
              >
                {loading ? <Loader2 className="size-4 animate-spin" /> : "Update password"}
              </Button>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
}

