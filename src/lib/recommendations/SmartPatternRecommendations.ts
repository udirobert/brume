/**
 * Smart Pattern Recommendations - Intelligent Pattern Suggestions
 * 
 * DRY: Single source of truth for recommendation logic
 * CLEAN: Separates recommendation logic from UI components
 * MODULAR: Reusable across different contexts
 */

import { BREATHING_PATTERNS } from "../breathingPatterns";
import { getCache } from "../utils/cache-utils";

export interface RecommendationContext {
  timeOfDay?: number; // 0-23 hour
  userGoal?: "stress" | "energy" | "sleep" | "focus" | "general";
  sessionHistory?: string[]; // Previously used pattern IDs (legacy)
  userLevel?: "beginner" | "intermediate" | "advanced";
  currentMood?: "stressed" | "tired" | "anxious" | "energetic" | "calm";
  sessionType?: "classic" | "enhanced";
  isFirstSession?: boolean;
}

export interface EnhancedRecommendationContext {
  timeOfDay?: number; // 0-23 hour
  userGoal?: "stress" | "energy" | "sleep" | "focus" | "general";
  sessionHistory?: SessionData[]; // Enhanced session data
  userLevel?: "beginner" | "intermediate" | "advanced";
  currentMood?: "stressed" | "tired" | "anxious" | "energetic" | "calm";
  sessionType?: "classic" | "enhanced";
  isFirstSession?: boolean;
  userPreferences?: UserPreferences;
}

export interface UserPreferences {
  favoritePatterns: string[];
  completedSessions: string[];
  preferredGoals: string[];
  timePreferences: Record<string, string[]>;
  effectivenessRatings: Record<string, number>;
  difficultyPreference: "beginner" | "intermediate" | "advanced";
}

export interface SessionData {
  patternId: string;
  duration: number;
  completionRate: number;
  restlessnessScore?: number;
  breathQuality?: number;
  userEngagement?: number;
  timestamp: number;
}

export interface MatchFactors {
  timeOptimization: number; // 0-100
  goalAlignment: number; // 0-100
  userHistory: number; // 0-100
  difficultyFit: number; // 0-100
}

export interface PatternMatch {
  patternId: string;
  pattern: typeof BREATHING_PATTERNS[keyof typeof BREATHING_PATTERNS];
  matchPercentage: number; // 0-100
  confidence: number; // 0-1 (kept for compatibility)
  matchFactors: MatchFactors;
  explanation: string;
  trend: 'rising' | 'stable' | 'declining';
  reason: string;
  timeToEffect: string;
  bestFor: string[];
  priority: "high" | "medium" | "low";
}

export interface PatternRecommendation {
  patternId: string;
  pattern: typeof BREATHING_PATTERNS[keyof typeof BREATHING_PATTERNS];
  reason: string;
  confidence: number; // 0-1 scale
  timeToEffect: string;
  bestFor: string[];
  priority: "high" | "medium" | "low";
}

/**
 * ENHANCEMENT FIRST: Builds on existing pattern data with smart recommendations
 */
export class SmartPatternRecommendations {

  /**
   * Get personalized pattern recommendations based on context
   */
  static getRecommendations(context: RecommendationContext): PatternRecommendation[] {
    const recommendations: PatternRecommendation[] = [];

    // First session - always recommend box breathing
    if (context.isFirstSession) {
      return [{
        patternId: "box",
        pattern: BREATHING_PATTERNS.box,
        reason: "Four counts each way. Easy to hold onto.",
        confidence: 1.0,
        timeToEffect: "30 seconds",
        bestFor: ["First sessions", "An easy start"],
        priority: "high"
      }];
    }

    // Time-based recommendations
    const timeRecommendations = this.getTimeBasedRecommendations(context.timeOfDay);
    recommendations.push(...timeRecommendations);

    // Goal-based recommendations
    if (context.userGoal) {
      const goalRecommendations = this.getGoalBasedRecommendations(context.userGoal);
      recommendations.push(...goalRecommendations);
    }

    // Mood-based recommendations
    if (context.currentMood) {
      const moodRecommendations = this.getMoodBasedRecommendations(context.currentMood);
      recommendations.push(...moodRecommendations);
    }

    // Level-based filtering
    const filteredRecommendations = this.filterByUserLevel(recommendations, context.userLevel);

    // Remove duplicates and sort by confidence
    const uniqueRecommendations = this.deduplicateAndSort(filteredRecommendations);

    // Limit to top 3-4 recommendations to prevent choice paralysis
    return uniqueRecommendations.slice(0, context.sessionType === "enhanced" ? 4 : 3);
  }

  /**
   * Time-aware recommendations based on circadian rhythms
   */
  private static getTimeBasedRecommendations(hour: number = new Date().getHours()): PatternRecommendation[] {
    if (hour >= 6 && hour < 10) {
      // Morning - energy and alertness
      return [
        {
          patternId: "energy",
          pattern: BREATHING_PATTERNS.energy,
          reason: "Short counts, a little quicker. A bright start.",
          confidence: 0.9,
          timeToEffect: "2 minutes",
          bestFor: ["Early hours", "A quicker rhythm"],
          priority: "high"
        },
        {
          patternId: "box",
          pattern: BREATHING_PATTERNS.box,
          reason: "Four equal sides. A steady shape when things feel fast.",
          confidence: 0.8,
          timeToEffect: "30 seconds",
          bestFor: ["Steady mornings", "Before the day starts"],
          priority: "medium"
        }
      ];
    }

    if (hour >= 10 && hour < 14) {
      // Mid-morning to early afternoon - focus and productivity
      return [
        {
          patternId: "box",
          pattern: BREATHING_PATTERNS.box,
          reason: "Four equal sides. A steady shape between tasks.",
          confidence: 0.9,
          timeToEffect: "30 seconds",
          bestFor: ["Between tasks", "A quiet pause"],
          priority: "high"
        },
        {
          patternId: "mindfulness",
          pattern: BREATHING_PATTERNS.mindfulness,
          reason: "Even counts, in and out. Nothing to get right.",
          confidence: 0.7,
          timeToEffect: "2 minutes",
          bestFor: ["A slower minute", "Noticing the breath"],
          priority: "medium"
        }
      ];
    }

    if (hour >= 14 && hour < 18) {
      // Afternoon - combat afternoon slump
      return [
        {
          patternId: "energy",
          pattern: BREATHING_PATTERNS.energy,
          reason: "Short counts, a little quicker. For the middle of the afternoon.",
          confidence: 0.8,
          timeToEffect: "2 minutes",
          bestFor: ["Mid-afternoon", "A quicker rhythm"],
          priority: "high"
        },
        {
          patternId: "wim_hof",
          pattern: BREATHING_PATTERNS.wim_hof,
          reason: "Fuller breaths, round after round. For when you want intensity.",
          confidence: 0.6,
          timeToEffect: "3 minutes",
          bestFor: ["A bigger breath", "Experienced practisers"],
          priority: "medium"
        }
      ];
    }

    if (hour >= 18 && hour < 22) {
      // Evening - transition and relaxation
      return [
        {
          patternId: "relaxation",
          pattern: BREATHING_PATTERNS.relaxation,
          reason: "Longer out than in. A way to put the day down.",
          confidence: 0.9,
          timeToEffect: "3 minutes",
          bestFor: ["End of the day", "Slowing down"],
          priority: "high"
        },
        {
          patternId: "box",
          pattern: BREATHING_PATTERNS.box,
          reason: "Four equal sides. An even edge between work and rest.",
          confidence: 0.7,
          timeToEffect: "30 seconds",
          bestFor: ["Between work and rest", "Evenings"],
          priority: "medium"
        }
      ];
    }

    // Night - sleep preparation
    return [
      {
        patternId: "sleep",
        pattern: BREATHING_PATTERNS.sleep,
        reason: "A long exhale, then a pause. Slower on purpose.",
        confidence: 0.9,
        timeToEffect: "5 minutes",
        bestFor: ["Before sleep", "The last thing at night"],
        priority: "high"
      },
      {
        patternId: "relaxation",
        pattern: BREATHING_PATTERNS.relaxation,
        reason: "Longer out than in. A way to put the day down.",
        confidence: 0.8,
        timeToEffect: "3 minutes",
        bestFor: ["Laying the day down", "Before bed"],
        priority: "medium"
      }
    ];
  }

  /**
   * Goal-based recommendations
   */
  private static getGoalBasedRecommendations(goal: string): PatternRecommendation[] {
    switch (goal) {
      case "stress":
        return [
          {
            patternId: "box",
            pattern: BREATHING_PATTERNS.box,
            reason: "Four equal sides. A steady shape when things feel fast.",
            confidence: 0.95,
            timeToEffect: "30 seconds",
            bestFor: ["Fast days", "Holding steady"],
            priority: "high"
          },
          {
            patternId: "relaxation",
            pattern: BREATHING_PATTERNS.relaxation,
            reason: "Longer out than in. A way to put the day down.",
            confidence: 0.9,
            timeToEffect: "3 minutes",
            bestFor: ["Letting go", "A slower pace"],
            priority: "high"
          }
        ];

      case "energy":
        return [
          {
            patternId: "energy",
            pattern: BREATHING_PATTERNS.energy,
            reason: "Short counts, a little quicker.",
            confidence: 0.9,
            timeToEffect: "2 minutes",
            bestFor: ["A quicker rhythm", "Early hours"],
            priority: "high"
          },
          {
            patternId: "wim_hof",
            pattern: BREATHING_PATTERNS.wim_hof,
            reason: "Fuller breaths, round after round.",
            confidence: 0.8,
            timeToEffect: "3 minutes",
            bestFor: ["A bigger breath", "Experienced practisers"],
            priority: "medium"
          }
        ];

      case "sleep":
        return [
          {
            patternId: "sleep",
            pattern: BREATHING_PATTERNS.sleep,
            reason: "A long exhale, then a pause. Slower on purpose.",
            confidence: 0.95,
            timeToEffect: "5 minutes",
            bestFor: ["Before sleep", "Bedtime"],
            priority: "high"
          },
          {
            patternId: "relaxation",
            pattern: BREATHING_PATTERNS.relaxation,
            reason: "Longer out than in. A way to put the day down.",
            confidence: 0.8,
            timeToEffect: "3 minutes",
            bestFor: ["Bedtime", "Slowing down"],
            priority: "medium"
          }
        ];

      case "focus":
        return [
          {
            patternId: "box",
            pattern: BREATHING_PATTERNS.box,
            reason: "Four equal sides. Easy to hold onto.",
            confidence: 0.9,
            timeToEffect: "30 seconds",
            bestFor: ["Steady attention", "One thing at a time"],
            priority: "high"
          },
          {
            patternId: "mindfulness",
            pattern: BREATHING_PATTERNS.mindfulness,
            reason: "Even counts, in and out. Nothing to get right.",
            confidence: 0.8,
            timeToEffect: "2 minutes",
            bestFor: ["Noticing the breath", "Sitting still"],
            priority: "medium"
          }
        ];

      default:
        return [];
    }
  }

  /**
   * Mood-based recommendations
   */
  private static getMoodBasedRecommendations(mood: string): PatternRecommendation[] {
    switch (mood) {
      case "stressed":
        return [
          {
            patternId: "box",
            pattern: BREATHING_PATTERNS.box,
            reason: "Four equal sides. A steady shape when things feel fast.",
            confidence: 0.95,
            timeToEffect: "30 seconds",
            bestFor: ["Fast days", "A steady shape"],
            priority: "high"
          }
        ];

      case "tired":
        return [
          {
            patternId: "energy",
            pattern: BREATHING_PATTERNS.energy,
            reason: "Short counts, a little quicker.",
            confidence: 0.9,
            timeToEffect: "2 minutes",
            bestFor: ["Low battery", "A quicker rhythm"],
            priority: "high"
          }
        ];

      case "anxious":
        return [
          {
            patternId: "relaxation",
            pattern: BREATHING_PATTERNS.relaxation,
            reason: "Longer out than in. A way to put the day down.",
            confidence: 0.9,
            timeToEffect: "3 minutes",
            bestFor: ["When it's a lot", "A slower pace"],
            priority: "high"
          }
        ];

      default:
        return [];
    }
  }

  /**
   * Filter recommendations by user experience level
   */
  private static filterByUserLevel(
    recommendations: PatternRecommendation[],
    level: string = "beginner"
  ): PatternRecommendation[] {
    if (level === "beginner") {
      // Filter out advanced patterns for beginners
      return recommendations.filter(rec =>
        !["wim_hof"].includes(rec.patternId)
      );
    }
    return recommendations;
  }

  /**
   * Remove duplicates and sort by confidence and priority
   */
  private static deduplicateAndSort(recommendations: PatternRecommendation[]): PatternRecommendation[] {
    const seen = new Set<string>();
    const unique = recommendations.filter(rec => {
      if (seen.has(rec.patternId)) return false;
      seen.add(rec.patternId);
      return true;
    });

    return unique.sort((a, b) => {
      // Sort by priority first, then confidence
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;

      return b.confidence - a.confidence;
    });
  }

  /**
   * Generate a unique cache key for the given context
   */
  private static generateCacheKey(context: EnhancedRecommendationContext): string {
    const keyParts = [
      'pattern-matches',
      context.timeOfDay || 'any-time',
      context.userGoal || 'any-goal',
      context.userLevel || 'any-level',
      context.currentMood || 'any-mood',
      context.sessionType || 'any-type',
      context.isFirstSession ? 'first-session' : 'returning-user',
      context.userPreferences?.difficultyPreference || 'any-difficulty',
      context.userPreferences?.favoritePatterns?.join(',') || 'no-favorites',
      context.userPreferences?.preferredGoals?.join(',') || 'no-goals',
    ];

    return keyParts.join(':');
  }

  /**
   * Get dynamic pattern matches with personalized scoring
   * Uses caching for performance optimization
   */
  static async getPatternMatches(context: EnhancedRecommendationContext = {}): Promise<PatternMatch[]> {
    const cache = getCache();
    const cacheKey = this.generateCacheKey(context);

    // Use cache with 5-minute TTL for pattern matches
    return await cache.getOrCompute(
      cacheKey,
      async () => {
        const matches: PatternMatch[] = [];

        // Calculate matches for all patterns
        Object.entries(BREATHING_PATTERNS).forEach(([patternId, pattern]) => {
          const match = this.calculatePatternMatch(patternId, pattern, context);
          matches.push(match);
        });

        // Sort by match percentage (descending)
        return matches.sort((a, b) => b.matchPercentage - a.matchPercentage);
      },
      300000 // 5 minutes TTL
    );
  }

  /**
   * Calculate dynamic match for a specific pattern
   */
  private static calculatePatternMatch(
    patternId: string,
    pattern: typeof BREATHING_PATTERNS[keyof typeof BREATHING_PATTERNS],
    context: EnhancedRecommendationContext
  ): PatternMatch {
    const factors = this.calculateMatchFactors(patternId, pattern, context);
    const matchPercentage = Math.round(
      (factors.timeOptimization + factors.goalAlignment + factors.userHistory + factors.difficultyFit) / 4
    );

    return {
      patternId,
      pattern,
      matchPercentage,
      confidence: matchPercentage / 100, // Convert to 0-1 scale for compatibility
      matchFactors: factors,
      explanation: this.generateMatchExplanation(patternId, factors, context),
      trend: this.calculateTrend(patternId, context),
      reason: this.generateReason(patternId, context),
      timeToEffect: this.getTimeToEffect(patternId),
      bestFor: this.getBestFor(patternId),
      priority: this.getPriority(patternId, matchPercentage)
    };
  }

  /**
   * Calculate individual match factors
   */
  private static calculateMatchFactors(
    patternId: string,
    pattern: typeof BREATHING_PATTERNS[keyof typeof BREATHING_PATTERNS],
    context: EnhancedRecommendationContext
  ): MatchFactors {
    return {
      timeOptimization: this.calculateTimeOptimization(patternId, context.timeOfDay),
      goalAlignment: this.calculateGoalAlignment(patternId, context.userGoal),
      userHistory: this.calculateUserHistory(patternId, context),
      difficultyFit: this.calculateDifficultyFit(patternId, pattern, context.userLevel)
    };
  }

  /**
   * Calculate time-based optimization score
   */
  private static calculateTimeOptimization(patternId: string, hour: number = new Date().getHours()): number {
    if (hour >= 6 && hour < 10) {
      // Morning - favor energy patterns
      if (patternId === "energy") return 95;
      if (patternId === "box") return 85;
      if (patternId === "wim_hof") return 70;
      return 60;
    }

    if (hour >= 10 && hour < 14) {
      // Mid-morning - favor focus patterns
      if (patternId === "box") return 95;
      if (patternId === "mindfulness") return 85;
      return 70;
    }

    if (hour >= 14 && hour < 18) {
      // Afternoon - favor energy patterns
      if (patternId === "energy") return 90;
      if (patternId === "wim_hof") return 80;
      return 65;
    }

    if (hour >= 18 && hour < 22) {
      // Evening - favor relaxation patterns
      if (patternId === "relaxation") return 95;
      if (patternId === "box") return 85;
      if (patternId === "sleep") return 90;
      return 70;
    }

    // Night - favor sleep patterns
    if (patternId === "sleep") return 95;
    if (patternId === "relaxation") return 85;
    return 75;
  }

  /**
   * Calculate goal alignment score
   */
  private static calculateGoalAlignment(patternId: string, userGoal?: string): number {
    if (!userGoal) return 75; // Default score

    const goalPatterns: Record<string, string[]> = {
      stress: ["box", "relaxation", "mindfulness"],
      energy: ["energy", "wim_hof"],
      sleep: ["sleep", "relaxation"],
      focus: ["box", "mindfulness"],
      general: ["box", "relaxation", "energy"]
    };

    const patternsForGoal = goalPatterns[userGoal] || [];
    if (patternsForGoal.includes(patternId)) {
      return patternsForGoal.indexOf(patternId) === 0 ? 95 : 85;
    }

    return 60; // Not ideal for this goal but still viable
  }

  /**
   * Calculate user history score
   */
  private static calculateUserHistory(
    patternId: string,
    context: EnhancedRecommendationContext
  ): number {
    const { userPreferences, sessionHistory } = context;

    // Check if it's a favorite pattern
    if (userPreferences?.favoritePatterns.includes(patternId)) {
      return 95;
    }

    // Check session history for successful completions
    if (sessionHistory?.length) {
      // Type guard to check if sessionHistory contains SessionData objects
      const isSessionDataArray = (arr: any[]): arr is SessionData[] => {
        return arr.length > 0 && typeof arr[0] === 'object' && 'patternId' in arr[0];
      };

      if (isSessionDataArray(sessionHistory)) {
        const patternSessions = sessionHistory.filter(s => s.patternId === patternId);
        if (patternSessions.length > 0) {
          const avgCompletion = patternSessions.reduce((sum, s) => sum + s.completionRate, 0) / patternSessions.length;
          const avgEngagement = patternSessions.reduce((sum, s) => sum + (s.userEngagement || 0), 0) / patternSessions.length;

          // Boost score based on successful sessions
          if (avgCompletion > 80 && avgEngagement > 70) {
            return Math.min(95, 70 + (patternSessions.length * 5)); // Up to 95% for many successful sessions
          }
        }
      } else {
        // Legacy string array - basic pattern matching
        const stringHistory = sessionHistory as string[];
        const patternCount = stringHistory.filter(s => s === patternId).length;
        if (patternCount > 0) {
          return Math.min(90, 65 + (patternCount * 5)); // Up to 90% for many sessions
        }
      }
    }

    // Check effectiveness ratings
    if (userPreferences?.effectivenessRatings[patternId]) {
      const rating = userPreferences.effectivenessRatings[patternId];
      return 60 + (rating * 10); // Convert 1-5 rating to 70-100 score
    }

    return 70; // Default score for unknown patterns
  }

  /**
   * Calculate difficulty fit score
   */
  private static calculateDifficultyFit(
    patternId: string,
    pattern: typeof BREATHING_PATTERNS[keyof typeof BREATHING_PATTERNS],
    userLevel?: string
  ): number {
    if (!userLevel) return 80; // Default score

    const patternDifficulty = this.getPatternDifficulty(patternId);
    const levelScores: Record<string, Record<string, number>> = {
      beginner: { beginner: 95, intermediate: 75, advanced: 50 },
      intermediate: { beginner: 85, intermediate: 95, advanced: 80 },
      advanced: { beginner: 70, intermediate: 90, advanced: 95 }
    };

    return levelScores[userLevel]?.[patternDifficulty] || 75;
  }

  /**
   * Get pattern difficulty level
   */
  private static getPatternDifficulty(patternId: string): "beginner" | "intermediate" | "advanced" {
    const difficultyMap: Record<string, "beginner" | "intermediate" | "advanced"> = {
      box: "beginner",
      relaxation: "beginner",
      sleep: "beginner",
      mindfulness: "beginner",
      energy: "intermediate",
      wim_hof: "advanced"
    };

    return difficultyMap[patternId] || "beginner";
  }

  /**
   * Generate human-readable explanation
   */
  private static generateMatchExplanation(
    patternId: string,
    factors: MatchFactors,
    context: EnhancedRecommendationContext
  ): string {
    const explanations: string[] = [];

    if (factors.timeOptimization >= 90) {
      explanations.push("Perfect timing for right now");
    } else if (factors.timeOptimization >= 80) {
      explanations.push("Well-suited for current time");
    }

    if (factors.goalAlignment >= 90) {
      explanations.push("Excellent match for your goal");
    } else if (factors.goalAlignment >= 80) {
      explanations.push("Good alignment with your objective");
    }

    if (factors.userHistory >= 90) {
      explanations.push("One you keep coming back to");
    } else if (factors.userHistory >= 80) {
      explanations.push("Familiar from your history");
    }

    if (factors.difficultyFit >= 90) {
      explanations.push("Matches your experience level");
    }

    return explanations.length > 0 ? explanations.join(" • ") : "Balanced option for your needs";
  }

  /**
   * Calculate trend based on recent usage
   */
  private static calculateTrend(
    patternId: string,
    context: EnhancedRecommendationContext
  ): 'rising' | 'stable' | 'declining' {
    if (!context.sessionHistory?.length) return 'stable';

    // Type guard to check if sessionHistory contains SessionData objects
    const isSessionDataArray = (arr: any[]): arr is SessionData[] => {
      return arr.length > 0 && typeof arr[0] === 'object' && 'patternId' in arr[0];
    };

    if (!isSessionDataArray(context.sessionHistory)) return 'stable';

    const recentSessions = context.sessionHistory
      .filter(s => s.patternId === patternId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5); // Last 5 sessions

    if (recentSessions.length < 2) return 'stable';

    const recentAvg = recentSessions.slice(0, 2).reduce((sum, s) => sum + s.completionRate, 0) / 2;
    const olderAvg = recentSessions.slice(2).reduce((sum, s) => sum + s.completionRate, 0) / Math.max(1, recentSessions.length - 2);

    if (recentAvg > olderAvg + 10) return 'rising';
    if (recentAvg < olderAvg - 10) return 'declining';
    return 'stable';
  }

  /**
   * Generate reason text
   */
  private static generateReason(patternId: string, context: EnhancedRecommendationContext): string {
    const hour = context.timeOfDay || new Date().getHours();

    if (hour >= 6 && hour < 10 && patternId === "energy") {
      return "Short counts, a little quicker. A bright start.";
    }

    if (hour >= 10 && hour < 14 && patternId === "box") {
      return "Four equal sides. A steady shape between tasks.";
    }

    if (hour >= 14 && hour < 18 && patternId === "energy") {
      return "Short counts, a little quicker. For the middle of the afternoon.";
    }

    if (hour >= 18 && hour < 22 && patternId === "relaxation") {
      return "Longer out than in. A way to put the day down.";
    }

    if (patternId === "sleep") {
      return "A long exhale, then a pause. Slower on purpose.";
    }

    return "An even rhythm, any time of day.";
  }

  /**
   * Get time to effect
   */
  private static getTimeToEffect(patternId: string): string {
    const timeMap: Record<string, string> = {
      box: "30 seconds",
      relaxation: "3 minutes",
      wim_hof: "3 minutes",
      energy: "2 minutes",
      sleep: "5 minutes",
      mindfulness: "2 minutes"
    };

    return timeMap[patternId] || "2 minutes";
  }

  /**
   * Get best for categories
   */
  private static getBestFor(patternId: string): string[] {
    const bestForMap: Record<string, string[]> = {
      box: ["Steady", "Even counts", "Between tasks"],
      relaxation: ["Long exhale", "Slowing down", "Before bed"],
      wim_hof: ["Fuller breaths", "Rounds", "Intensity"],
      energy: ["Quicker counts", "Early hours", "A bright start"],
      sleep: ["Before sleep", "Long exhale", "Bedtime"],
      mindfulness: ["Even counts", "Stillness", "Noticing the breath"]
    };

    return bestForMap[patternId] || ["Any time"];
  }

  /**
   * Get priority based on match percentage
   */
  private static getPriority(patternId: string, matchPercentage: number): "high" | "medium" | "low" {
    if (matchPercentage >= 85) return "high";
    if (matchPercentage >= 70) return "medium";
    return "low";
  }

  /**
   * Get quick recommendations for immediate use (legacy method for compatibility)
   */
  static getQuickRecommendations(context: Partial<RecommendationContext> = {}): PatternRecommendation[] {
    const hour = new Date().getHours();

    if (hour >= 6 && hour < 12) {
      return [BREATHING_PATTERNS.energy, BREATHING_PATTERNS.box].map((pattern, index) => ({
        patternId: pattern.id,
        pattern,
        reason: index === 0 ? "A quicker start to the day" : "Steady and even",
        confidence: index === 0 ? 0.9 : 0.8,
        timeToEffect: index === 0 ? "2 minutes" : "30 seconds",
        bestFor: index === 0 ? ["Early hours"] : ["Steady"],
        priority: "high" as const
      }));
    }

    if (hour >= 18) {
      return [BREATHING_PATTERNS.relaxation, BREATHING_PATTERNS.sleep].map((pattern, index) => ({
        patternId: pattern.id,
        pattern,
        reason: index === 0 ? "A slower end to the day" : "Long exhale, before sleep",
        confidence: 0.9,
        timeToEffect: index === 0 ? "3 minutes" : "5 minutes",
        bestFor: index === 0 ? ["Evenings"] : ["Before sleep"],
        priority: "high" as const
      }));
    }

    // Default to the steadiest rhythm
    return [{
      patternId: "box",
      pattern: BREATHING_PATTERNS.box,
      reason: "Steady and even.",
      confidence: 0.95,
      timeToEffect: "30 seconds",
      bestFor: ["Steady", "Even counts"],
      priority: "high"
    }];
  }

  /**
   * Get quick pattern matches for immediate use
   */
  static getQuickPatternMatches(context: Partial<RecommendationContext> = {}): PatternMatch[] {
    const hour = new Date().getHours();

    if (hour >= 6 && hour < 12) {
      return [BREATHING_PATTERNS.energy, BREATHING_PATTERNS.box].map((pattern, index) => ({
        patternId: pattern.id,
        pattern,
        matchPercentage: index === 0 ? 90 : 85,
        confidence: index === 0 ? 0.9 : 0.85,
        matchFactors: {
          timeOptimization: 95,
          goalAlignment: index === 0 ? 90 : 85,
          userHistory: 75,
          difficultyFit: 80
        },
        explanation: index === 0 ? "A good fit for mornings" : "Steady and even",
        trend: 'stable' as const,
        reason: index === 0 ? "A quicker start to the day" : "Steady and even",
        timeToEffect: index === 0 ? "2 minutes" : "30 seconds",
        bestFor: index === 0 ? ["Early hours"] : ["Steady"],
        priority: "high" as const
      }));
    }

    if (hour >= 18) {
      return [BREATHING_PATTERNS.relaxation, BREATHING_PATTERNS.sleep].map((pattern, index) => ({
        patternId: pattern.id,
        pattern,
        matchPercentage: index === 0 ? 90 : 95,
        confidence: index === 0 ? 0.9 : 0.95,
        matchFactors: {
          timeOptimization: 95,
          goalAlignment: index === 0 ? 85 : 90,
          userHistory: 75,
          difficultyFit: 80
        },
        explanation: index === 0 ? "A good fit for evenings" : "A long exhale before sleep",
        trend: 'stable' as const,
        reason: index === 0 ? "A slower end to the day" : "Long exhale, before sleep",
        timeToEffect: index === 0 ? "3 minutes" : "5 minutes",
        bestFor: index === 0 ? ["Evenings"] : ["Before sleep"],
        priority: "high" as const
      }));
    }

    // Default to the steadiest rhythm
    return [{
      patternId: "box",
      pattern: BREATHING_PATTERNS.box,
      matchPercentage: 95,
      confidence: 0.95,
      matchFactors: {
        timeOptimization: 85,
        goalAlignment: 90,
        userHistory: 75,
        difficultyFit: 80
      },
      explanation: "An even rhythm",
      trend: 'stable' as const,
      reason: "Steady and even.",
      timeToEffect: "30 seconds",
      bestFor: ["Steady", "Even counts"],
      priority: "high"
    }];
  }
}

export default SmartPatternRecommendations;