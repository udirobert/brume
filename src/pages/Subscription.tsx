/**
 * Subscription Page — Brume Premium paywall (RevenueCat Shipaton)
 *
 * Product truth: a single entitlement (brume_premium) unlocked by two
 * products — brume_premium_monthly and brume_premium_annual (the annual
 * product carries the 7-day free trial). See src/lib/monetization/revenueCatConfig.ts.
 *
 * NOTE FOR SHIPATON JUDGES: promo/offer codes are issued and validated on the
 * RevenueCat side (App Store Connect / Google Play). Redeem a code, then use
 * "Restore Purchases" in the paywall below — on iOS the manager also exposes
 * the native App Store offer-code sheet.
 */

import React from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Crown,
  Sparkles,
  Waves,
  Wind,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { SubscriptionManager } from "@/components/monetization/SubscriptionManager";
import { BrumeMascot } from "@/components/BrumeMascot";

const BENEFITS = [
  {
    icon: BadgeCheck,
    tint: "bg-blue-100 text-blue-600",
    title: "Sessions that see you",
    copy: "Stillness from the breath itself — not an honor-system log.",
  },
  {
    icon: Wind,
    tint: "bg-teal-100 text-teal-600",
    title: "The full library",
    copy: "Every rhythm — from box breathing to coherence and beyond.",
  },
  {
    icon: Waves,
    tint: "bg-purple-100 text-purple-600",
    title: "Adaptive sessions",
    copy: "The orb responds to your state and adjusts in real time.",
  },
];

const Subscription: React.FC = () => {
  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-blue-50/50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-purple-600" />
                <h1 className="text-xl font-semibold">Brume Premium</h1>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="container mx-auto px-4 py-8">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <BrumeMascot state="bright" size={88} className="mb-4" />
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-linear-to-br from-purple-500 to-blue-500 rounded-2xl">
              <Sparkles className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-3xl font-bold bg-linear-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Breathing breaks that fit your day.
            </h2>
          </div>
          <p className="text-lg text-muted-foreground mb-8">
            One membership unlocks the full practice.
          </p>

          {/* Key Benefits */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {BENEFITS.map(({ icon: Icon, tint, title, copy }) => (
              <div
                key={title}
                className="p-4 bg-white/60 rounded-xl border border-white/50"
              >
                <div
                  className={`w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-3 ${tint}`}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="font-semibold mb-1">{title}</h3>
                <p className="text-sm text-muted-foreground">{copy}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Subscription Manager Component */}
        <div className="max-w-6xl mx-auto">
          <SubscriptionManager variant="full" showCurrentPlan={true} />
          {/* Judge testing: promo codes are provisioned in RevenueCat /
              App Store Connect / Google Play — redeem, then Restore Purchases. */}
          <p className="text-xs text-muted-foreground text-center mt-4">
            Testing Brume Premium? Annual includes a 7-day free trial. Promo
            codes are managed via RevenueCat — redeem your code, then tap
            “Restore Purchases” above.
          </p>
        </div>

        {/* FAQ Section */}
        <div className="mt-16 max-w-3xl mx-auto">
          <h3 className="text-2xl font-bold text-center mb-8">Frequently Asked Questions</h3>
          <div className="space-y-6">
            <div className="p-6 bg-white/60 rounded-xl border border-white/50">
              <h4 className="font-semibold mb-2">Is there a free trial?</h4>
              <p className="text-muted-foreground">
                Yes. Brume Premium Annual begins with a 7-day free trial — full access from day one, and you can cancel anytime during the trial.
              </p>
            </div>

            <div className="p-6 bg-white/60 rounded-xl border border-white/50">
              <h4 className="font-semibold mb-2">Can I cancel anytime?</h4>
              <p className="text-muted-foreground">
                Yes, you can cancel your subscription at any time. You'll keep access to Premium features until the end of your billing period.
              </p>
            </div>

            <div className="p-6 bg-white/60 rounded-xl border border-white/50">
              <h4 className="font-semibold mb-2">What happens to my sessions?</h4>
              <p className="text-muted-foreground">
                Your history stays yours. Downgrading only changes what you can
                unlock next — never the sessions you already took.
              </p>
            </div>

            <div className="p-6 bg-white/60 rounded-xl border border-white/50">
              <h4 className="font-semibold mb-2">Where can I use my subscription?</h4>
              <p className="text-muted-foreground">
                Purchases are handled securely through the App Store or Google Play via RevenueCat, and your membership follows your Brume account across devices.
              </p>
            </div>
          </div>
        </div>

        {/* Support Section */}
        <div className="mt-12 text-center">
          <div className="p-8 bg-linear-to-r from-blue-50 to-purple-50 rounded-2xl border border-blue-100">
            <h3 className="text-xl font-semibold mb-2">Need a hand?</h3>
            <p className="text-muted-foreground mb-4">
              Write us and we'll help you get back to the breath.
            </p>
            <Button variant="outline" asChild>
              <a href="mailto:support@brume.app">Contact support</a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Subscription;
