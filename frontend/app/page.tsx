"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useWeb3, formatBalance, formatAddress, formatWei } from "./hooks";
import { useContract } from "./hooks/useContract";
import LandingPage from "./components/LandingPage";
import RiderDashboard from "./components/RiderDashboard";
import DriverDashboard from "./components/DriverDashboard";
import {
  resolveRideState,
  getTimeoutStatus,
} from "./copilot";
import { State } from "./contracts/types";
import { Star, CheckCircle, AlertCircle, X, BadgeCheck, ShieldCheck, User, Car, MapPin } from "lucide-react";
import dynamic from "next/dynamic";
import type { SelectionMode } from "./components/Map";

// Dynamically import MapWrapper with SSR disabled
const MapWrapper = dynamic(() => import("./components/MapWrapper"), { ssr: false });

type View = "home" | "myRides" | "registerDriver" | "rideDetail";



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
    getRecentRides
  } = useContract();

  const [isDriverMode, setIsDriverMode] = useState(false);
  const [view, setView] = useState<View>("home");
  
  const [myRides, setMyRides] = useState<any[]>([]);
  const [selectedRideId, setSelectedRideId] = useState<bigint | null>(null);
  const [selectedRide, setSelectedRide] = useState<any>(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [driverName, setDriverName] = useState("");

  // New ride form state (hoisted for RiderDashboard)
  const [newRide, setNewRide] = useState({
    pickup: { latitude: "", longitude: "", address: "" },
    destination: { latitude: "", longitude: "", address: "" },
    amount: "",
  });
  const [selectionMode, setSelectionMode] = useState<"pickup" | "destination" | null>(null);

  // Rating form
  const [rating, setRating] = useState(0);

  // Auto-switch mode on load if preferred? No, default to Rider.
  
  // Distance calculation (helper for RiderDashboard logic if needed inside page, but currently logic is inside Map selection effect)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; 
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Fare calculation effect
  useEffect(() => {
    if (newRide.pickup.latitude && newRide.destination.latitude) {
      const dist = calculateDistance(
        parseFloat(newRide.pickup.latitude),
        parseFloat(newRide.pickup.longitude),
        parseFloat(newRide.destination.latitude),
        parseFloat(newRide.destination.longitude)
      );
      const calculatedFare = 0.001 + (dist * 0.0001);
      setNewRide(prev => ({ ...prev, amount: calculatedFare.toFixed(5) }));
    }
  }, [newRide.pickup.latitude, newRide.pickup.longitude, newRide.destination.latitude, newRide.destination.longitude]);

  // Handle map click
  const handleMapClick = useCallback((latitude: number, longitude: number) => {
    if (selectionMode === "pickup") {
      setNewRide(prev => ({
        ...prev,
        pickup: { latitude: latitude.toString(), longitude: longitude.toString(), address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}` },
      }));
      setSelectionMode(null);
    } else if (selectionMode === "destination") {
      setNewRide(prev => ({
        ...prev,
        destination: { latitude: latitude.toString(), longitude: longitude.toString(), address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}` },
      }));
      setSelectionMode(null);
    }
  }, [selectionMode]);

  // Refresh rides
  const refreshRides = useCallback(async () => {
    if (!isConnected || !address) return;
    try {
      // Fetch based on mode or fetch both?
      // Fetching both ensures "My Rides" is accurate for mixed usage
      const riderRideIds = await getRiderRides(address);
      const driverRideIds = isRegisteredDriver ? await getDriverRides(address) : [];
      const allRideIds = [...new Set([...riderRideIds, ...driverRideIds])];

      const ridesPromises = allRideIds.map(async (id) => {
        try {
          const ride = await getRide(id);
          const ratingData = await getRideRating(id);
          return { ride, ratingData };
        } catch (e) {
          return { ride: null, ratingData: null };
        }
      });

      const rides = await Promise.all(ridesPromises);
      const validRides = rides.filter((r) => r.ride !== null).reverse();
      setMyRides(validRides);
    } catch (err) {
      console.error("Failed to fetch rides:", err);
    }
  }, [isConnected, address, getRide, getRiderRides, getDriverRides, getRideRating, isRegisteredDriver]);

  useEffect(() => { refreshRides(); }, [refreshRides]);
  useEffect(() => { 
    const interval = setInterval(refreshRides, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, [refreshRides]);

  // Fetch selected ride
  useEffect(() => {
    if (!selectedRideId) { setSelectedRide(null); return; }
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
      setSuccess("Successfully registered!");
      setDriverName("");
    } catch (err: any) { setError(err.message || "Failed to register"); } finally { setLoading(false); }
  };

  const handleVerifyIdentity = async () => {
    setError(null); setSuccess(null); setLoading(true);
    try {
      await verifyIdentity();
      setSuccess("Verified successfully!");
    } catch (err: any) { setError(err.message || "Failed to verify"); } finally { setLoading(false); }
  };

  const handleRequestRide = async () => {
    setError(null); setSuccess(null); setLoading(true);
    try {
      const amount = BigInt(Math.floor(parseFloat(newRide.amount) * 1e18));
      const pickupData = { latitude: String(newRide.pickup.latitude), longitude: String(newRide.pickup.longitude), address: String(newRide.pickup.address) };
      const destData = { latitude: String(newRide.destination.latitude), longitude: String(newRide.destination.longitude), address: String(newRide.destination.address) };
      const hash = await requestRide(pickupData, destData, amount);
      setSuccess(`Ride requested!`);
      await refreshRides();
      setView("myRides");
    } catch (err: any) { setError(err.message || "Failed to request ride"); } finally { setLoading(false); }
  };

  const handleAcceptRide = async (rideId: bigint) => {
    setError(null); setSuccess(null); setLoading(true);
    try {
      const hash = await acceptRide(rideId);
      setSuccess(`Ride accepted!`);
      await refreshRides();
      setSelectedRideId(rideId);
    } catch (err: any) { setError(err.message || "Failed to accept ride"); } finally { setLoading(false); }
  };

  // ... (Other actions like fund, start, complete, rate remain same, just passed down)
  const createActionHandler = (action: any, successMsg: string) => async (...args: any[]) => {
      if (!selectedRide) return;
      setError(null); setSuccess(null); setLoading(true);
      try {
        await action(selectedRide.ride.id, ...args);
        setSuccess(successMsg);
        await refreshRides();
        setSelectedRide(await getRide(selectedRide.ride.id));
      } catch (err: any) { setError(err.message || "Failed"); } finally { setLoading(false); }
  };
  
  const handleFundRide = createActionHandler(fundRide, "Ride funded!");
  const handleStartRide = createActionHandler(startRide, "Ride started!");
  const handleCompleteRide = createActionHandler(completeRide, "Ride completed!");
  const handleConfirmArrival = createActionHandler(confirmArrival, "Arrival confirmed!");
  const handleCancelRide = async () => {
    if (!selectedRide) return;
    const reason = prompt("Reason for cancellation:");
    if (!reason) return;
    await createActionHandler(cancelRide, "Ride cancelled!")(reason);
  };
  const handleRateDriver = createActionHandler(rateDriver, "Driver rated!");
  const handleRateRider = createActionHandler(rateRider, "Rider rated!");
  const handleClaimRefund = async (type: "notFunded" | "notStarted") => {
     if (!selectedRide) return;
     if (type === "notFunded") await createActionHandler(claimRefundNotFunded, "Refund claimed!")();
     else await createActionHandler(claimRefundNotStarted, "Refund claimed!")();
  };


  const resolvedState = useMemo(() => {
    if (!selectedRide || !selectedRide.ride || !address) return null;
    return resolveRideState(selectedRide.ride, address);
  }, [selectedRide, address]);

  const timeoutStatus = useMemo(() => {
    if (!selectedRide || !selectedRide.ride) return null;
    return getTimeoutStatus(selectedRide.ride, Math.floor(Date.now() / 1000));
  }, [selectedRide]);

  const [isConnecting, setIsConnecting] = useState(false);
  const handleConnect = async () => {
    setIsConnecting(true);
    try { await connect(); } catch (e) { console.error(e) }
    setIsConnecting(false);
  }

  if (!isConnected) return <LandingPage onConnect={handleConnect} connecting={isConnecting} />;

  // Show network warning if not on Sepolia
  if (chainId && chainId !== 11155111) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="bg-card border border-yellow-500/50 rounded-2xl p-8 max-w-md text-center space-y-6">
          <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8 text-yellow-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground mb-2">Wrong Network</h2>
            <p className="text-muted-foreground">
              This app runs on the Sepolia testnet. Please switch your wallet to continue.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Current chain: {chainId}
            </p>
          </div>
          <button
            onClick={disconnect}
            className="w-full text-muted-foreground hover:text-foreground py-2 transition-colors"
          >
            Disconnect Wallet
          </button>
        </div>
      </div>
    );
  }

  // Computed views
  if (selectedRideId && selectedRide && selectedRide.ride) {
    return (
      <RideDetailView
        ride={selectedRide.ride}
        ratingData={selectedRide.ratingData}
        resolvedState={resolvedState}
        timeoutStatus={timeoutStatus}
        userAddress={address!}
        userBalance={balance!}
        isRegisteredDriver={isRegisteredDriver}
        onBack={() => { setSelectedRideId(null); setSelectedRide(null); }}
        onFund={handleFundRide}
        onStart={handleStartRide}
        onComplete={handleCompleteRide}
        onConfirm={handleConfirmArrival}
        onCancel={handleCancelRide}
        onRateDriver={() => handleRateDriver(rating)}
        onRateRider={() => handleRateRider(rating)}
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

  if (view === "registerDriver") {
    // Keep the registration view as it was, but use 'home' as back
    // Or integrate into Rider dashboard?
    // Let's keep it as a full page view triggered by "Become Driver" button
    // Reuse the code block from before, or better, if I extracted it it would be cleaner.
    // I'll keep the inline implementation for continuity as per instructions.
    // ... [Registration View Code] ...
    // Since I'm replacing the file, I need to include the registration view code here.
    return (
      <div className="min-h-screen bg-background">
        <Header address={address!} balance={balance!} onDisconnect={disconnect} onBack={() => setView("home")} />
        <main className="max-w-2xl mx-auto p-6">
          <div className="bg-card rounded-lg p-6 border border-border">
            <h1 className="text-2xl font-semibold mb-2">Become a Driver</h1>
            <p className="text-muted-foreground mb-6">Complete the registration and verification process.</p>
            {/* Progress Steps and Form identical to previous implementation */}
            <div className="flex items-center gap-2 mb-8">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${isRegisteredDriver ? 'bg-green-500 text-white' : 'bg-primary text-primary-foreground'}`}>
                {isRegisteredDriver ? <CheckCircle className="w-4 h-4" /> : '1'}
              </div>
              <div className={`flex-1 h-1 rounded ${isRegisteredDriver ? 'bg-green-500' : 'bg-muted'}`} />
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${isVerifiedDriver ? 'bg-green-500 text-white' : isRegisteredDriver ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                {isVerifiedDriver ? <CheckCircle className="w-4 h-4" /> : '2'}
              </div>
            </div>

            <div className={`mb-6 p-5 rounded-xl border ${isRegisteredDriver ? 'border-green-200 bg-green-50/50' : 'border-border bg-muted/20'}`}>
               {/* Step 1 Content */}
               <div className="flex items-start gap-3 mb-4">
                 <div className={`p-2 rounded-lg ${isRegisteredDriver ? 'bg-green-100' : 'bg-muted'}`}>
                   {/* User Icon */}
                   <svg className={`w-5 h-5 ${isRegisteredDriver ? 'text-green-600' : 'text-muted-foreground'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                 </div>
                 <div className="flex-1">
                   <h3 className="font-semibold">Step 1: Driver Registration</h3>
                   <p className="text-sm text-muted-foreground">Register your wallet address.</p>
                 </div>
               </div>
               {!isRegisteredDriver && (
                 <div className="space-y-3">
                   <input type="text" value={driverName} onChange={(e) => setDriverName(e.target.value)} placeholder="Display name" className="w-full px-4 py-3 rounded-lg border border-input bg-background" />
                   <button onClick={handleRegisterDriver} disabled={loading || !driverName} className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium">Register</button>
                 </div>
               )}
            </div>

            <div className={`p-5 rounded-xl border ${isVerifiedDriver ? 'border-green-200 bg-green-50/50' : isRegisteredDriver ? 'border-blue-200 bg-blue-50/30' : 'border-border bg-muted/10 opacity-60'}`}>
               {/* Step 2 Content */}
               <div className="flex items-start gap-3 mb-4">
                 <div className={`p-2 rounded-lg ${isVerifiedDriver ? 'bg-green-100' : isRegisteredDriver ? 'bg-blue-100' : 'bg-muted'}`}>
                    <ShieldCheck className={`w-5 h-5 ${isVerifiedDriver ? 'text-green-600' : isRegisteredDriver ? 'text-blue-600' : 'text-muted-foreground'}`} />
                 </div>
                 <div className="flex-1">
                   <h3 className="font-semibold">Step 2: Identity Verification</h3>
                   <p className="text-sm text-muted-foreground">Verify using zkPassport.</p>
                 </div>
               </div>
               {isRegisteredDriver && !isVerifiedDriver && (
                 <button onClick={handleVerifyIdentity} disabled={loading} className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium">Verify with zkPassport</button>
               )}
               {isVerifiedDriver && <div className="text-green-600 font-medium flex items-center gap-2"><CheckCircle className="w-4 h-4"/> Verified</div>}
            </div>

            {error && <div className="mt-4 text-red-600 text-sm">{error}</div>}
            {success && <div className="mt-4 text-green-600 text-sm">{success}</div>}
          </div>
        </main>
      </div>
    );
  }

  if (view === "myRides") {
    // Show only relevant rides based on mode?
    // User requested: "ensure 'My Rides' only shows rides where user is Rider"
    // So if I am in Rider mode (default), filter for rider.
    const relevantRides = myRides.filter(r => r.ride.rider.toLowerCase() === address?.toLowerCase());
    return (
      <MyRidesView
        address={address!}
        balance={balance!}
        onDisconnect={disconnect}
        rides={relevantRides}
        onSelectRide={setSelectedRideId}
        onBack={() => setView("home")}
        refreshRides={refreshRides}
      />
    );
  }

  // Driver Mode
  if (isDriverMode) {
    if (!isRegisteredDriver) {
      // Logic error: shouldn't be able to switch if not registered, but safety fallback
      setIsDriverMode(false);
      return null; 
    }
    return (
      <DriverDashboard
        address={address!}
        balance={balance!}
        driverRating={driverRating}
        isVerified={isVerifiedDriver}
        onDisconnect={disconnect}
        onBack={() => {}} // No back in dashboard? Or back to home?
        onSelectRide={setSelectedRideId} // When driver selects a ride, they see details overlay
        myRides={myRides.filter(r => r.ride.driver.toLowerCase() === address?.toLowerCase())} // Filter for driver rides
        getRecentRides={getRecentRides}
        acceptRide={handleAcceptRide} // Actually detail view handles accept, but dashboard needs it? No, dashboard just lists.
        onToggleDriverMode={() => setIsDriverMode(false)}
      />
    );
  }

  // Rider Mode (Default)
  return (
    <RiderDashboard
      address={address!}
      balance={balance!}
      onDisconnect={disconnect}
      onBack={() => {}} // Main view
      newRide={newRide}
      setNewRide={setNewRide}
      selectionMode={selectionMode}
      setSelectionMode={setSelectionMode} // Cast for strict typing if needed
      handleMapClick={handleMapClick}
      handleRequestRide={handleRequestRide}
      loading={loading}
      error={error}
      success={success}
      isRegisteredDriver={isRegisteredDriver}
      onViewMyRides={() => setView("myRides")}
      onBecomeDriver={() => setView("registerDriver")}
      onToggleDriverMode={() => setIsDriverMode(true)}
    />
  );
}

// ... Keep existing sub-components (Header, MyRidesView, RideDetailView, RideCard) ...
// For brevity in this tool call, I will assume the previous tool call context allows me to replace the TOP part and keep the bottom part if I used start/end lines?
// The instruction said "replace the Home component".
// If I use `replace_file_content` with StartLine/EndLine, I can surgical replace Home.
// Original file line 21 is `export default function Home`.
// Line 637 is `function Dashboard`.


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
