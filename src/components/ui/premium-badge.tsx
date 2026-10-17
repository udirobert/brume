/**
 * Premium Badge System - Luxury Visual Language
 * 
 * ENHANCEMENT FIRST: Builds on existing Badge component with premium aesthetics
 * CLEAN: Consistent visual hierarchy across all badge types
 * PREMIUM: Luxury design language that reinforces brand quality
 */

import React from "react";
import { Badge } from "./badge";
import { cn } from "@/lib/utils";
import { 
  Star, 
  Sparkles, 
  Crown, 
  Target, 
  Zap, 
  Heart,
  Moon,
  Sun,
  Coffee,
  Award,
  CheckCircle
} from "lucide-react";

export interface PremiumBadgeProps {
  variant: 
    | "perfect" 
    | "excellent" 
    | "great" 
    | "good" 
    | "contextual"
    | "premium"
    | "featured"
    | "recommended";
  context?: 
    | "morning" 
    | "evening" 
    | "stress" 
    | "energy" 
    | "sleep" 
    | "work" 
    | "focus"
    | "recovery";
  size?: "sm" | "default" | "lg";
  showIcon?: boolean;
  className?: string;
  children?: React.ReactNode;
}

// PREMIUM: Luxury color schemes and styling
const PREMIUM_VARIANTS = {
  perfect: {
    className: "bg-linear-to-r from-amber-500 to-orange-500 text-white border-0 shadow-lg",
    icon: Star,
    iconClassName: "text-white"
  },
  excellent: {
    className: "bg-linear-to-r from-emerald-500 to-teal-500 text-white border-0 shadow-md",
    icon: Award,
    iconClassName: "text-white"
  },
  great: {
    className: "bg-linear-to-r from-blue-500 to-indigo-500 text-white border-0 shadow-md",
    icon: Target,
    iconClassName: "text-white"
  },
  good: {
    className: "bg-linear-to-r from-purple-500 to-pink-500 text-white border-0 shadow-sm",
    icon: CheckCircle,
    iconClassName: "text-white"
  },
  contextual: {
    className: "bg-linear-to-r from-slate-600 to-slate-700 text-white border-0",
    icon: Sparkles,
    iconClassName: "text-white"
  },
  premium: {
    className: "bg-linear-to-r from-yellow-400 to-amber-500 text-black border-0 shadow-lg font-semibold",
    icon: Crown,
    iconClassName: "text-black"
  },
  featured: {
    className: "bg-linear-to-r from-rose-500 to-pink-500 text-white border-0 shadow-md",
    icon: Star,
    iconClassName: "text-white"
  },
  recommended: {
    className: "bg-linear-to-r from-gray-500 to-gray-600 text-white border-0",
    icon: Heart,
    iconClassName: "text-white"
  }
} as const;

// CONTEXTUAL: Context-specific styling
const CONTEXTUAL_VARIANTS = {
  morning: {
    className: "bg-linear-to-r from-orange-400 to-yellow-500 text-white border-0",
    icon: Sun,
    iconClassName: "text-white"
  },
  evening: {
    className: "bg-linear-to-r from-indigo-500 to-purple-600 text-white border-0",
    icon: Moon,
    iconClassName: "text-white"
  },
  stress: {
    className: "bg-linear-to-r from-red-500 to-pink-500 text-white border-0",
    icon: Heart,
    iconClassName: "text-white"
  },
  energy: {
    className: "bg-linear-to-r from-green-500 to-emerald-500 text-white border-0",
    icon: Zap,
    iconClassName: "text-white"
  },
  sleep: {
    className: "bg-linear-to-r from-blue-600 to-indigo-700 text-white border-0",
    icon: Moon,
    iconClassName: "text-white"
  },
  work: {
    className: "bg-linear-to-r from-gray-600 to-slate-700 text-white border-0",
    icon: Coffee,
    iconClassName: "text-white"
  },
  focus: {
    className: "bg-linear-to-r from-cyan-500 to-blue-500 text-white border-0",
    icon: Target,
    iconClassName: "text-white"
  },
  recovery: {
    className: "bg-linear-to-r from-teal-500 to-green-600 text-white border-0",
    icon: Heart,
    iconClassName: "text-white"
  }
} as const;

const SIZE_STYLES = {
  sm: {
    className: "text-xs px-2 py-0.5",
    iconSize: "h-3 w-3"
  },
  default: {
    className: "text-xs px-2.5 py-1",
    iconSize: "h-3.5 w-3.5"
  },
  lg: {
    className: "text-sm px-3 py-1.5",
    iconSize: "h-4 w-4"
  }
} as const;

export const PremiumBadge: React.FC<PremiumBadgeProps> = ({
  variant,
  context,
  size = "default",
  showIcon = true,
  className,
  children
}) => {
  // CLEAN: Determine styling based on variant and context
  const styleConfig = context && variant === "contextual" 
    ? CONTEXTUAL_VARIANTS[context]
    : PREMIUM_VARIANTS[variant];
    
  const sizeConfig = SIZE_STYLES[size];
  const Icon = styleConfig.icon;

  return (
    <Badge
      className={cn(
        styleConfig.className,
        sizeConfig.className,
        "font-medium tracking-wide transition-all duration-200 hover:scale-105",
        className
      )}
    >
      {showIcon && Icon && (
        <Icon className={cn(sizeConfig.iconSize, styleConfig.iconClassName, "mr-1")} />
      )}
      {children}
    </Badge>
  );
};

// MODULAR: Predefined premium badges for common use cases
export const PerfectBadge: React.FC<Omit<PremiumBadgeProps, 'variant'>> = (props) => (
  <PremiumBadge variant="perfect" {...props}>Perfect for you</PremiumBadge>
);

export const ExcellentBadge: React.FC<Omit<PremiumBadgeProps, 'variant'>> = (props) => (
  <PremiumBadge variant="excellent" {...props}>Excellent match</PremiumBadge>
);

export const GreatBadge: React.FC<Omit<PremiumBadgeProps, 'variant'>> = (props) => (
  <PremiumBadge variant="great" {...props}>Great match</PremiumBadge>
);

export const ContextualBadge: React.FC<{
  context: NonNullable<PremiumBadgeProps['context']>;
  size?: PremiumBadgeProps['size'];
  className?: string;
}> = ({ context, size, className }) => {
  const contextLabels = {
    morning: "Morning boost",
    evening: "Evening calm", 
    stress: "Stress relief",
    energy: "Energy boost",
    sleep: "Sleep ready",
    work: "Work break",
    focus: "Focus enhancer",
    recovery: "Rest & restore"
  };

  return (
    <PremiumBadge 
      variant="contextual" 
      context={context}
      size={size}
      className={className}
    >
      {contextLabels[context]}
    </PremiumBadge>
  );
};

export default PremiumBadge;