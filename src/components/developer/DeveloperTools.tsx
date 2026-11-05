/**
 * Developer Tools Component
 * ENHANCEMENT: Provides easy access to developer overrides and debugging
 * CLEAN: Centralized developer utilities
 * MODULAR: Composable developer interface
 */

import React, { useState, useEffect } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
// Dev-only glyphs — the product set stays in components/icons/BrumeIcons;
// these draw themselves so this panel needs no icon dependency.
const devIcon = (paths: string[]) =>
  function Icon({ className }: { className?: string }) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
        {paths.map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
    );
  };
const Settings = devIcon([
  "M12 9.3a2.7 2.7 0 1 0 0 5.4 2.7 2.7 0 0 0 0-5.4z",
  "M12 3.6v2.1", "M12 18.3v2.1", "M3.6 12h2.1", "M18.3 12h2.1",
  "M6.1 6.1l1.5 1.5", "M16.4 16.4l1.5 1.5", "M17.9 6.1l-1.5 1.5", "M7.6 16.4l-1.5 1.5",
]);
const Crown = devIcon(["M5 16.5h14", "M6 16.5L4.6 8.6l4.4 3.4L12 6.2l3 5.8 4.4-3.4L18 16.5z"]);
const Sparkles = devIcon(["M12 4.5l1.6 4.4 4.4 1.6-4.4 1.6L12 16.5l-1.6-4.4-4.4-1.6 4.4-1.6z"]);
const Zap = devIcon(["M13 3.5L5.6 13.4H11l-1 7.1 7.4-9.9H12z"]);
const RefreshCw = devIcon(["M20 12a8 8 0 1 1-2.4-5.6", "M20 3.4v4h-4"]);
const Trash2 = devIcon(["M4.5 6.5h15", "M9.2 6.5V4.9a1.3 1.3 0 0 1 1.3-1.3h3a1.3 1.3 0 0 1 1.3 1.3v1.6", "M7 6.5l1 13h8l1-13"]);
const Info = devIcon(["M12 20a8 8 0 1 1 0-16 8 8 0 0 1 0 16z", "M12 11v5", "M12 7.9v.1"]);
const CheckCircle = devIcon(["M12 20a8 8 0 1 1 0-16 8 8 0 0 1 0 16z", "M8.6 12.3l2.4 2.4 4.6-4.9"]);
import {
  getDeveloperOverride,
  setDeveloperOverride,
  clearDeveloperOverride,
} from "@/lib/monetization/revenueCatConfig";
import { revenueCatService } from "@/lib/monetization/revenueCat";

interface DeveloperToolsProps {
  className?: string;
}

export const DeveloperTools: React.FC<DeveloperToolsProps> = ({
  className,
}) => {
  const [override, setOverride] = useState(getDeveloperOverride());
  const [selectedTier, setSelectedTier] = useState<"basic" | "premium" | "pro">(
    "pro",
  );
  const [configStatus, setConfigStatus] = useState<{
    isAvailable: boolean;
    isInitialized: boolean;
    error: string | null;
  } | null>(null);

  // Refresh override status
  const refreshOverride = async () => {
    setOverride(getDeveloperOverride());
    try {
      const isAvailable = revenueCatService.isRevenueCatAvailable();
      await revenueCatService.initialize();
      setConfigStatus({
        isAvailable,
        isInitialized: true,
        error: null,
      });
    } catch (error) {
      setConfigStatus({
        isAvailable: false,
        isInitialized: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  useEffect(() => {
    refreshOverride();
  }, []);

  const handleSetOverride = () => {
    setDeveloperOverride(selectedTier);
    refreshOverride();
  };

  const handleClearOverride = () => {
    clearDeveloperOverride();
    refreshOverride();
  };

  const tierIcons = {
    basic: Zap,
    premium: Sparkles,
    pro: Crown,
  };

  const tierColors = {
    basic: "bg-gray-500",
    premium: "bg-blue-500",
    pro: "bg-purple-500",
  };

  // Only show in development
  if (!import.meta.env.DEV) {
    return null;
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Developer Tools
        </CardTitle>
        <CardDescription>
          Override subscription tiers and debug RevenueCat configuration
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Current Override Status */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Current Override Status</h4>
          {override.enabled ? (
            <div className="flex items-center gap-2">
              <Badge className={tierColors[override.tier]}>
                {React.createElement(tierIcons[override.tier], {
                  className: "h-3 w-3 mr-1",
                })}
                {override.tier.toUpperCase()}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {override.reason}
              </span>
            </div>
          ) : (
            <Badge variant="outline">
              <CheckCircle className="h-3 w-3 mr-1" />
              No Override Active
            </Badge>
          )}
        </div>

        {/* Set Override */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Set Developer Override</h4>
          <div className="flex gap-2">
            <Select
              value={selectedTier}
              onValueChange={(value: "basic" | "premium" | "pro") => setSelectedTier(value)}
            >
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="basic">Basic (Free)</SelectItem>
                <SelectItem value="premium">Premium ($4.99/month)</SelectItem>
                <SelectItem value="pro">Pro ($9.99/month)</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleSetOverride} size="sm">
              Set Override
            </Button>
          </div>
        </div>

        {/* Clear Override */}
        {override.enabled && (
          <Button
            onClick={handleClearOverride}
            variant="outline"
            size="sm"
            className="w-full"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear Override
          </Button>
        )}

        {/* Configuration Status */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium">RevenueCat Status</h4>
            <Button onClick={refreshOverride} variant="ghost" size="sm">
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>

          {configStatus && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-medium">Available:</span>
                <Badge
                  variant={configStatus.isAvailable ? "default" : "destructive"}
                >
                  {configStatus.isAvailable ? "Yes" : "No"}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="font-medium">Initialized:</span>
                <Badge
                  variant={configStatus.isInitialized ? "default" : "secondary"}
                >
                  {configStatus.isInitialized ? "Yes" : "No"}
                </Badge>
              </div>
              {configStatus.error && (
                <div className="text-xs text-muted-foreground">
                  Error: {configStatus.error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Usage Instructions */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-xs">
            <strong>Usage:</strong> Set an override to test premium features
            locally. The override persists in localStorage until cleared. This
            only works in development mode.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};

export default DeveloperTools;
