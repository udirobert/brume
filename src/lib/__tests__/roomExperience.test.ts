import { beforeEach, describe, expect, it } from "vitest";
import {
  FEEL_MATERIALS,
  demeanorForFeel,
  materialForFeel,
  practiceProgress,
  resolvedMaterial,
  useRoomExperience,
} from "../roomExperience";
import { CHECK_IN_FEELS, applyFeel, feelAt } from "../feelTheme";
import { CHECK_IN_SHORT_LABELS } from "../checkin";

describe("materialForFeel", () => {
  it("maps the five words onto the five evocative materials", () => {
    for (let i = 0; i < FEEL_MATERIALS.length; i++) {
      expect(materialForFeel(i)).toBe(FEEL_MATERIALS[i]);
    }
  });

  it("falls back to mist for null and invalid input", () => {
    expect(materialForFeel(null)).toBe("mist");
    expect(materialForFeel(undefined)).toBe("mist");
    expect(materialForFeel(-1)).toBe("mist");
    expect(materialForFeel(14)).toBe("mist");
    expect(materialForFeel(99)).toBe("mist");
    expect(materialForFeel(5)).toBe("sand");
    expect(materialForFeel(NaN)).toBe("mist");
    expect(materialForFeel(0.5)).toBe("mist");
  });
});

describe("demeanorForFeel", () => {
  it("shelters the two heaviest words, attends the middle, opens the rest", () => {
    expect(demeanorForFeel(0)).toBe("open");
    expect(demeanorForFeel(1)).toBe("attentive");
    expect(demeanorForFeel(2)).toBe("attentive");
    expect(demeanorForFeel(3)).toBe("sheltering");
    expect(demeanorForFeel(4)).toBe("sheltering");
    expect(demeanorForFeel(null)).toBe("open");
    expect(demeanorForFeel(undefined)).toBe("open");
  });

  it("matches the demeanor stored on each feel entry", () => {
    for (let i = 0; i < CHECK_IN_FEELS.length; i++) {
      expect(CHECK_IN_FEELS[i].demeanor).toBe(demeanorForFeel(i));
    }
  });
});

describe("practiceProgress", () => {
  it("clamps to 0..1 over ninety seconds", () => {
    expect(practiceProgress(0)).toBe(0);
    expect(practiceProgress(45)).toBe(0.5);
    expect(practiceProgress(90)).toBe(1);
    expect(practiceProgress(400)).toBe(1);
    expect(practiceProgress(-5)).toBe(0);
    expect(practiceProgress(NaN)).toBe(0);
    expect(practiceProgress(Infinity)).toBe(0);
    expect(practiceProgress(-Infinity)).toBe(0);
  });
});

describe("useRoomExperience", () => {
  beforeEach(() => {
    useRoomExperience.getState().reset();
  });

  it("setFeel keeps progress when the same word is picked again", () => {
    const s = useRoomExperience.getState();
    s.setFeel(2);
    s.setPractice({ progress: 0.6 });
    s.setFeel(2);
    expect(useRoomExperience.getState().progress).toBe(0.6);
  });

  it("setFeel resets progress only when the word changes", () => {
    const s = useRoomExperience.getState();
    s.setFeel(1);
    s.setPractice({ progress: 0.4 });
    s.setFeel(3);
    expect(useRoomExperience.getState().feelIndex).toBe(3);
    expect(useRoomExperience.getState().progress).toBe(0);
  });

  it("setFeel rejects non-integers and out-of-range picks", () => {
    const s = useRoomExperience.getState();
    s.setFeel(2);
    s.setFeel(NaN);
    expect(useRoomExperience.getState().feelIndex).toBeNull();
    s.setFeel(2);
    s.setFeel(14);
    expect(useRoomExperience.getState().feelIndex).toBeNull();
    s.setFeel(7);
    expect(useRoomExperience.getState().feelIndex).toBe(7);
    s.setFeel(0.5);
    expect(useRoomExperience.getState().feelIndex).toBeNull();
  });

  it("a material override resolves without touching the feel", () => {
    const s = useRoomExperience.getState();
    s.setFeel(4);
    s.setMaterial("sand");
    const state = useRoomExperience.getState();
    expect(state.feelIndex).toBe(4);
    expect(resolvedMaterial(state)).toBe("sand");
    s.setMaterial(null);
    expect(resolvedMaterial(useRoomExperience.getState())).toBe("ink");
  });

  it("setMaterial rejects unknown material names", () => {
    const s = useRoomExperience.getState();
    s.setMaterial("bogus" as never);
    expect(useRoomExperience.getState().materialOverride).toBeNull();
  });

  it("reset restores every default", () => {
    const s = useRoomExperience.getState();
    s.setFeel(3);
    s.setMaterial("snow");
    s.setStill(true);
    s.setPractice({ progress: 0.9, breath: 0.4, practicing: true, paused: true });
    s.reset();
    const state = useRoomExperience.getState();
    expect(state).toMatchObject({
      feelIndex: null,
      materialOverride: null,
      still: false,
      progress: 0,
      breath: 0,
      practicing: false,
      paused: false,
    });
  });
});

describe("feel routing", () => {
  beforeEach(() => {
    useRoomExperience.getState().reset();
  });

  it("feelAt rejects NaN and fractions", () => {
    expect(feelAt(NaN)).toBeNull();
    expect(feelAt(0.5)).toBeNull();
    expect(feelAt(2.999)).toBeNull();
    expect(feelAt(2)).toBe(CHECK_IN_FEELS[2]);
  });

  it("heavier words never map to bright, stretch, proud, hum, hop or celebrate", () => {
    for (const feel of CHECK_IN_FEELS.filter((f) => f.valence === "heavy")) {
      expect(feel.state).not.toBe("bright");
      expect(feel.state).not.toBe("stretch");
      expect(feel.state).not.toBe("proud");
      expect(feel.state).not.toBe("hum");
      expect(feel.reaction).not.toBe("hop");
      expect(feel.reaction).not.toBe("celebrate");
    }
    expect(CHECK_IN_FEELS[0].reaction).toBe("hop");
    expect(CHECK_IN_FEELS[0].state).toBe("bright");
  });

  it("every word routes to a one-shot reaction so stale reactions are superseded", () => {
    for (const feel of CHECK_IN_FEELS) {
      expect(feel.reaction).toBeTruthy();
    }
  });

  it("applyFeel syncs the store and clears on invalid input", () => {
    applyFeel(3);
    expect(useRoomExperience.getState().feelIndex).toBe(3);
    applyFeel(0.5);
    expect(useRoomExperience.getState().feelIndex).toBeNull();
    applyFeel(2);
    applyFeel(null);
    expect(useRoomExperience.getState().feelIndex).toBeNull();
  });
});
