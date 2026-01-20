"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  type PublicClient,
  type WalletClient,
  type Address,
} from "viem";
import { sepolia } from "viem/chains";

// Contract address (replace with deployed address)
export const CONTRACT_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;

export function useWeb3() {
  const [publicClient, setPublicClient] = useState<PublicClient | null>(null);
  const [walletClient, setWalletClient] = useState<WalletClient | null>(null);
  const [address, setAddress] = useState<Address | null>(null);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [chainId, setChainId] = useState<number | null>(null);

  // Initialize public client
  useEffect(() => {
    const client = createPublicClient({
      chain: sepolia,
      transport: typeof window !== "undefined" && (window as any).ethereum
        ? custom((window as any).ethereum)
        : http(),
    });
    setPublicClient(client);
  }, []);

  // Connect wallet
  const connect = useCallback(async () => {
    if (typeof window === "undefined" || !(window as any).ethereum) {
      throw new Error("MetaMask not installed");
    }

    try {
      const accounts = await (window as any).ethereum.request({
        method: "eth_requestAccounts",
      });

      if (accounts.length === 0) {
        throw new Error("No accounts found");
      }

      const client = createWalletClient({
        chain: sepolia,
        transport: custom((window as any).ethereum),
      });

      setWalletClient(client);
      setAddress(accounts[0] as Address);
      setIsConnected(true);

      // Get chain ID
      const chainIdHex = await (window as any).ethereum.request({
        method: "eth_chainId",
      });
      setChainId(parseInt(chainIdHex, 16));

      return accounts[0] as Address;
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      throw error;
    }
  }, []);

  // Disconnect wallet
  const disconnect = useCallback(() => {
    setWalletClient(null);
    setAddress(null);
    setIsConnected(false);
    setChainId(null);
    setBalance(null);
  }, []);

  // Update balance when address changes
  useEffect(() => {
    if (!publicClient || !address) {
      setBalance(null);
      return;
    }

    const fetchBalance = async () => {
      try {
        const bal = await publicClient.getBalance({ address });
        setBalance(bal);
      } catch (error) {
        console.error("Failed to fetch balance:", error);
      }
    };

    fetchBalance();

    // Refresh balance every 10 seconds
    const interval = setInterval(fetchBalance, 10000);
    return () => clearInterval(interval);
  }, [publicClient, address]);

  // Listen for account changes
  useEffect(() => {
    if (typeof window === "undefined" || !(window as any).ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnect();
      } else if (accounts[0] !== address) {
        setAddress(accounts[0] as Address);
        setIsConnected(true);
      }
    };

    const handleChainChanged = () => {
      window.location.reload();
    };

    (window as any).ethereum.on("accountsChanged", handleAccountsChanged);
    (window as any).ethereum.on("chainChanged", handleChainChanged);

    return () => {
      (window as any).ethereum?.removeListener("accountsChanged", handleAccountsChanged);
      (window as any).ethereum?.removeListener("chainChanged", handleChainChanged);
    };
  }, [address, disconnect]);

  return {
    publicClient,
    walletClient,
    address,
    balance,
    isConnected,
    chainId,
    connect,
    disconnect,
  };
}

// Format balance for display
export function formatBalance(balance: bigint | null): string {
  if (balance === null) return "0.0000";
  return (Number(balance) / 1e18).toFixed(4);
}

// Format address for display
export function formatAddress(address: Address | null): string {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Format wei to ETH
export function formatWei(wei: bigint): string {
  return (Number(wei) / 1e18).toFixed(6);
}
