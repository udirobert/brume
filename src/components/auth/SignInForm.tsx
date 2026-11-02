import React, { useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, Loader2, Sparkles, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PixelLoader } from "@/components/primitives/PixelLoader";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const Web3AuthIsland = React.lazy(() => import("./Web3AuthIsland"));

export type SignInIntent = "signin" | "save-session" | "progress" | "onboarding";

const COPY: Record<
  SignInIntent,
  { title: string; subtitle: string }
> = {
  signin: {
    title: "Sign in",
    subtitle: "Your practice stays with you.",
  },
  onboarding: {
    title: "Welcome back",
    subtitle: "Pick up where you left off.",
  },
  progress: {
    title: "Save your progress",
    subtitle: "Keep your practice on this device and the next.",
  },
  "save-session": {
    title: "Keep this practice",
    subtitle: "An email is enough. This session stays on screen.",
  },
};

interface SignInFormProps {
  intent?: SignInIntent;
  /** Create-account first (post-session / progress). Sign-in first otherwise. */
  defaultSignUp?: boolean;
  /** Hide the Brume wordmark — use inside a sheet. */
  compact?: boolean;
  showWallet?: boolean;
  onComplete?: (authType?: string) => void;
  className?: string;
}

export function SignInForm({
  intent = "signin",
  defaultSignUp = false,
  compact = false,
  showWallet = true,
  onComplete,
  className,
}: SignInFormProps) {
  const auth = useAuth();
  const copy = COPY[intent];

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(defaultSignUp);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletOpen, setWalletOpen] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email || !password) {
      setError("Enter an email and password.");
      return;
    }
    if (password.length < 6) {
      setError("Password needs at least 6 characters.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = isSignUp
        ? await auth.register(email, password)
        : await auth.login(email, password);

      if (result.success) {
        onComplete?.("email");
      } else {
        setError(result.error || "That didn't work. Try again.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work. Try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (walletOpen) {
    return (
      <div className={cn("w-full max-w-md mx-auto", className)}>
        <React.Suspense
          fallback={
            <div className="flex items-center justify-center min-h-[40vh]">
              <PixelLoader variant="drive" label="Brume" />
            </div>
          }
        >
          <Web3AuthIsland
            method="wallet"
            quiet
            onBack={() => setWalletOpen(false)}
            onWalletContinue={() => onComplete?.("wallet")}
          />
        </React.Suspense>
      </div>
    );
  }

  return (
    <div className={cn("w-full max-w-sm mx-auto", className)}>
      {!compact && (
        <Link
          to="/"
          className="flex items-center justify-center gap-2 font-bold text-primary mb-10 hover:opacity-80 transition-opacity"
        >
          <div className="rounded bg-primary/10 p-1">
            <Sparkles className="w-4 h-4" />
          </div>
          <span className="text-lg">Brume</span>
        </Link>
      )}

      {!compact && (
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight">{copy.title}</h1>
          <p className="text-muted-foreground mt-2 text-[15px] leading-relaxed">
            {copy.subtitle}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="brume-email">Email</Label>
          <Input
            id="brume-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
            className="h-11 rounded-xl"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="brume-password">Password</Label>
          <Input
            id="brume-password"
            type="password"
            autoComplete={isSignUp ? "new-password" : "current-password"}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            className="h-11 rounded-xl"
          />
        </div>

        <Button
          type="submit"
          disabled={isLoading || !email || !password}
          className="w-full rounded-full h-12 btn-premium"
        >
          {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          {isSignUp ? "Create account" : "Sign in"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground mt-5">
        {isSignUp ? "Already have an account?" : "New here?"}{" "}
        <button
          type="button"
          onClick={() => {
            setIsSignUp(!isSignUp);
            setError(null);
          }}
          className="font-medium text-primary hover:underline underline-offset-2"
          disabled={isLoading}
        >
          {isSignUp ? "Sign in" : "Create an account"}
        </button>
      </p>

      {showWallet && (
        <div className="mt-8 pt-6 border-t border-border/60 text-center">
          <button
            type="button"
            onClick={() => setWalletOpen(true)}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Wallet className="h-3.5 w-3.5" />
            or connect a wallet
          </button>
        </div>
      )}

      {!compact && (
        <p className="text-xs text-muted-foreground/70 text-center mt-8">
          By continuing you agree to the{" "}
          <Link to="/terms" className="underline underline-offset-4">
            Terms
          </Link>
          .
        </p>
      )}
    </div>
  );
}

export default SignInForm;
