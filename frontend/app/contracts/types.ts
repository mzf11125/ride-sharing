// Contract Types for RideSharing

export enum State {
  Requested = 0,
  Accepted = 1,
  Funded = 2,
  Started = 3,
  CompletedByDriver = 4,
  Finalized = 5,
  Cancelled = 6,
  Refunded = 7,
}

export interface Location {
  latitude: string;
  longitude: string;
  address_: string;
}

export interface Ride {
  id: bigint;
  rider: `0x${string}`;
  driver: `0x${string}`;
  amount: bigint;
  state: State;
  pickup: Location;
  destination: Location;
  requestedAt: bigint;
  acceptedAt: bigint;
  fundedAt: bigint;
  startedAt: bigint;
  completedAt: bigint;
  finalizedAt: bigint;
}

export interface Driver {
  isRegistered: boolean;
  totalRating: bigint;
  ratingCount: bigint;
  rideIds: bigint[];
}

export interface Rating {
  riderRatedDriver: boolean;
  driverRatedRider: boolean;
  riderRating: number;
  driverRating: number;
}

export interface RefundStatus {
  canRefund: boolean;
  refundType: number; // 0 = none, 1 = not funded timeout, 2 = not started timeout
  timeRemaining: bigint;
}

// Contract events
export interface RideRequestedEvent {
  rideId: bigint;
  rider: `0x${string}`;
  amount: bigint;
}

export interface RideAcceptedEvent {
  rideId: bigint;
  driver: `0x${string}`;
  acceptedAt: bigint;
}

export interface RideFundedEvent {
  rideId: bigint;
  amount: bigint;
  fundedAt: bigint;
}

export interface RideStartedEvent {
  rideId: bigint;
  timestamp: bigint;
}

export interface RideCompletedByDriverEvent {
  rideId: bigint;
  timestamp: bigint;
}

export interface RideFinalizedEvent {
  rideId: bigint;
  amount: bigint;
}

export interface RideCancelledEvent {
  rideId: bigint;
  cancelledBy: `0x${string}`;
  reason: string;
}

export interface RideRefundedEvent {
  rideId: bigint;
  rider: `0x${string}`;
  amount: bigint;
  reason: string;
}

export interface DriverRatedEvent {
  rideId: bigint;
  driver: `0x${string}`;
  rating: number;
  newAverage: bigint;
}

export interface RiderRatedEvent {
  rideId: bigint;
  rider: `0x${string}`;
  rating: number;
  newAverage: bigint;
}
