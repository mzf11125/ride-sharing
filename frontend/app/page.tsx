"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useWeb3, formatBalance, formatAddress, formatWei } from "./hooks";
import { useContract } from "./hooks/useContract";
import LandingPage from "./components/LandingPage";
import {
  resolveRideState,
  getTimeoutStatus,
} from "./copilot";
import { State } from "./contracts/types";
import { Car, User, Star, CheckCircle, AlertCircle, X, MapPin, BadgeCheck, ShieldCheck, Clock } from "lucide-react";
import dynamic from "next/dynamic";
import type { SelectionMode } from "./components/Map";

// Dynamically import MapWrapper with SSR disabled
const MapWrapper = dynamic(() => import("./components/MapWrapper"), { ssr: false });

type View = "home" | "myRides" | "availableRides" | "driverMode" | "registerDriver" | "requestRide" | "rideDetail";

export default function Home() {
  const { address, isConnected, balance, connect, disconnect, chainId } = useWeb3();
  const {
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

  // Map selection mode
  const [selectionMode, setSelectionMode] = useState<SelectionMode>(null);

  // Haversine Distance Calculation
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
  };

  // Auto-calculate fare
  useEffect(() => {
    if (newRide.pickup.latitude && newRide.destination.latitude) {
      const dist = calculateDistance(
        parseFloat(newRide.pickup.latitude),
        parseFloat(newRide.pickup.longitude),
        parseFloat(newRide.destination.latitude),
        parseFloat(newRide.destination.longitude)
      );
      // Pricing: 0.001 ETH base + 0.0001 ETH per km
      const calculatedFare = 0.001 + (dist * 0.0001);
      setNewRide(prev => ({ ...prev, amount: calculatedFare.toFixed(5) }));
    }
  }, [newRide.pickup.latitude, newRide.pickup.longitude, newRide.destination.latitude, newRide.destination.longitude]);

  // Handle map click
  const handleMapClick = useCallback((latitude: number, longitude: number) => {
    if (selectionMode === "pickup") {
      setNewRide(prev => ({
        ...prev,
        pickup: {
          latitude: latitude.toString(),
          longitude: longitude.toString(),
          address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
        },
      }));
      setSelectionMode(null);
    } else if (selectionMode === "destination") {
      setNewRide(prev => ({
        ...prev,
        destination: {
          latitude: latitude.toString(),
          longitude: longitude.toString(),
          address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
        },
      }));
      setSelectionMode(null);
    }
  }, [selectionMode]);

  // Refresh rides
  const refreshRides = useCallback(async () => {
    if (!isConnected || !address) return;

    try {
      console.log("Refreshing rides for:", address);
      const riderRideIds = await getRiderRides(address);
      const driverRideIds = isRegisteredDriver ? await getDriverRides(address) : [];
      console.log("Rider Ride IDs:", riderRideIds);
      console.log("Driver Ride IDs:", driverRideIds);
      
      const allRideIds = [...new Set([...riderRideIds, ...driverRideIds])];
      console.log("All Ride IDs:", allRideIds);

      const ridesPromises = allRideIds.map(async (id) => {
        try {
          const ride = await getRide(id);
          const ratingData = await getRideRating(id);
          console.log(`Fetched ride ${id}:`, ride);
          return { ride, ratingData };
        } catch (e) {
          console.error(`Error fetching ride ${id}:`, e);
          return { ride: null, ratingData: null };
        }
      });

      const rides = await Promise.all(ridesPromises);
      const validRides = rides.filter((r) => r.ride !== null).reverse();
      console.log("Valid rides found:", validRides.length);
      setMyRides(validRides);
    } catch (err) {
      console.error("Failed to fetch rides:", err);
    }
  }, [isConnected, address, getRide, getRiderRides, getDriverRides, getRideRating, isRegisteredDriver]);

  useEffect(() => {
    refreshRides();
  }, [refreshRides]);

  useEffect(() => {
    const interval = setInterval(refreshRides, 10000);
    return () => clearInterval(interval);
  }, [refreshRides]);

  // Fetch selected ride
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

  // Actions
  const handleRegisterDriver = async () => {
    setError(null); setSuccess(null); setLoading(true);
    try {
      await registerDriver(driverName);
      setSuccess("Successfully registered as a driver!");
      setDriverName("");
    } catch (err: any) { setError(err.message || "Failed to register"); } finally { setLoading(false); }
  };

  const handleVerifyIdentity = async () => {
    setError(null); setSuccess(null); setLoading(true);
    try {
      await verifyIdentity();
      setSuccess("Identity verified successfully!");
    } catch (err: any) { setError(err.message || "Failed to verify identity"); } finally { setLoading(false); }
  };

  const handleRequestRide = async () => {
    setError(null); setSuccess(null); setLoading(true);
    try {
      // Ensure all values are strings for the contract call
      const amount = BigInt(Math.floor(parseFloat(newRide.amount) * 1e18));
      const pickupData = {
        latitude: String(newRide.pickup.latitude),
        longitude: String(newRide.pickup.longitude),
        address: String(newRide.pickup.address),
      };
      const destData = {
        latitude: String(newRide.destination.latitude),
        longitude: String(newRide.destination.longitude),
        address: String(newRide.destination.address),
      };
      const hash = await requestRide(pickupData, destData, amount);
      setSuccess(`Ride requested! Tx: ${hash.slice(0, 10)}...`);
      await refreshRides();
      setView("myRides");
    } catch (err: any) { setError(err.message || "Failed to request ride"); } finally { setLoading(false); }
  };

  const handleAcceptRide = async (rideId: bigint) => {
    setError(null); setSuccess(null); setLoading(true);
    try {
      const hash = await acceptRide(rideId);
      setSuccess(`Ride accepted! Tx: ${hash.slice(0, 10)}...`);
      await refreshRides();
      setSelectedRideId(rideId);
    } catch (err: any) { setError(err.message || "Failed to accept ride"); } finally { setLoading(false); }
  };

  const handleFundRide = async () => {
    if (!selectedRide) return;
    setError(null); setSuccess(null); setLoading(true);
    try {
      const hash = await fundRide(selectedRide.ride.id, selectedRide.ride.amount);
      setSuccess(`Ride funded! Tx: ${hash.slice(0, 10)}...`);
      await refreshRides();
      setSelectedRide(await getRide(selectedRide.ride.id));
    } catch (err: any) { setError(err.message || "Failed to fund ride"); } finally { setLoading(false); }
  };

  const handleStartRide = async () => {
    if (!selectedRide) return;
    setError(null); setSuccess(null); setLoading(true);
    try {
      const hash = await startRide(selectedRide.ride.id);
      setSuccess(`Ride started! Tx: ${hash.slice(0, 10)}...`);
      await refreshRides();
      setSelectedRide(await getRide(selectedRide.ride.id));
    } catch (err: any) { setError(err.message || "Failed to start ride"); } finally { setLoading(false); }
  };

  const handleCompleteRide = async () => {
    if (!selectedRide) return;
    setError(null); setSuccess(null); setLoading(true);
    try {
      const hash = await completeRide(selectedRide.ride.id);
      setSuccess(`Ride completed! Tx: ${hash.slice(0, 10)}...`);
      await refreshRides();
      setSelectedRide(await getRide(selectedRide.ride.id));
    } catch (err: any) { setError(err.message || "Failed to complete ride"); } finally { setLoading(false); }
  };

  const handleConfirmArrival = async () => {
    if (!selectedRide) return;
    setError(null); setSuccess(null); setLoading(true);
    try {
      const hash = await confirmArrival(selectedRide.ride.id);
      setSuccess(`Arrival confirmed! Payment released. Tx: ${hash.slice(0, 10)}...`);
      await refreshRides();
      setSelectedRide(await getRide(selectedRide.ride.id));
    } catch (err: any) { setError(err.message || "Failed to confirm arrival"); } finally { setLoading(false); }
  };

  const handleCancelRide = async () => {
    if (!selectedRide) return;
    const reason = prompt("Reason for cancellation:");
    if (!reason) return;
    setError(null); setSuccess(null); setLoading(true);
    try {
      const hash = await cancelRide(selectedRide.ride.id, reason);
      setSuccess(`Ride cancelled! Tx: ${hash.slice(0, 10)}...`);
      await refreshRides();
      setSelectedRide(await getRide(selectedRide.ride.id));
    } catch (err: any) { setError(err.message || "Failed to cancel ride"); } finally { setLoading(false); }
  };

  const handleRateDriver = async () => {
    if (!selectedRide || rating < 1 || rating > 5) return;
    setError(null); setSuccess(null); setLoading(true);
    try {
      const hash = await rateDriver(selectedRide.ride.id, rating);
      setSuccess(`Driver rated! Tx: ${hash.slice(0, 10)}...`);
      await refreshRides();
      setSelectedRide(await getRide(selectedRide.ride.id));
      setRating(0);
    } catch (err: any) { setError(err.message || "Failed to rate driver"); } finally { setLoading(false); }
  };

  const handleRateRider = async () => {
    if (!selectedRide || rating < 1 || rating > 5) return;
    setError(null); setSuccess(null); setLoading(true);
    try {
      const hash = await rateRider(selectedRide.ride.id, rating);
      setSuccess(`Rider rated! Tx: ${hash.slice(0, 10)}...`);
      await refreshRides();
      setSelectedRide(await getRide(selectedRide.ride.id));
      setRating(0);
    } catch (err: any) { setError(err.message || "Failed to rate rider"); } finally { setLoading(false); }
  };

  const handleClaimRefund = async (type: "notFunded" | "notStarted") => {
    if (!selectedRide) return;
    setError(null); setSuccess(null); setLoading(true);
    try {
      const hash = type === "notFunded"
        ? await claimRefundNotFunded(selectedRide.ride.id)
        : await claimRefundNotStarted(selectedRide.ride.id);
      setSuccess(`Refund claimed! Tx: ${hash.slice(0, 10)}...`);
      await refreshRides();
      setSelectedRide(await getRide(selectedRide.ride.id));
    } catch (err: any) { setError(err.message || "Failed to claim refund"); } finally { setLoading(false); }
  };

  const resolvedState = useMemo(() => {
    if (!selectedRide || !selectedRide.ride || !address) return null;
    return resolveRideState(selectedRide.ride, address);
  }, [selectedRide, address]);

  const timeoutStatus = useMemo(() => {
    if (!selectedRide || !selectedRide.ride) return null;
    return getTimeoutStatus(selectedRide.ride, Math.floor(Date.now() / 1000));
  }, [selectedRide]);

  const handleBack = () => {
    setSelectedRideId(null);
    setSelectedRide(null);
    setRating(0);
  };

  const [isConnecting, setIsConnecting] = useState(false);
  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      await connect();
    } catch (e) { console.error(e) }
    setIsConnecting(false);
  }

  if (!isConnected) {
    return <LandingPage onConnect={handleConnect} connecting={isConnecting} />;
  }

  if (view === "home") {
    return (
      <Dashboard
        address={address!}
        balance={balance!}
        isRegisteredDriver={isRegisteredDriver}
        isVerifiedDriver={isVerifiedDriver}
        driverRating={driverRating}
        onViewChange={setView}
        onDisconnect={disconnect}
        myRidesCount={myRides.length}
        chainId={chainId}
        onConnect={handleConnect}
      />
    );
  }

  if (view === "registerDriver") {
    return (
      <div className="min-h-screen bg-background">
        <Header address={address!} balance={balance!} onDisconnect={disconnect} onBack={() => setView("home")} />
        <main className="max-w-2xl mx-auto p-6">
          <div className="bg-card rounded-lg p-6 border border-border">
            <h1 className="text-2xl font-semibold mb-2">Become a Driver</h1>
            <p className="text-muted-foreground mb-6">Complete the registration and verification process to start earning.</p>
            
            {/* Progress Steps */}
            <div className="flex items-center gap-2 mb-8">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${isRegisteredDriver ? 'bg-green-500 text-white' : 'bg-primary text-primary-foreground'}`}>
                {isRegisteredDriver ? <CheckCircle className="w-4 h-4" /> : '1'}
              </div>
              <div className={`flex-1 h-1 rounded ${isRegisteredDriver ? 'bg-green-500' : 'bg-muted'}`} />
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${isVerifiedDriver ? 'bg-green-500 text-white' : isRegisteredDriver ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                {isVerifiedDriver ? <CheckCircle className="w-4 h-4" /> : '2'}
              </div>
            </div>

            {/* Step 1: Registration */}
            <div className={`mb-6 p-5 rounded-xl border ${isRegisteredDriver ? 'border-green-200 bg-green-50/50' : 'border-border bg-muted/20'}`}>
              <div className="flex items-start gap-3 mb-4">
                <div className={`p-2 rounded-lg ${isRegisteredDriver ? 'bg-green-100' : 'bg-muted'}`}>
                  <User className={`w-5 h-5 ${isRegisteredDriver ? 'text-green-600' : 'text-muted-foreground'}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Step 1: Driver Registration</h3>
                    {isRegisteredDriver && <span className="text-xs font-medium text-green-600 bg-green-100 px-2 py-0.5 rounded-full">Completed</span>}
                  </div>
                  <p className="text-sm text-muted-foreground">Register your wallet address as a driver on the blockchain.</p>
                </div>
              </div>
              
              {!isRegisteredDriver && (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    placeholder="Enter your display name"
                    className="w-full px-4 py-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <button
                    onClick={handleRegisterDriver}
                    disabled={loading || !driverName}
                    className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
                  >
                    {loading ? "Registering..." : "Register as Driver"}
                  </button>
                </div>
              )}
            </div>

            {/* Step 2: zkKYC Verification */}
            <div className={`p-5 rounded-xl border ${isVerifiedDriver ? 'border-green-200 bg-green-50/50' : isRegisteredDriver ? 'border-blue-200 bg-blue-50/30' : 'border-border bg-muted/10 opacity-60'}`}>
              <div className="flex items-start gap-3 mb-4">
                <div className={`p-2 rounded-lg ${isVerifiedDriver ? 'bg-green-100' : isRegisteredDriver ? 'bg-blue-100' : 'bg-muted'}`}>
                  <ShieldCheck className={`w-5 h-5 ${isVerifiedDriver ? 'text-green-600' : isRegisteredDriver ? 'text-blue-600' : 'text-muted-foreground'}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Step 2: Identity Verification (zkKYC)</h3>
                    {isVerifiedDriver && <span className="text-xs font-medium text-green-600 bg-green-100 px-2 py-0.5 rounded-full">Verified</span>}
                  </div>
                  <p className="text-sm text-muted-foreground">Verify your identity using zkPassport for privacy-preserving KYC.</p>
                </div>
              </div>

              {isRegisteredDriver && !isVerifiedDriver && (
                <div className="space-y-4">
                  {/* What will be verified */}
                  <div className="bg-white/50 rounded-lg p-4 border border-blue-100">
                    <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                      <BadgeCheck className="w-4 h-4 text-blue-600" />
                      What zkPassport Verifies
                    </h4>
                    <div className="grid grid-cols-1 gap-2 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        <span>You are a real person (liveness check)</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        <span>Nationality verification (passport country)</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        <span>Age verification (18+ requirement)</span>
                      </div>
                    </div>
                  </div>

                  {/* Privacy notice */}
                  <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                    <p className="text-xs text-amber-700 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span><strong>Privacy-Preserving:</strong> zkPassport uses zero-knowledge proofs. Your personal data stays on your device – only the verification result is shared on-chain.</span>
                    </p>
                  </div>

                  <button
                    onClick={handleVerifyIdentity}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-3.5 rounded-lg font-medium transition-all shadow-sm disabled:opacity-50"
                  >
                    <ShieldCheck className="w-5 h-5" />
                    {loading ? "Verifying..." : "Verify with zkPassport"}
                  </button>
                </div>
              )}

              {isVerifiedDriver && (
                <div className="flex items-center gap-3 p-3 bg-green-100/50 rounded-lg">
                  <BadgeCheck className="w-6 h-6 text-green-600" />
                  <div>
                    <p className="font-medium text-green-800">Identity Verified</p>
                    <p className="text-sm text-green-600">You are now a verified driver and can accept rides.</p>
                  </div>
                </div>
              )}

              {!isRegisteredDriver && (
                <p className="text-sm text-muted-foreground text-center py-2">Complete Step 1 first to unlock verification.</p>
              )}
            </div>

            {/* Driver Stats (if fully verified) */}
            {isRegisteredDriver && isVerifiedDriver && (
              <div className="mt-6 p-4 bg-muted/30 rounded-lg">
                <h4 className="font-medium mb-3">Your Driver Stats</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-background rounded-lg">
                    <div className="flex items-center justify-center gap-1 text-yellow-500 mb-1">
                      <Star className="w-5 h-5 fill-yellow-500" />
                      <span className="text-xl font-bold">{driverRating.average > 0 ? (driverRating.average / 10).toFixed(1) : "N/A"}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Average Rating</p>
                  </div>
                  <div className="text-center p-3 bg-background rounded-lg">
                    <p className="text-xl font-bold">{driverRating.count}</p>
                    <p className="text-xs text-muted-foreground">Total Ratings</p>
                  </div>
                </div>
              </div>
            )}

            {error && <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}
            {success && <div className="mt-4 p-3 bg-green-50 text-green-600 rounded-lg text-sm flex items-center gap-2"><CheckCircle className="w-4 h-4" />{success}</div>}
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
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-muted-foreground">Click map to set locations</p>
                {selectionMode && <button onClick={() => setSelectionMode(null)} className="text-sm hover:text-foreground flex items-center gap-1"><X className="w-4 h-4" /> Cancel</button>}
              </div>
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setSelectionMode(selectionMode === "pickup" ? null : "pickup")}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium flex items-center justify-center gap-2 ${selectionMode === "pickup" ? "bg-green-500 text-white" : hasPickup ? "bg-green-100 text-green-700 border-green-300" : "bg-muted"}`}
                >
                  <MapPin className="w-4 h-4" /> {hasPickup ? "Pickup Set" : "Set Pickup"}
                </button>
                <button
                  onClick={() => setSelectionMode(selectionMode === "destination" ? null : "destination")}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium flex items-center justify-center gap-2 ${selectionMode === "destination" ? "bg-red-500 text-white" : hasDestination ? "bg-red-100 text-red-700 border-red-300" : "bg-muted"}`}
                >
                  <MapPin className="w-4 h-4" /> {hasDestination ? "Dest Set" : "Set Destination"}
                </button>
              </div>
              <div className="rounded-lg overflow-hidden border border-border">
                <MapWrapper
                  pickup={hasPickup ? { latitude: parseFloat(newRide.pickup.latitude), longitude: parseFloat(newRide.pickup.longitude), address: newRide.pickup.address } : undefined}
                  destination={hasDestination ? { latitude: parseFloat(newRide.destination.latitude), longitude: parseFloat(newRide.destination.longitude), address: newRide.destination.address } : undefined}
                  selectionMode={selectionMode}
                  onLocationSelect={handleMapClick}
                  height="350px"
                />
              </div>
            </div>

            <div className="mb-4 space-y-2">
              <div className="text-sm"><span className="font-medium">Pickup:</span> {newRide.pickup.address || "Not set"}</div>
              <div className="text-sm"><span className="font-medium">Dest:</span> {newRide.destination.address || "Not set"}</div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Estimated Fare (ETH)</label>
              <input type="number" step="0.00001" value={newRide.amount} onChange={(e) => setNewRide({ ...newRide, amount: e.target.value })} className="w-full px-4 py-3 rounded-lg border border-input bg-background" />
            </div>

            <button onClick={handleRequestRide} disabled={loading || !canSubmit} className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium disabled:opacity-50">
              {loading ? "Requesting..." : "Request Ride"}
            </button>
            {error && <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}
            {success && <div className="mt-4 p-3 bg-green-50 text-green-600 rounded-lg text-sm flex items-center gap-2"><CheckCircle className="w-4 h-4" />{success}</div>}
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

function Dashboard({ address, balance, isRegisteredDriver, isVerifiedDriver, driverRating, onViewChange, onDisconnect, myRidesCount, chainId, onConnect }: any) {
  const isWrongNetwork = chainId !== 11155111;
  
  return (
    <div className="min-h-screen bg-background">
      <Header address={address} balance={balance} onDisconnect={onDisconnect} />
      <main className="max-w-4xl mx-auto p-6">
        {isWrongNetwork && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              <div>
                <p className="font-medium text-amber-800">Wrong Network</p>
                <p className="text-sm text-amber-600">Please switch to Sepolia Testnet to use this app.</p>
              </div>
            </div>
            <button onClick={onConnect} className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700">
              Switch Network
            </button>
          </div>
        )}
        <div className="bg-card rounded-xl p-6 border border-border mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center"><User className="w-6 h-6" /></div>
            <div><p className="text-sm text-muted-foreground">Connected as</p><p className="font-medium">{formatAddress(address)}</p></div>
            <div className="ml-auto"><p className="text-sm text-muted-foreground">Balance</p><p className="font-medium">{formatBalance(balance)} ETH</p></div>
          </div>
          {isRegisteredDriver && (
            <div className="flex items-center gap-4 pt-4 border-t border-border">
              <div className="flex items-center gap-2"><Star className="w-5 h-5 text-yellow-500 fill-yellow-500" /><span>Rating: {driverRating.average > 0 ? (driverRating.average / 10).toFixed(1) : "N/A"}</span></div>
              {isVerifiedDriver && <div className="flex items-center gap-1.5 text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md text-xs font-medium"><BadgeCheck className="w-3.5 h-3.5" /> Verified</div>}
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <ActionButton icon={<Car className="w-6 h-6" />} title="Request Ride" description="Request a ride" onClick={() => onViewChange("requestRide")} disabled={isWrongNetwork} />
          <ActionButton icon={<Car className="w-6 h-6" />} title="My Rides" description={`${myRidesCount} rides`} onClick={() => onViewChange("myRides")} disabled={isWrongNetwork} />
          {!isRegisteredDriver ? (
            <ActionButton icon={<User className="w-6 h-6" />} title="Become a Driver" description="Register to earn" onClick={() => onViewChange("registerDriver")} disabled={isWrongNetwork} />
          ) : (
            <div onClick={() => !isWrongNetwork && onViewChange("registerDriver")} className={`bg-card rounded-xl p-6 border border-border flex items-center gap-3 cursor-pointer hover:border-primary transition-colors ${isWrongNetwork ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <CheckCircle className="w-6 h-6 text-green-500" />
              <div><p className="font-medium">Driver Dashboard</p><p className="text-sm text-muted-foreground">{isVerifiedDriver ? "Verified & Ready" : "Verification Pending"}</p></div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function ActionButton({ icon, title, description, onClick, disabled }: any) {
  return (
    <button onClick={disabled ? undefined : onClick} disabled={disabled} className={`bg-card rounded-xl p-6 border border-border text-left hover:border-primary transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center flex-shrink-0">{icon}</div>
        <div><h3 className="font-semibold text-lg">{title}</h3><p className="text-muted-foreground">{description}</p></div>
      </div>
    </button>
  );
}

function Header({ address, balance, onDisconnect, onBack }: any) {
  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-10">
      <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {onBack && <button onClick={onBack} className="p-2 -ml-2 hover:bg-muted rounded-full"><X className="w-5 h-5" /></button>}
          <span className="font-bold text-lg">RideShare</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onDisconnect} className="text-sm font-medium text-destructive hover:bg-destructive/10 px-4 py-2 rounded-lg">Disconnect</button>
        </div>
      </div>
    </header>
  );
}

function MyRidesView({ address, balance, onDisconnect, rides, onSelectRide, onBack, refreshRides }: any) {
  return (
    <div className="min-h-screen bg-background">
      <Header address={address} balance={balance} onDisconnect={onDisconnect} onBack={onBack} />
      <main className="max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">My Rides</h1>
          <button onClick={refreshRides} className="text-sm text-primary hover:underline">Refresh</button>
        </div>
        {rides.length === 0 ? <p className="text-center py-12 text-muted-foreground">No rides found.</p> :
          <div className="space-y-4">{rides.map(({ ride, ratingData }: any) => <RideCard key={ride.id} ride={ride} ratingData={ratingData} onClick={() => onSelectRide(ride.id)} />)}</div>}
      </main>
    </div>
  );
}

function RideCard({ ride, ratingData, onClick }: any) {
  const statusLabels: any = { [State.Requested]: "Requested", [State.Accepted]: "Accepted", [State.Funded]: "Funded", [State.Started]: "In Progress", [State.CompletedByDriver]: "Completed", [State.Finalized]: "Finalized", [State.Cancelled]: "Cancelled", [State.Refunded]: "Refunded" };
  return (
    <div onClick={onClick} className="bg-card p-4 rounded-xl border border-border hover:border-primary transition-all cursor-pointer shadow-sm">
      <div className="flex justify-between items-start mb-3">
        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium border">{statusLabels[ride.state]}</span>
        <span className="font-semibold">{formatWei(ride.amount)} ETH</span>
      </div>
      <div className="text-sm space-y-1">
        <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-green-500" /><span>{ride.pickup.address_}</span></div>
        <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-red-500" /><span>{ride.destination.address_}</span></div>
      </div>
    </div>
  );
}

function RideDetailView({ ride, ratingData, resolvedState, timeoutStatus, userAddress, userBalance, isRegisteredDriver, onBack, onFund, onStart, onComplete, onConfirm, onCancel, onRateDriver, onRateRider, onClaimRefund, onAcceptRide, rating, setRating, loading, error, success, setError, setSuccess }: any) {
  if (!resolvedState) return <div className="p-6">Loading...</div>;
  const { stateLabel, userRole, nextAction, canFund, canStart, canComplete, canConfirm, canCancel: canCancelRide } = resolvedState;

  return (
    <div className="min-h-screen bg-background">
      <Header address={userAddress} balance={userBalance} onDisconnect={() => { }} onBack={onBack} />
      <main className="max-w-2xl mx-auto p-6">
        <div className="bg-card rounded-lg p-6 border border-border shadow-sm">
          <div className="flex justify-between items-start mb-6">
            <h1 className="text-2xl font-bold">Ride #{ride.id.toString()}</h1>
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-secondary text-secondary-foreground">{stateLabel}</span>
          </div>
          <div className="space-y-4 mb-8">
            <div className="flex items-start gap-3"><div className="mt-1"><div className="w-2 h-2 rounded-full bg-green-500" /></div><div><p className="text-sm font-medium text-muted-foreground">Pickup</p><p>{ride.pickup.address_}</p></div></div>
            <div className="flex items-start gap-3"><div className="mt-1"><div className="w-2 h-2 rounded-full bg-red-500" /></div><div><p className="text-sm font-medium text-muted-foreground">Destination</p><p>{ride.destination.address_}</p></div></div>
            <div className="pt-4 border-t border-border flex justify-between items-center"><p className="font-medium">Fare Amount</p><p className="text-xl font-bold">{formatWei(ride.amount)} ETH</p></div>
          </div>

          <div className="bg-muted/30 rounded-lg p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2"><User className="w-5 h-5 text-primary" /><h3 className="font-semibold">Your Actions</h3></div>
            <p className="text-sm text-muted-foreground mb-4">{nextAction}</p>

            {userRole === 'driver' && ride.state === State.Requested && (
              <button onClick={() => onAcceptRide(ride.id)} disabled={loading} className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium">Accept Ride</button>
            )}
            {canFund && <button onClick={onFund} disabled={loading} className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium">Fund Ride</button>}
            {canStart && <button onClick={onStart} disabled={loading} className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium">Start Ride</button>}
            {canComplete && <button onClick={onComplete} disabled={loading} className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium">Complete Ride</button>}
            {canConfirm && <button onClick={onConfirm} disabled={loading} className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium">Confirm Arrival</button>}
            {canCancelRide && <button onClick={onCancel} disabled={loading} className="w-full bg-destructive text-destructive-foreground py-3 rounded-lg font-medium">Cancel Ride</button>}

            {ride.state === State.Finalized && (
              <div className="mt-4">
                <p className="mb-2 font-medium">Rate {userRole === 'rider' ? 'Driver' : 'Rider'}</p>
                <div className="flex gap-2 mb-4">{[1, 2, 3, 4, 5].map((star) => (<button key={star} onClick={() => setRating(star)}><Star className={`w-6 h-6 ${rating >= star ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}`} /></button>))}</div>
                <button onClick={userRole === 'rider' ? onRateDriver : onRateRider} disabled={loading || rating === 0} className="w-full bg-secondary text-secondary-foreground py-2 rounded-lg">Submit Rating</button>
              </div>
            )}

            {error && <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}
            {success && <div className="mt-4 p-3 bg-green-50 text-green-600 rounded-lg text-sm flex items-center gap-2"><CheckCircle className="w-4 h-4" />{success}</div>}
          </div>
        </div>
      </main>
    </div>
  );
}
