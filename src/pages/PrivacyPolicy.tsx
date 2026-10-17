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
            Last updated: October 16, 2026
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
                  <li>• Process optional camera frames on our backend to estimate movement</li>
                  <li>• Store breathing session metrics</li>
                  <li>• Sync preferences across devices</li>
                  <li>• Enable social features (with consent)</li>
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
              <a href="#video-camera-data" className="block hover:underline">3. Video and Camera Data</a>
              <a href="#blockchain-data" className="block hover:underline">4. Blockchain and Web3 Data</a>
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
                  <li>Wallet addresses (when you connect a Web3 wallet)</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">Session Data</h3>
                <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-1">
                  <li>Breathing session duration and timestamps</li>
                  <li>Breathing patterns used and completion rates</li>
                  <li>Performance metrics (breathing rate, consistency scores)</li>
                  <li>Progress achievements and milestones</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">Technical Information</h3>
                <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-1">
                  <li>Device type, browser, and operating system</li>
                  <li>IP address and general location (city/country level)</li>
                  <li>App usage analytics and performance data</li>
                  <li>Error logs and crash reports (anonymized)</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 2 */}
          <section id="how-we-use-information" className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              2. How We Use Your Information
            </h2>
            <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-2">
              <li><strong>Provide Services:</strong> Enable breathing sessions, AI coaching, and progress tracking</li>
              <li><strong>Personalization:</strong> Customize your experience and provide relevant breathing patterns</li>
              <li><strong>Analytics:</strong> Understand app usage to improve features and performance</li>
              <li><strong>Communication:</strong> Send important updates, tips, and optional newsletters</li>
              <li><strong>Security:</strong> Detect and prevent fraud, abuse, and security incidents</li>
              <li><strong>Legal Compliance:</strong> Meet our legal obligations and protect user rights</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section id="video-camera-data" className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              3. Video and Camera Data
            </h2>
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800 mb-4">
              <p className="text-green-800 dark:text-green-200 font-medium">
                🛡️ Camera feedback is optional — you can practise fully without it
              </p>
            </div>
            <div className="space-y-4 text-gray-600 dark:text-gray-300">
              <div>
                <h3 className="font-medium text-gray-800 dark:text-gray-200 mb-2">Camera Access</h3>
                <p>We request camera access only to provide optional camera feedback during sessions. Camera access is:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Always optional and requires your explicit permission</li>
                  <li>Used when you enable camera feedback, including during session setup</li>
                  <li>Captured as image (JPEG) frames and sent to Brume's backend for processing</li>
                  <li>Processed with MediaPipe to estimate face landmarks and movement</li>
                </ul>
              </div>

              <div>
                <h3 className="font-medium text-gray-800 dark:text-gray-200 mb-2">Face Landmark and Movement Estimates</h3>
                <p>When enabled, we use computer vision to:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Estimate face landmarks and movement from camera frames</li>
                  <li>Provide visual feedback during the session</li>
                  <li>Produce session summary metrics for your history</li>
                </ul>
                <p className="mt-2">Camera feedback is not a clinical measurement and does not measure breath quality.</p>
              </div>

              <div>
                <h3 className="font-medium text-gray-800 dark:text-gray-200 mb-2">Data Processing</h3>
                <p>Camera frames contain your face and are processed on our backend during the session. Session landmarks and movement metrics are held temporarily in backend memory; session summary metrics may be kept so they appear in your history.</p>
              </div>
            </div>
          </section>

          {/* Section 4 */}
          <section id="blockchain-data" className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              4. Credentials and Blockchain Data
            </h2>
            <div className="space-y-4 text-gray-600 dark:text-gray-300">
              <p>When you use credential features, we integrate with decentralized networks:</p>

              <div>
                <h3 className="font-medium text-gray-800 dark:text-gray-200 mb-2">Flow Blockchain</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>Verified practice credential attestations (opt-in)</li>
                  <li>Public attestation records (session proof and scores)</li>
                  <li>Public blockchain data (transactions, smart contracts)</li>
                </ul>
              </div>

              <div>
                <h3 className="font-medium text-gray-800 dark:text-gray-200 mb-2">Lens Protocol V3</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>Decentralized social features and community interactions</li>
                  <li>Profile information you choose to make public</li>
                  <li>Content sharing and social graph data</li>
                </ul>
              </div>

              <div>
                <h3 className="font-medium text-gray-800 dark:text-gray-200 mb-2">Wallet Integration</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>We never store or access your private keys</li>
                  <li>Wallet connections are managed by secure third-party providers</li>
                  <li>We only see public wallet addresses you choose to connect</li>
                  <li>All blockchain transactions are user-initiated and cryptographically signed</li>
                </ul>
              </div>
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
                  <li><strong>Local Storage:</strong> Session data cached on your device for offline access</li>
                  <li><strong>Supabase (Cloud):</strong> Encrypted user data and preferences for cross-device sync</li>
                  <li><strong>IPFS:</strong> Decentralized storage for public content and credential metadata</li>
                  <li><strong>Hetzner Servers:</strong> EU-based servers for AI processing and vision analysis</li>
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
                  <li>Account data: Retained while your account is active</li>
                  <li>Session data: Retained for up to 2 years for progress tracking</li>
                  <li>Analytics data: Aggregated and anonymized after 90 days</li>
                  <li>Deleted account data: Permanently removed within 30 days</li>
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
                <h3 className="font-medium text-gray-800 dark:text-gray-200 mb-2">With Your Consent</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>Social features: Profile information you choose to make public</li>
                  <li>Community sharing: Breathing patterns and achievements you publish</li>
                  <li>Third-party integrations: Services you explicitly authorize</li>
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
                  <li><strong>Access:</strong> View all data we have about you</li>
                  <li><strong>Update:</strong> Modify your account information and preferences</li>
                  <li><strong>Export:</strong> Download your data in a portable format</li>
                  <li><strong>Delete:</strong> Permanently remove your account and associated data</li>
                  <li><strong>Restrict:</strong> Limit how we process your information</li>
                </ul>
              </div>

              <div>
                <h3 className="font-medium text-gray-800 dark:text-gray-200 mb-2">Privacy Settings</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>Camera access: Enable/disable in browser settings</li>
                  <li>AI features: Opt out of advanced AI analysis</li>
                  <li>Social features: Control profile visibility and sharing</li>
                  <li>Communications: Unsubscribe from optional emails</li>
                  <li>Analytics: Opt out of usage tracking</li>
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
                  <p><strong>Email:</strong> privacy@imperfectform.fun</p>
                  <p><strong>Website:</strong> <a href="https://imperfectbreath.netlify.app" className="text-blue-600 dark:text-blue-400 hover:underline">imperfectbreath.netlify.app</a></p>
                  <p><strong>Community:</strong> <a href="https://lens.xyz/u/imperfectbreath" className="text-blue-600 dark:text-blue-400 hover:underline">Lens Protocol Community</a></p>
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
