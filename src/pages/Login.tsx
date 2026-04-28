import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DEMO_PASSWORD = "Demo@1234";

const DEMO_ACCOUNTS: { email: string; person: string; role: "VSD" | "BOPM"; pod?: string }[] = [
  { email: "aditya.shaw+demo@peppercontent.io", person: "Aditya Shaw", role: "VSD", pod: "BFSI" },
  { email: "neema.jayadas+demo@peppercontent.io", person: "Neema Jayadas", role: "VSD", pod: "US B2B" },
  { email: "aamir.khan+demo@peppercontent.io", person: "Aamir Khan", role: "VSD", pod: "Integrated" },
  { email: "sumit.shekhawat+demo@peppercontent.io", person: "Sumit Shekhawat", role: "VSD", pod: "India B2B" },
  { email: "sneha.iyer+demo@peppercontent.io", person: "Sneha Iyer", role: "VSD", pod: "FMCG" },
  { email: "ritu.priya+demo@peppercontent.io", person: "Ritu Priya", role: "BOPM", pod: "Sr BOPM (Aditya Shaw)" },
  { email: "tiffany.fernandes+demo@peppercontent.io", person: "Tiffany Fernandes", role: "BOPM", pod: "Sr BOPM" },
  { email: "shreshtha.pathak+demo@peppercontent.io", person: "Shreshtha Pathak", role: "BOPM", pod: "Principal BOPM" },
];

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoEmail, setDemoEmail] = useState("");
  const [demoLoading, setDemoLoading] = useState(false);

  useEffect(() => {
    const e = searchParams.get("email");
    if (e) setEmail(e);
  }, [searchParams]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      navigate("/");
    }
  };

  const handleDemoLogin = async () => {
    if (!demoEmail) {
      toast.error("Pick a persona first");
      return;
    }
    setDemoLoading(true);
    let { error } = await supabase.auth.signInWithPassword({
      email: demoEmail,
      password: DEMO_PASSWORD,
    });
    if (error) {
      // Auto-provision demo accounts then retry
      toast.message("Provisioning demo accounts…");
      const { error: provErr } = await supabase.functions.invoke("admin-user-mgmt", {
        body: { action: "provision_demo_logins" },
      });
      if (provErr) {
        setDemoLoading(false);
        toast.error(provErr.message || "Could not provision demo logins");
        return;
      }
      const retry = await supabase.auth.signInWithPassword({
        email: demoEmail,
        password: DEMO_PASSWORD,
      });
      error = retry.error;
    }
    setDemoLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      navigate("/");
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Google sign-in failed");
      setLoading(false);
      return;
    }
    if (result.redirected) return;
    navigate("/");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-medium tracking-tight text-foreground">VSD-OS</h1>
          <p className="text-sm text-muted-foreground">Sign in to your account</p>
        </div>

        <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-2">
          <div className="text-xs font-medium text-foreground">Demo login (admins only)</div>
          <Select value={demoEmail} onValueChange={setDemoEmail}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Select a persona…" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>VSDs</SelectLabel>
                {DEMO_ACCOUNTS.filter((a) => a.role === "VSD").map((a) => (
                  <SelectItem key={a.email} value={a.email}>
                    {a.person} — {a.pod}
                  </SelectItem>
                ))}
              </SelectGroup>
              <SelectGroup>
                <SelectLabel>BOPMs</SelectLabel>
                {DEMO_ACCOUNTS.filter((a) => a.role === "BOPM").map((a) => (
                  <SelectItem key={a.email} value={a.email}>
                    {a.person} — {a.pod}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Button
            type="button"
            className="w-full h-9"
            onClick={handleDemoLogin}
            disabled={demoLoading || !demoEmail}
          >
            {demoLoading ? "Signing in…" : "Sign in as persona"}
          </Button>
          <p className="text-[11px] text-muted-foreground">
            First use auto-provisions accounts. Password: <span className="font-mono">{DEMO_PASSWORD}</span>
          </p>
        </div>

        <Button
          variant="outline"
          className="w-full"
          onClick={handleGoogleLogin}
          disabled={loading}
        >
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Continue with Google
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">or</span>
          </div>
        </div>

        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Don't have an account?{" "}
          <Link to="/signup" className="text-primary hover:underline">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
