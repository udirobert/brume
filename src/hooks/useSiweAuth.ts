import { useCallback, useMemo } from 'react';
import { issueSiweChallenge, verifySiweSignature } from '../lib/api/siwe';
import { useWallet } from './useWallet';
import { useAuthStore } from '../stores/authStore';
import { config } from '../config/environment';

export interface UseSiweAuthReturn {
  isReady: boolean;
  isWalletConnected: boolean;
  authenticate: (opts?: { domain?: string; uri?: string; statement?: string }) => Promise<{ success: boolean; address?: string; jwt?: string | null; error?: string }>;
}

export const useSiweAuth = (): UseSiweAuthReturn => {
  const { isConnected, address, chainId, signMessage, connect } = useWallet();
  const setSiweState = useAuthStore((s) => s.setSiweState);
  const setWallet = useAuthStore((s) => s.setWallet);

  const isReady = useMemo(() => !!address && !!isConnected, [address, isConnected]);

  const authenticate = useCallback(async (opts?: { domain?: string; uri?: string; statement?: string }) => {
    try {
      if (!isConnected || !address) {
        await connect();
      }
      if (!address) {
        throw new Error('Wallet not connected');
      }

      const parsedChainId = chainId ? parseInt(chainId, 16) : 1;
      const domain = opts?.domain || new URL(config.app.url).hostname || 'brume.trustfall.xyz';
      const uri = opts?.uri || config.app.url || 'https://brume.trustfall.xyz';
      const statement = opts?.statement || 'Sign-In with Ethereum to Brume';

      const challenge = await issueSiweChallenge({ address, chainId: parsedChainId, domain, uri, statement });
      const signature = await signMessage(challenge.message);
      const verify = await verifySiweSignature({ message: challenge.message, signature });

      if (!verify.ok || !verify.siweVerified) {
        throw new Error('SIWE verification failed');
      }

      // Update unified store with wallet state and SIWE status
      setWallet(address, chainId || null, true);
      setSiweState(true, verify.thirdPartyJwt || null);

      return { success: true, address, jwt: verify.thirdPartyJwt || null };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'SIWE authentication failed';
      setSiweState(false, null);
      return { success: false, error: msg };
    }
  }, [isConnected, address, chainId, signMessage, connect, setSiweState, setWallet]);

  return {
    isReady,
    isWalletConnected: isConnected,
    authenticate,
  };
};