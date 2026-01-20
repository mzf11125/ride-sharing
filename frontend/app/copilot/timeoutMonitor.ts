// Timeout Monitor - tracks ride timeouts and provides countdown
import type { Ride } from "../contracts/types";
import { State } from "../contracts/types";

export const ACCEPT_TIMEOUT_SECONDS = 15 * 60; // 15 minutes
export const START_TIMEOUT_SECONDS = 30 * 60; // 30 minutes

export interface TimeoutStatus {
  type: "accept" | "start" | "none";
  startTime: bigint;
  timeoutSeconds: number;
  elapsedSeconds: number;
  remainingSeconds: number;
  isExpired: boolean;
  canClaimRefund: boolean;
}

/**
 * Calculate timeout status for a ride
 */
export function getTimeoutStatus(ride: Ride | null, currentTimestamp: number): TimeoutStatus {
  const defaultStatus: TimeoutStatus = {
    type: "none",
    startTime: BigInt(0),
    timeoutSeconds: 0,
    elapsedSeconds: 0,
    remainingSeconds: 0,
    isExpired: false,
    canClaimRefund: false,
  };

  if (!ride) return defaultStatus;

  const now = Math.floor(currentTimestamp);

  switch (ride.state) {
    case State.Accepted:
      const acceptElapsed = now - Number(ride.acceptedAt);
      return {
        type: "accept",
        startTime: ride.acceptedAt,
        timeoutSeconds: ACCEPT_TIMEOUT_SECONDS,
        elapsedSeconds: acceptElapsed,
        remainingSeconds: Math.max(0, ACCEPT_TIMEOUT_SECONDS - acceptElapsed),
        isExpired: acceptElapsed >= ACCEPT_TIMEOUT_SECONDS,
        canClaimRefund: acceptElapsed >= ACCEPT_TIMEOUT_SECONDS,
      };

    case State.Funded:
      const startElapsed = now - Number(ride.fundedAt);
      return {
        type: "start",
        startTime: ride.fundedAt,
        timeoutSeconds: START_TIMEOUT_SECONDS,
        elapsedSeconds: startElapsed,
        remainingSeconds: Math.max(0, START_TIMEOUT_SECONDS - startElapsed),
        isExpired: startElapsed >= START_TIMEOUT_SECONDS,
        canClaimRefund: startElapsed >= START_TIMEOUT_SECONDS,
      };

    default:
      return defaultStatus;
  }
}

/**
 * Format remaining time as human-readable string
 */
export function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return "Expired";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

/**
 * Format elapsed time as human-readable string
 */
export function formatElapsedTime(startTime: bigint): string {
  const elapsed = Math.floor(Date.now() / 1000) - Number(startTime);
  return formatTimeRemaining(elapsed);
}

/**
 * Calculate percentage of timeout elapsed
 */
export function getTimeoutProgress(status: TimeoutStatus): number {
  if (status.type === "none") return 0;
  const progress = (status.elapsedSeconds / status.timeoutSeconds) * 100;
  return Math.min(100, Math.max(0, progress));
}

/**
 * Get timeout color based on progress
 */
export function getTimeoutColor(progress: number): string {
  if (progress >= 100) return "text-red-500";
  if (progress >= 75) return "text-orange-500";
  if (progress >= 50) return "text-yellow-500";
  return "text-green-500";
}

/**
 * Get timeout message
 */
export function getTimeoutMessage(status: TimeoutStatus): string {
  if (status.type === "none") return "";

  if (status.isExpired) {
    return status.type === "accept"
      ? "Funding timeout expired. You can claim a refund."
      : "Start timeout expired. You can claim a refund.";
  }

  const remaining = formatTimeRemaining(status.remainingSeconds);
  return status.type === "accept"
    ? `Driver must fund within ${remaining}`
    : `Driver must start within ${remaining}`;
}
