import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InsurerLogin } from "@/components/InsurerLogin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  Image as ImageIcon,
  Car,
  Shield,
  AlertCircle,
  Eye,
  ArrowLeft,
  RefreshCw,
  Loader2,
  Zap
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

interface Claim {
  id: string;
  claim_number: string;
  policy_number: string;
  incident_type: string;
  incident_date: string;
  description: string;
  location: string;
  status: string;
  severity_level: string;
  confidence_score: number;
  routing_decision: string;
  ai_assessment: any;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: number;
  vehicle_vin: string;
  vehicle_license_plate: string;
  vehicle_ownership_status: string;
  vehicle_odometer: number;
  vehicle_purchase_date: string;
  policy_document_url: string;
  created_at: string;
}

interface ClaimFile {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string;
}

export default function InsurerDashboard() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [claimFiles, setClaimFiles] = useState<ClaimFile[]>([]);
  const [claimQuestions, setClaimQuestions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem("insurer_auth") === "true";
  });

  const fetchClaims = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('claims')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setClaims(data as Claim[]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchClaims();
  }, []);

  const fetchClaimFiles = async (claimId: string) => {
    const { data, error } = await supabase
      .from('claim_files')
      .select('*')
      .eq('claim_id', claimId);

    if (!error && data) {
      setClaimFiles(data as ClaimFile[]);
    }
  };

  const fetchClaimQuestions = async (claimId: string) => {
    const { data, error } = await supabase
      .from('claim_questions')
      .select('*')
      .eq('claim_id', claimId)
      .order('asked_at', { ascending: true });

    if (!error && data) {
      setClaimQuestions(data);
    }
  };

  const handleViewClaim = (claim: Claim) => {
    setSelectedClaim(claim);
    fetchClaimFiles(claim.id);
    fetchClaimQuestions(claim.id);
  };

  const handleFinalizeAssessment = async (claim: Claim) => {
    setIsFinalizing(true);
    try {
      // Get claim questions with answers
      const { data: questions } = await supabase
        .from('claim_questions')
        .select('*')
        .eq('claim_id', claim.id);

      // Get claim files for image URLs
      const { data: files } = await supabase
        .from('claim_files')
        .select('*')
        .eq('claim_id', claim.id);

      const imageUrls = files?.filter(f => f.file_type?.startsWith('image/'))
        .map(f => f.file_url) || [];

      // Prepare follow-up answers
      const followUpAnswers = questions?.map(q => ({
        question: q.question,
        answer: q.answer || 'Not answered',
        question_type: q.question_type,
        is_required: q.is_required
      })) || [];

      // Prepare claim data
      const claimData = {
        incident_type: claim.incident_type,
        incident_date: claim.incident_date,
        description: claim.description,
        location: claim.location,
        policy_number: claim.policy_number,
        vehicle_make: claim.vehicle_make,
        vehicle_model: claim.vehicle_model,
        vehicle_year: claim.vehicle_year,
        vehicle_vin: claim.vehicle_vin,
        vehicle_license_plate: claim.vehicle_license_plate,
        vehicle_ownership_status: claim.vehicle_ownership_status,
        vehicle_odometer: claim.vehicle_odometer,
        vehicle_purchase_date: claim.vehicle_purchase_date,
      };

      toast.info("Running AI assessment...");

      // Call finalize-assessment
      const { data, error } = await supabase.functions.invoke('finalize-assessment', {
        body: {
          claimData,
          initialAssessment: claim.ai_assessment || {},
          followUpAnswers,
          additionalImageUrls: imageUrls
        }
      });

      if (error) throw error;

      // Update claim with final assessment
      const { error: updateError } = await supabase
        .from('claims')
        .update({
          severity_level: data.assessment.severity_level,
          confidence_score: data.assessment.confidence_score,
          routing_decision: data.assessment.routing_decision,
          ai_assessment: data.assessment,
          status: 'assessed'
        })
        .eq('id', claim.id);

      if (updateError) throw updateError;

      // Refresh data
      await fetchClaims();
      await fetchClaimQuestions(claim.id);
      
      // Update selected claim with new data
      const updatedClaim = {
        ...claim,
        severity_level: data.assessment.severity_level,
        confidence_score: data.assessment.confidence_score,
        routing_decision: data.assessment.routing_decision,
        ai_assessment: data.assessment,
        status: 'assessed'
      };
      setSelectedClaim(updatedClaim);

      toast.success("Assessment finalized successfully!");
    } catch (error) {
      console.error('Error finalizing assessment:', error);
      toast.error("Failed to finalize assessment. Please try again.");
    } finally {
      setIsFinalizing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'assessed': return 'bg-emerald-500';
      case 'submitted': return 'bg-amber-500';
      case 'pending': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getRoutingBadge = (routing: string) => {
    switch (routing) {
      case 'straight_through': return { color: 'bg-emerald-500', label: 'Straight Through' };
      case 'junior_adjuster': return { color: 'bg-blue-500', label: 'Junior Adjuster' };
      case 'senior_adjuster': return { color: 'bg-amber-500', label: 'Senior Adjuster' };
      case 'specialist': return { color: 'bg-orange-500', label: 'Specialist' };
      case 'fraud_investigation': return { color: 'bg-red-600', label: 'Fraud Investigation' };
      default: return { color: 'bg-gray-500', label: routing || 'Pending' };
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'low': return { color: 'bg-emerald-500', label: 'Low Severity' };
      case 'medium': return { color: 'bg-amber-500', label: 'Medium Severity' };
      case 'high': return { color: 'bg-orange-500', label: 'High Severity' };
      case 'critical': return { color: 'bg-red-500', label: 'Critical Severity' };
      case 'fraudulent': return { color: 'bg-red-600', label: 'Fraudulent' };
      case 'invalid_images': return { color: 'bg-red-600', label: 'Invalid Images' };
      default: return { color: 'bg-gray-500', label: severity || 'Pending Assessment' };
    }
  };

  const getLegitimacyBadge = (assessment: any) => {
    if (!assessment) return null;

    const hasFraudFlags = assessment.fraud_indicators?.has_red_flags;
    const isAuthentic = assessment.image_authenticity?.appears_authentic;

    if (hasFraudFlags || isAuthentic === false) {
      return { color: 'bg-red-600', label: 'Potential Fraud', icon: AlertTriangle };
    }

    if (isAuthentic === true && !hasFraudFlags) {
      return { color: 'bg-emerald-500', label: 'Legitimate Claim', icon: CheckCircle };
    }

    return { color: 'bg-gray-500', label: 'Verification Pending', icon: Clock };
  };

  const handleLogin = () => {
    sessionStorage.setItem("insurer_auth", "true");
    setIsAuthenticated(true);
  };

  if (!isAuthenticated) {
    return <InsurerLogin onLogin={handleLogin} />;
  }

  if (selectedClaim) {
    const assessment = selectedClaim.ai_assessment;
    const routing = getRoutingBadge(selectedClaim.routing_decision);
    const severity = getSeverityBadge(selectedClaim.severity_level);

    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <Button variant="ghost" onClick={() => setSelectedClaim(null)} className="mb-6">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Claims List
          </Button>

          <div className="grid gap-6">
            {/* Header */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl">Claim #{selectedClaim.claim_number}</CardTitle>
                    <CardDescription>
                      Submitted on {new Date(selectedClaim.created_at).toLocaleDateString()}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Finalize Assessment Button */}
                    {selectedClaim.status === 'submitted' && (
                      <Button 
                        onClick={() => handleFinalizeAssessment(selectedClaim)}
                        disabled={isFinalizing}
                        className="bg-primary hover:bg-primary/90"
                      >
                        {isFinalizing ? (
                          <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing...</>
                        ) : (
                          <><Zap className="mr-2 h-4 w-4" /> Finalize Assessment</>
                        )}
                      </Button>
                    )}
                    <div className="flex gap-2">
                      {(() => {
                        const legitimacy = getLegitimacyBadge(assessment);
                        if (legitimacy) {
                          const Icon = legitimacy.icon;
                          return (
                            <Badge className={`${legitimacy.color} text-white flex items-center gap-1`}>
                              <Icon className="h-3 w-3" />
                              {legitimacy.label}
                            </Badge>
                          );
                        }
                      })()}
                      <Badge className={`${severity.color} text-white`}>{severity.label}</Badge>
                      <Badge className={`${routing.color} text-white`}>{routing.label}</Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Fraud Flags */}
            {(assessment?.fraud_indicators?.has_red_flags || assessment?.image_authenticity?.appears_authentic === false) && (
              <Card className="border-destructive/50 bg-destructive/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-5 w-5" />
                    Fraud Flags Detected
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {assessment?.image_authenticity?.appears_authentic === false && (
                    <div className="space-y-2">
                      <h4 className="font-semibold">Image Authenticity Issues</h4>
                      <p className="text-sm">{assessment.image_authenticity.validation_notes}</p>
                      {assessment.image_authenticity.concerns?.length > 0 && (
                        <ul className="text-sm space-y-1">
                          {assessment.image_authenticity.concerns.map((c: string, i: number) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-muted-foreground mt-1.5">•</span>
                              <span>{c}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <Badge variant="outline" className="mt-2">
                        Confidence: {Math.round((assessment.image_authenticity.confidence || 0) * 100)}%
                      </Badge>
                    </div>
                  )}

                  {assessment?.fraud_indicators?.has_red_flags && (
                    <div className="space-y-2">
                      <h4 className="font-semibold">Fraud Indicators</h4>
                      <p className="text-sm">
                        Status: <strong>{assessment.fraud_indicators.verification_status}</strong>
                      </p>
                      {assessment.fraud_indicators.concerns?.length > 0 && (
                        <ul className="text-sm space-y-1">
                          {assessment.fraud_indicators.concerns.map((c: string, i: number) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-muted-foreground mt-1.5">•</span>
                              <span>{c}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {assessment?.vehicle_validation && !assessment.vehicle_validation.details_consistent && (
                    <div className="space-y-2">
                      <h4 className="font-semibold">Vehicle Validation Issues</h4>
                      <p className="text-sm">{assessment.vehicle_validation.notes}</p>
                    </div>
                  )}

                  {/* Metadata checks */}
                  {assessment?.metadata_flags && assessment.metadata_flags.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-semibold">Metadata Analysis</h4>
                      <ul className="text-sm space-y-1">
                        {assessment.metadata_flags.map((flag: string, i: number) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-muted-foreground mt-1.5">•</span>
                            <span>{flag}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="details">Claim Details</TabsTrigger>
                <TabsTrigger value="vehicle">Vehicle & Policy</TabsTrigger>
                <TabsTrigger value="questions">Q&A ({claimQuestions.length})</TabsTrigger>
                <TabsTrigger value="assessment">AI Assessment</TabsTrigger>
                <TabsTrigger value="files">Uploaded Files</TabsTrigger>
              </TabsList>

              <TabsContent value="details">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Incident Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Incident Type</p>
                        <p className="font-medium capitalize">{selectedClaim.incident_type?.replace('_', ' ')}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Incident Date</p>
                        <p className="font-medium">{new Date(selectedClaim.incident_date).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Location</p>
                        <p className="font-medium">{selectedClaim.location || 'Not specified'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Policy Number</p>
                        <p className="font-medium">{selectedClaim.policy_number}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Description</p>
                      <p className="text-sm bg-muted/50 p-3 rounded-lg">{selectedClaim.description || 'No description provided'}</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="vehicle">
                <div className="grid gap-6 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Car className="h-5 w-5" />
                        Vehicle Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-sm text-muted-foreground">Make</p>
                          <p className="font-medium">{selectedClaim.vehicle_make || '-'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Model</p>
                          <p className="font-medium">{selectedClaim.vehicle_model || '-'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Year</p>
                          <p className="font-medium">{selectedClaim.vehicle_year || '-'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">VIN</p>
                          <p className="font-medium font-mono text-xs">{selectedClaim.vehicle_vin || '-'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">License Plate</p>
                          <p className="font-medium">{selectedClaim.vehicle_license_plate || '-'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Ownership</p>
                          <p className="font-medium capitalize">{selectedClaim.vehicle_ownership_status || '-'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Odometer</p>
                          <p className="font-medium">{selectedClaim.vehicle_odometer ? `${selectedClaim.vehicle_odometer.toLocaleString()} mi` : '-'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Purchase Date</p>
                          <p className="font-medium">{selectedClaim.vehicle_purchase_date ? new Date(selectedClaim.vehicle_purchase_date).toLocaleDateString() : '-'}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5" />
                        Policy Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <p className="text-sm text-muted-foreground">Policy Number</p>
                        <p className="font-medium">{selectedClaim.policy_number}</p>
                      </div>
                      {selectedClaim.policy_document_url && (
                        <div>
                          <p className="text-sm text-muted-foreground mb-2">Policy Document</p>
                          <a
                            href={selectedClaim.policy_document_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                          >
                            <FileText className="h-4 w-4" />
                            View Policy Document
                          </a>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="questions">
                <div className="space-y-6">
                  {/* Key Takeaways Summary */}
                  <Card className="border-primary/20 bg-primary/5">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Zap className="h-5 w-5 text-primary" />
                        Key Takeaways
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {(() => {
                        const analysis = assessment?.follow_up_analysis || [];
                        const credibleCount = analysis.filter((a: any) => a.credibility === 'credible').length;
                        const concernCount = analysis.filter((a: any) => 
                          a.credibility === 'suspicious' || a.credibility === 'evasive' || a.impact_on_claim === 'critical_concern'
                        ).length;
                        const positiveCount = analysis.filter((a: any) => a.impact_on_claim === 'positive').length;
                        
                        // Extract key findings
                        const criticalConcerns = analysis.filter((a: any) => 
                          a.impact_on_claim === 'critical_concern' || a.credibility === 'suspicious' || a.credibility === 'evasive'
                        );
                        const positiveFindings = analysis.filter((a: any) => 
                          a.credibility === 'credible' && a.impact_on_claim === 'positive'
                        );

                        return (
                          <div className="space-y-4">
                            {/* Stats Row */}
                            <div className="grid grid-cols-3 gap-4 text-center">
                              <div className="p-3 rounded-lg bg-card border">
                                <div className="text-2xl font-bold text-emerald-600">{credibleCount}</div>
                                <div className="text-xs text-muted-foreground">Credible Responses</div>
                              </div>
                              <div className="p-3 rounded-lg bg-card border">
                                <div className="text-2xl font-bold text-amber-600">{concernCount}</div>
                                <div className="text-xs text-muted-foreground">Concerns Flagged</div>
                              </div>
                              <div className="p-3 rounded-lg bg-card border">
                                <div className="text-2xl font-bold text-primary">{positiveCount}</div>
                                <div className="text-xs text-muted-foreground">Positive Indicators</div>
                              </div>
                            </div>

                            {/* Critical Concerns */}
                            {criticalConcerns.length > 0 && (
                              <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/5">
                                <h4 className="font-semibold text-sm text-destructive mb-2 flex items-center gap-2">
                                  <AlertTriangle className="h-4 w-4" />
                                  Critical Concerns ({criticalConcerns.length})
                                </h4>
                                <ul className="text-sm space-y-1">
                                  {criticalConcerns.slice(0, 3).map((c: any, i: number) => (
                                    <li key={i} className="text-muted-foreground">• {c.assessment}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Positive Findings */}
                            {positiveFindings.length > 0 && (
                              <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20">
                                <h4 className="font-semibold text-sm text-emerald-700 dark:text-emerald-400 mb-2 flex items-center gap-2">
                                  <CheckCircle className="h-4 w-4" />
                                  Positive Findings ({positiveFindings.length})
                                </h4>
                                <ul className="text-sm space-y-1">
                                  {positiveFindings.slice(0, 3).map((p: any, i: number) => (
                                    <li key={i} className="text-muted-foreground">• {p.assessment}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {analysis.length === 0 && (
                              <p className="text-sm text-muted-foreground">No analysis available yet. Run assessment to generate insights.</p>
                            )}
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>

                  {/* Gaps in Submission */}
                  <Card className="border-amber-500/20 bg-amber-50/30 dark:bg-amber-950/10">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <AlertCircle className="h-5 w-5 text-amber-600" />
                        Gaps in Submission
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {(() => {
                        const unansweredQuestions = claimQuestions.filter(q => !q.answer || q.answer.trim() === '');
                        const vagueAnswers = assessment?.follow_up_analysis?.filter((a: any) => 
                          a.credibility === 'questionable' || a.assessment?.toLowerCase().includes('vague') || a.assessment?.toLowerCase().includes('unclear')
                        ) || [];
                        const missingInfo = assessment?.missing_information || [];

                        const hasGaps = unansweredQuestions.length > 0 || vagueAnswers.length > 0 || missingInfo.length > 0;

                        return (
                          <div className="space-y-4">
                            {!hasGaps ? (
                              <div className="flex items-center gap-2 text-emerald-600">
                                <CheckCircle className="h-4 w-4" />
                                <span className="text-sm font-medium">All required information provided</span>
                              </div>
                            ) : (
                              <>
                                {unansweredQuestions.length > 0 && (
                                  <div>
                                    <h4 className="font-semibold text-sm text-amber-700 dark:text-amber-400 mb-2">
                                      Unanswered Questions ({unansweredQuestions.length})
                                    </h4>
                                    <ul className="text-sm space-y-1">
                                      {unansweredQuestions.map((q: any, i: number) => (
                                        <li key={i} className="text-muted-foreground flex items-start gap-2">
                                          <span className="text-amber-500">○</span>
                                          <span>{q.question}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {vagueAnswers.length > 0 && (
                                  <div>
                                    <h4 className="font-semibold text-sm text-amber-700 dark:text-amber-400 mb-2">
                                      Incomplete/Vague Responses ({vagueAnswers.length})
                                    </h4>
                                    <ul className="text-sm space-y-1">
                                      {vagueAnswers.map((a: any, i: number) => (
                                        <li key={i} className="text-muted-foreground flex items-start gap-2">
                                          <span className="text-amber-500">○</span>
                                          <span>{a.question}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {missingInfo.length > 0 && (
                                  <div>
                                    <h4 className="font-semibold text-sm text-amber-700 dark:text-amber-400 mb-2">
                                      Additional Information Needed
                                    </h4>
                                    <ul className="text-sm space-y-1">
                                      {missingInfo.map((info: string, i: number) => (
                                        <li key={i} className="text-muted-foreground flex items-start gap-2">
                                          <span className="text-amber-500">○</span>
                                          <span>{info}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>

                  {/* Detailed Q&A (Collapsible) */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Detailed Q&A Review
                      </CardTitle>
                      <CardDescription>
                        {claimQuestions.length} question(s) asked during claim intake
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {claimQuestions.filter(q => q.question_type !== 'additional_images').length === 0 ? (
                        <p className="text-muted-foreground text-sm">No follow-up questions recorded</p>
                      ) : (
                        <div className="space-y-4">
                          {claimQuestions.filter(q => q.question_type !== 'additional_images').map((q, idx) => {
                            // Find matching analysis from AI assessment by question text only
                            const qaAnalysis = assessment?.follow_up_analysis?.find(
                              (a: any) => a.question === q.question
                            );
                            
                            const getCredibilityBadge = (credibility: string) => {
                              switch (credibility) {
                                case 'credible': return { color: 'bg-emerald-500', label: 'Credible' };
                                case 'questionable': return { color: 'bg-amber-500', label: 'Questionable' };
                                case 'suspicious': return { color: 'bg-orange-500', label: 'Suspicious' };
                                case 'evasive': return { color: 'bg-red-500', label: 'Evasive' };
                                default: return { color: 'bg-gray-500', label: credibility || 'Unknown' };
                              }
                            };
                            
                            const getImpactBadge = (impact: string) => {
                              switch (impact) {
                                case 'positive': return { color: 'bg-emerald-500', label: 'Positive Impact' };
                                case 'neutral': return { color: 'bg-gray-500', label: 'Neutral' };
                                case 'negative': return { color: 'bg-orange-500', label: 'Negative Impact' };
                                case 'critical_concern': return { color: 'bg-red-600', label: 'Critical Concern' };
                                default: return { color: 'bg-gray-500', label: impact || 'Unknown' };
                              }
                            };
                            
                            return (
                              <div key={q.id} className={`p-4 rounded-lg border space-y-3 ${
                                qaAnalysis?.impact_on_claim === 'critical_concern' 
                                  ? 'border-destructive/50 bg-destructive/5'
                                  : qaAnalysis?.credibility === 'suspicious' || qaAnalysis?.credibility === 'evasive'
                                    ? 'border-orange-500/50 bg-orange-50/50 dark:bg-orange-950/20'
                                    : 'bg-card'
                              }`}>
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Badge variant="outline" className="text-xs">
                                        {q.question_type || 'general'}
                                      </Badge>
                                      {q.is_required && (
                                        <Badge variant="destructive" className="text-xs">Required</Badge>
                                      )}
                                    </div>
                                    <p className="font-medium text-sm">{q.question}</p>
                                  </div>
                                </div>
                                
                                <div className="pt-2 border-t">
                                  {q.answer ? (
                                    <div>
                                      <p className="text-xs text-muted-foreground mb-1">Claimant's Answer:</p>
                                      <p className="text-sm bg-muted/50 p-2 rounded">{q.answer}</p>
                                      {q.answered_at && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                          Answered: {new Date(q.answered_at).toLocaleString()}
                                        </p>
                                      )}
                                    </div>
                                  ) : (
                                    <p className="text-sm text-amber-600 italic">Not answered yet</p>
                                  )}
                                </div>
                                
                                {/* AI Analysis of this answer */}
                                {qaAnalysis && (
                                  <div className="pt-3 border-t mt-3 space-y-2">
                                    <div className="flex items-center gap-2">
                                      <Shield className="h-4 w-4 text-primary" />
                                      <span className="text-xs font-semibold text-primary">AI Assessment</span>
                                      {qaAnalysis.credibility && (
                                        <Badge className={`${getCredibilityBadge(qaAnalysis.credibility).color} text-white text-xs`}>
                                          {getCredibilityBadge(qaAnalysis.credibility).label}
                                        </Badge>
                                      )}
                                      {qaAnalysis.impact_on_claim && (
                                        <Badge className={`${getImpactBadge(qaAnalysis.impact_on_claim).color} text-white text-xs`}>
                                          {getImpactBadge(qaAnalysis.impact_on_claim).label}
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-sm text-muted-foreground bg-primary/5 p-2 rounded">
                                      {qaAnalysis.assessment}
                                    </p>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="assessment">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      AI Assessment Results
                    </CardTitle>
                    <CardDescription>
                      Confidence Score: {selectedClaim.confidence_score ? `${Math.round(selectedClaim.confidence_score * 100)}%` : 'N/A'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Key Decision Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 rounded-lg border bg-card">
                        <p className="text-sm text-muted-foreground mb-1">Routing Decision</p>
                        <Badge className={`${routing.color} text-white`}>{routing.label}</Badge>
                      </div>
                      <div className="p-4 rounded-lg border bg-card">
                        <p className="text-sm text-muted-foreground mb-1">Estimated Cost</p>
                        <p className="font-bold text-lg text-primary">
                          {assessment?.damage_assessment?.estimated_cost_range || 'Pending'}
                        </p>
                      </div>
                      <div className="p-4 rounded-lg border bg-card">
                        <p className="text-sm text-muted-foreground mb-1">Estimated Timeline</p>
                        <p className="font-semibold">
                          {assessment?.recommendations?.estimated_timeline || 'TBD'}
                        </p>
                      </div>
                    </div>

                    {/* Reasoning */}
                    {assessment?.reasoning && (
                      <div className="p-4 rounded-lg border bg-muted/30">
                        <h4 className="font-semibold mb-2">Assessment Reasoning</h4>
                        <p className="text-sm text-muted-foreground">{assessment.reasoning}</p>
                      </div>
                    )}

                    {/* Vehicle Match Analysis */}
                    {assessment?.vehicle_match_analysis && (
                      <div className={`p-4 rounded-lg border ${
                        assessment.vehicle_match_analysis.match_confidence < 0.7 
                          ? 'border-destructive/50 bg-destructive/5' 
                          : 'bg-card'
                      }`}>
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                          <Car className="h-4 w-4" />
                          Vehicle Match Analysis
                          {assessment.vehicle_match_analysis.match_confidence < 0.7 && (
                            <Badge variant="destructive" className="ml-2">Mismatch Detected</Badge>
                          )}
                        </h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Claimed Vehicle</p>
                            <p className="font-medium">{assessment.vehicle_match_analysis.claimed_vehicle}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Observed in Photos</p>
                            <p className="font-medium">{assessment.vehicle_match_analysis.observed_vehicle}</p>
                          </div>
                        </div>
                        <div className="mt-3">
                          <p className="text-muted-foreground text-sm">Match Confidence</p>
                          <Badge variant={assessment.vehicle_match_analysis.match_confidence >= 0.7 ? 'default' : 'destructive'}>
                            {Math.round(assessment.vehicle_match_analysis.match_confidence * 100)}%
                          </Badge>
                        </div>
                        {assessment.vehicle_match_analysis.discrepancies?.length > 0 && (
                          <div className="mt-3">
                            <p className="text-muted-foreground text-sm mb-1">Discrepancies Found:</p>
                            <ul className="text-sm space-y-1 text-destructive">
                              {assessment.vehicle_match_analysis.discrepancies.map((d: string, i: number) => (
                                <li key={i} className="flex items-start gap-2">
                                  <span className="mt-1.5">•</span>
                                  <span>{d}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Damage Assessment */}
                    {assessment?.damage_assessment && (
                      <div className="space-y-4">
                        <h4 className="font-semibold">Damage Assessment</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          {assessment.damage_assessment.damage_types?.length > 0 && (
                            <div>
                              <p className="text-sm text-muted-foreground mb-2">Damage Types</p>
                              <div className="flex flex-wrap gap-1">
                                {assessment.damage_assessment.damage_types.map((t: string, i: number) => (
                                  <Badge key={i} variant="outline" className="text-xs">{t}</Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          {assessment.damage_assessment.affected_areas?.length > 0 && (
                            <div>
                              <p className="text-sm text-muted-foreground mb-2">Affected Areas</p>
                              <div className="flex flex-wrap gap-1">
                                {assessment.damage_assessment.affected_areas.map((a: string, i: number) => (
                                  <Badge key={i} variant="secondary" className="text-xs">{a}</Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          <div>
                            <p className="text-sm text-muted-foreground">Estimated Cost</p>
                            <p className="font-semibold text-primary">{assessment.damage_assessment.estimated_cost_range || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Repair Complexity</p>
                            <Badge variant="outline">{assessment.damage_assessment.repair_complexity || 'N/A'}</Badge>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Drivable</p>
                            <Badge variant={assessment.damage_assessment.is_drivable ? 'default' : 'destructive'}>
                              {assessment.damage_assessment.is_drivable ? 'Yes' : 'No'}
                            </Badge>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Total Loss Risk</p>
                            <Badge variant="outline">{assessment.damage_assessment.total_loss_risk || 'N/A'}</Badge>
                          </div>
                        </div>

                        {assessment.damage_assessment.safety_concerns?.length > 0 && (
                          <div>
                            <p className="text-sm text-muted-foreground mb-2">Safety Concerns</p>
                            <ul className="text-sm space-y-1">
                              {assessment.damage_assessment.safety_concerns.map((c: string, i: number) => (
                                <li key={i} className="text-destructive flex items-start gap-2">
                                  <span className="mt-1.5">•</span>
                                  <span>{c}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Visible Damage Analysis */}
                    {assessment?.visible_damage_analysis && (
                      <div className="space-y-3">
                        <h4 className="font-semibold">Initial Visual Analysis</h4>
                        <p className="text-sm bg-muted/50 p-3 rounded-lg">
                          {assessment.visible_damage_analysis.preliminary_notes}
                        </p>
                      </div>
                    )}

                    {/* Next Steps & Recommendations */}
                    {assessment?.recommendations && (
                      <div className="p-4 rounded-lg border-2 border-primary/20 bg-primary/5 space-y-4">
                        <h4 className="font-semibold text-lg flex items-center gap-2">
                          <CheckCircle className="h-5 w-5 text-primary" />
                          Next Steps & Recommendations
                        </h4>
                        
                        {assessment.recommendations.immediate_actions?.length > 0 && (
                          <div>
                            <p className="text-sm font-medium mb-2">Immediate Actions Required:</p>
                            <ul className="space-y-2">
                              {assessment.recommendations.immediate_actions.map((a: string, i: number) => (
                                <li key={i} className="text-sm flex items-start gap-2 p-2 bg-background rounded">
                                  <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                                  {a}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {assessment.recommendations.required_documentation?.length > 0 && (
                          <div>
                            <p className="text-sm font-medium mb-2">Required Documentation:</p>
                            <ul className="space-y-1">
                              {assessment.recommendations.required_documentation.map((doc: string, i: number) => (
                                <li key={i} className="text-sm flex items-start gap-2">
                                  <FileText className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                                  {doc}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                          <div>
                            <p className="text-sm text-muted-foreground">Estimated Timeline</p>
                            <p className="font-semibold">{assessment.recommendations.estimated_timeline || 'TBD'}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Estimated Cost Range</p>
                            <p className="font-semibold text-primary">{assessment?.damage_assessment?.estimated_cost_range || 'Pending'}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="files">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ImageIcon className="h-5 w-5" />
                      Uploaded Files
                    </CardTitle>
                    <CardDescription>
                      {claimFiles.length} file(s) uploaded
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {claimFiles.length === 0 ? (
                      <p className="text-muted-foreground text-sm">No files uploaded</p>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {claimFiles.map((file) => (
                          <a
                            key={file.id}
                            href={file.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group relative aspect-square rounded-lg overflow-hidden border hover:border-primary transition-colors"
                          >
                            {file.file_type?.startsWith('image/') ? (
                              <img
                                src={file.file_url}
                                alt={file.file_name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-muted">
                                <FileText className="h-8 w-8 text-muted-foreground" />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Eye className="h-6 w-6 text-white" />
                            </div>
                            <p className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs p-1 truncate">
                              {file.file_name}
                            </p>
                          </a>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link to="/" className="text-sm text-muted-foreground hover:text-primary mb-2 inline-block">
              ← Back to Claim Form
            </Link>
            <h1 className="text-3xl font-bold">Insurer Dashboard</h1>
            <p className="text-muted-foreground">Review and manage submitted claims</p>
          </div>
          <Button onClick={fetchClaims} variant="outline" disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : claims.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Claims Yet</h3>
              <p className="text-muted-foreground">Claims will appear here once submitted.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {claims.map((claim) => {
              const routing = getRoutingBadge(claim.routing_decision);
              const severity = getSeverityBadge(claim.severity_level);
              const hasFraudFlags = claim.ai_assessment?.fraud_indicators?.has_red_flags ||
                claim.ai_assessment?.image_authenticity?.appears_authentic === false;

              return (
                <Card
                  key={claim.id}
                  className={`cursor-pointer hover:border-primary transition-colors ${hasFraudFlags ? 'border-destructive/50' : ''}`}
                  onClick={() => handleViewClaim(claim)}
                >
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="font-semibold">{claim.claim_number}</p>
                          <p className="text-sm text-muted-foreground">
                            {claim.vehicle_year} {claim.vehicle_make} {claim.vehicle_model}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {/* Show consolidated fraud badge OR legitimacy badge - not both */}
                        {hasFraudFlags ? (
                          <Badge variant="destructive" className="flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Fraud Investigation
                          </Badge>
                        ) : (
                          <>
                            {/* Only show severity if not fraud-related */}
                            <Badge className={`${severity.color} text-white`}>{severity.label}</Badge>
                            <Badge className={`${routing.color} text-white`}>{routing.label}</Badge>
                          </>
                        )}
                        <Badge variant="outline" className={getStatusColor(claim.status)}>
                          {claim.status}
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-6 text-sm text-muted-foreground">
                      <span className="capitalize">{claim.incident_type?.replace('_', ' ')}</span>
                      <span>{new Date(claim.incident_date).toLocaleDateString()}</span>
                      <span>{claim.location}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}