import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "../ui/button";
import { Heart, BarChart3, User, Wind } from "lucide-react";

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  isActive: boolean;
  color: string;
  activeColor: string;
  description: string;
  badge?: string;
}

const getNavItems = (user: any, locationPathname: string): NavItem[] => [
  {
    id: "home",
    label: "Home",
    icon: Heart,
    path: "/",
    isActive: locationPathname === "/",
    color: "",
    activeColor: "",
    description: "How you feel today",
  },
  {
    id: "progress",
    label: "Progress",
    icon: BarChart3,
    path: "/progress",
    isActive: locationPathname.startsWith("/progress"),
    color: "",
    activeColor: "",
    description: "Your practice",
  },
  {
    id: "decompress",
    label: "Decompress",
    icon: Wind,
    path: "/decompress",
    isActive: locationPathname.startsWith("/decompress"),
    color: "",
    activeColor: "",
    description: "Two minutes, no explaining",
  },
  {
    id: "profile",
    label: user ? "Profile" : "Sign in",
    icon: User,
    path: user ? "/profile" : "/auth",
    isActive: locationPathname === "/profile" || locationPathname === "/auth",
    color: "",
    activeColor: "",
    description: user ? "Your profile and settings" : "Sign in",
  },
];

interface BottomTabBarProps {
  className?: string;
}

export const BottomTabBar: React.FC<BottomTabBarProps> = ({ className }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isMobile = useIsMobile();

  if (!isMobile) {
    return null;
  }

  const hiddenPaths = ["/session", "/post-session", "/auth", "/onboarding"];
  if (hiddenPaths.some((path) => location.pathname.startsWith(path))) {
    return null;
  }

  const triggerHapticFeedback = (type: "subtle" | "gentle" = "subtle") => {
    if ("vibrate" in navigator) {
      switch (type) {
        case "gentle":
          navigator.vibrate([25]);
          break;
        default:
          navigator.vibrate([15]);
      }
    }
  };

  const navItems = getNavItems(user, location.pathname);

  const handleNavigation = (item: NavItem) => {
    if (item.id === "profile" && !user) {
      triggerHapticFeedback("subtle");
      const searchParams = new URLSearchParams();
      searchParams.set("context", "profile");
      searchParams.set("redirect", "/profile");
      navigate(`/auth?${searchParams.toString()}`);
      return;
    }

    triggerHapticFeedback("subtle");
    navigate(item.path);
  };

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50",
        "bg-background/90 backdrop-blur-md border-t border-border/30",
        "safe-area-pb",
        className,
      )}
    >
      <div className="grid grid-cols-4 gap-1 px-2 py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.isActive;

          return (
            <Button
              key={item.id}
              variant="ghost"
              size="sm"
              onClick={() => {
                triggerHapticFeedback("subtle");
                handleNavigation(item);
              }}
              className={cn(
                "flex flex-col items-center gap-1 h-auto py-2 px-1 rounded-full",
                "hover:bg-foreground/5 active:scale-95 transition-all duration-300",
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-5 w-5 transition-colors duration-200" />
              <span
                className={cn(
                  "text-xs leading-none transition-colors duration-200",
                  isActive && "font-medium",
                )}
              >
                {item.label}
              </span>
            </Button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomTabBar;