import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  FileText,
  Scale,
  Users,
  Globe,
  AlertTriangle,
} from "lucide-react";

const TermsOfService = () => {
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
            <FileText className="h-8 w-8 text-blue-600 dark:text-blue-400 mr-3" />
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
              Terms of Service
            </h1>
          </div>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Terms and conditions for using Brume
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Last updated: {new Date().toLocaleDateString()}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 mb-8">
          {/* Executive Summary */}
          <div className="mb-8 p-6 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <h2 className="text-xl font-semibold text-green-900 dark:text-green-100 mb-3 flex items-center">
              <Scale className="mr-2 h-5 w-5" />
              Fair & Transparent Terms
            </h2>
            <div className="text-sm text-gray-700 dark:text-gray-300">
              <p className="mb-3">
                These terms are designed to protect both users and creators
                while fostering a healthy breathing community.
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-medium text-green-700 dark:text-green-300 mb-2">
                    ✅ Your Rights
                  </h3>
                  <ul className="space-y-1">
                    <li>• Own your created content and patterns</li>
                    <li>• Control your privacy settings</li>
                    <li>• Cancel subscriptions anytime</li>
                    <li>• Export your data</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-medium text-blue-700 dark:text-blue-300 mb-2">
                    🤝 Our Commitment
                  </h3>
                  <ul className="space-y-1">
                    <li>• Respect your intellectual property</li>
                    <li>• Provide transparent pricing</li>
                    <li>• Support wellness, not addiction</li>
                    <li>• Protect your privacy</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Table of Contents */}
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              Contents
            </h2>
            <nav className="space-y-2 text-blue-600 dark:text-blue-400">
              <a href="#acceptance" className="block hover:underline">
                1. Acceptance of Terms
              </a>
              <a href="#description" className="block hover:underline">
                2. Description of Service
              </a>
              <a href="#user-accounts" className="block hover:underline">
                3. User Accounts and Responsibilities
              </a>
              <a href="#content-ownership" className="block hover:underline">
                4. Content and Intellectual Property
              </a>
              <a href="#acceptable-use" className="block hover:underline">
                5. Acceptable Use Policy
              </a>
              <a href="#payments" className="block hover:underline">
                6. Payments and Subscriptions
              </a>
              <a href="#web3-blockchain" className="block hover:underline">
                7. Web3 and Blockchain Features
              </a>
              <a href="#health-disclaimers" className="block hover:underline">
                8. Health and Wellness Disclaimers
              </a>
              <a href="#limitation-liability" className="block hover:underline">
                9. Limitation of Liability
              </a>
              <a href="#termination" className="block hover:underline">
                10. Termination
              </a>
              <a href="#governing-law" className="block hover:underline">
                11. Governing Law
              </a>
              <a href="#changes" className="block hover:underline">
                12. Changes to Terms
              </a>
              <a href="#contact" className="block hover:underline">
                13. Contact Information
              </a>
            </nav>
          </div>

          {/* Section 1 */}
          <section id="acceptance" className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              1. Acceptance of Terms
            </h2>
            <div className="space-y-4 text-gray-600 dark:text-gray-300">
              <p>
                By accessing or using Brume ("the Service"), you
                agree to be bound by these Terms of Service ("Terms"). If you do
                not agree to these Terms, please do not use our Service.
              </p>
              <ul className="list-disc list-inside space-y-2">
                <li>
                  These Terms apply to all users, including visitors, registered
                  users, and content creators
                </li>
                <li>
                  By creating an account, you confirm that you are at least 13
                  years old
                </li>
                <li>
                  If you are under 18, you should have parental or guardian
                  supervision when using our Service
                </li>
                <li>
                  Your use of the Service constitutes acceptance of any updates
                  to these Terms
                </li>
              </ul>
            </div>
          </section>

          {/* Section 2 */}
          <section id="description" className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              2. Description of Service
            </h2>
            <div className="space-y-4 text-gray-600 dark:text-gray-300">
              <p>
                Brume is a digital wellness platform that provides:
              </p>
              <ul className="list-disc list-inside space-y-2">
                <li>
                  <strong>Breathing Guidance:</strong> Interactive breathing
                  patterns and exercises
                </li>
                <li>
                  <strong>AI Coaching:</strong> Personalized guidance through
                  our Zen AI agent
                </li>
                <li>
                  <strong>Computer Vision:</strong> Optional camera-based
                  biometric feedback
                </li>
                <li>
                  <strong>Progress Tracking:</strong> Session history and
                  wellness metrics
                </li>
                <li>
                  <strong>Social Features:</strong> Community sharing via Lens
                  Protocol
                </li>
                <li>
                  <strong>Verified Credentials:</strong> Portable, on-chain
                  proof-of-practice records
                </li>
                <li>
                  <strong>Optional Wallet:</strong> Connect a wallet to hold
                  your verified credentials
                </li>
              </ul>
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800 mt-4">
                <p className="text-blue-800 dark:text-blue-200">
                  <strong>Note:</strong> Our Service is for wellness and
                  educational purposes only. It is not intended as medical
                  treatment or professional therapy.
                </p>
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section id="user-accounts" className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <Users className="mr-2 h-5 w-5" />
              3. User Accounts and Responsibilities
            </h2>
            <div className="space-y-4 text-gray-600 dark:text-gray-300">
              <div>
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">
                  Account Creation
                </h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    You must provide accurate and complete information when
                    creating an account
                  </li>
                  <li>
                    You are responsible for maintaining the security of your
                    account credentials
                  </li>
                  <li>One person may not maintain multiple accounts</li>
                  <li>
                    You must notify us immediately of any unauthorized use of
                    your account
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">
                  User Responsibilities
                </h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    Use the Service in accordance with these Terms and
                    applicable laws
                  </li>
                  <li>
                    Respect other users and maintain a supportive community
                    environment
                  </li>
                  <li>
                    Protect your privacy by not sharing sensitive personal
                    information
                  </li>
                  <li>
                    Report any inappropriate content or behavior to our support
                    team
                  </li>
                  <li>
                    Maintain reasonable security practices for connected wallets
                    and devices
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">
                  Account Termination
                </h3>
                <p>
                  You may terminate your account at any time. Upon termination:
                </p>
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    Your personal data will be deleted according to our Privacy
                    Policy
                  </li>
                  <li>
                    Your created content may remain available if shared publicly
                  </li>
                  <li>
                    Outstanding payments or subscriptions will be handled
                    according to our refund policy
                  </li>
                  <li>
                    Verified credentials will remain in your wallet
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 4 */}
          <section id="content-ownership" className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              4. Content and Intellectual Property
            </h2>
            <div className="space-y-4 text-gray-600 dark:text-gray-300">
              <div>
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">
                  Your Content
                </h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    You retain ownership of all original breathing patterns,
                    posts, and content you create
                  </li>
                  <li>
                    By sharing content publicly, you grant us a license to
                    display and distribute it on our platform
                  </li>
                  <li>
                    You represent that your content does not infringe on others'
                    intellectual property rights
                  </li>
                  <li>
                    You may delete your content at any time, though cached or
                    shared copies may persist
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">
                  Our Content
                </h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    Our platform, software, and original breathing patterns are
                    protected by intellectual property laws
                  </li>
                  <li>
                    You may not copy, modify, or redistribute our proprietary
                    content without permission
                  </li>
                  <li>
                    We provide certain content under Creative Commons or
                    open-source licenses where indicated
                  </li>
                  <li>
                    Third-party content is used with appropriate licenses and
                    attribution
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">
                  Verified Practice Credentials
                </h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    Credentials attest that a practice session was
                    camera-verified; they are records, not financial assets
                  </li>
                  <li>
                    Credential issuance is recorded on blockchain networks and
                    governed by smart contracts
                  </li>
                  <li>
                    We do not control blockchain networks and cannot reverse
                    blockchain transactions
                  </li>
                  <li>
                    Credential metadata may be stored on IPFS or similar
                    decentralized storage systems
                  </li>
                  <li>Credentials carry no expectation of monetary value or utility</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 5 */}
          <section id="acceptable-use" className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              5. Acceptable Use Policy
            </h2>
            <div className="space-y-4 text-gray-600 dark:text-gray-300">
              <p>
                To maintain a safe and supportive community, you agree not to:
              </p>

              <div>
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">
                  Prohibited Activities
                </h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    Share content that is harmful, threatening, abusive, or
                    discriminatory
                  </li>
                  <li>
                    Impersonate others or provide false information about your
                    identity
                  </li>
                  <li>
                    Spam, harass, or engage in unwanted commercial
                    communications
                  </li>
                  <li>
                    Upload malicious code, viruses, or attempt to hack our
                    systems
                  </li>
                  <li>Violate any applicable laws or regulations</li>
                  <li>Infringe on others' intellectual property rights</li>
                  <li>
                    Share content that promotes self-harm or dangerous breathing
                    practices
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">
                  Community Guidelines
                </h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    Be respectful and supportive of other community members
                  </li>
                  <li>
                    Share authentic experiences and avoid misleading health
                    claims
                  </li>
                  <li>
                    Respect privacy and do not share others' personal
                    information
                  </li>
                  <li>
                    Provide constructive feedback and avoid destructive
                    criticism
                  </li>
                  <li>Focus on wellness and positive breathing practices</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 6 */}
          <section id="payments" className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              6. Payments and Subscriptions
            </h2>
            <div className="space-y-4 text-gray-600 dark:text-gray-300">
              <div>
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">
                  Subscription Services
                </h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    Subscription fees are billed in advance on a recurring basis
                  </li>
                  <li>
                    You may cancel your subscription at any time through your
                    account settings
                  </li>
                  <li>
                    Cancellation takes effect at the end of your current billing
                    period
                  </li>
                  <li>No refunds are provided for partial billing periods</li>
                  <li>
                    We may change subscription pricing with 30 days' notice
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">
                  Subscriptions
                </h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    Brume Premium subscriptions are billed through the Apple App
                    Store or Google Play
                  </li>
                  <li>
                    Subscription management, cancellation, and refunds follow
                    the respective store&apos;s policies
                  </li>
                  <li>
                    Free trials convert to paid subscriptions unless cancelled
                    before the trial ends
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">
                  Refund Policy
                </h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    Digital content purchases are generally non-refundable
                  </li>
                  <li>
                    We may provide refunds for technical issues or billing
                    errors
                  </li>
                  <li>
                    Subscription refunds are handled case-by-case for
                    extenuating circumstances
                  </li>
                  <li>
                    Blockchain transactions cannot be reversed once confirmed
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 7 */}
          <section id="web3-blockchain" className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              7. Web3 and Blockchain Features
            </h2>
            <div className="space-y-4 text-gray-600 dark:text-gray-300">
              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <p className="text-yellow-800 dark:text-yellow-200 font-medium flex items-center">
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  Important: Blockchain transactions are irreversible. Please
                  understand the risks before participating.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">
                  Wallet Connection
                </h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>We do not control or have access to your private keys</li>
                  <li>
                    You are responsible for securing your wallet and private
                    keys
                  </li>
                  <li>
                    We are not liable for lost or stolen wallet assets
                  </li>
                  <li>
                    Wallet connections are facilitated by third-party providers
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">
                  Credential Attestations
                </h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    Issuing a credential involves a blockchain transaction; any
                    network fees are disclosed before you confirm
                  </li>
                  <li>
                    Credentials are non-transferable records of practice, not
                    tokens or investment products
                  </li>
                  <li>
                    Blockchain networks may experience delays, failures, or
                    forks
                  </li>
                  <li>Smart contracts may contain bugs or vulnerabilities</li>
                  <li>
                    Regulatory changes may affect the availability of blockchain
                    features
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">
                  Supported Networks
                </h3>
                <p>We currently support:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Flow Blockchain for verified credential attestations</li>
                  <li>Lens Protocol V3 for decentralized social features (currently paused — see roadmap)</li>
                  <li>
                    Ethereum and other EVM-compatible networks for wallet
                    connections
                  </li>
                  <li>
                    We may add or remove network support with reasonable notice
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 8 */}
          <section id="health-disclaimers" className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              8. Health and Wellness Disclaimers
            </h2>
            <div className="space-y-4 text-gray-600 dark:text-gray-300">
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
                <p className="text-red-800 dark:text-red-200 font-medium">
                  <strong>Medical Disclaimer:</strong> Brume is not
                  medical advice, treatment, or therapy. Always consult
                  healthcare professionals for medical concerns.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">
                  General Health Information
                </h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    Our content is for educational and wellness purposes only
                  </li>
                  <li>
                    Individual results may vary, and we make no guarantees about
                    health outcomes
                  </li>
                  <li>Breathing exercises may not be suitable for everyone</li>
                  <li>
                    If you have respiratory, cardiovascular, or other health
                    conditions, consult your doctor
                  </li>
                  <li>
                    Stop any exercise that causes discomfort or adverse symptoms
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">
                  AI and Computer Vision
                </h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    AI coaching provides general guidance, not personalized
                    medical advice
                  </li>
                  <li>
                    Computer vision features are for entertainment and general
                    wellness feedback
                  </li>
                  <li>Biometric measurements may not be medically accurate</li>
                  <li>
                    Do not rely on our technology for medical diagnosis or
                    monitoring
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">
                  User-Generated Content
                </h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    User-shared breathing patterns and advice are not
                    professionally reviewed
                  </li>
                  <li>
                    We do not endorse or verify the safety of community-created
                    content
                  </li>
                  <li>
                    Users share experiences at their own discretion and risk
                  </li>
                  <li>
                    Report any concerning or potentially harmful content to our
                    team
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 9 */}
          <section id="limitation-liability" className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              9. Limitation of Liability
            </h2>
            <div className="space-y-4 text-gray-600 dark:text-gray-300">
              <p>
                To the maximum extent permitted by law, Brume and its
                affiliates, officers, employees, and agents shall not be liable
                for:
              </p>
              <ul className="list-disc list-inside space-y-2">
                <li>
                  Any indirect, incidental, special, consequential, or punitive
                  damages
                </li>
                <li>
                  Loss of profits, data, use, goodwill, or other intangible
                  losses
                </li>
                <li>
                  Damages resulting from your use or inability to use the
                  Service
                </li>
                <li>
                  Damages resulting from any unauthorized access to or
                  alteration of your data
                </li>
                <li>
                  Damages resulting from third-party conduct or content on the
                  Service
                </li>
                <li>
                  Damages related to blockchain networks, wallets, or
                  credential attestations
                </li>
                <li>
                  Health issues or injuries that may arise from using breathing
                  exercises
                </li>
              </ul>

              <p className="mt-4">
                Our total liability for any claims related to the Service shall
                not exceed the amount you paid us in the twelve (12) months
                preceding the claim, or $100, whichever is greater.
              </p>

              <div>
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">
                  Indemnification
                </h3>
                <p>
                  You agree to indemnify and hold harmless Brume from
                  any claims, damages, or expenses arising from your use of the
                  Service, violation of these Terms, or infringement of any
                  rights.
                </p>
              </div>
            </div>
          </section>

          {/* Section 10 */}
          <section id="termination" className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              10. Termination
            </h2>
            <div className="space-y-4 text-gray-600 dark:text-gray-300">
              <div>
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">
                  Termination by You
                </h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    You may terminate your account at any time through account
                    settings
                  </li>
                  <li>
                    Termination does not relieve you of any payment obligations
                  </li>
                  <li>
                    Your data will be handled according to our Privacy Policy
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">
                  Termination by Us
                </h3>
                <p>We may terminate or suspend your account if you:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Violate these Terms or our community guidelines</li>
                  <li>Engage in fraudulent or illegal activities</li>
                  <li>Pose a security risk to other users or our systems</li>
                  <li>Fail to pay required fees or charges</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">
                  Effect of Termination
                </h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>Your access to paid features will cease immediately</li>
                  <li>Your content may be removed from public areas</li>
                  <li>Blockchain assets will remain in your wallet</li>
                  <li>
                    These Terms will continue to apply to past use of the
                    Service
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 11 */}
          <section id="governing-law" className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              11. Governing Law and Dispute Resolution
            </h2>
            <div className="space-y-4 text-gray-600 dark:text-gray-300">
              <div>
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">
                  Governing Law
                </h3>
                <p>
                  These Terms are governed by the laws of [Your Jurisdiction],
                  without regard to conflict of law principles. Any disputes
                  will be subject to the exclusive jurisdiction of courts in
                  [Your Jurisdiction].
                </p>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">
                  Dispute Resolution
                </h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    We encourage resolving disputes through direct communication
                    first
                  </li>
                  <li>
                    For formal disputes, we prefer binding arbitration over
                    litigation
                  </li>
                  <li>
                    Class action lawsuits are waived to the extent permitted by
                    law
                  </li>
                  <li>
                    Time limits for bringing claims may apply under applicable
                    law
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 12 */}
          <section id="changes" className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              12. Changes to Terms
            </h2>
            <div className="space-y-3 text-gray-600 dark:text-gray-300">
              <p>We may modify these Terms from time to time. When we do:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>We will post the updated Terms on this page</li>
                <li>We will update the "Last updated" date</li>
                <li>
                  For material changes, we will notify you via email or
                  prominent notice in the app
                </li>
                <li>
                  Continued use after changes constitutes acceptance of the new
                  Terms
                </li>
                <li>
                  If you don't agree to changes, you should discontinue use of
                  the Service
                </li>
              </ul>
            </div>
          </section>

          {/* Section 13 */}
          <section id="contact" className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <Globe className="mr-2 h-5 w-5" />
              13. Contact Information
            </h2>
            <div className="space-y-4 text-gray-600 dark:text-gray-300">
              <p>
                If you have questions about these Terms of Service, please
                contact us:
              </p>

              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <div className="space-y-2">
                  <p>
                    <strong>Legal:</strong> <a href="https://github.com/udirobert/brume/issues" className="text-blue-600 dark:text-blue-400 hover:underline">github.com/udirobert/brume/issues</a>
                  </p>
                  <p>
                    <strong>Support:</strong> <a href="https://github.com/udirobert/brume/issues" className="text-blue-600 dark:text-blue-400 hover:underline">github.com/udirobert/brume/issues</a>
                  </p>
                  <p>
                    <strong>Website:</strong>{" "}
                    <a
                      href="https://brumeapp.netlify.app"
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      brumeapp.netlify.app
                    </a>
                  </p>
                  <p>
                    <strong>Community:</strong>{" "}
                    <a
                      href="https://lens.xyz/u/imperfectbreath"
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Lens Protocol Community
                    </a>
                  </p>
                  <p>
                    <strong>Response Time:</strong> We typically respond within
                    72 hours
                  </p>
                </div>
              </div>

              <div>
                <h3 className="font-medium text-gray-800 dark:text-gray-200 mb-2">
                  Reporting Issues
                </h3>
                <p>For urgent issues, please include:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Your account email address</li>
                  <li>Description of the issue or violation</li>
                  <li>Any relevant screenshots or documentation</li>
                  <li>Steps to reproduce technical problems</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Miscellaneous */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              14. Miscellaneous
            </h2>
            <div className="space-y-3 text-gray-600 dark:text-gray-300">
              <div>
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">
                  Severability
                </h3>
                <p>
                  If any provision of these Terms is found to be invalid or
                  unenforceable, the remaining provisions will remain in full
                  force and effect.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">
                  Entire Agreement
                </h3>
                <p>
                  These Terms, together with our Privacy Policy, constitute the
                  entire agreement between you and Brume regarding
                  the Service.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">
                  Assignment
                </h3>
                <p>
                  You may not assign or transfer your rights under these Terms
                  without our written consent. We may assign our rights and
                  obligations without restriction.
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500 dark:text-gray-400">
          <p>
            These terms of service are effective as of{" "}
            {new Date().toLocaleDateString()} and apply to all users of
            Brume.
          </p>
          <div className="mt-2 space-x-4">
            <Link
              to="/"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              Return to Brume
            </Link>
            <span>•</span>
            <Link
              to="/privacy"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              Privacy Policy
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsOfService;
