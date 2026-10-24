import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion, useReducedMotion } from "framer-motion";
import { Sparkles, Camera, ShieldCheck } from "lucide-react";
import BreathingAnimation from "@/components/BreathingAnimation";
import { BrumeMascot } from "@/components/BrumeMascot";

/**
 * Onboarding — single screen, one breath away.
 *
 * The old 4-slide marketing deck is gone. A breathwork app's onboarding
 * should get you to a breath, not through a slideshow. The user lands,
 * sees the mist orb, understands the breathing rhythm, and starts without
 * an account. Account creation is deferred until after the first session.
 *
 * The orb is shown in "prepare" mode — no breath signal, dim and
 * mechanical. When they start a camera-enabled session, it comes alive.
 * That contrast IS the pitch.
 */
export default function Onboarding() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion() || (typeof document !== "undefined" && document.hidden);

  return (
    <div className="min-h-screen bg-calm-gradient flex flex-col items-center justify-center px-6 py-4 sm:py-12">
      {/* Ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-72 h-72 bg-primary/15 rounded-full blur-[120px] -z-10" />

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md flex flex-col items-center text-center space-y-5 sm:space-y-8"
      >
        {/* The mist orb — idle, waiting. This is the visual hook. */}
        <div className="relative">
          <BreathingAnimation
            phase="prepare"
            isActive={false}
            pattern={{
              name: "Reset",
              phases: { inhale: 4, hold: 0, exhale: 6, hold_after_exhale: 0 },
            }}
            compactMode
          />
          <BrumeMascot
            state="idle"
            size={72}
            className="absolute -bottom-3 -right-3"
          />
        </div>

        <div className="space-y-3">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-[1.1]">
            Take a moment
            <br />
            <span className="text-gradient">to breathe.</span>
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-sm mx-auto leading-relaxed">
            Follow a gentle 4-in, 6-out rhythm. No signup needed, and camera
            feedback is always optional.
          </p>
        </div>

        {/* Trust badges — compact, not slides */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Camera className="w-3.5 h-3.5" />
            Camera optional
          </span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            No signup needed
          </span>
        </div>

        <div className="flex flex-col items-center gap-3 pt-2 w-full">
          <Button
            size="lg"
            className="btn-premium rounded-full px-16 py-7 text-lg w-full max-w-xs"
            onClick={() => navigate("/session?pattern=reset")}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Start my reset
          </Button>
          <button
            onClick={() => navigate("/auth?context=onboarding")}
            className="text-sm text-muted-foreground hover:text-primary transition-colors underline underline-offset-4"
          >
            Already have an account? Sign in
          </button>
        </div>

        <p className="text-xs text-muted-foreground/70 pt-2">
          By continuing, you agree to our{" "}
          <a href="/terms" className="underline underline-offset-4">Terms</a>.
        </p>
      </motion.div>
    </div>
  );
}
