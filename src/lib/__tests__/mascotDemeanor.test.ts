import { describe, expect, it } from "vitest";
import {
  BRUME_AVATAR,
  validateAvatar,
} from "../../../anna/bundle/mascot-engine.js";
import { avatarForDemeanor } from "../mascotDemeanor";

describe("avatarForDemeanor", () => {
  it("returns the frozen shared avatar for open", () => {
    expect(avatarForDemeanor("open")).toBe(BRUME_AVATAR);
    expect(avatarForDemeanor(undefined)).toBe(BRUME_AVATAR);
  });

  it("attentive and sheltering avatars validate", () => {
    for (const demeanor of ["attentive", "sheltering"] as const) {
      const res = validateAvatar(avatarForDemeanor(demeanor));
      expect(res.ok, res.ok ? "" : res.errors.join(", ")).toBe(true);
    }
  });

  it("softens eyes and mouth without touching the base avatar", () => {
    const beforeMouths = { ...BRUME_AVATAR.mouths };
    const beforeRy = BRUME_AVATAR.eyes.ry;
    const attentive = avatarForDemeanor("attentive");
    const sheltering = avatarForDemeanor("sheltering");

    expect(attentive).not.toBe(BRUME_AVATAR);
    expect(sheltering).not.toBe(BRUME_AVATAR);
    expect(attentive.eyes.ry).toBe(3.8);
    expect(sheltering.eyes.ry).toBe(3.4);
    expect(attentive.mouths.smile).toBe("M 44 60 Q 50 61 56 60 Q 50 61 44 60 Z");
    expect(sheltering.mouths.smile).toBe("M 44 61 Q 50 61 56 61 Q 50 61 44 61 Z");
    expect(sheltering.mouths.closed).toBe(sheltering.mouths.smile);

    expect(BRUME_AVATAR.mouths).toEqual(beforeMouths);
    expect(BRUME_AVATAR.eyes.ry).toBe(beforeRy);
    expect(Object.isFrozen(BRUME_AVATAR)).toBe(true);
  });

  it("keeps body geometry identical to the shared avatar", () => {
    for (const demeanor of ["attentive", "sheltering"] as const) {
      const avatar = avatarForDemeanor(demeanor);
      expect(avatar.body).toBe(BRUME_AVATAR.body);
      expect(avatar.highlight).toBe(BRUME_AVATAR.highlight);
      expect(avatar.mouths.open).toBe(BRUME_AVATAR.mouths.open);
      expect(avatar.mouths.flat).toBe(BRUME_AVATAR.mouths.flat);
    }
  });
});
