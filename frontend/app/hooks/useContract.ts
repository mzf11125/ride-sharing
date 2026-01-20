"use client";

import { useCallback, useEffect, useState } from "react";
import { type Address, type Log } from "viem";
import { RIDE_SHARING_ABI, ACCEPT_TIMEOUT, START_TIMEOUT } from "../contracts/abi";
import type { Ride, State, Driver, Rating, RefundStatus } from "../contracts/types";
import { useWeb3, CONTRACT_ADDRESS } from "./useWeb3";

export function useContract() {
  const { publicClient, walletClient, address, isConnected } = useWeb3();
  const [rideCounter, setRideCounter] = useState<bigint>(BigInt(0));
  const [isRegisteredDriver, setIsRegisteredDriver] = useState(false);
  const [driverRating, setDriverRating] = useState<{ average: number; count: number }>({
    average: 0,
    count: 0,
  });

  // Fetch contract state
  useEffect(() => {
    if (!publicClient) return;

    const fetchState = async () => {
      try {
        const counter = await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: RIDE_SHARING_ABI,
          functionName: "rideCounter",
        });
        setRideCounter(counter as bigint);
      } catch (error) {
        console.error("Failed to fetch ride counter:", error);
      }
    };

    fetchState();
  }, [publicClient]);

  // Fetch driver registration status
  useEffect(() => {
    if (!publicClient || !address || !isConnected) return;

    const fetchDriverStatus = async () => {
      try {
        const registered = await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: RIDE_SHARING_ABI,
          functionName: "isRegisteredDriver",
          args: [address],
        });
        setIsRegisteredDriver(registered as boolean);

        const rating = await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: RIDE_SHARING_ABI,
          functionName: "getDriverRating",
          args: [address],
        });
        const [, avgRating, count] = rating as [boolean, bigint, bigint];
        setDriverRating({
          average: Number(avgRating) / 10,
          count: Number(count),
        });
      } catch (error) {
        console.error("Failed to fetch driver status:", error);
      }
    };

    fetchDriverStatus();
  }, [publicClient, address, isConnected]);

  // Register as driver
  const registerDriver = useCallback(
    async (name: string) => {
      if (!walletClient || !address) throw new Error("Wallet not connected");

      const { request } = await publicClient!.simulateContract({
        address: CONTRACT_ADDRESS,
        abi: RIDE_SHARING_ABI,
        functionName: "registerDriver",
        args: [name],
        account: address,
      });

      const hash = await walletClient.writeContract(request);

      // Wait for transaction
      await publicClient!.waitForTransactionReceipt({ hash });

      // Refresh state
      const registered = await publicClient!.readContract({
        address: CONTRACT_ADDRESS,
        abi: RIDE_SHARING_ABI,
        functionName: "isRegisteredDriver",
        args: [address],
      });
      setIsRegisteredDriver(registered as boolean);

      return hash;
    },
    [walletClient, publicClient, address]
  );

  // Request ride
  const requestRide = useCallback(
    async (pickup: any, destination: any, amount: bigint) => {
      if (!walletClient || !address) throw new Error("Wallet not connected");

      const { request } = await publicClient!.simulateContract({
        address: CONTRACT_ADDRESS,
        abi: RIDE_SHARING_ABI,
        functionName: "requestRide",
        args: [
          pickup.latitude,
          pickup.longitude,
          pickup.address,
          destination.latitude,
          destination.longitude,
          destination.address,
          amount,
        ],
        account: address,
      });

      const hash = await walletClient.writeContract(request);
      return hash;
    },
    [walletClient, publicClient, address]
  );

  // Accept ride
  const acceptRide = useCallback(
    async (rideId: bigint) => {
      if (!walletClient || !address) throw new Error("Wallet not connected");

      const { request } = await publicClient!.simulateContract({
        address: CONTRACT_ADDRESS,
        abi: RIDE_SHARING_ABI,
        functionName: "acceptRide",
        args: [rideId],
        account: address,
      });

      const hash = await walletClient.writeContract(request);
      return hash;
    },
    [walletClient, publicClient, address]
  );

  // Fund ride
  const fundRide = useCallback(
    async (rideId: bigint, amount: bigint) => {
      if (!walletClient || !address) throw new Error("Wallet not connected");

      const { request } = await publicClient!.simulateContract({
        address: CONTRACT_ADDRESS,
        abi: RIDE_SHARING_ABI,
        functionName: "fundRide",
        args: [rideId],
        account: address,
        value: amount,
      });

      const hash = await walletClient.writeContract(request);
      return hash;
    },
    [walletClient, publicClient, address]
  );

  // Start ride
  const startRide = useCallback(
    async (rideId: bigint) => {
      if (!walletClient || !address) throw new Error("Wallet not connected");

      const { request } = await publicClient!.simulateContract({
        address: CONTRACT_ADDRESS,
        abi: RIDE_SHARING_ABI,
        functionName: "startRide",
        args: [rideId],
        account: address,
      });

      const hash = await walletClient.writeContract(request);
      return hash;
    },
    [walletClient, publicClient, address]
  );

  // Complete ride
  const completeRide = useCallback(
    async (rideId: bigint) => {
      if (!walletClient || !address) throw new Error("Wallet not connected");

      const { request } = await publicClient!.simulateContract({
        address: CONTRACT_ADDRESS,
        abi: RIDE_SHARING_ABI,
        functionName: "completeRide",
        args: [rideId],
        account: address,
      });

      const hash = await walletClient.writeContract(request);
      return hash;
    },
    [walletClient, publicClient, address]
  );

  // Confirm arrival
  const confirmArrival = useCallback(
    async (rideId: bigint) => {
      if (!walletClient || !address) throw new Error("Wallet not connected");

      const { request } = await publicClient!.simulateContract({
        address: CONTRACT_ADDRESS,
        abi: RIDE_SHARING_ABI,
        functionName: "confirmArrival",
        args: [rideId],
        account: address,
      });

      const hash = await walletClient.writeContract(request);
      return hash;
    },
    [walletClient, publicClient, address]
  );

  // Cancel ride
  const cancelRide = useCallback(
    async (rideId: bigint, reason: string) => {
      if (!walletClient || !address) throw new Error("Wallet not connected");

      const { request } = await publicClient!.simulateContract({
        address: CONTRACT_ADDRESS,
        abi: RIDE_SHARING_ABI,
        functionName: "cancelRide",
        args: [rideId, reason],
        account: address,
      });

      const hash = await walletClient.writeContract(request);
      return hash;
    },
    [walletClient, publicClient, address]
  );

  // Rate driver
  const rateDriver = useCallback(
    async (rideId: bigint, rating: number) => {
      if (!walletClient || !address) throw new Error("Wallet not connected");

      const { request } = await publicClient!.simulateContract({
        address: CONTRACT_ADDRESS,
        abi: RIDE_SHARING_ABI,
        functionName: "rateDriver",
        args: [rideId, rating],
        account: address,
      });

      const hash = await walletClient.writeContract(request);
      return hash;
    },
    [walletClient, publicClient, address]
  );

  // Rate rider
  const rateRider = useCallback(
    async (rideId: bigint, rating: number) => {
      if (!walletClient || !address) throw new Error("Wallet not connected");

      const { request } = await publicClient!.simulateContract({
        address: CONTRACT_ADDRESS,
        abi: RIDE_SHARING_ABI,
        functionName: "rateRider",
        args: [rideId, rating],
        account: address,
      });

      const hash = await walletClient.writeContract(request);
      return hash;
    },
    [walletClient, publicClient, address]
  );

  // Claim refund not funded
  const claimRefundNotFunded = useCallback(
    async (rideId: bigint) => {
      if (!walletClient || !address) throw new Error("Wallet not connected");

      const { request } = await publicClient!.simulateContract({
        address: CONTRACT_ADDRESS,
        abi: RIDE_SHARING_ABI,
        functionName: "claimRefundNotFunded",
        args: [rideId],
        account: address,
      });

      const hash = await walletClient.writeContract(request);
      return hash;
    },
    [walletClient, publicClient, address]
  );

  // Claim refund not started
  const claimRefundNotStarted = useCallback(
    async (rideId: bigint) => {
      if (!walletClient || !address) throw new Error("Wallet not connected");

      const { request } = await publicClient!.simulateContract({
        address: CONTRACT_ADDRESS,
        abi: RIDE_SHARING_ABI,
        functionName: "claimRefundNotStarted",
        args: [rideId],
        account: address,
      });

      const hash = await walletClient.writeContract(request);
      return hash;
    },
    [walletClient, publicClient, address]
  );

  // Get ride details
  const getRide = useCallback(
    async (rideId: bigint): Promise<Ride | null> => {
      if (!publicClient) return null;

      try {
        const rideData = await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: RIDE_SHARING_ABI,
          functionName: "getRide",
          args: [rideId],
        }) as unknown as readonly [
          bigint,           // id
          `0x${string}`,    // rider
          `0x${string}`,    // driver
          bigint,           // amount
          State,            // state
          readonly [string, string, string], // pickup (lat, lng, address)
          readonly [string, string, string], // destination (lat, lng, address)
          bigint,           // requestedAt
          bigint,           // acceptedAt
          bigint,           // fundedAt
          bigint,           // startedAt
          bigint,           // completedAt
          bigint,           // finalizedAt
        ];

        const [
          id,
          rider,
          driver,
          amount,
          state,
          pickup,
          destination,
          requestedAt,
          acceptedAt,
          fundedAt,
          startedAt,
          completedAt,
          finalizedAt,
        ] = rideData;

        return {
          id,
          rider,
          driver,
          amount,
          state,
          pickup: { latitude: pickup[0], longitude: pickup[1], address_: pickup[2] },
          destination: { latitude: destination[0], longitude: destination[1], address_: destination[2] },
          requestedAt,
          acceptedAt,
          fundedAt,
          startedAt,
          completedAt,
          finalizedAt,
        };
      } catch (error) {
        console.error("Failed to fetch ride:", error);
        return null;
      }
    },
    [publicClient]
  );

  // Get rider rides
  const getRiderRides = useCallback(
    async (riderAddress: Address): Promise<bigint[]> => {
      if (!publicClient) return [];

      try {
        const rides = await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: RIDE_SHARING_ABI,
          functionName: "getRiderRides",
          args: [riderAddress],
        });
        return rides as unknown as bigint[];
      } catch (error) {
        console.error("Failed to fetch rider rides:", error);
        return [];
      }
    },
    [publicClient]
  );

  // Get driver rides
  const getDriverRides = useCallback(
    async (driverAddress: Address): Promise<bigint[]> => {
      if (!publicClient) return [];

      try {
        const rides = await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: RIDE_SHARING_ABI,
          functionName: "getDriverRides",
          args: [driverAddress],
        });
        return rides as unknown as bigint[];
      } catch (error) {
        console.error("Failed to fetch driver rides:", error);
        return [];
      }
    },
    [publicClient]
  );

  // Get ride rating
  const getRideRating = useCallback(
    async (rideId: bigint): Promise<Rating | null> => {
      if (!publicClient) return null;

      try {
        const ratingData = await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: RIDE_SHARING_ABI,
          functionName: "getRideRating",
          args: [rideId],
        });
        return ratingData as unknown as Rating;
      } catch (error) {
        console.error("Failed to fetch ride rating:", error);
        return null;
      }
    },
    [publicClient]
  );

  // Get refund status
  const getRefundStatus = useCallback(
    async (rideId: bigint): Promise<RefundStatus | null> => {
      if (!publicClient) return null;

      try {
        const status = await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: RIDE_SHARING_ABI,
          functionName: "getRefundStatus",
          args: [rideId],
        });
        return status as unknown as RefundStatus;
      } catch (error) {
        console.error("Failed to fetch refund status:", error);
        return null;
      }
    },
    [publicClient]
  );

  // Get all registered drivers
  const getRegisteredDrivers = useCallback(async (): Promise<Address[]> => {
    if (!publicClient) return [];

    try {
      const drivers = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: RIDE_SHARING_ABI,
        functionName: "getRegisteredDrivers",
      });
      return drivers as Address[];
    } catch (error) {
      console.error("Failed to fetch registered drivers:", error);
      return [];
    }
  }, [publicClient]);

  return {
    rideCounter,
    isRegisteredDriver,
    driverRating,
    registerDriver,
    requestRide,
    acceptRide,
    fundRide,
    startRide,
    completeRide,
    confirmArrival,
    cancelRide,
    rateDriver,
    rateRider,
    claimRefundNotFunded,
    claimRefundNotStarted,
    getRide,
    getRiderRides,
    getDriverRides,
    getRideRating,
    getRefundStatus,
    getRegisteredDrivers,
  };
}
