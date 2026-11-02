/**
 * Premium Tooltip - Luxury educational micro-interactions
 * 
 * CORE PRINCIPLES APPLIED:
 * - ENHANCEMENT FIRST: Enhanced existing tooltip with luxury aesthetics
 * - CLEAN: Clear educational content with elegant presentation
 * - MODULAR: Reusable across all components
 * - PERFORMANT: Lightweight with smooth animations
 */

import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import { HelpCircle, Info } from 'lucide-react';

interface PremiumTooltipProps {
  children: React.ReactNode;
  content: {
    title: string;
    description: string;
    tip?: string;
  };
  side?: 'top' | 'bottom' | 'left' | 'right';
  variant?: 'info' | 'help' | 'metric';
  className?: string;
}

export const PremiumTooltip: React.FC<PremiumTooltipProps> = ({
  children,
  content,
  side = 'top',
  variant = 'info',
  className,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  const getTooltipClasses = () => {
    const baseClasses = "absolute z-50 px-4 py-3 text-sm bg-black/90 backdrop-blur-xl text-white rounded-xl border border-white/10 shadow-2xl transition-all duration-300 pointer-events-none max-w-xs";
    
    const positionClasses = {
      top: "bottom-full left-1/2 transform -translate-x-1/2 mb-2",
      bottom: "top-full left-1/2 transform -translate-x-1/2 mt-2", 
      left: "right-full top-1/2 transform -translate-y-1/2 mr-2",
      right: "left-full top-1/2 transform -translate-y-1/2 ml-2",
    };

    const visibilityClasses = isVisible 
      ? "opacity-100 scale-100 translate-y-0" 
      : "opacity-0 scale-95 translate-y-1";

    return cn(baseClasses, positionClasses[side], visibilityClasses);
  };

  const getIconClasses = () => {
    const baseClasses = "w-3 h-3 transition-colors duration-200";
    
    const variantClasses = {
      info: "text-blue-400 hover:text-blue-300",
      help: "text-gray-400 hover:text-gray-300", 
      metric: "text-emerald-400 hover:text-emerald-300",
    };

    return cn(baseClasses, variantClasses[variant]);
  };

  const Icon = variant === 'help' ? HelpCircle : Info;

  return (
    <div className={cn("relative inline-flex items-center", className)}>
      <div
        className="flex items-center gap-1 cursor-help"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onTouchStart={() => setIsVisible(!isVisible)}
      >
        {children}
        <Icon className={getIconClasses()} />
      </div>

      {/* Premium Tooltip Content */}
      <div className={getTooltipClasses()}>
        {/* Arrow indicator */}
        <div className={cn(
          "absolute w-2 h-2 bg-black/90 border border-white/10 transform rotate-45",
          {
            "top-full left-1/2 -translate-x-1/2 -mt-1 border-t-0 border-l-0": side === 'top',
            "bottom-full left-1/2 -translate-x-1/2 -mb-1 border-b-0 border-r-0": side === 'bottom',
            "top-1/2 left-full -translate-y-1/2 -ml-1 border-t-0 border-r-0": side === 'left',
            "top-1/2 right-full -translate-y-1/2 -mr-1 border-b-0 border-l-0": side === 'right',
          }
        )} />

        <div className="space-y-2">
          <div className="font-medium text-white tracking-wide">
            {content.title}
          </div>
          <div className="text-white/80 text-xs leading-relaxed">
            {content.description}
          </div>
          {content.tip && (
            <div className="text-blue-300/80 text-xs italic border-t border-white/10 pt-2">
              💡 {content.tip}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Predefined educational content for common metrics
export const MetricTooltips = {
  stillness: {
    title: "Stillness Score",
    description: "Measures how steady your head and body position remain during meditation. Higher scores indicate less physical movement.",
    tip: "Try to find a comfortable position and gently minimize head movements for better scores."
  },
  presence: {
    title: "Presence Score", 
    description: "Indicates how steadily the session signal held.",
    tip: "A quiet minute or two is enough."
  },
  confidence: {
    title: "Detection Confidence",
    description: "Technical measure of how accurately the AI can detect your facial features. Higher values indicate clearer tracking.",
    tip: "Nothing to get right — just follow the rhythm."
  },
  breathingPhase: {
    title: "Breathing Phase",
    description: "Current stage of your breathing cycle. Follow the visual guide to maintain proper rhythm and timing.",
    tip: "Focus on smooth transitions between phases rather than forcing the timing."
  },
  cycle: {
    title: "Breathing Cycle",
    description: "Number of complete breath sequences you've completed. Each cycle includes inhale, hold, exhale, and pause phases.",
    tip: "Consistency matters more than speed - focus on quality over quantity."
  },
  progress: {
    title: "Session Progress",
    description: "Percentage of your planned session duration completed. Based on your selected pattern and target time.",
    tip: "Sessions become more beneficial with consistent daily practice."
  }
};

export default PremiumTooltip;