import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Shield, Eye, Database, Users, Lock, Globe } from 'lucide-react';

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <Link
            to="/"
            className="inline-flex items-center text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 mb-4 transition-colors"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to App
          </Link>
          <div className="flex items-center mb-4">
            <Shield className="h-8 w-8 text-blue-600 dark:text-blue-400 mr-3" />
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Privacy Policy</h1>
          </div>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            How Brume protects your privacy and handles your data
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Last updated: November 4, 2026
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 mb-8">
          {/* Executive Summary */}
          <div className="mb-8 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <h2 className="text-xl font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center">
              <Eye className="mr-2 h-5 w-5" />
              Privacy First Approach
            </h2>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <h3 className="font-medium text-green-700 dark:text-green-300 mb-2">✅ What We DO</h3>
                <ul className="space-y-1 text-gray-700 dark:text-gray-300">
                  <li>• Store breathing session metrics</li>
                  <li>• Sync preferences across devices</li>
                  <li>• Keep the check-in ledger on your device unless you sign in</li>
                </ul>
              </div>
              <div>
                <h3 className="font-medium text-red-700 dark:text-red-300 mb-2">❌ What We NEVER Do</h3>
                <ul className="space-y-1 text-gray-700 dark:text-gray-300">
                  <li>• Measure clinical or medical breath quality</li>
                  <li>• Track you across other websites</li>
                  <li>• Sell your personal data</li>
                  <li>• Access your private keys</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Table of Contents */}
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">Contents</h2>
            <nav className="space-y-2 text-blue-600 dark:text-blue-400">
              <a href="#information-we-collect" className="block hover:underline">1. Information We Collect</a>
              <a href="#how-we-use-information" className="block hover:underline">2. How We Use Your Information</a>
              <a href="#video-camera-data" className="block hover:underline">3. Camera and microphone</a>
              <a href="#account" className="block hover:underline">4. Your account, if you make one</a>
              <a href="#data-storage" className="block hover:underline">5. Data Storage and Security</a>
              <a href="#sharing" className="block hover:underline">6. Information Sharing</a>
              <a href="#your-rights" className="block hover:underline">7. Your Rights and Choices</a>
              <a href="#children" className="block hover:underline">8. Children's Privacy</a>
              <a href="#changes" className="block hover:underline">9. Changes to This Policy</a>
              <a href="#contact" className="block hover:underline">10. Contact Information</a>
            </nav>
          </div>

          {/* Section 1 */}
          <section id="information-we-collect" className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <Database className="mr-2 h-5 w-5" />
              1. Information We Collect
            </h2>

            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">Account Information</h3>
                <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-1">
                  <li>Email address (for account creation and communication)</li>
                  <li>Username and display name</li>
                  <li>Profile preferences and settings</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">Session Data</h3>
                <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-1">
                  <li>Breathing session duration and timestamps</li>
                  <li>Breathing patterns used and completion rates</li>
                  <li>The check-in word you confirmed, stored as a word from our own list — never a note you typed</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">Technical Information</h3>
                <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-1">
                  <li>App usage counts (see "How we measure" below — numbers and closed lists, never words)</li>
                  <li>Standard web-hosting request data, kept by the host, not gathered by Brume</li>
                </ul>
              </div>
            </div>
          </section>

          <section id="experiment-events" className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              How we measure
            </h2>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Brume keeps a small number of <strong>anonymous counts</strong> so we can learn what people do and improve it. No account is needed and no analytics company is involved: five events are sent to Brume's own counter on this site, and that counter keeps <strong>daily totals only</strong> — no device id, no cookie, no profile, nothing that could single anyone out. What follows is exactly what may leave your device, and every field in it is a number, a boolean, or a member of a closed list. Nothing else is sent.
              </p>
              <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Sent to the counter</h3>
              <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-1 text-sm">
                <li>Visits — two day numbers: how long since your first visit, and how long since your last one</li>
                <li>Sessions — that one started, and that it finished or was left, with the pattern name, seconds and cycles</li>
                <li>How the room felt afterwards — one of three choices on a closed list, and how many times you changed the room before answering</li>
              </ul>
              <h3 className="font-medium text-gray-900 dark:text-gray-100 mt-4 mb-2">Counted on your device, never sent</h3>
              <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-1 text-sm">
                <li>Which room material you pick, and whether you resume from the landing</li>
                <li>That you drew in the room (strokes and seconds, never the drawing itself)</li>
                <li>That you copied or shared a Words Card, and whether the optional quiet-room link was on</li>
                <li>Which check-in word you confirmed and which reason you picked — positions in a closed list of fourteen and six, never the words themselves</li>
              </ul>
              <h3 className="font-medium text-gray-900 dark:text-gray-100 mt-4 mb-2">What we never count</h3>
              <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-1 text-sm">
                <li>Anything you typed — message text, the Words Card, a reason you chose to keep private</li>
                <li>Anything you said — the microphone returns a match, then drops the sentence; only the word you confirm is recorded, and as a number</li>
                <li>Your breath timing beyond duration and cycle count</li>
                <li>Anything from the mist drawing</li>
                <li>Audio recordings — nothing you say is stored</li>
              </ul>
              <h3 className="font-medium text-gray-900 dark:text-gray-100 mt-4 mb-2">The voice service</h3>
              <p className="text-gray-700 dark:text-gray-300 text-sm">
                Breath cues are pre-recorded files that play on your device.
                Three optional moments use our voice service (AssemblyAI): the
                line Brume says when you tap Begin, "Hear it" on your Words
                Card, and the check-in microphone when you tap "say it". The
                first two send only the words being spoken, to be spoken back.
                The third sends audio while you speak, returns words, and
                matches them against the fourteen feelings — the audio is not
                stored and the sentence is not kept. "Just for me" cards never
                offer the spoken option. See "Camera and microphone" below.
              </p>
              <p className="text-gray-700 dark:text-gray-300 mt-4 text-sm">
                If you ever want us to stop counting, just leave the app. All data stays local unless you explicitly share a Words Card or proof image.
              </p>
            </div>
          </section>

          {/* Section 2 */}
          <section id="how-we-use-information" className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              2. How We Use Your Information
            </h2>
            <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-2">
              <li><strong>Provide Services:</strong> Run breathing sessions, the check-in, and the progress you can look back on</li>
              <li><strong>Personalization:</strong> Customize your experience and provide relevant breathing patterns</li>
              <li><strong>Analytics:</strong> Understand app usage to improve features and performance</li>
              <li><strong>Account notices:</strong> Only the emails a login system has to send — verifying an address and resetting a password. Brume sends no newsletters and no tips</li>
              <li><strong>Security:</strong> Detect and prevent fraud, abuse, and security incidents</li>
              <li><strong>Legal Compliance:</strong> Meet our legal obligations and protect user rights</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section id="video-camera-data" className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              3. Camera and microphone
            </h2>
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800 mb-4">
              <p className="text-green-800 dark:text-green-200 font-medium">
                🛡️ The web app does not use your camera
              </p>
            </div>
            <div className="space-y-4 text-gray-600 dark:text-gray-300">
              <p>
                Brume never requests camera access. No image or video is
                captured, sent, or processed — sessions are guided breathing
                only. Session history is stored on your device, and in
                Supabase if you sign in.
              </p>
              <h3 className="font-medium text-gray-800 dark:text-gray-200 mb-2">
                Microphone
              </h3>
              <p>
                The microphone stays off until you tap "say it" beside the
                check-in words. One tap listens for one sentence. Your speech
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
          </section>

          {/* Section 4 */}
          <section id="account" className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              4. Your account, if you make one
            </h2>
            <div className="space-y-4 text-gray-600 dark:text-gray-300">
              <p>
                An account is optional. Without one, everything stays on your device and Brume never asks who you are.
              </p>

              <div>
                <h3 className="font-medium text-gray-800 dark:text-gray-200 mb-2">What signing in stores</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>Your email address and a password, handled by Supabase — Brume never sees the password itself, only the login session Supabase issues</li>
                  <li>A profile row with the name, username and avatar you choose to fill in, so the same account looks the same on another device</li>
                  <li>Your session history and check-in words, so the room can remember your practice — these are rows only your account can read</li>
                </ul>
              </div>

              <div>
                <h3 className="font-medium text-gray-800 dark:text-gray-200 mb-2">What Brume does not do</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li><strong>No wallets, no blockchain.</strong> Brume has no wallet sign-in, keeps no record on any chain, and issues no credential or attestation about your practice</li>
                  <li><strong>No social graph.</strong> There is no profile other people can read, nothing to follow, and no way to publish a session</li>
                  <li><strong>Nothing public.</strong> No part of your practice is written out to any public store</li>
                  <li><strong>No paywall.</strong> The room, the patterns and the check-in are the whole product; there is no tier to buy</li>
                </ul>
              </div>

              <p className="text-sm">
                Until 4 November 2026 this section described wallet sign-in, on-chain credential attestations and a Lens Protocol social profile. Those features were removed from the app rather than shipped, and this page was rewritten to match.
              </p>
            </div>
          </section>

          {/* Section 5 */}
          <section id="data-storage" className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <Lock className="mr-2 h-5 w-5" />
              5. Data Storage and Security
            </h2>
            <div className="space-y-4 text-gray-600 dark:text-gray-300">
              <div>
                <h3 className="font-medium text-gray-800 dark:text-gray-200 mb-2">Data Storage</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li><strong>Your device:</strong> session history, the check-in ledger and your preferences, in local storage — this is where everything lives if you never sign in</li>
                  <li><strong>Supabase (Cloud):</strong> account rows and, for signed-in people, synced history. Access is restricted per row to the account that owns it; the data is not additionally encrypted by Brume itself</li>
                  <li><strong>Netlify (Cloud):</strong> the site itself, the voice proxy, and the anonymous daily counters described above</li>
                  <li><strong>Hetzner Servers:</strong> EU-based servers for the voice service</li>
                </ul>
              </div>

              <div>
                <h3 className="font-medium text-gray-800 dark:text-gray-200 mb-2">Security Measures</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>End-to-end encryption for sensitive data transmission</li>
                  <li>Regular security audits and vulnerability assessments</li>
                  <li>Secure authentication with JWT tokens and refresh cycles</li>
                  <li>GDPR-compliant data processing and storage practices</li>
                  <li>Access controls and monitoring for all data systems</li>
                </ul>
              </div>

              <div>
                <h3 className="font-medium text-gray-800 dark:text-gray-200 mb-2">Data Retention</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>Account and session data: kept while the account exists, and removed when you ask us to delete it</li>
                  <li>Everything on your device: kept until you clear it yourself, in your browser's site data — Brume has no copy to withhold</li>
                  <li>The voice service: audio and transcript are dropped as the match is made; nothing is retained</li>
                  <li>The anonymous counters: one aggregate document per day, with no date and no person inside it to delete</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 6 */}
          <section id="sharing" className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <Users className="mr-2 h-5 w-5" />
              6. Information Sharing
            </h2>
            <div className="space-y-4 text-gray-600 dark:text-gray-300">
              <p>We share your information only in these specific circumstances:</p>

              <div>
                <h3 className="font-medium text-gray-800 dark:text-gray-200 mb-2">Only where you hand something over yourself</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>Copying or sharing a Words Card leaves your device through your own browser or app — Brume keeps no copy of it and publishes nothing on your behalf</li>
                  <li>The voice service runs only on the three taps described in section 3, and returns words rather than keeping them</li>
                  <li>There are no social features to consent to: no profile anyone else can read, nothing to publish</li>
                </ul>
              </div>

              <div>
                <h3 className="font-medium text-gray-800 dark:text-gray-200 mb-2">Service Providers</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>Cloud infrastructure providers (Supabase, Hetzner)</li>
                  <li>AI service providers (OpenAI, Google, Anthropic) for enhanced features</li>
                  <li>Analytics services (anonymized usage data only)</li>
                  <li>All providers are bound by strict data protection agreements</li>
                </ul>
              </div>

              <div>
                <h3 className="font-medium text-gray-800 dark:text-gray-200 mb-2">Legal Requirements</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>To comply with legal obligations and court orders</li>
                  <li>To protect our rights, property, and safety</li>
                  <li>To investigate fraud, security incidents, or policy violations</li>
                  <li>In connection with business transfers (with notice to users)</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 7 */}
          <section id="your-rights" className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              7. Your Rights and Choices
            </h2>
            <div className="space-y-4 text-gray-600 dark:text-gray-300">
              <div>
                <h3 className="font-medium text-gray-800 dark:text-gray-200 mb-2">Data Control</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li><strong>Access:</strong> Your own history is always on screen — Progress shows it, and it lives on your device unless you sign in</li>
                  <li><strong>Update:</strong> Name, username and avatar, on Profile</li>
                  <li><strong>Delete:</strong> Ask by email and the rows tied to your account are removed; clearing your browser's site data removes everything the device kept, immediately and without asking anyone</li>
                  <li><strong>Leave:</strong> Sign out. Nothing continues to be associated with you</li>
                </ul>
              </div>

              <div>
                <h3 className="font-medium text-gray-800 dark:text-gray-200 mb-2">Settings you actually have</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>The room: material and cue overrides, and a still room if you want one</li>
                  <li>The voice: one glyph cycles spoken cues, breath-only cues, and quiet</li>
                  <li>The microphone: used only when you tap "say it", and your browser asks first</li>
                  <li>There is no analytics switch, no AI switch and no sharing switch, because there is nothing behind them to turn off</li>
                </ul>
              </div>

              <div>
                <h3 className="font-medium text-gray-800 dark:text-gray-200 mb-2">Regional Rights</h3>
                <p>Depending on your location, you may have additional rights under:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li><strong>GDPR (EU):</strong> Right to portability, rectification, and erasure</li>
                  <li><strong>CCPA (California):</strong> Right to know, delete, and opt-out</li>
                  <li><strong>Other Laws:</strong> We comply with applicable privacy regulations worldwide</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 8 */}
          <section id="children" className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              8. Children's Privacy
            </h2>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800 mb-4">
              <p className="text-yellow-800 dark:text-yellow-200">
                <strong>Age Requirement:</strong> Our service is designed for users 13 years and older.
              </p>
            </div>
            <div className="space-y-3 text-gray-600 dark:text-gray-300">
              <p>We are committed to protecting children's privacy:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>We do not knowingly collect personal information from children under 13</li>
                <li>If we learn that we have collected information from a child under 13, we will delete it immediately</li>
                <li>Parents who believe their child has provided us with information should contact us</li>
                <li>For users 13-17, we recommend parental guidance when using breathing and wellness features</li>
              </ul>
              <p className="mt-4">
                <strong>For App Store compliance:</strong> If your target audience includes children under 13, additional safety measures and parental consent mechanisms may be required.
              </p>
            </div>
          </section>

          {/* Section 9 */}
          <section id="changes" className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              9. Changes to This Policy
            </h2>
            <div className="space-y-3 text-gray-600 dark:text-gray-300">
              <p>We may update this Privacy Policy from time to time. When we do:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>We will post the updated policy on this page</li>
                <li>We will update the "Last updated" date at the top</li>
                <li>For significant changes, we will notify you via email or in-app notification</li>
                <li>Continued use of the service after changes constitutes acceptance</li>
                <li>You can review previous versions of this policy in our documentation</li>
              </ul>
            </div>
          </section>

          {/* Section 10 */}
          <section id="contact" className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <Globe className="mr-2 h-5 w-5" />
              10. Contact Information
            </h2>
            <div className="space-y-4 text-gray-600 dark:text-gray-300">
              <p>If you have questions about this Privacy Policy or your personal data, please contact us:</p>

              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <div className="space-y-2">
                  <p><strong>Contact:</strong> <a href="https://github.com/udirobert/brume/issues" className="text-blue-600 dark:text-blue-400 hover:underline">github.com/udirobert/brume/issues</a></p>
                  <p><strong>Website:</strong> <a href="https://brume.trustfall.xyz" className="text-blue-600 dark:text-blue-400 hover:underline">brume.trustfall.xyz</a></p>
                  <p><strong>Response Time:</strong> We typically respond within 72 hours</p>
                </div>
              </div>

              <div>
                <h3 className="font-medium text-gray-800 dark:text-gray-200 mb-2">For Data Protection Requests</h3>
                <p>Please include the following information in your request:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Your registered email address</li>
                  <li>Specific nature of your request (access, deletion, etc.)</li>
                  <li>Any relevant account or transaction information</li>
                  <li>Preferred method for receiving our response</li>
                </ul>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500 dark:text-gray-400">
          <p>This privacy policy is effective as of {new Date().toLocaleDateString()} and applies to all users of Brume.</p>
          <Link to="/" className="text-blue-600 dark:text-blue-400 hover:underline mt-2 inline-block">
            Return to Brume
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
