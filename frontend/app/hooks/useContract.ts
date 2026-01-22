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
  const [isVerifiedDriver, setIsVerifiedDriver] = useState(false);
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
        const [, isVerified, avgRating, count] = rating as [boolean, boolean, bigint, bigint];
        setIsVerifiedDriver(isVerified);
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

  // Verify Identity (Mock)
  const verifyIdentity = useCallback(async () => {
    if (!walletClient || !address) throw new Error("Wallet not connected");

    const { request } = await publicClient!.simulateContract({
      address: CONTRACT_ADDRESS,
      abi: RIDE_SHARING_ABI,
      functionName: "verifyIdentity",
      args: [],
      account: address,
    });

    const hash = await walletClient.writeContract(request);

    // Wait for transaction
    await publicClient!.waitForTransactionReceipt({ hash });

    // Refresh state
    const rating = await publicClient!.readContract({
      address: CONTRACT_ADDRESS,
      abi: RIDE_SHARING_ABI,
      functionName: "getDriverRating",
      args: [address],
    });
    const [, isVerified] = rating as [boolean, boolean, bigint, bigint];
    setIsVerifiedDriver(isVerified);

    return hash;
  }, [walletClient, publicClient, address]);

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
        });
        console.log("Raw rideData:", rideData);

        const data = rideData as any;

        
        // Helper to extract location regardless of array/object structure
        const extractLocation = (loc: any) => {
          if (Array.isArray(loc)) {
             return { latitude: loc[0], longitude: loc[1], address_: loc[2] };
          }
          return { latitude: loc.latitude, longitude: loc.longitude, address_: loc.address_ };
        };

        // If returned as an array (older viem or specific config)
        if (Array.isArray(data)) {
           return {
            id: data[0],
            rider: data[1],
            driver: data[2],
            amount: data[3],
            state: data[4],
            pickup: extractLocation(data[5]),
            destination: extractLocation(data[6]),
            requestedAt: data[7],
            acceptedAt: data[8],
            fundedAt: data[9],
            startedAt: data[10],
            completedAt: data[11],
            finalizedAt: data[12],
          };
        }

        // Return as object (standard for this version)
        return {
          id: data.id,
          rider: data.rider,
          driver: data.driver,
          amount: data.amount,
          state: data.state,
          pickup: extractLocation(data.pickup),
          destination: extractLocation(data.destination),
          requestedAt: data.requestedAt,
          acceptedAt: data.acceptedAt,
          fundedAt: data.fundedAt,
          startedAt: data.startedAt,
          completedAt: data.completedAt,
          finalizedAt: data.finalizedAt,
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
    isVerifiedDriver,
    driverRating,
    registerDriver,
    verifyIdentity,
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
