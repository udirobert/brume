/**
 * Session Entry Points - Clean UI for choosing between session experiences
 *
 * SINGLE RESPONSIBILITY: Present clear choice between session types and patterns
 * DRY: Eliminates duplication between mobile/desktop
 * CLEAN: No mixed concerns, pure presentation logic
 * WELLNESS UX: Promotes delightful pattern discovery and choice
 */

import React from "react";
import { Link } from "react-router-dom";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { isTouchDevice } from "../../utils/mobile-detection";
import { Sparkles, Camera, Zap, Heart } from "lucide-react";

interface SessionEntryPointsProps {
  variant?: "mobile" | "desktop";
  className?: string;
}

export const SessionEntryPoints: React.FC<SessionEntryPointsProps> = ({
  variant,
  className = "",
}) => {
  const isMobile = isTouchDevice();
  const effectiveVariant = variant || (isMobile ? "mobile" : "desktop");

  const sessionTypes = [
    {
      key: "classic",
      title: "Try Breathing",
      description: "Start with guided box breathing - simple and effective",
      badge: "Start Here",
      icon: Heart,
      to: "/session/classic",
      buttonClass: isMobile
        ? "w-full text-sm bg-linear-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 text-blue-800 hover:from-blue-100 hover:to-indigo-100"
        : "px-6 py-4 text-base rounded-full shadow-lg hover:shadow-xl transition-all duration-300 bg-linear-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 text-blue-800 hover:from-blue-100 hover:to-indigo-100",
      badgeClass:
        "absolute -top-2 -right-2 bg-linear-to-r from-blue-500 to-indigo-600 text-white border-0 text-xs px-3 py-1 shadow-md",
      features: [
        "4-4-4-4 box breathing pattern",
        "No camera or signup required",
        "Immediate stress relief",
      ],
    },
    {
      key: "enhanced",
      title: "Enhanced Experience",
      description:
        "AI-powered feedback with camera tracking for deeper practice",
      badge: "Popular",
      icon: Camera,
      to: "/session/enhanced",
      buttonClass: isMobile
        ? "w-full text-sm bg-linear-to-r from-purple-50 to-pink-50 border-2 border-purple-200 text-purple-800 hover:from-purple-100 hover:to-pink-100"
        : "px-6 py-4 text-base rounded-full shadow-lg hover:shadow-xl transition-all duration-300 bg-linear-to-r from-purple-50 to-pink-50 border-2 border-purple-200 text-purple-800 hover:from-purple-100 hover:to-pink-100",
      badgeClass:
        "absolute -top-2 -right-2 bg-linear-to-r from-purple-500 to-pink-600 text-white border-0 text-xs px-3 py-1 shadow-md",
      features: [
        "Real-time posture feedback",
        "AI coaching insights",
        "Advanced session metrics",
      ],
    },
  ];

  if (effectiveVariant === "mobile") {
    return (
      <div className={`space-y-6 p-4 ${className}`}>
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold mb-2">Start Your Practice</h2>
          <p className="text-muted-foreground">
            Choose your breathing experience
          </p>
        </div>

        {sessionTypes.map((session) => {
          const Icon = session.icon;
          return (
            <div key={session.key} className="relative">
              <Link to={session.to} className="block">
                <Button variant="outline" className={session.buttonClass}>
                  <div className="flex items-center gap-3 w-full">
                    <Icon className="w-5 h-5" />
                    <div className="text-left flex-1">
                      <div className="font-semibold">{session.title}</div>
                      <div className="text-xs opacity-80">
                        {session.description}
                      </div>
                    </div>
                  </div>
                </Button>
              </Link>
              <Badge className={session.badgeClass}>{session.badge}</Badge>
            </div>
          );
        })}
      </div>
    );
  }

  // Desktop layout
  return (
    <div className={`max-w-5xl mx-auto py-12 ${className}`}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 justify-items-center">
        {sessionTypes.map((session) => {
          const Icon = session.icon;
          return (
            <div key={session.key} className="w-full max-w-md">
              <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100">
                <div className="text-center mb-6">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-linear-to-br from-gray-50 to-gray-100 mb-4">
                    <Icon className="w-8 h-8 text-gray-600" />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">{session.title}</h3>
                  <p className="text-muted-foreground">{session.description}</p>
                </div>

                <ul className="space-y-2 mb-8">
                  {session.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2 text-sm">
                      <Sparkles className="w-4 h-4 text-green-500" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="relative">
                  <Link to={session.to} className="block">
                    <Button className={session.buttonClass}>
                      <Zap className="w-5 h-5 mr-2" />
                      Start Session
                    </Button>
                  </Link>
                  <Badge className={session.badgeClass}>{session.badge}</Badge>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Post-session pattern discovery hint */}
      <div className="mt-12 text-center">
        <p className="text-sm text-muted-foreground bg-linear-to-r from-blue-50 to-purple-50 p-4 rounded-lg inline-block">
          ✨ Complete your first session to unlock 6+ breathing patterns
          including Wim Hof, 4-7-8, and more
        </p>
      </div>
    </div>
  );
};

export default SessionEntryPoints;
