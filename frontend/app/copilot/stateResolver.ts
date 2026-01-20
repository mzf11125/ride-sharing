// State Resolver - determines ride state and user role
import type { Ride } from "../contracts/types";
import { State } from "../contracts/types";

export type UserRole = "rider" | "driver" | "stranger";

export interface ResolvedState {
  state: State;
  stateLabel: string;
  userRole: UserRole;
  canCancel: boolean;
  canFund: boolean;
  canStart: boolean;
  canComplete: boolean;
  canConfirm: boolean;
  canRateDriver: boolean;
  canRateRider: boolean;
  nextAction: string | null;
}

/**
 * Resolve the current state and available actions for a ride
 */
export function resolveRideState(
  ride: Ride | null,
  userAddress: `0x${string}` | undefined
): ResolvedState {
  const defaultState: ResolvedState = {
    state: State.Requested,
    stateLabel: "Requested",
    userRole: "stranger",
    canCancel: false,
    canFund: false,
    canStart: false,
    canComplete: false,
    canConfirm: false,
    canRateDriver: false,
    canRateRider: false,
    nextAction: null,
  };

  if (!ride || !userAddress) {
    return defaultState;
  }

  const normalizedUser = userAddress.toLowerCase() as `0x${string}`;
  const normalizedRider = ride.rider.toLowerCase() as `0x${string}`;
  const normalizedDriver = ride.driver.toLowerCase() as `0x${string}`;

  // Determine user role
  let userRole: UserRole;
  if (normalizedUser === normalizedRider) {
    userRole = "rider";
  } else if (normalizedUser === normalizedDriver && normalizedDriver !== "0x0000000000000000000000000000000000000000" as `0x${string}`) {
    userRole = "driver";
  } else {
    userRole = "stranger";
  }

  const stateLabel = getStateLabel(ride.state);
  const canCancel = userRole !== "stranger" && ride.state < State.Started;

  // Action availability based on state and role
  const canFund = userRole === "rider" && ride.state === State.Accepted;
  const canStart = userRole === "driver" && ride.state === State.Funded;
  const canComplete = userRole === "driver" && ride.state === State.Started;
  const canConfirm = userRole === "rider" && ride.state === State.CompletedByDriver;
  const canRateDriver = userRole === "rider" && ride.state === State.Finalized;
  const canRateRider = userRole === "driver" && ride.state === State.Finalized;

  // Determine next action
  let nextAction: string | null = null;
  switch (ride.state) {
    case State.Requested:
      if (userRole === "rider") {
        nextAction = "Waiting for a driver to accept...";
      } else if (userRole === "driver") {
        nextAction = "You can accept this ride";
      }
      break;
    case State.Accepted:
      if (userRole === "rider") {
        nextAction = "Fund your ride to proceed";
      } else if (userRole === "driver") {
        nextAction = "Waiting for rider to fund...";
      }
      break;
    case State.Funded:
      if (userRole === "rider") {
        nextAction = "Waiting for driver to start...";
      } else if (userRole === "driver") {
        nextAction = "You can start the ride now";
      }
      break;
    case State.Started:
      if (userRole === "rider") {
        nextAction = "Ride in progress...";
      } else if (userRole === "driver") {
        nextAction = "Complete the ride when you arrive";
      }
      break;
    case State.CompletedByDriver:
      if (userRole === "rider") {
        nextAction = "Confirm arrival to release payment";
      } else if (userRole === "driver") {
        nextAction = "Waiting for rider to confirm...";
      }
      break;
    case State.Finalized:
      nextAction = "Ride complete!";
      break;
    case State.Cancelled:
      nextAction = "Ride was cancelled";
      break;
    case State.Refunded:
      nextAction = "Ride was refunded due to timeout";
      break;
  }

  return {
    state: ride.state,
    stateLabel,
    userRole,
    canCancel,
    canFund,
    canStart,
    canComplete,
    canConfirm,
    canRateDriver,
    canRateRider,
    nextAction,
  };
}

function getStateLabel(state: State): string {
  switch (state) {
    case State.Requested:
      return "Requested";
    case State.Accepted:
      return "Accepted";
    case State.Funded:
      return "Funded";
    case State.Started:
      return "In Progress";
    case State.CompletedByDriver:
      return "Completed by Driver";
    case State.Finalized:
      return "Completed";
    case State.Cancelled:
      return "Cancelled";
    case State.Refunded:
      return "Refunded";
    default:
      return "Unknown";
  }
}

/**
 * Format timestamp to readable date
 */
export function formatTimestamp(timestamp: bigint): string {
  if (timestamp === BigInt(0)) return "N/A";
  return new Date(Number(timestamp) * 1000).toLocaleString();
}

/**
 * Calculate time remaining for timeout
 */
export function getTimeRemaining(
  ride: Ride,
  currentTimestamp: number
): { minutes: number; seconds: number; isExpired: boolean } | null {
  let referenceTime: bigint;
  let timeout: number;

  if (ride.state === 1 /* Accepted */) {
    referenceTime = ride.acceptedAt;
    timeout = 15 * 60; // 15 minutes
  } else if (ride.state === 2 /* Funded */) {
    referenceTime = ride.fundedAt;
    timeout = 30 * 60; // 30 minutes
  } else {
    return null;
  }

  const elapsed = currentTimestamp - Number(referenceTime);
  const remaining = timeout - elapsed;

  if (remaining <= 0) {
    return { minutes: 0, seconds: 0, isExpired: true };
  }

  return {
    minutes: Math.floor(remaining / 60),
    seconds: remaining % 60,
    isExpired: false,
  };
}
