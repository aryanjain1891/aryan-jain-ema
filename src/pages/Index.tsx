import { useState } from "react";
import { ClaimIntakeForm } from "@/components/claim/ClaimIntakeForm";
import { ClaimAssessment } from "@/components/claim/ClaimAssessment";
import { Shield, FileText, Brain } from "lucide-react";

const Index = () => {
  const [claimId, setClaimId] = useState<string | null>(null);
  const [showAssessment, setShowAssessment] = useState(false);

  const handleClaimCreated = (newClaimId: string) => {
    setClaimId(newClaimId);
    setShowAssessment(true);
  };

  const handleReset = () => {
    setClaimId(null);
    setShowAssessment(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary to-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-lg sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Shield className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Intelligent FNOL Gatekeeper</h1>
              <p className="text-sm text-muted-foreground">AI-Powered Claims Intake & Triage</p>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      {!showAssessment && (
        <section className="container mx-auto px-4 py-12 text-center">
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 text-accent text-sm font-medium mb-4">
              <Brain className="h-4 w-4" />
              <span>Powered by Advanced AI</span>
            </div>
            
            <h2 className="text-4xl md:text-5xl font-bold text-foreground">
              File Your Claim in <span className="text-accent">Minutes</span>
            </h2>
            
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Our intelligent system validates your policy instantly, analyzes damage photos with computer vision, 
              and routes your claim to the right specialist—eliminating the "black hole" of traditional claims intake.
            </p>

            <div className="grid md:grid-cols-3 gap-6 mt-12">
              <div className="p-6 rounded-xl bg-card border border-border hover:shadow-lg transition-shadow">
                <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4 mx-auto">
                  <Shield className="h-6 w-6 text-accent" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">Instant Validation</h3>
                <p className="text-sm text-muted-foreground">
                  Real-time policy verification stops denials before they start
                </p>
              </div>

              <div className="p-6 rounded-xl bg-card border border-border hover:shadow-lg transition-shadow">
                <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4 mx-auto">
                  <Brain className="h-6 w-6 text-accent" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">Smart Triage</h3>
                <p className="text-sm text-muted-foreground">
                  AI routes claims to the right adjuster based on complexity
                </p>
              </div>

              <div className="p-6 rounded-xl bg-card border border-border hover:shadow-lg transition-shadow">
                <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4 mx-auto">
                  <FileText className="h-6 w-6 text-accent" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">Dynamic Questions</h3>
                <p className="text-sm text-muted-foreground">
                  Adaptive interview captures all needed data upfront
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {!showAssessment ? (
          <ClaimIntakeForm onClaimCreated={handleClaimCreated} />
        ) : (
          <ClaimAssessment claimId={claimId!} onReset={handleReset} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 mt-16 py-8 bg-card/50">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2024 Intelligent FNOL System. Built with advanced AI for instant claims processing.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;