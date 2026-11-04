/**
 * PrivacyPolicy — the sensing copy must match the real implementation: no
 * camera at all, and a microphone that is opt-in, one sentence at a time,
 * and records nothing. A published claim that has simply gone stale is worse
 * than no claim, so the wording the app no longer stands behind is pinned
 * out as well as the wording it now uses.
 */
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import PrivacyPolicy from "../PrivacyPolicy";

const html = renderToString(
  <MemoryRouter>
    <PrivacyPolicy />
  </MemoryRouter>,
);

describe("PrivacyPolicy camera copy", () => {
  it("states the camera is not used", () => {
    expect(html).toContain("does not use your camera");
    expect(html).toContain("never requests camera access");
  });

  it("describes no frame capture or processing", () => {
    expect(html).not.toContain("MediaPipe");
    expect(html).not.toContain("sent to Brume&#x27;s backend for processing");
    expect(html).not.toContain("face landmarks");
    expect(html).not.toContain("camera feedback");
  });

  it("pins the last-updated date", () => {
    expect(html).toContain("Last updated: November 4, 2026");
  });
});

describe("PrivacyPolicy microphone copy", () => {
  it("never claims the microphone is unused", () => {
    expect(html).not.toContain("Camera or microphone input");
    expect(html).not.toContain("never requests microphone");
    expect(html).not.toContain("no microphone");
  });

  it("says what the microphone does, and when", () => {
    expect(html).toContain("The microphone stays off until you tap");
    expect(html).toContain("One tap listens for one sentence");
    expect(html).toContain("AssemblyAI");
  });

  it("states that nothing from the listening is kept", () => {
    expect(html).toContain("The audio is not stored");
    expect(html).toContain("the transcript is not written to your history");
  });

  it("keeps voice proposing, never deciding", () => {
    expect(html).toContain("it never chooses for you");
    expect(html).toContain("works by tapping instead");
  });
});

describe("PrivacyPolicy counting copy", () => {
  it("names the counter it actually sends to, and what the counter keeps", () => {
    expect(html).toContain("Brume&#x27;s own counter");
    expect(html).toContain("daily totals only");
    expect(html).toContain("no device id");
    expect(html).toContain("Nothing else is sent");
  });

  it("splits what leaves the device from what stays on it", () => {
    expect(html).toContain("Sent to the counter");
    expect(html).toContain("Counted on your device, never sent");
    // The claim that nothing was ever sent is no longer true, so it must not
    // survive anywhere on the page.
    expect(html).not.toContain("Nothing is sent today");
    expect(html).not.toContain("no analytics provider wired in");
  });

  it("counts the check-in as a position, never as a word", () => {
    expect(html).toContain("positions in a closed list of fourteen and six");
    // The claim that feelings are never counted was false: the ledger
    // stores the index and track() carries it. Words are what is never kept.
    expect(html).not.toContain("or check-in feelings");
  });

  it("sends day numbers for visits, never a person", () => {
    expect(html).toContain("how long since your first visit");
    expect(html).toContain("how long since your last one");
    expect(html).not.toContain("user id");
  });

  it("never counts what you typed or what you said", () => {
    expect(html).toContain("Anything you typed");
    expect(html).toContain("Anything you said");
    expect(html).toContain("drops the sentence");
  });
});

describe("PrivacyPolicy account copy", () => {
  it("describes an account as an email and nothing else", () => {
    expect(html).toContain("4. Your account, if you make one");
    expect(html).toContain("Your email address and a password");
  });

  it("says out loud what Brume does not do", () => {
    expect(html).toContain("No wallets, no blockchain.");
    expect(html).toContain("No social graph.");
    expect(html).toContain("No paywall.");
  });

  it("drops every claim the app never shipped", () => {
    // Headings and bullets as this page worded them while the features were
    // only promised. A stale claim is worse than a missing one.
    for (const stale of [
      "Blockchain and Web3 Data",
      "Credentials and Blockchain Data",
      "Flow Blockchain",
      "Wallet Integration",
      "Lens Protocol V3",
      "Verified practice credential",
      "Public attestation records",
      "Wallet addresses",
      "consistency scores",
      "optional newsletters",
      "Decentralized storage",
      "IPFS",
      "lens.xyz",
    ]) {
      expect(html, stale).not.toContain(stale);
    }
  });

  it("keeps the one sentence that names the change", () => {
    // The date line is the only place a removed feature may be named, so the
    // rest of the page cannot quietly re-describe it.
    expect(html.match(/Until 4 November 2026/g)).toHaveLength(1);
    expect(html).toContain("removed from the app rather than shipped");
  });

  it("sells nothing anywhere on the page", () => {
    for (const commercial of ["upgrade", "premium", "checkout", "pro plan"]) {
      expect(html.toLowerCase(), commercial).not.toContain(commercial);
    }
  });

  it("mentions a newsletter only to deny one", () => {
    expect(html).toContain("Brume sends no newsletters");
  });

  it("has no anchor left named after a chain", () => {
    expect(html).not.toMatch(/#blockchain-data/);
    expect(html).toContain('id="account"');
  });
});
