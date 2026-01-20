// Gas Estimator - estimates gas costs before transactions
import type { PublicClient, WalletClient } from "viem";
import { RIDE_SHARING_ABI } from "../contracts/abi";

export interface GasEstimate {
  gasLimit: bigint | null;
  gasPrice: bigint | null;
  ethCost: string | null;
  usdCost: string | null;
  error: string | null;
}

/**
 * Estimate gas cost for a contract call
 */
export async function estimateGas(
  publicClient: PublicClient,
  functionName: string,
  args: unknown[],
  address: `0x${string}`,
  account?: `0x${string}`,
  value?: bigint
): Promise<GasEstimate> {
  try {
    // Get gas price
    const gasPrice = await publicClient.getGasPrice();

    // Estimate gas limit
    const params: any = {
      address,
      abi: RIDE_SHARING_ABI,
      functionName: functionName as any,
      args: args as any,
    };

    if (account) params.account = account;
    if (value !== undefined) params.value = value;

    const gasEstimate = await publicClient.estimateContractGas(params);

    // Add 20% buffer
    const gasLimit = (gasEstimate * BigInt(120)) / BigInt(100);

    // Calculate costs
    const weiCost = gasLimit * gasPrice;
    const ethCost = (Number(weiCost) / 1e18).toFixed(6);

    // Rough USD estimate (assume $3000/ETH - in production, fetch from API)
    const usdCost = (parseFloat(ethCost) * 3000).toFixed(2);

    return {
      gasLimit,
      gasPrice,
      ethCost,
      usdCost,
      error: null,
    };
  } catch (error) {
    return {
      gasLimit: null,
      gasPrice: null,
      ethCost: null,
      usdCost: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Predefined gas estimates for common operations (fallback when estimation fails)
 */
export const FALLBACK_GAS_ESTIMATES: Record<string, { gasLimit: number; ethCost: string }> = {
  registerDriver: { gasLimit: 50000, ethCost: "0.0001" },
  requestRide: { gasLimit: 150000, ethCost: "0.0003" },
  acceptRide: { gasLimit: 80000, ethCost: "0.00016" },
  fundRide: { gasLimit: 100000, ethCost: "0.0002" },
  startRide: { gasLimit: 60000, ethCost: "0.00012" },
  completeRide: { gasLimit: 60000, ethCost: "0.00012" },
  confirmArrival: { gasLimit: 70000, ethCost: "0.00014" },
  cancelRide: { gasLimit: 70000, ethCost: "0.00014" },
  rateDriver: { gasLimit: 80000, ethCost: "0.00016" },
  rateRider: { gasLimit: 80000, ethCost: "0.00016" },
  claimRefundNotFunded: { gasLimit: 60000, ethCost: "0.00012" },
  claimRefundNotStarted: { gasLimit: 60000, ethCost: "0.00012" },
};

export function getFallbackEstimate(functionName: string): GasEstimate {
  const fallback = FALLBACK_GAS_ESTIMATES[functionName];
  if (!fallback) {
    return {
      gasLimit: null,
      gasPrice: null,
      ethCost: null,
      usdCost: null,
      error: "No estimate available",
    };
  }

  return {
    gasLimit: BigInt(fallback.gasLimit),
    gasPrice: null,
    ethCost: fallback.ethCost,
    usdCost: (parseFloat(fallback.ethCost) * 3000).toFixed(2),
    error: null,
  };
}

/**
 * Check if user has sufficient balance for transaction
 */
export function checkSufficientBalance(
  userBalance: bigint,
  gasCost: bigint,
  additionalValue: bigint = BigInt(0)
): { sufficient: boolean; needed: bigint } {
  const totalNeeded = gasCost + additionalValue;
  return {
    sufficient: userBalance >= totalNeeded,
    needed: totalNeeded,
  };
}

/**
 * Format gas cost for display
 */
export function formatGasCost(estimate: GasEstimate): {
  primary: string;
  secondary?: string;
} {
  if (estimate.error) {
    return { primary: "Gas estimation failed" };
  }

  if (estimate.ethCost) {
    return {
      primary: `~${estimate.ethCost} ETH`,
      secondary: estimate.usdCost ? `(~$${estimate.usdCost})` : undefined,
    };
  }

  return { primary: "Calculating..." };
}
