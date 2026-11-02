import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useOfflineManager } from "@/lib/offline/OfflineManager";
import {
  Wifi,
  WifiOff,
  Cloud,
  CloudOff,
  RefreshCw,
  Download,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrumeMascot } from "@/components/BrumeMascot";

interface OfflineIndicatorProps {
  className?: string;
  showDetails?: boolean;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  className,
  showDetails = false,
}) => {
  const { syncStatus, forcSync } = useOfflineManager();
  const [isSyncing, setIsSyncing] = React.useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await forcSync();
    } finally {
      setIsSyncing(false);
    }
  };

  const formatLastSync = (date: Date) => {
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  if (!showDetails) {
    // Simple indicator
    return (
      <Badge
        variant={syncStatus.isOnline ? "default" : "secondary"}
        className={cn("flex items-center gap-1", className)}
      >
        {syncStatus.isOnline ? (
          <Wifi className="h-3 w-3" />
        ) : (
          <WifiOff className="h-3 w-3" />
        )}
        {syncStatus.isOnline ? 'Online' : 'Offline'}
        {syncStatus.pendingSessions > 0 && (
          <span className="ml-1 bg-orange-500 text-white rounded-full px-1 text-xs">
            {syncStatus.pendingSessions}
          </span>
        )}
      </Badge>
    );
  }

  // Detailed view
  return (
    <div className={cn("space-y-3", className)}>
      {/* Connection Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {syncStatus.isOnline ? (
            <Cloud className="h-4 w-4 text-green-600" />
          ) : (
            <CloudOff className="h-4 w-4 text-orange-600" />
          )}
          <span className="font-medium">
            {syncStatus.isOnline ? 'Connected' : 'Offline Mode'}
          </span>
        </div>
        
        {syncStatus.isOnline && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSync}
            disabled={isSyncing}
            className="h-8 px-2"
          >
            <RefreshCw className={cn("h-3 w-3", isSyncing && "animate-spin")} />
          </Button>
        )}
      </div>

      {/* Sync Status */}
      <div className="text-sm text-muted-foreground space-y-1">
        <div className="flex justify-between">
          <span>Last sync:</span>
          <span>{formatLastSync(syncStatus.lastSyncTime)}</span>
        </div>
        
        {syncStatus.pendingSessions > 0 && (
          <div className="flex justify-between">
            <span>Pending sessions:</span>
            <Badge variant="outline" className="text-xs">
              {syncStatus.pendingSessions}
            </Badge>
          </div>
        )}
      </div>

      {/* Offline Notice */}
      {!syncStatus.isOnline && (
        <Alert>
          <BrumeMascot state="sleepy" size={40} />
          <Download className="h-4 w-4" />
          <AlertDescription className="text-xs">
            You're offline. Breathing still works.
            Core breathing features remain available.
          </AlertDescription>
        </Alert>
      )}

      {/* Pending Sync Notice */}
      {syncStatus.isOnline && syncStatus.pendingSessions > 0 && (
        <Alert>
          <Upload className="h-4 w-4" />
          <AlertDescription className="text-xs">
            {syncStatus.pendingSessions} session{syncStatus.pendingSessions > 1 ? 's' : ''} waiting to sync.
            <Button
              variant="link"
              size="sm"
              onClick={handleSync}
              disabled={isSyncing}
              className="h-auto p-0 ml-1 text-xs"
            >
              Sync now
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default OfflineIndicator;