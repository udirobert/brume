import { BRUME_AVATAR } from "../../anna/bundle/mascot-engine.js";
import type { BrumeAvatar } from "../../anna/bundle/mascot-engine.js";
import type { RoomDemeanor } from "./roomExperience";

const ATTENTIVE_SMILE = "M 44 60 Q 50 61 56 60 Q 50 61 44 60 Z";
const SHELTERING_SMILE = "M 44 61 Q 50 61 56 61 Q 50 61 44 61 Z";

const ATTENTIVE_AVATAR: BrumeAvatar = Object.freeze({
  ...BRUME_AVATAR,
  eyes: Object.freeze({ ...BRUME_AVATAR.eyes, ry: 3.8 }),
  mouths: Object.freeze({ ...BRUME_AVATAR.mouths, smile: ATTENTIVE_SMILE }),
});

const SHELTERING_AVATAR: BrumeAvatar = Object.freeze({
  ...BRUME_AVATAR,
  eyes: Object.freeze({ ...BRUME_AVATAR.eyes, ry: 3.4 }),
  mouths: Object.freeze({
    ...BRUME_AVATAR.mouths,
    smile: SHELTERING_SMILE,
    closed: SHELTERING_SMILE,
  }),
});

export function avatarForDemeanor(demeanor: RoomDemeanor | undefined): BrumeAvatar {
  if (demeanor === "attentive") return ATTENTIVE_AVATAR;
  if (demeanor === "sheltering") return SHELTERING_AVATAR;
  return BRUME_AVATAR;
}
