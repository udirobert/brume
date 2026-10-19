/**
 * Lens Protocol v3 Metadata Creation
 *
 * Uses textOnly() from @lens-protocol/metadata for proper SDK compliance
 * Maintains backward compatibility with existing interfaces
 */

import { textOnly, MetadataAttributeType } from "@lens-protocol/metadata";
import type { TextOnlyMetadata } from "@lens-protocol/metadata";
import type { BreathingSession, PostMetadata } from "./types";

export type { TextOnlyMetadata };

/**
 * Generate default post content for a breathing session
 */
export function generateDefaultSessionPostContent(
  session: BreathingSession,
): string {
  const minutes = Math.round(session.duration / 60);
  return `🧘 Just finished a ${session.patternName} session - ${minutes} minute${minutes !== 1 ? "s" : ""}!`;
}

/**
 * Create metadata for a breathing session post using textOnly() from Lens SDK
 */
export function createBreathingSessionMetadata(
  session: BreathingSession,
): TextOnlyMetadata {
  const content = generateDefaultSessionPostContent(session);

  const metadata = textOnly({
    content,
    tags: [
      "breathing",
      "mindfulness",
      "wellness",
      session.patternName.toLowerCase().replace(/\s+/g, ""),
    ],
    attributes: [
      {
        key: "sessionType",
        value: "breathing",
        type: MetadataAttributeType.STRING,
      },
      {
        key: "pattern",
        value: session.patternName,
        type: MetadataAttributeType.STRING,
      },
      {
        key: "duration",
        value: session.duration.toString(),
        type: MetadataAttributeType.NUMBER,
      },
      ...(session.score
        ? [
            {
              key: "score",
              value: session.score.toString(),
              type: MetadataAttributeType.NUMBER as MetadataAttributeType.NUMBER,
            },
          ]
        : []),
      ...(session.cycles
        ? [
            {
              key: "cycles",
              value: session.cycles.toString(),
              type: MetadataAttributeType.NUMBER as MetadataAttributeType.NUMBER,
            },
          ]
        : []),
      ...(session.breathHoldTime
        ? [
            {
              key: "breathHoldTime",
              value: session.breathHoldTime.toString(),
              type: MetadataAttributeType.NUMBER as MetadataAttributeType.NUMBER,
            },
          ]
        : []),
    ],
  });

  return metadata;
}

/**
 * Create metadata for a general text post
 */
export function createTextPostMetadata(
  content: string,
  title?: string,
  tags?: string[],
): TextOnlyMetadata {
  return textOnly({
    content,
    tags: tags || ["brume"],
  });
}

/**
 * Create metadata for an achievement post
 */
export function createAchievementMetadata(
  achievementName: string,
  description: string,
): TextOnlyMetadata {
  const content = `🏆 Achievement unlocked: ${achievementName}!\n\n${description}\n\n#achievement #wellness #breathing #milestone`;

  return textOnly({
    content,
    tags: ["achievement", "wellness", "breathing", "milestone"],
    attributes: [
      {
        key: "achievementType",
        value: "breathing",
        type: MetadataAttributeType.STRING,
      },
      {
        key: "achievementName",
        value: achievementName,
        type: MetadataAttributeType.STRING,
      },
    ],
  });
}

/**
 * Create metadata for a challenge participation post
 */
export function createChallengeMetadata(
  challengeName: string,
  action: "joined" | "completed" | "progress",
  progress?: { current: number; total: number },
): TextOnlyMetadata {
  let content = "";

  switch (action) {
    case "joined":
      content = `🚀 Just joined the ${challengeName} challenge! Ready to level up my breathing practice.\n\n#challenge #breathing #wellness #commitment`;
      break;
    case "completed":
      content = `🎉 Challenge completed! Just finished the ${challengeName} challenge. What an incredible journey!\n\n#challenge #completed #breathing #achievement`;
      break;
    case "progress": {
      const progressText = progress
        ? `Day ${progress.current} of ${progress.total}`
        : "Making progress";
      content = `💪 ${progressText} in the ${challengeName} challenge. Staying consistent with my breathing practice!\n\n#challenge #progress #breathing #consistency`;
      break;
    }
  }

  return textOnly({
    content,
    tags: ["challenge", "breathing", "wellness", action],
    attributes: [
      {
        key: "challengeAction",
        value: action,
        type: MetadataAttributeType.STRING,
      },
      {
        key: "challengeName",
        value: challengeName,
        type: MetadataAttributeType.STRING,
      },
      ...(progress
        ? [
            {
              key: "progress",
              value: `${progress.current}/${progress.total}`,
              type: MetadataAttributeType.STRING as MetadataAttributeType.STRING,
            },
          ]
        : []),
    ],
  });
}

/**
 * Create a data URI from metadata (fallback for when Grove is unavailable)
 */
export function createMetadataDataUri(metadata: PostMetadata): string {
  const jsonString = JSON.stringify(metadata);
  return `data:application/json,${encodeURIComponent(jsonString)}`;
}

/**
 * Validate metadata structure
 */
export function validateMetadata(metadata: PostMetadata): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!metadata.content || metadata.content.trim().length === 0) {
    errors.push("Content is required");
  }

  if (metadata.content && metadata.content.length > 2000) {
    errors.push("Content too long (max 2000 characters)");
  }

  if (metadata.tags && metadata.tags.length > 10) {
    errors.push("Too many tags (max 10)");
  }

  if (metadata.tags) {
    metadata.tags.forEach((tag) => {
      if (tag.length > 50) {
        errors.push(`Tag too long: ${tag} (max 50 characters)`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Helper to extract hashtags from content
 */
export function extractHashtagsFromContent(content: string): string[] {
  const hashtagRegex = /#[\w]+/g;
  const matches = content.match(hashtagRegex);
  return matches ? matches.map((tag) => tag.slice(1)) : [];
}

/**
 * Helper to clean content for social sharing
 */
export function cleanContentForSharing(content: string): string {
  // Remove excessive whitespace
  let cleaned = content.replace(/\s+/g, " ").trim();

  // Ensure proper line breaks for social media
  cleaned = cleaned.replace(/\n\s*\n/g, "\n\n");

  return cleaned;
}
