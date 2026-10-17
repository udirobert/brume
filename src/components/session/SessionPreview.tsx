/**
 * SessionPreview — camera permission, then breathe.
 *
 * One screen. The state check-in already picked the pattern; we show why,
 * ask for the camera, and start. Face mesh is the warmup ritual
 * ("Brume can see you"). The breath itself is orb-only.
 */
import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "../ui/button";
import { ContextCards } from "@/components/primitives/ContextCard";
import { HandsFreeDemo } from "./HandsFreeDemo";
import { useCameraStore } from "../../stores/cameraStore";
import { Camera, Loader2, AlertCircle } from "lucide-react";

interface SessionPreviewProps {
  patternName: string;
  pattern: {
    name: string;
    phases: {
      inhale: number;
      hold?: number;
      exhale: number;
      pause?: number;
    };
    benefits?: string[];
    description?: string;
  };
  onStart: (cameraEnabled: boolean) => void;
  onCancel?: () => void;
  enableCamera: boolean;
  /** Session-level error (e.g. unavailable pattern) — rendered as an alert, distinct from camera request errors. */
  sessionError?: string | null;
  /** Parent-owned camera acquisition (useSession.requestCamera). Falls back to the raw camera-store request for standalone/SSR use. */
  onEnableCamera?: () => Promise<MediaStream | null>;
  /** Live camera + face-mesh capture, owned by the parent so the video element survives into the session. */
  capture?: React.ReactNode;
}

export const SessionPreview: React.FC<SessionPreviewProps> = ({
  patternName,
  pattern,
  onStart,
  onCancel,
  enableCamera,
  sessionError,
  onEnableCamera,
  capture,
}) => {
  const location = useLocation();
  const reason = (location.state as { reason?: string; reasonDetail?: string; source?: string } | null)?.reason;
  const reasonDetail = (location.state as { reason?: string; reasonDetail?: string; source?: string } | null)?.reasonDetail;
  const source =
    (location.state as { source?: string } | null)?.source || "Your check-in · breath science";

  const {
    stream: cameraStream,
    status: cameraStatus,
    error: cameraError,
    requestStream: requestCameraStream,
  } = useCameraStore();

  const [isInitializing, setIsInitializing] = useState(false);
  const [errorState, setErrorState] = useState<string | null>(null);

  useEffect(() => {
    if (cameraError) setErrorState(cameraError);
  }, [cameraError]);

  const handleRequestCamera = async () => {
    try {
      setIsInitializing(true);
      setErrorState(null);
      const stream = await (onEnableCamera ?? requestCameraStream)();
      if (!stream) throw new Error("Camera stream not available");
    } catch (error) {
      let message = "Camera setup failed.";
      if (error instanceof Error) {
        if (error.name === "NotAllowedError") {
          message = "Camera access denied. You can still breathe — the session just won't see you.";
        } else if (error.name === "NotFoundError") {
          message = "No camera found. You can still breathe — the session just won't see you.";
        } else if (error.name === "NotReadableError") {
          message = "Camera is in use by another app.";
        }
      }
      setErrorState(message);
    } finally {
      setIsInitializing(false);
    }
  };

  const phases = `${pattern.phases.inhale}s in · ${pattern.phases.hold || 0}s hold · ${pattern.phases.exhale}s out`;

  return (
    <div className="flex-grow flex flex-col items-center justify-center p-6 space-y-8">
      <div className="text-center space-y-2 max-w-md">
        <h2 className="text-3xl font-light tracking-tight text-foreground">{patternName}</h2>
        <p className="text-sm text-muted-foreground font-mono">{phases}</p>
      </div>

      {sessionError && (
        <div
          role="alert"
          className="flex items-start gap-2 text-sm text-destructive max-w-sm"
        >
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{sessionError}</span>
        </div>
      )}

      {(reason || reasonDetail) && (
        <ContextCards
          className="max-w-sm"
          chunks={[
            {
              title: reason || patternName,
              body: reasonDetail || pattern.description || "A pattern matched to how you feel right now.",
              source,
            },
          ]}
        />
      )}

      {enableCamera && (
        <div className="space-y-3 w-full max-w-sm">
          <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black/80 shadow-lg ring-1 ring-white/10">
            {cameraStream && capture ? (
              capture
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70">
                {cameraStatus === "requesting" || isInitializing ? (
                  <Loader2 className="h-8 w-8 animate-spin" />
                ) : (
                  <Camera className="h-8 w-8 opacity-50" />
                )}
                <p className="mt-2 text-sm">
                  {cameraStatus === "permission-denied"
                    ? "Camera access denied"
                    : "Optional camera feedback"}
                </p>
              </div>
            )}
          </div>
          {errorState && (
            <div className="flex items-start gap-2 text-sm text-destructive">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{errorState}</span>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col items-center gap-3 w-full max-w-xs">
        {enableCamera && !cameraStream && (
          <p className="text-xs text-muted-foreground/70 text-center px-2">
            Optional camera feedback sends image frames to Brume's backend for
            processing. You can practise without it.
          </p>
        )}
        {enableCamera && !cameraStream && (
          <Button
            onClick={handleRequestCamera}
            size="lg"
            className="w-full rounded-full btn-premium py-6"
            disabled={isInitializing || cameraStatus === "requesting"}
          >
            {(isInitializing || cameraStatus === "requesting") && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            <Camera className="mr-2 h-4 w-4" />
            Enable camera
          </Button>
        )}

        <Button
          onClick={() => onStart(enableCamera && !!cameraStream)}
          size="lg"
          className="w-full rounded-full btn-premium py-6"
          variant={enableCamera && !cameraStream ? "outline" : "default"}
        >
          {cameraStream ? "Begin" : "Breathe without camera"}
        </Button>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Not now
          </button>
        )}

        <HandsFreeDemo />
      </div>
    </div>
  );
};

export default SessionPreview;
