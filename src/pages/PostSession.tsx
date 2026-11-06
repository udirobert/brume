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
import { BrumeMascot } from "@/components/BrumeMascot";
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

export default function PostSession() {
  const location = useLocation();
  const navigate = useNavigate();
  const { saveSession, history = [] } = useSessionHistory();
  const { user } = useAuth();
  const hasSavedRef = useRef(false);
  const [saveOpen, setSaveOpen] = useState(false);

  const sessionData = useMemo(() => location.state || {}, [location.state]);
  const insight = useMemo(() => {
    const name = sessionData.patternName;
    if (!name) return "";
    const prior = (history || []).filter((s: any) => {
      const pn = s?.pattern_name || s?.patternName;
      return pn === name;
    }).length;
    if (prior <= 1) return `You practised ${name}.`;
    return `You've practised ${name} ${prior} times. The room keeps it.`;
  }, [history, sessionData.patternName]);

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
        restlessnessScore: 0,
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
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <PostSessionCelebration
          metrics={{
            patternName: sessionData.patternName,
            duration: sessionData.sessionDuration || 0,
            cycles: sessionData.cycleCount,
          }}
          patternId={sessionData.patternId}
          checkInIndex={sessionData.checkInIndex ?? null}
          insight={insight || `You practised ${sessionData.patternName}.`}
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
            <BrumeMascot state="proud" size={64} className="mb-2" />
            <SheetTitle className="text-2xl font-bold tracking-tight">
              Keep this practice
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
