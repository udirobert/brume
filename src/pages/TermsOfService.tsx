import React from "react";
import { Link } from "react-router-dom";
import {
  LegalPage,
  LegalTOC,
  LegalSection,
  LegalH3,
  LegalList,
  LegalCallout,
  LegalFooter,
} from "@/components/legal/LegalPage";

const TermsOfService = () => {
  return (
    <LegalPage
      title="Terms of Service"
      lede="Terms and conditions for using Brume"
      updated="Last updated: November 5, 2026"
      footer={
        <LegalFooter>
          <p>
            These terms of service are effective as of November 5, 2026 and
            apply to all users of Brume.
          </p>
          <div className="mt-2 space-x-4">
            <Link to="/" className="text-primary hover:underline underline-offset-2">
              Return to Brume
            </Link>
            <span>·</span>
            <Link to="/privacy" className="text-primary hover:underline underline-offset-2">
              Privacy Policy
            </Link>
          </div>
        </LegalFooter>
      }
    >
      {/* Plain-language summary */}
      <LegalCallout tone="note">
        <h2 className="text-lg font-semibold text-foreground mb-3">
          The short version
        </h2>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div>
            <h3 className="font-medium text-foreground mb-2">What this is</h3>
            <ul className="space-y-1 text-muted-foreground">
              <li>• A quiet room for a breath and a check-in</li>
              <li>• Free — nothing is sold, metered, or gated</li>
              <li>• Optional email sign-in, nothing else required</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium text-foreground mb-2">What this is not</h3>
            <ul className="space-y-1 text-muted-foreground">
              <li>• Medical advice, diagnosis, or therapy</li>
              <li>• A store — no subscriptions, trials, or purchases exist</li>
              <li>• A social network or a blockchain product</li>
            </ul>
          </div>
        </div>
      </LegalCallout>

      {/* Table of Contents */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-foreground mb-4">Contents</h2>
        <LegalTOC
          items={[
            { href: "#acceptance", label: "1. Acceptance of Terms" },
            { href: "#description", label: "2. Description of Service" },
            { href: "#user-accounts", label: "3. User Accounts and Responsibilities" },
            { href: "#content-ownership", label: "4. Content and Intellectual Property" },
            { href: "#acceptable-use", label: "5. Acceptable Use Policy" },
            { href: "#purchases", label: "6. Purchases" },
            { href: "#health-disclaimers", label: "7. Health and Wellness Disclaimers" },
            { href: "#limitation-liability", label: "8. Limitation of Liability" },
            { href: "#termination", label: "9. Termination" },
            { href: "#governing-law", label: "10. Governing Law" },
            { href: "#changes", label: "11. Changes to Terms" },
            { href: "#contact", label: "12. Contact Information" },
          ]}
        />
      </div>

      {/* Section 1 */}
      <LegalSection id="acceptance" title="1. Acceptance of Terms">
        <p>
          By accessing or using Brume ("the Service"), you
          agree to be bound by these Terms of Service ("Terms"). If you do
          not agree to these Terms, please do not use our Service.
        </p>
        <LegalList>
          <li>These Terms apply to all users, including visitors and registered users</li>
          <li>By creating an account, you confirm that you are at least 13 years old</li>
          <li>If you are under 18, you should have parental or guardian supervision when using our Service</li>
          <li>Your use of the Service constitutes acceptance of any updates to these Terms</li>
        </LegalList>
      </LegalSection>

      {/* Section 2 */}
      <LegalSection id="description" title="2. Description of Service">
        <p>Brume is a small wellness room that provides:</p>
        <LegalList>
          <li><strong>Breathing Guidance:</strong> Guided breathing patterns with visual and optional spoken cues</li>
          <li><strong>A Check-in:</strong> A single question — how are you feeling? — answered with a word from a fixed list, kept on your device</li>
          <li><strong>Progress:</strong> A private session history you can look back on</li>
          <li><strong>A Voice Service:</strong> Optional spoken lines and a one-sentence check-in microphone, each used only when you tap for it</li>
        </LegalList>
        <LegalCallout tone="note">
          <p className="text-foreground">
            <strong>Note:</strong> Our Service is for wellness and
            educational purposes only. It is not intended as medical
            treatment or professional therapy.
          </p>
        </LegalCallout>
      </LegalSection>

      {/* Section 3 */}
      <LegalSection id="user-accounts" title="3. User Accounts and Responsibilities">
        <div>
          <LegalH3>Account Creation</LegalH3>
          <p>
            An account is optional and consists of an email address and a
            password — nothing else is required to use the Service. If you
            create one:
          </p>
          <LegalList>
            <li>You must provide accurate and complete information when creating an account</li>
            <li>You are responsible for maintaining the security of your account credentials</li>
            <li>One person may not maintain multiple accounts</li>
            <li>You must notify us immediately of any unauthorized use of your account</li>
          </LegalList>
        </div>

        <div>
          <LegalH3>User Responsibilities</LegalH3>
          <LegalList>
            <li>Use the Service in accordance with these Terms and applicable laws</li>
            <li>Protect your privacy by not sharing sensitive personal information</li>
            <li>Report any inappropriate content or behavior to our support team</li>
            <li>Maintain reasonable security practices for your devices</li>
          </LegalList>
        </div>

        <div>
          <LegalH3>Account Termination</LegalH3>
          <p>You may terminate your account at any time. Upon termination:</p>
          <LegalList>
            <li>Your personal data will be deleted according to our Privacy Policy</li>
            <li>Data kept on your own device is removed by clearing your browser's site data</li>
          </LegalList>
        </div>
      </LegalSection>

      {/* Section 4 */}
      <LegalSection id="content-ownership" title="4. Content and Intellectual Property">
        <div>
          <LegalH3>Your Content</LegalH3>
          <LegalList>
            <li>You retain ownership of anything you write or record through the Service</li>
            <li>Your check-in words, session history, and any sentence you compose are stored on your device and — if you sign in — in rows only your account can read</li>
            <li>You may delete your content at any time, though copies you have shared yourself may persist outside our control</li>
          </LegalList>
        </div>

        <div>
          <LegalH3>Our Content</LegalH3>
          <LegalList>
            <li>Our platform, software, and original breathing patterns are protected by intellectual property laws</li>
            <li>You may not copy, modify, or redistribute our proprietary content without permission</li>
            <li>Third-party content is used with appropriate licenses and attribution</li>
          </LegalList>
        </div>
      </LegalSection>

      {/* Section 5 */}
      <LegalSection id="acceptable-use" title="5. Acceptable Use Policy">
        <p>To keep the Service safe and reliable, you agree not to:</p>
        <LegalList>
          <li>Impersonate others or provide false information about your identity</li>
          <li>Spam, harass, or engage in unwanted commercial communications</li>
          <li>Upload malicious code, viruses, or attempt to hack our systems</li>
          <li>Probe, stress-test, or scrape the Service or the voice service beyond normal use</li>
          <li>Violate any applicable laws or regulations</li>
          <li>Infringe on others' intellectual property rights</li>
        </LegalList>
      </LegalSection>

      {/* Section 6 */}
      <LegalSection id="purchases" title="6. Purchases">
        <p>
          Brume sells nothing. There are no subscriptions, no free trials
          that convert, no in-app purchases, and no tiered access — the
          room, the patterns, and the check-in are the whole product.
        </p>
        <p>
          If that ever changes, this page will be updated before anything
          becomes chargeable, and nothing will be billed under terms you
          have not seen.
        </p>
      </LegalSection>

      {/* Section 7 */}
      <LegalSection id="health-disclaimers" title="7. Health and Wellness Disclaimers">
        <LegalCallout tone="warning">
          <p className="text-foreground font-medium">
            <strong>Medical Disclaimer:</strong> Brume is not
            medical advice, treatment, or therapy. Always consult
            healthcare professionals for medical concerns.
          </p>
        </LegalCallout>

        <div>
          <LegalH3>General Health Information</LegalH3>
          <LegalList>
            <li>Our content is for educational and wellness purposes only</li>
            <li>Individual results may vary, and we make no guarantees about health outcomes</li>
            <li>Breathing exercises may not be suitable for everyone</li>
            <li>If you have respiratory, cardiovascular, or other health conditions, consult your doctor</li>
            <li>Stop any exercise that causes discomfort or adverse symptoms</li>
          </LegalList>
        </div>

        <div>
          <LegalH3>The voice service</LegalH3>
          <LegalList>
            <li>Spoken lines and the check-in microphone run only when you tap for them</li>
            <li>What the microphone hears is matched against a fixed list of words and dropped — it is not advice, diagnosis, or interpretation</li>
          </LegalList>
        </div>
      </LegalSection>

      {/* Section 8 */}
      <LegalSection id="limitation-liability" title="8. Limitation of Liability">
        <p>
          The Service is provided "as is" and "as available", without
          warranties of any kind, express or implied, including but not
          limited to warranties of merchantability, fitness for a
          particular purpose, and non-infringement.
        </p>
        <LegalList>
          <li>We do not warrant that the Service will be uninterrupted, secure, or error-free</li>
          <li>To the fullest extent permitted by law, we are not liable for indirect, incidental, special, consequential, or punitive damages arising from your use of the Service</li>
          <li>Our total liability for any claim relating to the Service is limited to the amount you paid us to use it — which, for a free service, is zero</li>
          <li>Some jurisdictions do not allow the exclusion of certain warranties or limitations of liability, so parts of this section may not apply to you</li>
        </LegalList>
      </LegalSection>

      {/* Section 9 */}
      <LegalSection id="termination" title="9. Termination">
        <p>
          You may stop using the Service at any time — signing out and
          clearing your browser's site data ends everything.
        </p>
        <LegalList>
          <li>We may suspend or end access to the Service for violations of these Terms, with notice where practicable</li>
          <li>Provisions that by their nature should survive — disclaimers, limitations of liability, governing law — survive termination</li>
          <li>Your data is handled after termination as described in the Privacy Policy</li>
        </LegalList>
      </LegalSection>

      {/* Section 10 */}
      <LegalSection id="governing-law" title="10. Governing Law and Dispute Resolution">
        <div>
          <LegalH3>Governing Law</LegalH3>
          <p>
            These Terms are governed by the laws of [Your Jurisdiction],
            without regard to conflict of law principles. Any disputes
            will be subject to the exclusive jurisdiction of courts in
            [Your Jurisdiction].
          </p>
        </div>

        <div>
          <LegalH3>Dispute Resolution</LegalH3>
          <LegalList>
            <li>We encourage resolving disputes through direct communication first</li>
            <li>For formal disputes, we prefer binding arbitration over litigation</li>
            <li>Class action lawsuits are waived to the extent permitted by law</li>
            <li>Time limits for bringing claims may apply under applicable law</li>
          </LegalList>
        </div>
      </LegalSection>

      {/* Section 11 */}
      <LegalSection id="changes" title="11. Changes to Terms">
        <div className="space-y-3">
          <p>We may modify these Terms from time to time. When we do:</p>
          <LegalList>
            <li>We will post the updated Terms on this page</li>
            <li>We will update the "Last updated" date</li>
            <li>For material changes, we will notify you via email or prominent notice in the app</li>
            <li>Continued use after changes constitutes acceptance of the new Terms</li>
            <li>If you don't agree to changes, you should discontinue use of the Service</li>
          </LegalList>
        </div>
      </LegalSection>

      {/* Section 12 */}
      <LegalSection id="contact" title="12. Contact Information">
        <div className="space-y-4">
          <p>If you have questions about these Terms of Service, please contact us:</p>

          <div className="bg-foreground/5 p-4 rounded-xl">
            <div className="space-y-2">
              <p>
                <strong>Legal:</strong>{" "}
                <a href="https://github.com/udirobert/brume/issues" className="text-primary hover:underline underline-offset-2">
                  github.com/udirobert/brume/issues
                </a>
              </p>
              <p>
                <strong>Support:</strong>{" "}
                <a href="https://github.com/udirobert/brume/issues" className="text-primary hover:underline underline-offset-2">
                  github.com/udirobert/brume/issues
                </a>
              </p>
              <p>
                <strong>Website:</strong>{" "}
                <a href="https://brume.trustfall.xyz" className="text-primary hover:underline underline-offset-2">
                  brume.trustfall.xyz
                </a>
              </p>
              <p><strong>Response Time:</strong> We typically respond within 72 hours</p>
            </div>
          </div>

          <div>
            <LegalH3>Reporting Issues</LegalH3>
            <p>For urgent issues, please include:</p>
            <LegalList>
              <li>Your account email address</li>
              <li>Description of the issue or violation</li>
              <li>Any relevant screenshots or documentation</li>
              <li>Steps to reproduce technical problems</li>
            </LegalList>
          </div>
        </div>
      </LegalSection>

      {/* Miscellaneous */}
      <LegalSection title="13. Miscellaneous">
        <div className="space-y-3">
          <div>
            <LegalH3>Severability</LegalH3>
            <p>
              If any provision of these Terms is found to be invalid or
              unenforceable, the remaining provisions will remain in full
              force and effect.
            </p>
          </div>

          <div>
            <LegalH3>Entire Agreement</LegalH3>
            <p>
              These Terms, together with our Privacy Policy, constitute the
              entire agreement between you and Brume regarding
              the Service.
            </p>
          </div>

          <div>
            <LegalH3>Assignment</LegalH3>
            <p>
              You may not assign or transfer your rights under these Terms
              without our written consent. We may assign our rights and
              obligations without restriction.
            </p>
          </div>
        </div>
      </LegalSection>
    </LegalPage>
  );
};

export default TermsOfService;
