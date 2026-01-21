"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useWeb3, formatBalance, formatAddress, formatWei } from "./hooks";
import { useContract } from "./hooks/useContract";
import PWAInstaller from "./components/PWAInstaller";
import {
  resolveRideState,
  getTimeRemaining,
  checkActionPolicy,
  getTimeoutStatus,
  formatTimeRemaining,
} from "./copilot";
import { State } from "./contracts/types";
import { Car, User, Star, Clock, AlertCircle, CheckCircle, Wallet, X, MapPin } from "lucide-react";
import dynamic from "next/dynamic";
import type { SelectionMode } from "./components/Map";

// Dynamically import MapWrapper with SSR disabled
const MapWrapper = dynamic(() => import("./components/MapWrapper"), { ssr: false });

type View = "home" | "myRides" | "availableRides" | "driverMode" | "registerDriver" | "requestRide" | "rideDetail";

export default function Home() {
  const { address, isConnected, balance, connect, disconnect } = useWeb3();
  const {
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
  } = useContract();

  const [view, setView] = useState<View>("home");
  const [myRides, setMyRides] = useState<any[]>([]);
  const [selectedRideId, setSelectedRideId] = useState<bigint | null>(null);
  const [selectedRide, setSelectedRide] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [driverName, setDriverName] = useState("");

  // New ride form
  const [newRide, setNewRide] = useState({
    pickup: { latitude: "", longitude: "", address: "" },
    destination: { latitude: "", longitude: "", address: "" },
    amount: "",
  });

  // Rating form
  const [rating, setRating] = useState(0);

  // Map selection mode for picking locations
  const [selectionMode, setSelectionMode] = useState<SelectionMode>(null);

  // Handle map click to set location
  const handleMapClick = useCallback((latitude: number, longitude: number) => {
    if (selectionMode === "pickup") {
      setNewRide({
        ...newRide,
        pickup: {
          latitude: latitude.toString(),
          longitude: longitude.toString(),
          address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
        },
      });
      setSelectionMode(null); // Reset after selection
    } else if (selectionMode === "destination") {
      setNewRide({
        ...newRide,
        destination: {
          latitude: latitude.toString(),
          longitude: longitude.toString(),
          address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
        },
      });
      setSelectionMode(null); // Reset after selection
    }
  }, [selectionMode, newRide]);

  // Refresh rides when connected
  const refreshRides = useCallback(async () => {
    if (!isConnected || !address) return;

    try {
      const riderRideIds = await getRiderRides(address);
      const driverRideIds = isRegisteredDriver ? await getDriverRides(address) : [];

      const allRideIds = [...new Set([...riderRideIds, ...driverRideIds])];

      const ridesPromises = allRideIds.map(async (id) => {
        const ride = await getRide(id);
        const ratingData = await getRideRating(id);
        return { ride, ratingData };
      });

      const rides = await Promise.all(ridesPromises);
      setMyRides(rides.filter((r) => r.ride !== null).reverse());
    } catch (err) {
      console.error("Failed to fetch rides:", err);
    }
  }, [isConnected, address, getRide, getRiderRides, getDriverRides, getRideRating, isRegisteredDriver]);

  useEffect(() => {
    refreshRides();
  }, [refreshRides]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(refreshRides, 10000);
    return () => clearInterval(interval);
  }, [refreshRides]);

  // Fetch selected ride details
  useEffect(() => {
    if (!selectedRideId) {
      setSelectedRide(null);
      return;
    }

    const fetchRide = async () => {
      const ride = await getRide(selectedRideId);
      const ratingData = await getRideRating(selectedRideId);
      setSelectedRide({ ride, ratingData });
    };

    fetchRide();
  }, [selectedRideId, getRide, getRideRating]);

  // Register driver
  const handleRegisterDriver = async () => {
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      await registerDriver(driverName);
      setSuccess("Successfully registered as a driver!");
      setDriverName("");
      setView("driverMode");
    } catch (err: any) {
      setError(err.message || "Failed to register");
    } finally {
      setLoading(false);
    }
  };

  // Request ride
  const handleRequestRide = async () => {
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const amount = BigInt(Math.floor(parseFloat(newRide.amount) * 1e18));
      const hash = await requestRide(newRide.pickup, newRide.destination, amount);
      setSuccess(`Ride requested! Tx: ${hash.slice(0, 10)}...`);
      await refreshRides();
      setView("myRides");
    } catch (err: any) {
      setError(err.message || "Failed to request ride");
    } finally {
      setLoading(false);
    }
  };

  // Accept ride
  const handleAcceptRide = async (rideId: bigint) => {
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const hash = await acceptRide(rideId);
      setSuccess(`Ride accepted! Tx: ${hash.slice(0, 10)}...`);
      await refreshRides();
      setSelectedRideId(rideId);
    } catch (err: any) {
      setError(err.message || "Failed to accept ride");
    } finally {
      setLoading(false);
    }
  };

  // Fund ride
  const handleFundRide = async () => {
    if (!selectedRide) return;

    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const hash = await fundRide(selectedRide.ride.id, selectedRide.ride.amount);
      setSuccess(`Ride funded! Tx: ${hash.slice(0, 10)}...`);
      await refreshRides();
      setSelectedRide(await getRide(selectedRide.ride.id));
    } catch (err: any) {
      setError(err.message || "Failed to fund ride");
    } finally {
      setLoading(false);
    }
  };

  // Start ride
  const handleStartRide = async () => {
    if (!selectedRide) return;

    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const hash = await startRide(selectedRide.ride.id);
      setSuccess(`Ride started! Tx: ${hash.slice(0, 10)}...`);
      await refreshRides();
      setSelectedRide(await getRide(selectedRide.ride.id));
    } catch (err: any) {
      setError(err.message || "Failed to start ride");
    } finally {
      setLoading(false);
    }
  };

  // Complete ride
  const handleCompleteRide = async () => {
    if (!selectedRide) return;

    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const hash = await completeRide(selectedRide.ride.id);
      setSuccess(`Ride completed! Tx: ${hash.slice(0, 10)}...`);
      await refreshRides();
      setSelectedRide(await getRide(selectedRide.ride.id));
    } catch (err: any) {
      setError(err.message || "Failed to complete ride");
    } finally {
      setLoading(false);
    }
  };

  // Confirm arrival
  const handleConfirmArrival = async () => {
    if (!selectedRide) return;

    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const hash = await confirmArrival(selectedRide.ride.id);
      setSuccess(`Arrival confirmed! Payment released. Tx: ${hash.slice(0, 10)}...`);
      await refreshRides();
      setSelectedRide(await getRide(selectedRide.ride.id));
    } catch (err: any) {
      setError(err.message || "Failed to confirm arrival");
    } finally {
      setLoading(false);
    }
  };

  // Cancel ride
  const handleCancelRide = async () => {
    if (!selectedRide) return;

    const reason = prompt("Reason for cancellation:");
    if (!reason) return;

    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const hash = await cancelRide(selectedRide.ride.id, reason);
      setSuccess(`Ride cancelled! Tx: ${hash.slice(0, 10)}...`);
      await refreshRides();
      setSelectedRide(await getRide(selectedRide.ride.id));
    } catch (err: any) {
      setError(err.message || "Failed to cancel ride");
    } finally {
      setLoading(false);
    }
  };

  // Rate driver
  const handleRateDriver = async () => {
    if (!selectedRide || rating < 1 || rating > 5) return;

    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const hash = await rateDriver(selectedRide.ride.id, rating);
      setSuccess(`Driver rated! Tx: ${hash.slice(0, 10)}...`);
      await refreshRides();
      setSelectedRide(await getRide(selectedRide.ride.id));
      setRating(0);
    } catch (err: any) {
      setError(err.message || "Failed to rate driver");
    } finally {
      setLoading(false);
    }
  };

  // Rate rider
  const handleRateRider = async () => {
    if (!selectedRide || rating < 1 || rating > 5) return;

    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const hash = await rateRider(selectedRide.ride.id, rating);
      setSuccess(`Rider rated! Tx: ${hash.slice(0, 10)}...`);
      await refreshRides();
      setSelectedRide(await getRide(selectedRide.ride.id));
      setRating(0);
    } catch (err: any) {
      setError(err.message || "Failed to rate rider");
    } finally {
      setLoading(false);
    }
  };

  // Claim refund
  const handleClaimRefund = async (type: "notFunded" | "notStarted") => {
    if (!selectedRide) return;

    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const hash =
        type === "notFunded"
          ? await claimRefundNotFunded(selectedRide.ride.id)
          : await claimRefundNotStarted(selectedRide.ride.id);
      setSuccess(`Refund claimed! Tx: ${hash.slice(0, 10)}...`);
      await refreshRides();
      setSelectedRide(await getRide(selectedRide.ride.id));
    } catch (err: any) {
      setError(err.message || "Failed to claim refund");
    } finally {
      setLoading(false);
    }
  };

  // Get resolved state for selected ride
  const resolvedState = useMemo(() => {
    if (!selectedRide || !selectedRide.ride || !address) return null;
    return resolveRideState(selectedRide.ride, address);
  }, [selectedRide, address]);

  // Get timeout status
  const timeoutStatus = useMemo(() => {
    if (!selectedRide || !selectedRide.ride) return null;
    return getTimeoutStatus(selectedRide.ride, Math.floor(Date.now() / 1000));
  }, [selectedRide]);

  // Back to list
  const handleBack = () => {
    setSelectedRideId(null);
    setSelectedRide(null);
    setRating(0);
  };

  if (!isConnected) {
    return <ConnectView onConnect={connect} />;
  }

  if (view === "home") {
    return (
      <Dashboard
        address={address!}
        balance={balance!}
        isRegisteredDriver={isRegisteredDriver}
        driverRating={driverRating}
        onViewChange={setView}
        onDisconnect={disconnect}
        myRidesCount={myRides.length}
      />
    );
  }

  if (view === "registerDriver") {
    return (
      <div className="min-h-screen bg-background">
        <Header address={address!} balance={balance!} onDisconnect={disconnect} onBack={() => setView("home")} />
        <main className="max-w-2xl mx-auto p-6">
          <div className="bg-card rounded-lg p-6 border border-border">
            <h1 className="text-2xl font-semibold mb-6">Register as Driver</h1>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Display Name</label>
                <input
                  type="text"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full px-4 py-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <button
                onClick={handleRegisterDriver}
                disabled={loading || !driverName}
                className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Registering..." : "Register"}
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (view === "requestRide") {
    const hasPickup = newRide.pickup.latitude && newRide.pickup.longitude;
    const hasDestination = newRide.destination.latitude && newRide.destination.longitude;
    const canSubmit = hasPickup && hasDestination && newRide.amount;

    return (
      <div className="min-h-screen bg-background">
        <Header address={address!} balance={balance!} onDisconnect={disconnect} onBack={() => setView("home")} />
        <main className="max-w-2xl mx-auto p-6">
          <div className="bg-card rounded-lg p-6 border border-border">
            <h1 className="text-2xl font-semibold mb-6">Request a Ride</h1>

            {/* Map with selection */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-muted-foreground">Click on the map to select locations</p>
                {selectionMode && (
                  <button
                    onClick={() => setSelectionMode(null)}
                    className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    <X className="w-4 h-4" /> Cancel
                  </button>
                )}
              </div>

              {/* Selection buttons */}
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setSelectionMode(selectionMode === "pickup" ? null : "pickup")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                    selectionMode === "pickup"
                      ? "bg-green-500 text-white"
                      : hasPickup
                        ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 border border-green-300 dark:border-green-700"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  <MapPin className="w-4 h-4" />
                  {hasPickup ? "Pickup Set" : "Set Pickup"}
                </button>
                <button
                  onClick={() => setSelectionMode(selectionMode === "destination" ? null : "destination")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                    selectionMode === "destination"
                      ? "bg-red-500 text-white"
                      : hasDestination
                        ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 border border-red-300 dark:border-red-700"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  <MapPin className="w-4 h-4" />
                  {hasDestination ? "Destination Set" : "Set Destination"}
                </button>
              </div>

              {/* Selection hint */}
              {selectionMode && (
                <div className={`text-sm py-2 px-3 rounded-lg mb-3 text-center ${
                  selectionMode === "pickup"
                    ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                    : "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                }`}>
                  {selectionMode === "pickup" ? "📍 Click on the map to set pickup location" : "📍 Click on the map to set destination"}
                </div>
              )}

              {/* Map */}
              <div className="rounded-lg overflow-hidden border border-border">
                <MapWrapper
                  pickup={
                    hasPickup
                      ? {
                          latitude: parseFloat(newRide.pickup.latitude),
                          longitude: parseFloat(newRide.pickup.longitude),
                          address: newRide.pickup.address,
                        }
                      : undefined
                  }
                  destination={
                    hasDestination
                      ? {
                          latitude: parseFloat(newRide.destination.latitude),
                          longitude: parseFloat(newRide.destination.longitude),
                          address: newRide.destination.address,
                        }
                      : undefined
                  }
                  selectionMode={selectionMode}
                  onLocationSelect={handleMapClick}
                  height="350px"
                />
              </div>
            </div>

            {/* Selected locations display */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className={`p-3 rounded-lg border ${hasPickup ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800" : "bg-muted border-border"}`}>
                <p className="text-xs font-medium text-muted-foreground mb-1">Pickup</p>
                {hasPickup ? (
                  <>
                    <p className="text-sm font-medium">{newRide.pickup.address || "Selected on map"}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {parseFloat(newRide.pickup.latitude).toFixed(4)}, {parseFloat(newRide.pickup.longitude).toFixed(4)}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Not selected</p>
                )}
              </div>
              <div className={`p-3 rounded-lg border ${hasDestination ? "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800" : "bg-muted border-border"}`}>
                <p className="text-xs font-medium text-muted-foreground mb-1">Destination</p>
                {hasDestination ? (
                  <>
                    <p className="text-sm font-medium">{newRide.destination.address || "Selected on map"}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {parseFloat(newRide.destination.latitude).toFixed(4)}, {parseFloat(newRide.destination.longitude).toFixed(4)}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Not selected</p>
                )}
              </div>
            </div>

            {/* Fare input */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Fare (ETH)</label>
              <input
                type="number"
                step="0.001"
                value={newRide.amount}
                onChange={(e) => setNewRide({ ...newRide, amount: e.target.value })}
                placeholder="0.01"
                className="w-full px-4 py-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Submit button */}
            <button
              onClick={handleRequestRide}
              disabled={loading || !canSubmit}
              className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Requesting..." : "Request Ride"}
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (view === "myRides") {
    if (selectedRide && selectedRide.ride) {
      return (
        <RideDetailView
          ride={selectedRide.ride}
          ratingData={selectedRide.ratingData}
          resolvedState={resolvedState}
          timeoutStatus={timeoutStatus}
          userAddress={address!}
          userBalance={balance!}
          isRegisteredDriver={isRegisteredDriver}
          onBack={handleBack}
          onFund={handleFundRide}
          onStart={handleStartRide}
          onComplete={handleCompleteRide}
          onConfirm={handleConfirmArrival}
          onCancel={handleCancelRide}
          onRateDriver={handleRateDriver}
          onRateRider={handleRateRider}
          onClaimRefund={handleClaimRefund}
          onAcceptRide={handleAcceptRide}
          rating={rating}
          setRating={setRating}
          loading={loading}
          error={error}
          success={success}
          setError={setError}
          setSuccess={setSuccess}
        />
      );
    }
    return (
      <MyRidesView
        address={address!}
        balance={balance!}
        onDisconnect={disconnect}
        rides={myRides}
        onSelectRide={setSelectedRideId}
        onBack={() => setView("home")}
        refreshRides={refreshRides}
      />
    );
  }

  return null;
}

// ============ Sub-Components ============

function ConnectView({ onConnect }: { onConnect: () => Promise<any> }) {
  const [connecting, setConnecting] = useState(false);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      await onConnect();
    } catch (err) {
      console.error(err);
    }
    setConnecting(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-card rounded-2xl p-8 border border-border shadow-lg">
        <div className="text-center mb-8">
          <Car className="w-16 h-16 mx-auto mb-4 text-primary" />
          <h1 className="text-3xl font-bold mb-2">RideShare</h1>
          <p className="text-muted-foreground">Decentralized ride-sharing on Ethereum</p>
        </div>
        <button
          onClick={handleConnect}
          disabled={connecting}
          className="w-full bg-primary text-primary-foreground py-4 rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Wallet className="w-5 h-5" />
          {connecting ? "Connecting..." : "Connect Wallet"}
        </button>
        <p className="text-center text-sm text-muted-foreground mt-4">
          Connect MetaMask to get started
        </p>
      </div>
    </div>
  );
}

function Dashboard({
  address,
  balance,
  isRegisteredDriver,
  driverRating,
  onViewChange,
  onDisconnect,
  myRidesCount,
}: {
  address: string;
  balance: bigint;
  isRegisteredDriver: boolean;
  driverRating: { average: number; count: number };
  onViewChange: (view: View) => void;
  onDisconnect: () => void;
  myRidesCount: number;
}) {
  return (
    <div className="min-h-screen bg-background">
      <Header address={address} balance={balance} onDisconnect={onDisconnect} />

      <main className="max-w-4xl mx-auto p-6">
        {/* User Info */}
        <div className="bg-card rounded-xl p-6 border border-border mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <User className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Connected as</p>
              <p className="font-medium">{formatAddress(address as `0x${string}`)}</p>
            </div>
            <div className="ml-auto">
              <p className="text-sm text-muted-foreground">Balance</p>
              <p className="font-medium">{formatBalance(balance)} ETH</p>
            </div>
          </div>

          {isRegisteredDriver && (
            <div className="flex items-center gap-2 pt-4 border-t border-border">
              <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
              <span className="text-sm">Driver Rating: {driverRating.average > 0 ? (driverRating.average / 10).toFixed(1) : "No ratings"}</span>
              <span className="text-sm text-muted-foreground">({driverRating.count} rides)</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <ActionButton
            icon={<Car className="w-6 h-6" />}
            title="Request Ride"
            description="Request a ride to your destination"
            onClick={() => onViewChange("requestRide")}
          />
          <ActionButton
            icon={<Car className="w-6 h-6" />}
            title="My Rides"
            description={`${myRidesCount} ride${myRidesCount !== 1 ? "s" : ""}`}
            onClick={() => onViewChange("myRides")}
          />
          {!isRegisteredDriver ? (
            <ActionButton
              icon={<User className="w-6 h-6" />}
              title="Become a Driver"
              description="Register to start earning"
              onClick={() => onViewChange("registerDriver")}
            />
          ) : (
            <div className="bg-card rounded-xl p-6 border border-border flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-green-500" />
              <div>
                <p className="font-medium">Driver Registered</p>
                <p className="text-sm text-muted-foreground">You can accept rides</p>
              </div>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="bg-card rounded-xl p-6 border border-border">
          <h2 className="text-lg font-semibold mb-4">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">1</div>
              <div>
                <p className="font-medium">Request</p>
                <p className="text-muted-foreground">Set pickup and destination</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">2</div>
              <div>
                <p className="font-medium">Fund & Ride</p>
                <p className="text-muted-foreground">Escrow holds payment safely</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">3</div>
              <div>
                <p className="font-medium">Complete & Rate</p>
                <p className="text-muted-foreground">Confirm arrival and rate</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function ActionButton({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="bg-card rounded-xl p-6 border border-border text-left hover:border-primary transition-colors">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
        <div>
          <h3 className="font-semibold mb-1">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </button>
  );
}

function Header({
  address,
  balance,
  onDisconnect,
  onBack,
}: {
  address: string;
  balance: bigint;
  onDisconnect: () => void;
  onBack?: () => void;
}) {
  return (
    <header className="bg-card border-b border-border">
      <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
        {onBack ? (
          <button onClick={onBack} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
            Back
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <Car className="w-6 h-6 text-primary" />
            <span className="font-semibold">RideShare</span>
          </div>
        )}
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-xs text-muted-foreground">{formatAddress(address as `0x${string}`)}</p>
            <p className="text-sm font-medium">{formatBalance(balance)} ETH</p>
          </div>
          <button
            onClick={onDisconnect}
            className="text-sm text-muted-foreground hover:text-foreground px-3 py-1 rounded border border-border"
          >
            Disconnect
          </button>
        </div>
      </div>
    </header>
  );
}

function MyRidesView({
  address,
  balance,
  onDisconnect,
  rides,
  onSelectRide,
  onBack,
  refreshRides,
}: {
  address: string;
  balance: bigint;
  onDisconnect: () => void;
  rides: any[];
  onSelectRide: (id: bigint) => void;
  onBack: () => void;
  refreshRides: () => void;
}) {
  const getStateLabel = (state: State) => {
    const labels = ["Requested", "Accepted", "Funded", "In Progress", "Completed", "Done", "Cancelled", "Refunded"];
    return labels[state] || "Unknown";
  };

  const getStateColor = (state: State) => {
    const colors = [
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
      "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
      "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    ];
    return colors[state] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="min-h-screen bg-background">
      <Header address={address} balance={balance} onDisconnect={onDisconnect} onBack={onBack} />
      <main className="max-w-2xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">My Rides</h1>
          <button onClick={refreshRides} className="text-sm text-muted-foreground hover:text-foreground">
            Refresh
          </button>
        </div>

        {rides.length === 0 ? (
          <div className="bg-card rounded-xl p-12 text-center border border-border">
            <Car className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No rides yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {rides.map(({ ride, ratingData }) => (
              <button
                key={ride.id.toString()}
                onClick={() => onSelectRide(ride.id)}
                className="w-full bg-card rounded-xl p-4 border border-border text-left hover:border-primary transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Ride #{ride.id.toString()}</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStateColor(ride.state)}`}>
                    {getStateLabel(ride.state)}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">
                  <p>From: {ride.pickup.address_ || ride.pickup.address}</p>
                  <p>To: {ride.destination.address_ || ride.destination.address}</p>
                  <p className="mt-1">{formatWei(ride.amount)} ETH</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function RideDetailView({
  ride,
  ratingData,
  resolvedState,
  timeoutStatus,
  userAddress,
  userBalance,
  isRegisteredDriver,
  onBack,
  onFund,
  onStart,
  onComplete,
  onConfirm,
  onCancel,
  onRateDriver,
  onRateRider,
  onClaimRefund,
  onAcceptRide,
  rating,
  setRating,
  loading,
  error,
  success,
  setError,
  setSuccess,
}: any) {
  const canAccept = resolvedState && resolvedState.userRole === "driver" && ride.state === State.Requested && isRegisteredDriver;

  return (
    <div className="min-h-screen bg-background">
      <Header address={userAddress} balance={userBalance} onDisconnect={() => {}} onBack={onBack} />

      <main className="max-w-2xl mx-auto p-6">
        {/* Alerts */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 rounded-lg p-4 mb-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Error</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}
        {success && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 rounded-lg p-4 mb-4 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Success</p>
              <p className="text-sm">{success}</p>
            </div>
          </div>
        )}

        {/* Ride Details */}
        <div className="bg-card rounded-xl p-6 border border-border mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold">Ride #{ride.id.toString()}</h1>
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-primary text-primary-foreground">
              {resolvedState?.stateLabel}
            </span>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">From</span>
              <span className="font-medium">{ride.pickup.address_ || ride.pickup.address}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">To</span>
              <span className="font-medium">{ride.destination.address_ || ride.destination.address}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fare</span>
              <span className="font-medium">{formatWei(ride.amount)} ETH</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Rider</span>
              <span className="font-medium">{formatAddress(ride.rider)}</span>
            </div>
            {ride.driver !== "0x0000000000000000000000000000000000000000" && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Driver</span>
                <span className="font-medium">{formatAddress(ride.driver)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Timeout Warning */}
        {timeoutStatus && timeoutStatus.type !== "none" && (
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-3 mb-2">
              <Clock className="w-5 h-5 text-orange-500" />
              <span className="font-medium text-orange-800 dark:text-orange-200">
                {timeoutStatus.isExpired ? "Timeout Expired" : "Time Remaining"}
              </span>
            </div>
            <p className="text-sm text-orange-700 dark:text-orange-300">
              {timeoutStatus.isExpired
                ? "You can claim a refund now."
                : formatTimeRemaining(timeoutStatus.remainingSeconds)}
            </p>
          </div>
        )}

        {/* Copilot Message */}
        {resolvedState?.nextAction && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-6">
            <p className="text-sm text-blue-800 dark:text-blue-200">{resolvedState.nextAction}</p>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          {resolvedState?.canFund && (
            <button onClick={onFund} disabled={loading} className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium disabled:opacity-50">
              {loading ? "Processing..." : `Fund Ride (${formatWei(ride.amount)} ETH)`}
            </button>
          )}

          {resolvedState?.canStart && (
            <button onClick={onStart} disabled={loading} className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium disabled:opacity-50">
              {loading ? "Processing..." : "Start Ride"}
            </button>
          )}

          {resolvedState?.canComplete && (
            <button onClick={onComplete} disabled={loading} className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium disabled:opacity-50">
              {loading ? "Processing..." : "Complete Ride"}
            </button>
          )}

          {resolvedState?.canConfirm && (
            <button onClick={onConfirm} disabled={loading} className="w-full bg-green-600 text-white py-3 rounded-lg font-medium disabled:opacity-50">
              {loading ? "Processing..." : "Confirm Arrival & Release Payment"}
            </button>
          )}

          {canAccept && (
            <button
              onClick={() => onAcceptRide(ride.id)}
              className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium"
            >
              Accept Ride
            </button>
          )}

          {timeoutStatus?.canClaimRefund && (
            <button
              onClick={() => onClaimRefund(timeoutStatus.type === "accept" ? "notFunded" : "notStarted")}
              disabled={loading}
              className="w-full bg-orange-500 text-white py-3 rounded-lg font-medium disabled:opacity-50"
            >
              {loading ? "Processing..." : "Claim Refund"}
            </button>
          )}

          {resolvedState?.canCancel && (
            <button onClick={onCancel} disabled={loading} className="w-full bg-red-500 text-white py-3 rounded-lg font-medium disabled:opacity-50">
              {loading ? "Processing..." : "Cancel Ride"}
            </button>
          )}

          {/* Rating Section */}
          {resolvedState?.canRateDriver && !ratingData?.riderRatedDriver && (
            <div className="bg-card rounded-xl p-4 border border-border">
              <p className="font-medium mb-3">Rate your driver</p>
              <div className="flex gap-2 mb-3">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    className={`w-10 h-10 rounded-lg ${rating >= star ? "bg-yellow-400 text-white" : "bg-muted text-muted-foreground"}`}
                  >
                    <Star className={`w-6 h-6 ${rating >= star ? "fill-current" : ""}`} />
                  </button>
                ))}
              </div>
              <button
                onClick={onRateDriver}
                disabled={loading || rating < 1}
                className="w-full bg-primary text-primary-foreground py-2 rounded-lg font-medium disabled:opacity-50"
              >
                {loading ? "Submitting..." : "Submit Rating"}
              </button>
            </div>
          )}

          {resolvedState?.canRateRider && !ratingData?.driverRatedRider && (
            <div className="bg-card rounded-xl p-4 border border-border">
              <p className="font-medium mb-3">Rate your rider</p>
              <div className="flex gap-2 mb-3">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    className={`w-10 h-10 rounded-lg ${rating >= star ? "bg-yellow-400 text-white" : "bg-muted text-muted-foreground"}`}
                  >
                    <Star className={`w-6 h-6 ${rating >= star ? "fill-current" : ""}`} />
                  </button>
                ))}
              </div>
              <button
                onClick={onRateRider}
                disabled={loading || rating < 1}
                className="w-full bg-primary text-primary-foreground py-2 rounded-lg font-medium disabled:opacity-50"
              >
                {loading ? "Submitting..." : "Submit Rating"}
              </button>
            </div>
          )}

          {/* Display existing ratings */}
          {ratingData && (ratingData.riderRatedDriver || ratingData.driverRatedRider) && (
            <div className="bg-card rounded-xl p-4 border border-border">
              <p className="font-medium mb-2">Ratings</p>
              {ratingData.riderRatedDriver && (
                <p className="text-sm">You rated driver: {ratingData.riderRating}/5</p>
              )}
              {ratingData.driverRatedRider && (
                <p className="text-sm">Driver rated you: {ratingData.driverRating}/5</p>
              )}
            </div>
          )}
        </div>
      </main>
      <PWAInstaller />
    </div>
  );
}
