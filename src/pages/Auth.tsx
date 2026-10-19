/**
 * Dedicated sign-in. Email first. Wallet is a quiet extra, not a peer door.
 */

import { useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { SignInForm, type SignInIntent } from "@/components/auth/SignInForm";
import { MistField } from "@/components/atmosphere/MistField";
import { ProgressiveBlur } from "@/components/atmosphere/ProgressiveBlur";
import { BrumeMascot } from "@/components/BrumeMascot";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

function intentFromSearch(searchParams: URLSearchParams): SignInIntent {
  const context = searchParams.get("context");
  const redirect = searchParams.get("redirect") || "";

  if (context === "onboarding") return "onboarding";
  if (
    context === "progress-tracking" ||
    redirect.includes("/progress") ||
    redirect.includes("post-session")
  ) {
    return "progress";
  }
  return "signin";
}

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, loading } = useAuth();

  const redirectTo = searchParams.get("redirect") || "/";
  const intent = intentFromSearch(searchParams);
  const defaultSignUp = intent === "progress";

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate(redirectTo, { replace: true });
    }
  }, [loading, isAuthenticated, navigate, redirectTo]);

  const handleAuthComplete = (authType?: string) => {
    if (authType === "email") {
      toast.success("Signed in. Your practice is saved.");
    } else if (authType === "wallet") {
      toast.success("Wallet connected.");
    }

    navigate(redirectTo);
  };

  if (!loading && isAuthenticated) {
    return <div className="min-h-screen bg-calm-gradient" />;
  }

  return (
    <div className="relative min-h-screen bg-calm-gradient flex flex-col items-center justify-center px-6 py-12">
      <MistField />
      <ProgressiveBlur />

      <div className="relative z-10 flex flex-col items-center">
        <BrumeMascot state="idle" size={88} className="mb-6" />
        <SignInForm
          intent={intent}
          defaultSignUp={defaultSignUp}
          onComplete={handleAuthComplete}
        />

        <Link
          to="/"
          className="mt-10 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Back to practice
        </Link>
      </div>
    </div>
  );
};

export default Auth;
