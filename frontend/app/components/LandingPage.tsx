import { Car, Shield, Zap, Users } from "lucide-react";

interface LandingPageProps {
    onConnect: () => Promise<any>;
    connecting: boolean;
}

export default function LandingPage({ onConnect, connecting }: LandingPageProps) {
    return (
        <div className="min-h-screen bg-background flex flex-col">
            {/* Navbar */}
            <nav className="border-b border-border/40 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Car className="w-6 h-6 text-primary" />
                        <span className="font-bold text-xl tracking-tight">RideShare</span>
                    </div>
                    <button
                        onClick={() => onConnect()}
                        disabled={connecting}
                        className="bg-primary text-primary-foreground px-4 py-2 rounded-full text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                        {connecting ? "Connecting..." : "Launch App"}
                    </button>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-background -z-10" />

                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6 animate-fade-in-up">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                    </span>
                    Live on testnet
                </div>

                <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 max-w-3xl animate-fade-in-up delay-100">
                    The Future of <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-600">Decentralized</span> Transportation
                </h1>

                <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl animate-fade-in-up delay-200">
                    Book rides directly with drivers. No middlemen, lower fees, and full transparency powered by the blockchain.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 animate-fade-in-up delay-300">
                    <button
                        onClick={() => onConnect()}
                        disabled={connecting}
                        className="bg-primary text-primary-foreground px-8 py-3 rounded-full text-lg font-semibold hover:opacity-90 transition-all shadow-lg hover:shadow-primary/20 scale-100 hover:scale-105 active:scale-95"
                    >
                        {connecting ? "Connecting..." : "Get Started Now"}
                    </button>
                    <a
                        href="#features"
                        className="bg-secondary text-secondary-foreground px-8 py-3 rounded-full text-lg font-medium hover:bg-secondary/80 transition-colors"
                    >
                        Learn More
                    </a>
                </div>
            </section>

            {/* Features Grid */}
            <section id="features" className="py-20 px-6 bg-muted/30">
                <div className="max-w-6xl mx-auto">
                    <h2 className="text-3xl font-bold text-center mb-12">Why Choose RideShare?</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <FeatureCard
                            icon={<Shield className="w-8 h-8 text-green-500" />}
                            title="Secure Escrow"
                            description="Funds are held safely in a smart contract until the ride is completed and confirmed."
                        />
                        <FeatureCard
                            icon={<Zap className="w-8 h-8 text-yellow-500" />}
                            title="Instant Payments"
                            description="Drivers get paid immediately upon ride completion. No weekly payouts or delays."
                        />
                        <FeatureCard
                            icon={<Users className="w-8 h-8 text-blue-500" />}
                            title="Community Driven"
                            description="Fair rating system and direct peer-to-peer connection without corporate intermediaries."
                        />
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-8 border-t border-border mt-auto">
                <div className="max-w-6xl mx-auto px-6 text-center text-sm text-muted-foreground">
                    <p>© {new Date().getFullYear()} RideShare. Built for the decentralized web.</p>
                </div>
            </footer>
        </div>
    );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
    return (
        <div className="bg-card p-6 rounded-2xl border border-border shadow-sm hover:shadow-md transition-shadow">
            <div className="mb-4">{icon}</div>
            <h3 className="text-xl font-semibold mb-2">{title}</h3>
            <p className="text-muted-foreground">{description}</p>
        </div>
    );
}
