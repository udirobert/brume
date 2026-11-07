import React from 'react';
import { Link } from 'react-router-dom';
import {
  LegalPage,
  LegalTOC,
  LegalSection,
  LegalH3,
  LegalList,
  LegalCallout,
  LegalFooter,
} from '@/components/legal/LegalPage';

const PrivacyPolicy = () => {
  return (
    <LegalPage
      title="Privacy Policy"
      lede="How Brume protects your privacy and handles your data"
      updated="Last updated: November 7, 2026"
      footer={
        <LegalFooter>
          <p>This privacy policy is effective as of November 4, 2026 and applies to all users of Brume.</p>
          <Link to="/" className="text-primary hover:underline underline-offset-2 mt-2 inline-block">
            Return to Brume
          </Link>
        </LegalFooter>
      }
    >
      {/* Executive Summary */}
      <LegalCallout tone="note">
        <h2 className="text-lg font-semibold text-foreground mb-3">
          Privacy First Approach
        </h2>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div>
            <h3 className="font-medium text-foreground mb-2">What We DO</h3>
            <ul className="space-y-1 text-muted-foreground">
              <li>• Store breathing session metrics</li>
              <li>• Sync preferences across devices</li>
              <li>• Keep the check-in ledger on your device unless you sign in</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium text-foreground mb-2">What We NEVER Do</h3>
            <ul className="space-y-1 text-muted-foreground">
              <li>• Measure clinical or medical breath quality</li>
              <li>• Track you across other websites</li>
              <li>• Sell your personal data</li>
              <li>• Access your private keys</li>
            </ul>
          </div>
        </div>
      </LegalCallout>

      {/* Table of Contents */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-foreground mb-4">Contents</h2>
        <LegalTOC
          items={[
            { href: '#information-we-collect', label: '1. Information We Collect' },
            { href: '#how-we-use-information', label: '2. How We Use Your Information' },
            { href: '#video-camera-data', label: '3. Camera and microphone' },
            { href: '#account', label: '4. Your account, if you make one' },
            { href: '#data-storage', label: '5. Data Storage and Security' },
            { href: '#sharing', label: '6. Information Sharing' },
            { href: '#your-rights', label: '7. Your Rights and Choices' },
            { href: '#children', label: "8. Children's Privacy" },
            { href: '#changes', label: '9. Changes to This Policy' },
            { href: '#contact', label: '10. Contact Information' },
          ]}
        />
      </div>

      {/* Section 1 */}
      <LegalSection id="information-we-collect" title="1. Information We Collect">
        <div className="space-y-6">
          <div>
            <LegalH3>Account Information</LegalH3>
            <LegalList>
              <li>Email address (for account creation and communication)</li>
              <li>Username and display name</li>
              <li>Profile preferences and settings</li>
            </LegalList>
          </div>

          <div>
            <LegalH3>Session Data</LegalH3>
            <LegalList>
              <li>Breathing session duration and timestamps</li>
              <li>Breathing patterns used and completion rates</li>
              <li>The check-in word you confirmed, stored as a word from our own list — never a note you typed</li>
            </LegalList>
          </div>

          <div>
            <LegalH3>Technical Information</LegalH3>
            <LegalList>
              <li>App usage counts (see "How we measure" below — numbers and closed lists, never words)</li>
              <li>Standard web-hosting request data, kept by the host, not gathered by Brume</li>
            </LegalList>
          </div>
        </div>
      </LegalSection>

      <LegalSection id="experiment-events" title="How we measure">
        <LegalCallout tone="note">
          <p className="text-muted-foreground mb-4">
            Brume keeps a small number of <strong>anonymous counts</strong> so we can learn what people do and improve it. No account is needed and no analytics company is involved: eight events are sent to Brume's own counter on this site, and that counter keeps <strong>daily totals only</strong> — no device id, no cookie, no profile, nothing that could single anyone out. What follows is exactly what may leave your device, and every field in it is a number, a boolean, or a member of a closed list. Nothing else is sent.
          </p>
          <h3 className="font-medium text-foreground mb-2">Sent to the counter</h3>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 text-sm">
            <li>Visits — two day numbers: how long since your first visit, and how long since your last one, plus which of three versions of the home screen this device was given (a closed list; it is what lets us tell whether a change makes people come back)</li>
            <li>Sessions — that one started, and that it finished or was left, with the pattern name, seconds and cycles</li>
            <li>How the room felt afterwards — one of three choices on a closed list, and how many times you changed the room before answering</li>
            <li>The sentence card — that you opened it, and that you changed the sentence we offered into your own. Which is the act of writing, not the words: your sentence is never part of this count</li>
            <li>Drawing in the room — that you drew on the home screen, how many strokes and roughly how many seconds, and which room material was showing. Never the drawing itself: not its shape, not where on the screen</li>
          </ul>
          <h3 className="font-medium text-foreground mt-4 mb-2">Counted on your device, never sent</h3>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 text-sm">
            <li>Which room material you pick, and whether you resume from the landing</li>
            <li>That you copied or shared a Words Card, and whether the optional quiet-room link was on</li>
            <li>Which check-in word you confirmed and which reason you picked — positions in a closed list of fourteen and six, never the words themselves</li>
          </ul>
          <h3 className="font-medium text-foreground mt-4 mb-2">What we never count</h3>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 text-sm">
            <li>Anything you typed — message text, the Words Card, a reason you chose to keep private</li>
            <li>Anything you said — the microphone returns a match, then drops the sentence; only the word you confirm is recorded, and as a number</li>
            <li>Your breath timing beyond duration and cycle count</li>
            <li>The mist drawing itself — its shape, where you drew, or what it looked like</li>
            <li>Audio recordings — nothing you say is stored</li>
          </ul>
          <h3 className="font-medium text-foreground mt-4 mb-2">The voice service</h3>
          <p className="text-muted-foreground text-sm">
            Breath cues are pre-recorded files that play on your device.
            Three optional moments use our voice service (AssemblyAI): the
            line Brume says when you tap Begin, "Hear it" on your Words
            Card, and the check-in microphone while you hold or tap "say it". The
            first two send only the words being spoken, to be spoken back.
            The third sends audio while you speak, returns words, and
            matches them against the fourteen feelings — the audio is not
            stored and the sentence is not kept. "Just for me" cards never
            offer the spoken option. See "Camera and microphone" below.
          </p>
          <p className="text-muted-foreground mt-4 text-sm">
            If you ever want us to stop counting, just leave the app. All data stays local unless you explicitly share a Words Card or proof image.
          </p>
        </LegalCallout>
      </LegalSection>

      {/* Section 2 */}
      <LegalSection id="how-we-use-information" title="2. How We Use Your Information">
        <LegalList>
          <li><strong>Provide Services:</strong> Run breathing sessions, the check-in, and the progress you can look back on</li>
          <li><strong>Personalization:</strong> Customize your experience and provide relevant breathing patterns</li>
          <li><strong>Analytics:</strong> Understand app usage to improve features and performance</li>
          <li><strong>Account notices:</strong> Only the emails a login system has to send — verifying an address and resetting a password. Brume sends no newsletters and no tips</li>
          <li><strong>Security:</strong> Detect and prevent fraud, abuse, and security incidents</li>
          <li><strong>Legal Compliance:</strong> Meet our legal obligations and protect user rights</li>
        </LegalList>
      </LegalSection>

      {/* Section 3 */}
      <LegalSection id="video-camera-data" title="3. Camera and microphone">
        <LegalCallout tone="good">
          <p className="text-foreground font-medium">
            The web app does not use your camera
          </p>
        </LegalCallout>
        <div className="space-y-4">
          <p>
            Brume never requests camera access. No image or video is
            captured, sent, or processed — sessions are guided breathing
            only. Session history is stored on your device, and in
            Supabase if you sign in.
          </p>
          <LegalH3>Microphone</LegalH3>
          <p>
            The microphone stays off until you hold or tap "say it" beside
            the check-in words. Each hold or tap listens for one sentence.
            By default it listens while you hold the button and stops when
            you let go; if you choose tap in the options, one tap starts it
            and it stops on a quiet stretch or a second tap. Your speech
            goes to AssemblyAI to be turned into words; Brume matches
            those words against the fourteen feelings and offers the
            closest one face-up — it never chooses for you, and a sentence
            containing "not" is never read as the opposite of itself.
          </p>
          <p>
            Nothing from that moment is kept. The audio is not stored, the
            transcript is not written to your history, and no count is made
            of what you said — your history records the feeling you
            confirmed, as a word you tapped. Your browser asks for
            permission the first time and you can refuse it; every check-in
            works by tapping instead, and nothing about Brume depends on
            the microphone being on.
          </p>
        </div>
      </LegalSection>

      {/* Section 4 */}
      <LegalSection id="account" title="4. Your account, if you make one">
        <div className="space-y-4">
          <p>
            An account is optional. Without one, everything stays on your device and Brume never asks who you are.
          </p>

          <div>
            <LegalH3>What signing in stores</LegalH3>
            <LegalList>
              <li>Your email address and a password, handled by Supabase — Brume never sees the password itself, only the login session Supabase issues</li>
              <li>A profile row with the name, username and avatar you choose to fill in, so the same account looks the same on another device</li>
              <li>Your session history and check-in words, so the room can remember your practice — these are rows only your account can read</li>
            </LegalList>
          </div>

          <div>
            <LegalH3>What Brume does not do</LegalH3>
            <LegalList>
              <li><strong>No wallets, no blockchain.</strong> Brume has no wallet sign-in, keeps no record on any chain, and issues no credential or attestation about your practice</li>
              <li><strong>No social graph.</strong> There is no profile other people can read, nothing to follow, and no way to publish a session</li>
              <li><strong>Nothing public.</strong> No part of your practice is written out to any public store</li>
              <li><strong>No paywall.</strong> The room, the patterns and the check-in are the whole product; there is no tier to buy</li>
            </LegalList>
          </div>

          <p className="text-sm">
            Until 4 November 2026 this section described wallet sign-in, on-chain credential attestations and a Lens Protocol social profile. Those features were removed from the app rather than shipped, and this page was rewritten to match.
          </p>
        </div>
      </LegalSection>

      {/* Section 5 */}
      <LegalSection id="data-storage" title="5. Data Storage and Security">
        <div className="space-y-4">
          <div>
            <LegalH3>Data Storage</LegalH3>
            <LegalList>
              <li><strong>Your device:</strong> session history, the check-in ledger and your preferences, in local storage — this is where everything lives if you never sign in</li>
              <li><strong>Supabase (Cloud):</strong> account rows and, for signed-in people, synced history. Access is restricted per row to the account that owns it; the data is not additionally encrypted by Brume itself</li>
              <li><strong>Netlify (Cloud):</strong> the site itself, the voice proxy, and the anonymous daily counters described above</li>
              <li><strong>Hetzner Servers:</strong> EU-based servers for the voice service</li>
            </LegalList>
          </div>

          <div>
            <LegalH3>Security Measures</LegalH3>
            <LegalList>
              <li>End-to-end encryption for sensitive data transmission</li>
              <li>Regular security audits and vulnerability assessments</li>
              <li>Secure authentication with JWT tokens and refresh cycles</li>
              <li>GDPR-compliant data processing and storage practices</li>
              <li>Access controls and monitoring for all data systems</li>
            </LegalList>
          </div>

          <div>
            <LegalH3>Data Retention</LegalH3>
            <LegalList>
              <li>Account and session data: kept while the account exists, and removed when you ask us to delete it</li>
              <li>Everything on your device: kept until you clear it yourself, in your browser's site data — Brume has no copy to withhold</li>
              <li>The voice service: audio and transcript are dropped as the match is made; nothing is retained</li>
              <li>The anonymous counters: one aggregate document per day, with no date and no person inside it to delete</li>
            </LegalList>
          </div>
        </div>
      </LegalSection>

      {/* Section 6 */}
      <LegalSection id="sharing" title="6. Information Sharing">
        <div className="space-y-4">
          <p>We share your information only in these specific circumstances:</p>

          <div>
            <LegalH3>Only where you hand something over yourself</LegalH3>
            <LegalList>
              <li>Copying or sharing a Words Card leaves your device through your own browser or app — Brume keeps no copy of it and publishes nothing on your behalf</li>
              <li>The voice service runs only on the three taps described in section 3, and returns words rather than keeping them</li>
              <li>There are no social features to consent to: no profile anyone else can read, nothing to publish</li>
            </LegalList>
          </div>

          <div>
            <LegalH3>Service Providers</LegalH3>
            <LegalList>
              <li>Cloud infrastructure providers (Supabase, Hetzner)</li>
              <li>AssemblyAI, via our own voice service, for the spoken lines and the check-in microphone</li>
              <li>Analytics services (anonymized usage data only)</li>
              <li>All providers are bound by strict data protection agreements</li>
            </LegalList>
          </div>

          <div>
            <LegalH3>Legal Requirements</LegalH3>
            <LegalList>
              <li>To comply with legal obligations and court orders</li>
              <li>To protect our rights, property, and safety</li>
              <li>To investigate fraud, security incidents, or policy violations</li>
              <li>In connection with business transfers (with notice to users)</li>
            </LegalList>
          </div>
        </div>
      </LegalSection>

      {/* Section 7 */}
      <LegalSection id="your-rights" title="7. Your Rights and Choices">
        <div className="space-y-4">
          <div>
            <LegalH3>Data Control</LegalH3>
            <LegalList>
              <li><strong>Access:</strong> Your own history is always on screen — Progress shows it, and it lives on your device unless you sign in</li>
              <li><strong>Update:</strong> Name, username and avatar, on Profile</li>
              <li><strong>Delete:</strong> Ask by email and the rows tied to your account are removed; clearing your browser's site data removes everything the device kept, immediately and without asking anyone</li>
              <li><strong>Leave:</strong> Sign out. Nothing continues to be associated with you</li>
            </LegalList>
          </div>

          <div>
            <LegalH3>Settings you actually have</LegalH3>
            <LegalList>
              <li>The room: material and cue overrides, and a still room if you want one</li>
              <li>The voice: one glyph cycles spoken cues, breath-only cues, and quiet</li>
              <li>The microphone: used only while you hold or tap "say it", and your browser asks first</li>
              <li>There is no analytics switch, no AI switch and no sharing switch, because there is nothing behind them to turn off</li>
            </LegalList>
          </div>

          <div>
            <LegalH3>Regional Rights</LegalH3>
            <p>Depending on your location, you may have additional rights under:</p>
            <LegalList>
              <li><strong>GDPR (EU):</strong> Right to portability, rectification, and erasure</li>
              <li><strong>CCPA (California):</strong> Right to know, delete, and opt-out</li>
              <li><strong>Other Laws:</strong> We comply with applicable privacy regulations worldwide</li>
            </LegalList>
          </div>
        </div>
      </LegalSection>

      {/* Section 8 */}
      <LegalSection id="children" title="8. Children's Privacy">
        <LegalCallout tone="warning">
          <p className="text-foreground">
            <strong>Age Requirement:</strong> Our service is designed for users 13 years and older.
          </p>
        </LegalCallout>
        <div className="space-y-3">
          <p>We are committed to protecting children's privacy:</p>
          <LegalList>
            <li>We do not knowingly collect personal information from children under 13</li>
            <li>If we learn that we have collected information from a child under 13, we will delete it immediately</li>
            <li>Parents who believe their child has provided us with information should contact us</li>
            <li>For users 13-17, we recommend parental guidance when using breathing and wellness features</li>
          </LegalList>
          <p className="mt-4">
            <strong>For App Store compliance:</strong> If your target audience includes children under 13, additional safety measures and parental consent mechanisms may be required.
          </p>
        </div>
      </LegalSection>

      {/* Section 9 */}
      <LegalSection id="changes" title="9. Changes to This Policy">
        <div className="space-y-3">
          <p>We may update this Privacy Policy from time to time. When we do:</p>
          <LegalList>
            <li>We will post the updated policy on this page</li>
            <li>We will update the "Last updated" date at the top</li>
            <li>For significant changes, we will notify you via email or in-app notification</li>
            <li>Continued use of the service after changes constitutes acceptance</li>
            <li>You can review previous versions of this policy in our documentation</li>
          </LegalList>
        </div>
      </LegalSection>

      {/* Section 10 */}
      <LegalSection id="contact" title="10. Contact Information">
        <div className="space-y-4">
          <p>If you have questions about this Privacy Policy or your personal data, please contact us:</p>

          <div className="bg-foreground/5 p-4 rounded-xl">
            <div className="space-y-2">
              <p><strong>Contact:</strong> <a href="https://github.com/udirobert/brume/issues" className="text-primary hover:underline underline-offset-2">github.com/udirobert/brume/issues</a></p>
              <p><strong>Website:</strong> <a href="https://brume.trustfall.xyz" className="text-primary hover:underline underline-offset-2">brume.trustfall.xyz</a></p>
              <p><strong>Response Time:</strong> We typically respond within 72 hours</p>
            </div>
          </div>

          <div>
            <LegalH3>For Data Protection Requests</LegalH3>
            <p>Please include the following information in your request:</p>
            <LegalList>
              <li>Your registered email address</li>
              <li>Specific nature of your request (access, deletion, etc.)</li>
              <li>Any relevant account or transaction information</li>
              <li>Preferred method for receiving our response</li>
            </LegalList>
          </div>
        </div>
      </LegalSection>
    </LegalPage>
  );
};

export default PrivacyPolicy;
