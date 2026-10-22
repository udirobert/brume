/**
 * Header — logo + Progress + auth.
 *
 * Mobile: bottom tab bar handles nav, header is logo + sign in.
 * Desktop: logo + Progress + Profile/sign in.
 *
 * Session is not a nav destination — it starts from the check-in on Home.
 * No community link (dead). Wallet lives on /profile.
 */
import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sparkles, BarChart3, User, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAuthStatus } from "@/stores/authStore";
import { cn } from "@/lib/utils";

interface HeaderProps {
  className?: string;
}

const Header: React.FC<HeaderProps> = ({ className }) => {
  const location = useLocation();
  const { logout } = useAuth();
  const { isAuthenticated, isLoading } = useAuthStatus();

  const navLink = (path: string, label: string, icon: React.ElementType) => {
    const isActive = location.pathname === path;
    return (
      <Link to={path}>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "flex items-center gap-2 rounded-full",
            isActive ? "text-foreground bg-foreground/5" : "text-muted-foreground",
          )}
        >
          {React.createElement(icon, { className: "w-4 h-4" })}
          {label}
        </Button>
      </Link>
    );
  };

  return (
    <header
      className={cn(
        "w-full sticky top-0 z-50 border-b border-border/30 bg-transparent backdrop-blur-md",
        className,
      )}
    >
      <nav className="container mx-auto px-4 py-3 flex justify-between items-center">
        <Link
          to="/"
          className="flex items-center gap-2 font-bold text-primary hover:opacity-80 transition-opacity text-lg"
        >
          <div className="rounded bg-primary/10 p-1">
            <Sparkles className="w-4 h-4" />
          </div>
          <span>Brume</span>
        </Link>

        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-2">
            {navLink("/progress", "Progress", BarChart3)}
            {isAuthenticated && navLink("/profile", "Profile", User)}
          </div>
          {isAuthenticated ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => logout()}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          ) : isLoading ? (
            // Session still resolving — don't flash "Sign in" at a signed-in user.
            <div className="h-8 w-16 rounded-full bg-foreground/5" aria-hidden="true" />
          ) : (
            <Link
              to="/auth"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5"
            >
              Sign in
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
};

export default Header;
export { Header };
export type { HeaderProps };
