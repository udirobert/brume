import { useAuth } from "../hooks/useAuth";
import { useLens } from "../hooks/useLens";
import { useFlow } from "../hooks/useFlow";
import { useNavigate, Link } from "react-router-dom";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  BarChart3,
  CreditCard,
  Palette,
  Shield,
  LogOut,
  HelpCircle,
  ChevronRight,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { BrumeMascot } from "@/components/BrumeMascot";
import { cn } from "@/lib/utils";

/**
 * Profile — Brume's own space, not an account dashboard.
 *
 * The mascot is the portrait: Brume keeps your place, so Brume is who you
 * see. Everything else is quiet — two ways in (practice, premium) and a
 * short list of settings. No wallet section: a wallet is something you
 * attach on purpose, and touching it here woke the wallet up unasked.
 */

const THEME_LABEL: Record<string, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};

const UserProfilePage = () => {
  const { user, profile, loading: authLoading, signOut } = useAuth();
  // Lens stays quiet infrastructure: disconnected on sign-out, never displayed.
  const { isAuthenticating, logout: lensLogout } = useLens();
  const { disconnect: flowDisconnect } = useFlow();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  const cycleTheme = () => {
    if (theme === "system") setTheme("light");
    else if (theme === "light") setTheme("dark");
    else setTheme("system");
  };

  const handleSignOut = async () => {
    try {
      await Promise.all([signOut(), lensLogout(), flowDisconnect()]);
      toast.success("Signed out successfully");
      navigate("/");
    } catch (error) {
      toast.error("Failed to sign out completely");
      console.error("Sign out error:", error);
    }
  };

  const isLoading = authLoading || isAuthenticating;

  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex items-center space-x-4 mb-6">
          <Skeleton className="h-24 w-24 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-6 w-64" />
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return (
      <div className="container mx-auto p-4 text-center space-y-4">
        <p className="text-muted-foreground">Sign in to see your profile.</p>
        <Button asChild>
          <Link to="/auth?redirect=/profile">Sign in</Link>
        </Button>
      </div>
    );
  }

  const displayName = user.profile.name || user.profile.username || "Your practice";
  const tierLabel =
    user.tier === "premium" || user.tier === "pro" ? "Premium" : "Free";

  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center px-2 py-6">
      {/* Brume is the portrait — the mascot carries the page, not an avatar. */}
      <div className="relative">
        <div
          className="absolute inset-0 -z-10 rounded-full bg-primary/15 blur-3xl scale-150"
          aria-hidden="true"
        />
        <BrumeMascot state="proud" size={116} />
        {user.profile.avatar && (
          <Avatar className="absolute -bottom-1 -right-1 h-11 w-11 border-2 border-background">
            <AvatarImage src={user.profile.avatar} alt={displayName} />
            <AvatarFallback>
              {displayName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        )}
      </div>

      <h1 className="mt-4 text-3xl font-bold tracking-tight text-center">
        {displayName}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground text-center break-all">
        {user.email}
      </p>
      <span className="mt-3 badge-premium">{tierLabel}</span>

      {/* Two ways in. Nothing else competes with them. */}
      <div className="mt-9 grid w-full grid-cols-2 gap-3">
        <ProfileAction
          to="/progress"
          icon={BarChart3}
          title="Progress"
          copy="Your sessions"
        />
        <ProfileAction
          to="/subscription"
          icon={CreditCard}
          title="Premium"
          copy={tierLabel === "Premium" ? "Manage" : "Unlock more"}
        />
      </div>

      {/* Settings — one quiet list, no card chrome. */}
      <div className="mt-9 w-full overflow-hidden rounded-2xl border border-border/70 bg-card/70 backdrop-blur-sm divide-y divide-border/60">
        <SettingsRow
          icon={Palette}
          label="Theme"
          value={THEME_LABEL[theme ?? "system"] ?? "System"}
          onClick={cycleTheme}
        />
        <SettingsRow icon={Shield} label="Privacy Policy" to="/privacy" />
        <SettingsRow icon={HelpCircle} label="Terms of Service" to="/terms" />
        <SettingsRow
          icon={LogOut}
          label="Sign out"
          destructive
          onClick={handleSignOut}
        />
      </div>

      <p className="mt-6 text-xs text-muted-foreground/70 text-center">
        Your practice stays with you. Sessions live on Progress — video never
        left your phone.
      </p>
    </div>
  );
};

function ProfileAction({
  to,
  icon: Icon,
  title,
  copy,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  copy: string;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "group flex flex-col items-start gap-1 rounded-2xl border border-border/70 bg-card/70 p-4",
        "backdrop-blur-sm transition-all duration-300",
        "hover:border-primary/40 hover:bg-primary/5",
      )}
    >
      <Icon className="h-5 w-5 text-primary" />
      <span className="mt-2 text-sm font-semibold">{title}</span>
      <span className="text-xs text-muted-foreground">{copy}</span>
    </Link>
  );
}

function SettingsRow({
  icon: Icon,
  label,
  value,
  to,
  onClick,
  destructive,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value?: string;
  to?: string;
  onClick?: () => void;
  destructive?: boolean;
}) {
  const inner = (
    <>
      <span className="flex items-center gap-3">
        <Icon className={cn("h-4 w-4", destructive ? "text-destructive" : "text-muted-foreground")} />
        <span className={cn("text-sm", destructive && "text-destructive")}>
          {label}
        </span>
      </span>
      {value ? (
        <span className="text-xs text-muted-foreground capitalize">{value}</span>
      ) : to ? (
        <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
      ) : null}
    </>
  );

  const className = cn(
    "flex w-full items-center justify-between px-4 py-3.5 text-left",
    "transition-colors hover:bg-foreground/5",
  );

  if (to) {
    return (
      <Link to={to} className={className}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {inner}
    </button>
  );
}

export default UserProfilePage;
