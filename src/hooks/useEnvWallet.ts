import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';

interface EnvWalletState {
  userWallet: ethers.Wallet | null;
  relayerWallet: ethers.Wallet | null;
  provider: ethers.JsonRpcProvider | null;
  isConfigured: boolean;
  userAddress: string | null;
  relayerAddress: string | null;
  userBalance: string | null;
  relayerBalance: string | null;
  multiNetworkBalances: { [networkName: string]: { balance: string; currency: string } } | null;
  chainId: number | null;
  error: string | null;
  currentUserPrivateKey: string | null;
}

export const useEnvWallet = () => {
  const [walletState, setWalletState] = useState<EnvWalletState>({
    userWallet: null,
    relayerWallet: null,
    provider: null,
    isConfigured: false,
    userAddress: null,
    relayerAddress: null,
    userBalance: null,
    relayerBalance: null,
    multiNetworkBalances: null,
    chainId: null,
    error: null,
    currentUserPrivateKey: null,
  });

  // Network configurations for multi-balance fetching
  const NETWORKS = [
    {
      id: 56,
      name: 'BSC',
      rpcUrl: import.meta.env.VITE_RPC_URL || 'https://bsc-dataseed1.binance.org',
      currency: 'BNB',
      relayerKey: import.meta.env.VITE_RELAYER_PRIVATE_KEY
    },
    {
      id: 1,
      name: 'Ethereum',
      rpcUrl: import.meta.env.VITE_ETHEREUM_RPC_URL || 'https://eth.llamarpc.com',
      currency: 'ETH',
      relayerKey: import.meta.env.VITE_ETHEREUM_RELAYER_PRIVATE_KEY || import.meta.env.VITE_RELAYER_PRIVATE_KEY
    },
    {
      id: 11155111,
      name: 'Sepolia',
      rpcUrl: import.meta.env.VITE_SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
      currency: 'ETH',
      relayerKey: import.meta.env.VITE_SEPOLIA_RELAYER_PRIVATE_KEY || import.meta.env.VITE_RELAYER_PRIVATE_KEY
    },
    {
      id: 42161,
      name: 'Arbitrum',
      rpcUrl: import.meta.env.VITE_ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
      currency: 'ETH',
      relayerKey: import.meta.env.VITE_ARBITRUM_RELAYER_PRIVATE_KEY || import.meta.env.VITE_RELAYER_PRIVATE_KEY
    },
    {
      id: 8453,
      name: 'Base',
      rpcUrl: import.meta.env.VITE_BASE_RPC_URL || 'https://mainnet.base.org',
      currency: 'ETH',
      relayerKey: import.meta.env.VITE_BASE_RELAYER_PRIVATE_KEY || import.meta.env.VITE_RELAYER_PRIVATE_KEY
    },
    {
      id: 137,
      name: 'Polygon',
      rpcUrl: import.meta.env.VITE_POLYGON_RPC_URL || 'https://polygon-rpc.com',
      currency: 'MATIC',
      relayerKey: import.meta.env.VITE_POLYGON_RELAYER_PRIVATE_KEY || import.meta.env.VITE_RELAYER_PRIVATE_KEY
    },
    {
      id: 10,
      name: 'Optimism',
      rpcUrl: import.meta.env.VITE_OPTIMISM_RPC_URL || 'https://mainnet.optimism.io',
      currency: 'ETH',
      relayerKey: import.meta.env.VITE_OPTIMISM_RELAYER_PRIVATE_KEY || import.meta.env.VITE_RELAYER_PRIVATE_KEY
    }
  ];

  // Fetch balances from all networks
  const fetchMultiNetworkBalances = useCallback(async () => {
    console.log('🌐 Fetching multi-network balances...');
    
    const balances: { [networkName: string]: { balance: string; currency: string } } = {};
    
    const promises = NETWORKS.map(async (network) => {
      if (!network.relayerKey || network.relayerKey.trim() === '' || network.relayerKey === '0x...' || network.relayerKey === '0x') {
        console.log(`⚠️ No relayer key for ${network.name}, skipping`);
        return;
      }
      
      // Validate private key format (should be 64 hex characters, optionally prefixed with 0x)
      const cleanKey = network.relayerKey.startsWith('0x') ? network.relayerKey.slice(2) : network.relayerKey;
      if (!/^[0-9a-fA-F]{64}$/.test(cleanKey)) {
        console.log(`⚠️ Invalid private key format for ${network.name}, skipping`);
        return;
      }
      
      try {
        const provider = new ethers.JsonRpcProvider(network.rpcUrl);
        const wallet = new ethers.Wallet(network.relayerKey, provider);
        const balance = await provider.getBalance(wallet.address);
        
        balances[network.name] = {
          balance: ethers.formatEther(balance),
          currency: network.currency
        };
        
        console.log(`✅ ${network.name}: ${ethers.formatEther(balance)} ${network.currency}`);
      } catch (error) {
        console.error(`❌ Failed to fetch balance for ${network.name}:`, error);
        balances[network.name] = {
          balance: '0.0000',
          currency: network.currency
        };
      }
    });
    
    await Promise.all(promises);
    
    setWalletState(prev => ({
      ...prev,
      multiNetworkBalances: balances
    }));
    
    console.log('🌐 Multi-network balances updated:', balances);
  }, []);

  // Initialize provider and relayer wallet once
  useEffect(() => {
    initializeProvider();
    fetchMultiNetworkBalances();
  }, []);

  const initializeProvider = async () => {
    try {
      // Get network-specific configuration
      const getNetworkConfig = () => {
        // Default to BSC if no specific network is selected
        const bscConfig = {
          relayerPrivateKey: import.meta.env.VITE_RELAYER_PRIVATE_KEY,
          rpcUrl: import.meta.env.VITE_RPC_URL
        };
        
        // You can extend this to support multiple networks
        return bscConfig;
      };
      
      const { relayerPrivateKey, rpcUrl } = getNetworkConfig();

      if (!relayerPrivateKey || !rpcUrl) {
        setWalletState(prev => ({
          ...prev,
          error: 'Please configure VITE_RELAYER_PRIVATE_KEY and VITE_RPC_URL in .env file',
        }));
        return;
      }

      console.log('🔧 Initializing provider and relayer...');

      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const relayerWallet = new ethers.Wallet(relayerPrivateKey, provider);
      const network = await provider.getNetwork();
      const chainId = Number(network.chainId);
      const relayerBalance = await provider.getBalance(relayerWallet.address);

      console.log('✅ Provider initialized:', {
        relayerAddress: relayerWallet.address,
        chainId,
        relayerBalance: ethers.formatEther(relayerBalance)
      });

      setWalletState(prev => ({
        ...prev,
        relayerWallet,
        provider,
        relayerAddress: relayerWallet.address,
        relayerBalance: ethers.formatEther(relayerBalance),
        chainId,
        error: null,
      }));

    } catch (error) {
      console.error('❌ Failed to initialize provider:', error);
      setWalletState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to initialize provider',
      }));
    }
  };

  const updateUserPrivateKey = useCallback(async (newPrivateKey: string) => {
    console.log('🔑 updateUserPrivateKey called:', newPrivateKey ? 'key provided' : 'empty');

    // If empty key, clear user wallet
    if (!newPrivateKey || newPrivateKey.trim() === '') {
      console.log('🧹 Clearing user wallet');
      setWalletState(prev => ({
        ...prev,
        currentUserPrivateKey: '',
        userWallet: null,
        userAddress: null,
        userBalance: null,
        isConfigured: false,
      }));
      return;
    }

    try {
      // Use functional update to get current state
      setWalletState(prev => {
        if (!prev.provider) {
          console.log('❌ Provider not ready, waiting...');
          // Retry after a short delay
          setTimeout(() => updateUserPrivateKey(newPrivateKey), 100);
          return prev;
        }

        console.log('👤 Creating user wallet...');
        const userWallet = new ethers.Wallet(newPrivateKey, prev.provider);
        
        console.log('✅ User wallet created:', userWallet.address);

        // Return new state immediately
        const newState = {
          ...prev,
          currentUserPrivateKey: newPrivateKey,
          userWallet,
          userAddress: userWallet.address,
          isConfigured: !!(prev.relayerWallet && prev.provider && newPrivateKey),
          error: null,
        };

        // Get balance asynchronously without blocking state update
        prev.provider.getBalance(userWallet.address)
          .then(balance => {
            console.log('💰 User balance:', ethers.formatEther(balance));
            setWalletState(current => ({
              ...current,
              userBalance: ethers.formatEther(balance),
            }));
          })
          .catch(error => {
            console.error('❌ Failed to get user balance:', error);
          });

        return newState;
      });

    } catch (error) {
      console.error('❌ Failed to create user wallet:', error);
      setWalletState(prev => ({
        ...prev,
        currentUserPrivateKey: newPrivateKey,
        userWallet: null,
        userAddress: null,
        userBalance: null,
        error: error instanceof Error ? error.message : 'Failed to create user wallet',
      }));
    }
  }, []); // Remove walletState dependency to prevent stale closures

  const refreshBalances = useCallback(async () => {
    setWalletState(prev => {
      if (!prev.provider) {
        console.log('❌ Provider not ready, waiting...');
        return prev;
      }

      try {
        const promises = [];
        
        if (prev.userWallet) {
          promises.push(
            prev.provider.getBalance(prev.userWallet.address)
              .then(balance => ({ type: 'user', balance: ethers.formatEther(balance) }))
          );
        }
        
        if (prev.relayerWallet) {
          promises.push(
            prev.provider.getBalance(prev.relayerWallet.address)
              .then(balance => ({ type: 'relayer', balance: ethers.formatEther(balance) }))
          );
        }

        Promise.all(promises).then(results => {
          setWalletState(current => {
            const updates: Partial<EnvWalletState> = {};
            results.forEach(result => {
              if (result.type === 'user') {
                updates.userBalance = result.balance;
              } else if (result.type === 'relayer') {
                updates.relayerBalance = result.balance;
              }
            });
            return { ...current, ...updates };
          });
          console.log('✅ Balances refreshed');
        }).catch(error => {
          console.error('❌ Failed to refresh balances:', error);
        });

      } catch (error) {
        console.error('❌ Failed to refresh balances:', error);
      }

      return prev;
    });
    
    // Also refresh multi-network balances
    fetchMultiNetworkBalances();
  }, []);

  // Debug logging
  useEffect(() => {
    console.log('🔍 Wallet state updated:', {
      hasUserWallet: !!walletState.userWallet,
      hasRelayerWallet: !!walletState.relayerWallet,
      hasProvider: !!walletState.provider,
      isConfigured: walletState.isConfigured,
      userAddress: walletState.userAddress,
      relayerAddress: walletState.relayerAddress,
      currentUserPrivateKey: walletState.currentUserPrivateKey ? 'set' : 'not set',
    });
  }, [walletState]);

  return {
    ...walletState,
    currentUserPrivateKey: walletState.currentUserPrivateKey,
    refreshBalances,
    reinitialize: initializeProvider,
    updateUserPrivateKey,
    fetchMultiNetworkBalances,
  };
};