/**
 * Blockchain Authentication Service
 * Single source of truth for Lens and Flow blockchain operations
 * 
 * ENHANCEMENT FIRST: Builds on existing patterns while improving functionality
 * AGGRESSIVE CONSOLIDATION: Removes duplicate auth logic
 * DRY: Single source of truth for blockchain operations
 * CLEAN: Clear separation of concerns
 * MODULAR: Composable and testable
 * PERFORMANT: Caching and efficient resource management
 */

import { PublicClient, SessionClient } from '@lens-protocol/client';
import { mainnet, testnet } from '@lens-protocol/client';
import { evmAddress } from '@lens-protocol/client';
import { currentSession, fetchAuthenticatedSessions, fetchAccountsAvailable } from '@lens-protocol/client/actions';
import * as fcl from '@onflow/fcl';
import { signMessageWith } from '@lens-protocol/client/viem';
import type { SignableMessage } from 'viem';

// Types
interface LensConfig {
  appId: string;
  environment: typeof mainnet | typeof testnet;
  storage?: Storage;
}

interface FlowConfig {
  network: 'testnet' | 'mainnet';
  accessNode: string;
  discoveryWallet: string;
}

interface LensAccountInfo {
  address: string;
  ownedBy?: { address: string };
}

interface LensSessionInfo {
  account?: LensAccountInfo;
}

interface FlowUser {
  addr: string | null;
  loggedIn: boolean;
  [key: string]: unknown;
}

interface AuthResult {
  success: boolean;
  error?: string;
  lensSession?: SessionClient;
  flowUser?: FlowUser;
}

interface PaymentResult {
  success: boolean;
  txId?: string;
  error?: string;
}

interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  duration: string;
}

export class BlockchainAuthService {
  private lensClient: PublicClient;
  private flowConfig: FlowConfig | null = null;
  private lensConfig: LensConfig | null = null;
  
  private activeLensSession: SessionClient | null = null;
  private isFlowInitialized = false;
  private authorAddress: string | null = null;

  constructor() {
    // Initialize with default testnet configuration
    this.lensClient = PublicClient.create({
      environment: testnet,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    });
  }

  /**
   * Initialize Lens configuration
   * Uses official Lens SDK as per documentation
   */
  async initializeLens(config: LensConfig): Promise<void> {
    this.lensConfig = config;
    
    this.lensClient = PublicClient.create({
      environment: config.environment,
      storage: config.storage || window.localStorage,
    });
  }

  /**
   * Initialize Flow configuration
   * Uses official FCL as per documentation
   */
  async initializeFlow(config: FlowConfig): Promise<void> {
    this.flowConfig = config;
    
    fcl.config({
      'accessNode.api': config.accessNode,
      'discovery.wallet': config.discoveryWallet,
      'app.detail.title': 'Brume',
      'app.detail.icon': '/icon.png',
    });
    
    this.isFlowInitialized = true;
  }

  /**
   * Unified authentication for both Lens and Flow
   * ENHANCEMENT FIRST: Enhances existing approach with official SDKs
   */
  async authenticateBoth(walletAddress: string, signMessage: (message: SignableMessage) => Promise<string>): Promise<AuthResult> {
    try {
      // Authenticate Lens first
      const lensResult = await this.authenticateLens(walletAddress, signMessage);
      
      // Initialize Flow if not already done
      if (!this.isFlowInitialized && this.flowConfig) {
        await this.initializeFlow(this.flowConfig);
      }
      
      // Authenticate Flow
      await fcl.authenticate();
      
      // Get Flow user info
      const flowUser = await fcl.currentUser().snapshot();
      
      return {
        success: lensResult.success,
        lensSession: this.activeLensSession ?? undefined,
        flowUser,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed',
      };
    }
  }

  /**
   * Authenticate with Lens Protocol
   * Uses official login flow as per documentation
   * App ID: 0xC75A89145d765c396fd75CbD16380Eb184Bd2ca7 (Testnet)
   */
  // Persist and retrieve author address
  getAuthorAddress(): string | null {
    if (this.authorAddress) return this.authorAddress;
    try {
      const v = typeof localStorage !== 'undefined' ? localStorage.getItem('lens:authorAddress') : null;
      this.authorAddress = v || null;
      return this.authorAddress;
    } catch {
      return null;
    }
  }

  setAuthorAddress(address: string) {
    this.authorAddress = address;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('lens:authorAddress', address);
      }
    } catch {
      console.warn("Could not persist author address to localStorage");
    }
  }

  async authenticateLens(walletAddress: string, signMessage: (message: SignableMessage) => Promise<string>): Promise<AuthResult> {
    try {
      if (!this.lensConfig) {
        throw new Error('Lens configuration not initialized');
      }

      // Use the official login flow with proper app ID from documentation
      const result = await this.lensClient.login({
        accountOwner: {
          app: this.lensConfig.appId as `0x${string}`,
          owner: evmAddress(walletAddress as `0x${string}`),
          account: evmAddress(walletAddress as `0x${string}`),
        },
        signMessage: signMessageWith({
          address: walletAddress as `0x${string}`,
          sign: signMessage,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any),
      });

      if (result.isErr()) {
        throw new Error(result.error.message);
      }

      this.activeLensSession = result.value;

      // Capture author address from current session
      try {
        const info = await currentSession(this.activeLensSession);
        if (!info.isErr()) {
          const sessionInfo = info.value as LensSessionInfo;
          const acct = sessionInfo.account;
          const addr: string | null = acct?.ownedBy?.address ?? acct?.address ?? null;
          if (addr) this.setAuthorAddress(addr);
        }
      } catch {
        console.warn("Could not capture author address during Lens authentication");
      }
      
      return {
        success: true,
        lensSession: result.value,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Lens authentication failed',
      };
    }
  }

  async resumeSession(): Promise<AuthResult> {
    try {
      // Try to resume Lens session from storage
      const lensResult = await this.lensClient.resumeSession();
      
      if (lensResult.isOk()) {
        this.activeLensSession = lensResult.value;
        // Capture author address from current session
        try {
          const info = await currentSession(this.activeLensSession);
          if (!info.isErr()) {
          const sessionInfo = info.value as LensSessionInfo;
          const acct = sessionInfo.account;
            const addr: string | null = acct?.ownedBy?.address ?? acct?.address ?? null;
            if (addr) this.setAuthorAddress(addr);
          }
        } catch {
          console.warn("Could not capture author address during session resume");
        }
      }
      
      // Flow session is automatically handled by FCL
      
      return {
        success: true,
        lensSession: this.activeLensSession || undefined,
        flowUser: this.isFlowInitialized ? undefined : undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Session resume failed',
      };
    }
  }

  /**
   * List available accounts for the wallet
   * As per Lens documentation for account management
   */
  async listAccounts(walletAddress: string) {
    if (!this.activeLensSession) {
      throw new Error('Not authenticated to Lens');
    }
    
    const result = await fetchAccountsAvailable(this.lensClient, {
      managedBy: evmAddress(walletAddress as `0x${string}`),
      includeOwned: true,
    });

    if (result.isErr()) {
      throw new Error(result.error.message);
    }

    return result.value;
  }

  /**
   * Get current Lens session details
   * As per Lens documentation
   */
  async getCurrentLensSessionDetails() {
    if (!this.activeLensSession) {
      throw new Error('Not authenticated to Lens');
    }
    
    const result = await currentSession(this.activeLensSession);
    
    if (result.isErr()) {
      throw new Error(result.error.message);
    }
    
    return result.value;
  }

  async getAuthorAccount(): Promise<LensAccountInfo | null> {
    if (!this.activeLensSession) return null;
    const sessionInfo = await currentSession(this.activeLensSession);
    if (sessionInfo.isErr()) return null;
    return (sessionInfo.value as LensSessionInfo).account ?? null;
  }

  /**
   * List authenticated sessions
   * As per Lens documentation
   */
  async getAuthenticatedSessions() {
    if (!this.activeLensSession) {
      throw new Error('Not authenticated to Lens');
    }
    
    const result = await fetchAuthenticatedSessions(this.activeLensSession);
    
    if (result.isErr()) {
      throw new Error(result.error.message);
    }
    
    return result.value;
  }

  /**
   * Authenticate Flow wallet
   */
  async authenticateFlow(): Promise<AuthResult> {
    try {
      if (!this.isFlowInitialized) {
        throw new Error('Flow not initialized');
      }

      await fcl.authenticate();
      const user = await fcl.currentUser().snapshot();
      
      return {
        success: true,
        flowUser: user,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Flow authentication failed',
      };
    }
  }

  /**
   * Get current Lens session if authenticated
   */
  getCurrentLensSession(): SessionClient | null {
    return this.activeLensSession;
  }

  /**
   * Get current Flow user if authenticated
   */
  getCurrentFlowUser(): FlowUser | null {
    if (!this.isFlowInitialized) return null;
    return fcl.currentUser().snapshot() as unknown as FlowUser | null;
  }

  /**
   * Logout from both services
   */
  async logout(): Promise<void> {
    try {
      // Logout from Lens if active
      if (this.activeLensSession) {
        // Clear local session reference; SDK will handle token invalidation
        this.activeLensSession = null;
      }
      
      // Logout from Flow if initialized
      if (this.isFlowInitialized) {
        await fcl.unauthenticate();
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  /**
   * Execute Flow payment/subscription transaction
   */
  async executeFlowPayment(amount: string, recipient: string, memo?: string): Promise<PaymentResult> {
    try {
      if (!this.isFlowInitialized) {
        throw new Error('Flow not initialized');
      }

      const transactionId = await fcl.mutate({
        cadence: `
          import FungibleToken from 0x9a0766d93b6608b7
          import FlowToken from 0x7e60df042a9c0868

          transaction(amount: UFix64, to: Address) {
              let sentVault: @FungibleToken.Vault

              prepare(signer: auth(BorrowValue) &Account) {
                  let tokenVault = signer.storage.borrow<auth(FungibleToken.Withdraw) &FungibleToken.Vault>(from: /storage/flowTokenVault)
                      ?? panic("Could not borrow reference to the owner's Vault!")

                  self.sentVault <- tokenVault.withdraw(amount: amount)
              }

              execute {
                  let receiverRef = getAccount(to)
                      .getCapability(/public/flowTokenReceiver)
                      .borrow<&{FungibleToken Receiver}>()
                      ?? panic("Could not borrow reference to the receiver's Vault!")

                  receiverRef.deposit(from: <-self.sentVault)
              }
          }
        `,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        args: (arg: any, t: any) => [
          arg(amount, t.UFix64),
          arg(recipient, t.Address),
        ],
        limit: 9999,
      });

      return {
        success: true,
        txId: transactionId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Payment failed',
      };
    }
  }

  /**
   * Subscribe to subscription plan using Flow
   */
  async subscribe(plan: SubscriptionPlan, paymentMethod: 'flow' = 'flow'): Promise<PaymentResult> {
    if (paymentMethod === 'flow') {
      // For demo purposes, sending to a contract address that would manage subscriptions
      // In a real implementation, this would interact with a subscription management smart contract
      return this.executeFlowPayment(
        plan.price.toString(), 
        '0xf8d6e0586b0a20c7' // Flow contract address placeholder
      );
    }
    
    throw new Error('Unsupported payment method');
  }

  /**
   * Check if user is authenticated to both services
   */
  isAuthenticated(): { lens: boolean; flow: boolean } {
    const lensAuth = !!this.activeLensSession;
    const flowAuth = this.isFlowInitialized;
    
    return {
      lens: lensAuth,
      flow: flowAuth,
    };
  }

  /**
   * Resume session from storage
   */
}

// Export singleton instance for consistent state management
export const blockchainAuthService = new BlockchainAuthService();

// Helper functions for easier usage
export const initializeBlockchainAuth = async (lensConfig: LensConfig, flowConfig: FlowConfig) => {
  await blockchainAuthService.initializeLens(lensConfig);
  await blockchainAuthService.initializeFlow(flowConfig);
  return blockchainAuthService.resumeSession();
};

export const authenticateBlockchain = async (
  walletAddress: string, 
  signMessage: (message: SignableMessage) => Promise<string>
): Promise<AuthResult> => {
  return await blockchainAuthService.authenticateBoth(walletAddress, signMessage);
};

export const executePayment = async (amount: string, recipient: string): Promise<PaymentResult> => {
  return await blockchainAuthService.executeFlowPayment(amount, recipient);
};