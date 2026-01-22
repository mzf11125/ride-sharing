import { useState, useEffect } from "react";
import { Star, BadgeCheck, Car, CheckCircle, MapPin, AlertCircle, RefreshCw, Menu, X } from "lucide-react";
import { formatWei } from "../hooks";
import { State } from "../contracts/types";

interface DriverDashboardProps {
  address: string;
  balance: bigint;
  driverRating: { average: number; count: number };
  isVerified: boolean;
  onDisconnect: () => void;
  onBack: () => void;
  onSelectRide: (id: bigint) => void;
  myRides: any[];
  getRecentRides: (limit?: number) => Promise<any[]>;
  acceptRide: (id: bigint) => Promise<any>;
  onToggleDriverMode: () => void;
}

export default function DriverDashboard({
  address,
  balance,
  driverRating,
  isVerified,
  onDisconnect,
  onBack,
  onSelectRide,
  myRides,
  getRecentRides,
  acceptRide,
  onToggleDriverMode
}: DriverDashboardProps) {
  const [activeTab, setActiveTab] = useState<"market" | "active">("market");
  const [availableRides, setAvailableRides] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const fetchAvailableRides = async () => {
    setLoading(true);
    try {
      const rides = await getRecentRides(20);
      const requested = rides.filter(r => r.state === State.Requested);
      setAvailableRides(requested.reverse());
    } catch (e) {
      console.error("Failed to fetch available rides", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "market") {
      fetchAvailableRides();
      const interval = setInterval(fetchAvailableRides, 15000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-primary text-primary-foreground p-1.5 rounded-lg"><Car className="w-4 h-4 sm:w-5 sm:h-5" /></div>
            <span className="font-bold text-base sm:text-lg">Driver Mode</span>
          </div>
          
          {/* Desktop Nav */}
          <div className="hidden sm:flex items-center gap-2">
            <button onClick={onToggleDriverMode} className="text-sm font-medium hover:bg-muted px-3 py-2 rounded-lg flex items-center gap-1"><MapPin className="w-4 h-4" /> Rider</button>
            <div className={`px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${isVerified ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
              {isVerified ? <BadgeCheck className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
              {isVerified ? "Verified" : "Pending"}
            </div>
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
            <button onClick={() => { onToggleDriverMode(); setMenuOpen(false); }} className="w-full text-left text-sm font-medium hover:bg-muted px-3 py-2 rounded-lg flex items-center gap-2"><MapPin className="w-4 h-4" /> Switch to Rider Mode</button>
            <div className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${isVerified ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
              {isVerified ? <BadgeCheck className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {isVerified ? "Verified Driver" : "Verification Pending"}
            </div>
            <button onClick={() => { onDisconnect(); setMenuOpen(false); }} className="w-full text-left text-sm font-medium text-destructive hover:bg-destructive/10 px-3 py-2 rounded-lg">Disconnect</button>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto p-4 sm:p-6">
        {/* Stats - responsive grid */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="bg-card p-3 sm:p-4 rounded-xl border border-border flex items-center gap-3 sm:gap-4">
            <div className="p-2 sm:p-3 bg-yellow-100 text-yellow-600 rounded-full"><Star className="w-5 h-5 sm:w-6 sm:h-6" /></div>
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground">Rating</p>
              <p className="text-lg sm:text-xl font-bold">{driverRating.average.toFixed(1)} <span className="text-xs sm:text-sm font-normal text-muted-foreground">({driverRating.count})</span></p>
            </div>
          </div>
          <div className="bg-card p-3 sm:p-4 rounded-xl border border-border flex items-center gap-3 sm:gap-4">
            <div className="p-2 sm:p-3 bg-green-100 text-green-600 rounded-full"><CheckCircle className="w-5 h-5 sm:w-6 sm:h-6" /></div>
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground">Completed</p>
              <p className="text-lg sm:text-xl font-bold">{myRides.filter(r => r.ride.state === State.CompletedByDriver || r.ride.state === State.Finalized).length}</p>
            </div>
          </div>
        </div>


        {/* Tabs */}
        <div className="flex items-center gap-2 mb-6 border-b border-border">
           <button 
             onClick={() => setActiveTab("market")}
             className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${activeTab === "market" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
           >
             Ride Marketplace
           </button>
           <button 
             onClick={() => setActiveTab("active")}
             className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${activeTab === "active" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
           >
             My Active Jobs
           </button>
        </div>

        {/* Content */}
        {activeTab === "market" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
               <h3 className="font-semibold text-lg">Available Rides</h3>
               <button onClick={fetchAvailableRides} disabled={loading} className="text-sm flex items-center gap-1 text-primary hover:underline">
                 <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> Refresh
               </button>
            </div>
            
            {availableRides.length === 0 ? (
               <div className="text-center py-12 bg-muted/20 rounded-xl border border-dashed border-border">
                 <p className="text-muted-foreground">No rides currently available.</p>
               </div>
            ) : (
               availableRides.map(ride => (
                 <div key={ride.id} className="bg-card p-4 rounded-xl border border-border hover:border-primary transition-all shadow-sm">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">New Request</span>
                        <span className="text-xs text-muted-foreground">RID: #{ride.id.toString()}</span>
                      </div>
                      <span className="font-bold text-lg">{formatWei(ride.amount)} ETH</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                       <div className="flex items-start gap-3">
                          <div className="mt-1"><div className="w-2 h-2 rounded-full bg-green-500" /></div>
                          <div><p className="text-xs font-medium text-muted-foreground">Pick Up</p><p className="text-sm">{ride.pickup.address_}</p></div>
                       </div>
                       <div className="flex items-start gap-3">
                          <div className="mt-1"><div className="w-2 h-2 rounded-full bg-red-500" /></div>
                          <div><p className="text-xs font-medium text-muted-foreground">Destination</p><p className="text-sm">{ride.destination.address_}</p></div>
                       </div>
                    </div>
                    <button 
                      onClick={() => onSelectRide(ride.id)} 
                      className="w-full py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
                    >
                      View Details & Accept
                    </button>
                 </div>
               ))
            )}
          </div>
        )}

        {activeTab === "active" && (
           <div className="space-y-4">
             {myRides.length === 0 ? (
               <div className="text-center py-12 bg-muted/20 rounded-xl border border-dashed border-border">
                 <p className="text-muted-foreground">No active jobs found.</p>
               </div>
             ) : (
                myRides.map(({ ride }: any) => (
                  <div key={ride.id} onClick={() => onSelectRide(ride.id)} className="bg-card p-4 rounded-xl border border-border hover:border-primary transition-all cursor-pointer shadow-sm">
                    <div className="flex justify-between items-start mb-3">
                      <RideStatusBadge state={ride.state} />
                      <span className="font-semibold">{formatWei(ride.amount)} ETH</span>
                    </div>
                    <div className="text-sm space-y-1">
                      <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-green-500" /><span>{ride.pickup.address_}</span></div>
                      <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-red-500" /><span>{ride.destination.address_}</span></div>
                    </div>
                  </div>
                ))
             )}
           </div>
        )}
      </main>
    </div>
  );
}

function RideStatusBadge({ state }: { state: State }) {
  const statusLabels: any = { 
    [State.Requested]: "Requested", 
    [State.Accepted]: "Accepted", 
    [State.Funded]: "Funded", 
    [State.Started]: "In Progress", 
    [State.CompletedByDriver]: "Completed", 
    [State.Finalized]: "Finalized", 
    [State.Cancelled]: "Cancelled", 
    [State.Refunded]: "Refunded" 
  };
  
  const colors: any = {
    [State.Accepted]: "bg-blue-100 text-blue-700",
    [State.Funded]: "bg-indigo-100 text-indigo-700",
    [State.Started]: "bg-purple-100 text-purple-700",
    [State.CompletedByDriver]: "bg-green-100 text-green-700",
    [State.Finalized]: "bg-gray-100 text-gray-700",
  }

  return <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[state] || "bg-secondary text-secondary-foreground"}`}>{statusLabels[state]}</span>;
}
