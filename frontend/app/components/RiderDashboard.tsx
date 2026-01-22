import { useState } from "react";
import { AlertCircle, CheckCircle, MapPin, X, Menu } from "lucide-react";
import dynamic from "next/dynamic";
import type { SelectionMode } from "./Map";

const MapWrapper = dynamic(() => import("./MapWrapper"), { ssr: false });

interface RiderDashboardProps {
  address: string;
  balance: bigint;
  onDisconnect: () => void;
  onBack: () => void;
  newRide: any;
  setNewRide: (ride: any) => void;
  selectionMode: SelectionMode;
  setSelectionMode: (mode: SelectionMode) => void;
  handleMapClick: (lat: number, lng: number) => void;
  handleRequestRide: () => void;
  loading: boolean;
  error: string | null;
  success: string | null;
  isRegisteredDriver: boolean;
  onViewMyRides: () => void;
  onBecomeDriver: () => void;
  onToggleDriverMode: () => void;
}

export default function RiderDashboard({
  address,
  balance,
  onDisconnect,
  onBack,
  newRide,
  setNewRide,
  selectionMode,
  setSelectionMode,
  handleMapClick,
  handleRequestRide,
  loading,
  error,
  success,
  isRegisteredDriver,
  onViewMyRides,
  onBecomeDriver,
  onToggleDriverMode
}: RiderDashboardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const hasPickup = newRide.pickup.latitude && newRide.pickup.longitude;
  const hasDestination = newRide.destination.latitude && newRide.destination.longitude;
  const canSubmit = hasPickup && hasDestination && newRide.amount;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-primary text-primary-foreground p-1.5 rounded-lg"><MapPin className="w-4 h-4 sm:w-5 sm:h-5" /></div>
            <span className="font-bold text-base sm:text-lg">RideShare</span>
          </div>
          
          {/* Desktop Nav */}
          <div className="hidden sm:flex items-center gap-2">
            <button onClick={onViewMyRides} className="text-sm font-medium hover:bg-muted px-3 py-2 rounded-lg">My Rides</button>
            {!isRegisteredDriver ? (
              <button onClick={onBecomeDriver} className="text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 px-3 py-2 rounded-lg">Become Driver</button>
            ) : (
              <button onClick={onToggleDriverMode} className="text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 px-3 py-2 rounded-lg flex items-center gap-1">
                <CheckCircle className="w-4 h-4" /> Driver
              </button>
            )}
            <button onClick={onDisconnect} className="text-sm font-medium text-destructive hover:bg-destructive/10 px-3 py-2 rounded-lg">Disconnect</button>
          </div>

          {/* Mobile Menu Button */}
          <button onClick={() => setMenuOpen(!menuOpen)} className="sm:hidden p-2 hover:bg-muted rounded-lg">
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Dropdown Menu */}
        {menuOpen && (
          <div className="sm:hidden border-t border-border bg-card px-4 py-3 space-y-2">
            <button onClick={() => { onViewMyRides(); setMenuOpen(false); }} className="w-full text-left text-sm font-medium hover:bg-muted px-3 py-2 rounded-lg">My Rides</button>
            {!isRegisteredDriver ? (
              <button onClick={() => { onBecomeDriver(); setMenuOpen(false); }} className="w-full text-left text-sm font-medium bg-secondary text-secondary-foreground px-3 py-2 rounded-lg">Become Driver</button>
            ) : (
              <button onClick={() => { onToggleDriverMode(); setMenuOpen(false); }} className="w-full text-left text-sm font-medium bg-primary text-primary-foreground px-3 py-2 rounded-lg flex items-center gap-2">
                <CheckCircle className="w-4 h-4" /> Switch to Driver Mode
              </button>
            )}
            <button onClick={() => { onDisconnect(); setMenuOpen(false); }} className="w-full text-left text-sm font-medium text-destructive hover:bg-destructive/10 px-3 py-2 rounded-lg">Disconnect</button>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto p-4 sm:p-6">
        <div className="bg-card rounded-lg p-4 sm:p-6 border border-border">

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
