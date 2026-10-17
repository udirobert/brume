/**
 * Inline Upgrade Component - Premium Feature Access UI
 *
 * ENHANCEMENT: Extends existing SubscriptionManager patterns for inline use
 * CLEAN: Reuses established UI components and styling patterns
 * MODULAR: Composable upgrade UI for any feature context
 * DRY: Single source of truth using existing subscription data
 */

import React from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Crown,
  Sparkles,
  Brain,
  Zap,
  ArrowRight,
  Lock,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SUBSCRIPTION_TIERS } from "@/lib/monetization/revenueCat";
import SubscriptionManager from "./SubscriptionManager";

interface InlineUpgradeProps {
  feature: "ai_analysis" | "ai_coaching" | "streaming_feedback" | "nft_creation";
  className?: string;
  variant?: "minimal" | "card" | "banner";
  onUpgrade?: () => void;
}

// Feature metadata using existing subscription data patterns
const FEATURE_META = {
  ai_analysis: {
    name: "AI Analysis",
    description: "Get personalized insights from your breathing patterns",
    icon: Brain,
    requiredTier: "premium",
    gradient: "from-blue-500 to-purple-600",
    benefits: [
      "Personalized pattern analysis",
      "Health insights & recommendations", 
      "Progress tracking & trends"
    ]
  },
  ai_coaching: {
    name: "AI Coaching",
    description: "Real-time guidance and personalized coaching",
    icon: Sparkles,
    requiredTier: "premium",
    gradient: "from-purple-500 to-pink-600",
    benefits: [
      "Real-time coaching feedback",
      "Adaptive training programs",
      "Performance optimization"
    ]
  },
  streaming_feedback: {
    name: "Live Feedback",
    description: "Real-time breathing pattern feedback",
    icon: Zap,
    requiredTier: "premium",
    gradient: "from-green-500 to-blue-600",
    benefits: [
      "Real-time pattern detection",
      "Instant feedback loops",
      "Live performance metrics"
    ]
  },
  nft_creation: {
    name: "NFT Creation",
    description: "Transform your patterns into unique digital art",
    icon: Crown,
    requiredTier: "premium",
    gradient: "from-yellow-500 to-orange-600",
    benefits: [
      "Unique pattern-based art",
      "Blockchain certification",
      "Collectible achievements"
    ]
  }
};

export const InlineUpgrade: React.FC<InlineUpgradeProps> = ({
  feature,
  className,
  variant = "card",
  onUpgrade,
}) => {
  const meta = FEATURE_META[feature];
  const requiredTier = SUBSCRIPTION_TIERS.find(tier => tier.id === meta.requiredTier);
  const Icon = meta.icon;

  if (!requiredTier) return null;

  const handleUpgradeClick = () => {
    onUpgrade?.();
  };

  // Minimal variant - just a button with icon
  if (variant === "minimal") {
    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "gap-2 border-dashed hover:border-solid transition-all",
              className
            )}
            onClick={handleUpgradeClick}
          >
            <Lock className="h-3 w-3" />
            Upgrade for {meta.name}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto sm:max-w-4xl max-w-[95vw]">
          <DialogHeader>
            <DialogTitle>Unlock {meta.name}</DialogTitle>
            <DialogDescription>
              Upgrade to {requiredTier.name} to access this premium feature
            </DialogDescription>
          </DialogHeader>
          <SubscriptionManager variant="full" showCurrentPlan={false} />
        </DialogContent>
      </Dialog>
    );
  }

  // Banner variant - full width alert-style
  if (variant === "banner") {
    return (
      <Alert className={cn("border-l-4 border-l-primary bg-linear-to-r from-background to-muted/20", className)}>
        <Icon className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between w-full">
          <div>
            <strong>{meta.name}</strong> requires {requiredTier.name} subscription
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm" onClick={handleUpgradeClick}>
                Upgrade Now
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto sm:max-w-4xl max-w-[95vw]">
              <DialogHeader>
                <DialogTitle>Unlock {meta.name}</DialogTitle>
                <DialogDescription>
                  Upgrade to {requiredTier.name} to access this premium feature
                </DialogDescription>
              </DialogHeader>
              <SubscriptionManager variant="full" showCurrentPlan={false} />
            </DialogContent>
          </Dialog>
        </AlertDescription>
      </Alert>
    );
  }

  // Card variant - full featured upgrade card
  return (
    <Card className={cn("relative overflow-hidden", className)}>
      {/* Premium gradient overlay */}
      <div 
        className={cn(
          "absolute inset-0 bg-linear-to-br opacity-5",
          meta.gradient
        )} 
      />
      
      {/* Required tier badge */}
      <div className="absolute top-3 right-3">
        <Badge className="bg-linear-to-r from-purple-600 to-purple-700">
          <Star className="h-3 w-3 mr-1" />
          {requiredTier.name}
        </Badge>
      </div>

      <CardHeader className="relative">
        <div className="flex items-start gap-3">
          <div className={cn(
            "p-2 rounded-lg text-white bg-linear-to-br",
            meta.gradient
          )}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg flex items-center gap-2">
              {meta.name}
              <Lock className="h-4 w-4 text-muted-foreground" />
            </CardTitle>
            <CardDescription className="mt-1">
              {meta.description}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="relative space-y-4">
        {/* Benefits list */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            What you'll get:
          </p>
          <ul className="space-y-1">
            {meta.benefits.map((benefit, index) => (
              <li key={index} className="flex items-center gap-2 text-sm">
                <div className={cn(
                  "h-1.5 w-1.5 rounded-full bg-linear-to-r",
                  meta.gradient
                )} />
                {benefit}
              </li>
            ))}
          </ul>
        </div>

        {/* Pricing info */}
        <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
          <div>
            <p className="text-sm font-medium">{requiredTier.name} Plan</p>
            <p className="text-xs text-muted-foreground">
              {requiredTier.features.length} premium features
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold">{requiredTier.price}</p>
          </div>
        </div>

        {/* Upgrade button */}
        <Dialog>
          <DialogTrigger asChild>
            <Button 
              className={cn(
                "w-full bg-linear-to-r text-white font-medium",
                meta.gradient,
                "hover:opacity-90 transition-opacity"
              )}
              onClick={handleUpgradeClick}
            >
              Upgrade to {requiredTier.name}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto sm:max-w-4xl max-w-[95vw]">
            <DialogHeader>
              <DialogTitle>Unlock {meta.name}</DialogTitle>
              <DialogDescription>
                Upgrade to {requiredTier.name} to access this premium feature and more
              </DialogDescription>
            </DialogHeader>
            <SubscriptionManager variant="full" showCurrentPlan={false} />
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default InlineUpgrade;