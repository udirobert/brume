/**
 * PostSession — the single post-session surface.
 *
 * Replaces the 1162-line Results.tsx dashboard. The post-session moment
 * is: land, see the stillness, go. Verification is a quiet property of
 * the record, not the landing job. No tabs, no agent traces.
 *
 * Session data arrives via router state from SessionModeWrapper.
 */
import React, { useEffect, useRef, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { PostSessionCelebration } from "@/components/session/PostSessionCelebration";
import { SignInForm } from "@/components/auth/SignInForm";
import { useSessionHistory } from "@/hooks/useSessionHistory";
import { useAuth } from "@/hooks/useAuth";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";

export default function PostSession() {
  const location = useLocation();
  const navigate = useNavigate();
  const { streak, saveSession } = useSessionHistory();
  const { user } = useAuth();
  const hasSavedRef = useRef(false);
  const [saveOpen, setSaveOpen] = useState(false);

  const sessionData = useMemo(() => location.state || {}, [location.state]);

  // Save once on mount. Guests are already persisted by SessionModeWrapper.
  useEffect(() => {
    if (!sessionData.patternName || hasSavedRef.current) return;
    if (!user && sessionData.sessionId) {
      hasSavedRef.current = true;
      return;
    }
    try {
      saveSession({
        breathHoldTime: sessionData.breathHoldTime || 0,
        restlessnessScore: sessionData.restlessnessScore || 0,
        sessionDuration: sessionData.sessionDuration || 0,
        patternName: sessionData.patternName,
      });
      hasSavedRef.current = true;
    } catch (error) {
      console.error("Failed to save session", error);
    }
  }, [sessionData, saveSession, user]);

  if (!sessionData.patternName) {
    // No session data — redirect home
    return <NavigateFallback />;
  }

  return (
    <div className="min-h-screen bg-calm-gradient flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <PostSessionCelebration
          metrics={{
            patternName: sessionData.patternName,
            duration: sessionData.sessionDuration || 0,
            cycles: sessionData.cycleCount,
            streak,
          }}
          patternId={sessionData.patternId}
          insight={`You practised ${sessionData.patternName}.`}
          isGuest={!user}
          onContinue={() => navigate("/")}
          onSeeProgress={() => navigate("/progress")}
          onSaveProgress={() => setSaveOpen(true)}
          onClose={() => navigate("/")}
        />
      </div>

      <Sheet open={saveOpen} onOpenChange={setSaveOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-[2rem] border-t px-6 pb-10 pt-8 max-h-[90vh] overflow-y-auto sm:max-w-md sm:mx-auto"
        >
          <SheetHeader className="text-center space-y-2 mb-6">
            <SheetTitle className="text-2xl font-bold tracking-tight">
              Keep this streak
            </SheetTitle>
            <SheetDescription className="text-[15px]">
              An email is enough. This session stays on screen.
            </SheetDescription>
          </SheetHeader>
          <SignInForm
            compact
            intent="save-session"
            defaultSignUp
            onComplete={() => {
              toast.success("Saved. This streak is yours.");
              setSaveOpen(false);
            }}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}

function NavigateFallback() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate("/", { replace: true });
  }, [navigate]);
  return null;
}
