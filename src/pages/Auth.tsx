import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Trophy, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

export default function Auth() {
  const { user, signIn, signUp, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = "Admin login · Intramurals";
  }, []);

  useEffect(() => {
    if (!authLoading && user) navigate("/");
  }, [user, authLoading, navigate]);

  const handle = async (mode: "signin" | "signup") => {
    if (!email || !password) {
      toast.error("Email and password required");
      return;
    }
    setSubmitting(true);
    const { error } = mode === "signin" ? await signIn(email, password) : await signUp(email, password);
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(mode === "signup" ? "Account created — you're signed in" : "Welcome back");
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-hero p-4">
      <div className="w-full max-w-md rounded-2xl bg-card p-8 shadow-elegant">
        <Link to="/" className="flex items-center justify-center gap-2 mb-6">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-hero text-primary-foreground">
            <Trophy className="h-6 w-6" />
          </div>
        </Link>
        <h1 className="text-2xl font-bold text-center mb-1">Admin Access</h1>
        <p className="text-center text-sm text-muted-foreground mb-6">
          Sign in to manage courses, events, and scores
        </p>

        <Tabs defaultValue="signin">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="signin">Sign in</TabsTrigger>
            <TabsTrigger value="signup">Sign up</TabsTrigger>
          </TabsList>

          {(["signin", "signup"] as const).map((mode) => (
            <TabsContent key={mode} value={mode} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor={`${mode}-email`}>Email</Label>
                <Input
                  id={`${mode}-email`}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@school.edu"
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${mode}-password`}>Password</Label>
                <Input
                  id={`${mode}-password`}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                />
              </div>
              <Button className="w-full" onClick={() => handle(mode)} disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {mode === "signin" ? "Sign in" : "Create account"}
              </Button>
            </TabsContent>
          ))}
        </Tabs>

        <Link to="/" className="block text-center text-sm text-muted-foreground hover:text-foreground mt-6">
          ← Back to dashboard
        </Link>
      </div>
    </div>
  );
}
