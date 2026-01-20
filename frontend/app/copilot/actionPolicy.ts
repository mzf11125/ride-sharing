// Action Policy - determines if an action is allowed and explains why
import type { State } from "../contracts/types";

export interface ActionPolicy {
  canProceed: boolean;
  reason: string;
  errorTitle?: string;
}

export type ActionType =
  | "registerDriver"
  | "requestRide"
  | "acceptRide"
  | "fundRide"
  | "startRide"
  | "completeRide"
  | "confirmArrival"
  | "cancelRide"
  | "rateDriver"
  | "rateRider"
  | "claimRefund";

/**
 * Check if an action is allowed and provide explanation
 */
export function checkActionPolicy(
  action: ActionType,
  context: {
    isConnected: boolean;
    isRegisteredDriver: boolean;
    rideState: State;
    userRole: "rider" | "driver" | "stranger";
    userBalance: bigint | null;
    rideAmount: bigint | null;
    hasRated: boolean;
    isRideFinalized: boolean;
  }
): ActionPolicy {
  switch (action) {
    case "registerDriver":
      return checkRegisterDriver(context);
    case "requestRide":
      return checkRequestRide(context);
    case "acceptRide":
      return checkAcceptRide(context);
    case "fundRide":
      return checkFundRide(context);
    case "startRide":
      return checkStartRide(context);
    case "completeRide":
      return checkCompleteRide(context);
    case "confirmArrival":
      return checkConfirmArrival(context);
    case "cancelRide":
      return checkCancelRide(context);
    case "rateDriver":
      return checkRateDriver(context);
    case "rateRider":
      return checkRateRider(context);
    case "claimRefund":
      return checkClaimRefund(context);
    default:
      return { canProceed: false, reason: "Unknown action" };
  }
}

function checkRegisterDriver(context: {
  isConnected: boolean;
  isRegisteredDriver: boolean;
}): ActionPolicy {
  if (!context.isConnected) {
    return {
      canProceed: false,
      reason: "Connect your wallet to register as a driver",
      errorTitle: "Wallet Not Connected",
    };
  }
  if (context.isRegisteredDriver) {
    return {
      canProceed: false,
      reason: "You are already registered as a driver",
      errorTitle: "Already Registered",
    };
  }
  return { canProceed: true, reason: "" };
}

function checkRequestRide(context: {
  isConnected: boolean;
}): ActionPolicy {
  if (!context.isConnected) {
    return {
      canProceed: false,
      reason: "Connect your wallet to request a ride",
      errorTitle: "Wallet Not Connected",
    };
  }
  return { canProceed: true, reason: "" };
}

function checkAcceptRide(context: {
  isConnected: boolean;
  isRegisteredDriver: boolean;
  rideState: State;
}): ActionPolicy {
  if (!context.isConnected) {
    return {
      canProceed: false,
      reason: "Connect your wallet to accept rides",
      errorTitle: "Wallet Not Connected",
    };
  }
  if (!context.isRegisteredDriver) {
    return {
      canProceed: false,
      reason: "Only registered drivers can accept rides",
      errorTitle: "Not Registered",
    };
  }
  if (context.rideState !== 0 /* Requested */) {
    return {
      canProceed: false,
      reason: "This ride is no longer available",
      errorTitle: "Ride Unavailable",
    };
  }
  return { canProceed: true, reason: "" };
}

function checkFundRide(context: {
  isConnected: boolean;
  userRole: "rider" | "driver" | "stranger";
  rideState: State;
  userBalance: bigint | null;
  rideAmount: bigint | null;
}): ActionPolicy {
  if (!context.isConnected) {
    return {
      canProceed: false,
      reason: "Connect your wallet to fund the ride",
      errorTitle: "Wallet Not Connected",
    };
  }
  if (context.userRole !== "rider") {
    return {
      canProceed: false,
      reason: "Only the rider can fund this ride",
      errorTitle: "Not Your Ride",
    };
  }
  if (context.rideState !== 1 /* Accepted */) {
    return {
      canProceed: false,
      reason: "Ride must be accepted before funding",
      errorTitle: "Cannot Fund",
    };
  }
  if (context.userBalance !== null && context.rideAmount !== null) {
    if (context.userBalance < context.rideAmount) {
      return {
        canProceed: false,
        reason: `Insufficient balance. You need at least ${formatEther(context.rideAmount)} ETH`,
        errorTitle: "Insufficient Balance",
      };
    }
  }
  return { canProceed: true, reason: "" };
}

function checkStartRide(context: {
  isConnected: boolean;
  userRole: "rider" | "driver" | "stranger";
  rideState: State;
}): ActionPolicy {
  if (!context.isConnected) {
    return {
      canProceed: false,
      reason: "Connect your wallet to start the ride",
      errorTitle: "Wallet Not Connected",
    };
  }
  if (context.userRole !== "driver") {
    return {
      canProceed: false,
      reason: "Only the driver can start the ride",
      errorTitle: "Not Your Ride",
    };
  }
  if (context.rideState !== 2 /* Funded */) {
    return {
      canProceed: false,
      reason: "Ride must be funded before starting",
      errorTitle: "Cannot Start",
    };
  }
  return { canProceed: true, reason: "" };
}

function checkCompleteRide(context: {
  isConnected: boolean;
  userRole: "rider" | "driver" | "stranger";
  rideState: State;
}): ActionPolicy {
  if (!context.isConnected) {
    return {
      canProceed: false,
      reason: "Connect your wallet to complete the ride",
      errorTitle: "Wallet Not Connected",
    };
  }
  if (context.userRole !== "driver") {
    return {
      canProceed: false,
      reason: "Only the driver can complete the ride",
      errorTitle: "Not Your Ride",
    };
  }
  if (context.rideState !== 3 /* Started */) {
    return {
      canProceed: false,
      reason: "Ride must be in progress before completing",
      errorTitle: "Cannot Complete",
    };
  }
  return { canProceed: true, reason: "" };
}

function checkConfirmArrival(context: {
  isConnected: boolean;
  userRole: "rider" | "driver" | "stranger";
  rideState: State;
}): ActionPolicy {
  if (!context.isConnected) {
    return {
      canProceed: false,
      reason: "Connect your wallet to confirm arrival",
      errorTitle: "Wallet Not Connected",
    };
  }
  if (context.userRole !== "rider") {
    return {
      canProceed: false,
      reason: "Only the rider can confirm arrival",
      errorTitle: "Not Your Ride",
    };
  }
  if (context.rideState !== 4 /* CompletedByDriver */) {
    return {
      canProceed: false,
      reason: "Driver must complete the ride first",
      errorTitle: "Cannot Confirm",
    };
  }
  return { canProceed: true, reason: "" };
}

function checkCancelRide(context: {
  isConnected: boolean;
  userRole: "rider" | "driver" | "stranger";
  rideState: State;
}): ActionPolicy {
  if (!context.isConnected) {
    return {
      canProceed: false,
      reason: "Connect your wallet to cancel",
      errorTitle: "Wallet Not Connected",
    };
  }
  if (context.userRole === "stranger") {
    return {
      canProceed: false,
      reason: "Only participants can cancel this ride",
      errorTitle: "Not Allowed",
    };
  }
  if (context.rideState >= 3 /* Started or later */) {
    return {
      canProceed: false,
      reason: "Cannot cancel a ride that has already started",
      errorTitle: "Cannot Cancel",
    };
  }
  if (context.rideState === 5 /* Finalized */ || context.rideState === 6 /* Cancelled */) {
    return {
      canProceed: false,
      reason: "This ride has already ended",
      errorTitle: "Ride Ended",
    };
  }
  return { canProceed: true, reason: "" };
}

function checkRateDriver(context: {
  isConnected: boolean;
  userRole: "rider" | "driver" | "stranger";
  isRideFinalized: boolean;
  hasRated: boolean;
}): ActionPolicy {
  if (!context.isConnected) {
    return {
      canProceed: false,
      reason: "Connect your wallet to rate",
      errorTitle: "Wallet Not Connected",
    };
  }
  if (context.userRole !== "rider") {
    return {
      canProceed: false,
      reason: "Only the rider can rate the driver",
      errorTitle: "Not Allowed",
    };
  }
  if (!context.isRideFinalized) {
    return {
      canProceed: false,
      reason: "You can only rate after the ride is complete",
      errorTitle: "Cannot Rate Yet",
    };
  }
  if (context.hasRated) {
    return {
      canProceed: false,
      reason: "You have already rated this driver",
      errorTitle: "Already Rated",
    };
  }
  return { canProceed: true, reason: "" };
}

function checkRateRider(context: {
  isConnected: boolean;
  userRole: "rider" | "driver" | "stranger";
  isRideFinalized: boolean;
  hasRated: boolean;
}): ActionPolicy {
  if (!context.isConnected) {
    return {
      canProceed: false,
      reason: "Connect your wallet to rate",
      errorTitle: "Wallet Not Connected",
    };
  }
  if (context.userRole !== "driver") {
    return {
      canProceed: false,
      reason: "Only the driver can rate the rider",
      errorTitle: "Not Allowed",
    };
  }
  if (!context.isRideFinalized) {
    return {
      canProceed: false,
      reason: "You can only rate after the ride is complete",
      errorTitle: "Cannot Rate Yet",
    };
  }
  if (context.hasRated) {
    return {
      canProceed: false,
      reason: "You have already rated this rider",
      errorTitle: "Already Rated",
    };
  }
  return { canProceed: true, reason: "" };
}

function checkClaimRefund(context: {
  isConnected: boolean;
  userRole: "rider" | "driver" | "stranger";
  rideState: State;
}): ActionPolicy {
  if (!context.isConnected) {
    return {
      canProceed: false,
      reason: "Connect your wallet to claim a refund",
      errorTitle: "Wallet Not Connected",
    };
  }
  if (context.userRole !== "rider") {
    return {
      canProceed: false,
      reason: "Only the rider can claim a refund",
      errorTitle: "Not Allowed",
    };
  }
  if (context.rideState !== 1 /* Accepted */ && context.rideState !== 2 /* Funded */) {
    return {
      canProceed: false,
      reason: "Refund only available for accepted or funded rides",
      errorTitle: "Cannot Refund",
    };
  }
  return { canProceed: true, reason: "" };
}

function formatEther(wei: bigint): string {
  const eth = Number(wei) / 1e18;
  return eth.toFixed(6);
}
