import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  RefreshCw
} from "lucide-react";
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
  const [isLoading, setIsLoading] = useState(true);

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

  const handleViewClaim = (claim: Claim) => {
    setSelectedClaim(claim);
    fetchClaimFiles(claim.id);
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
                        <ul className="list-disc list-inside text-sm space-y-1">
                          {assessment.image_authenticity.concerns.map((c: string, i: number) => (
                            <li key={i}>{c}</li>
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
                        <ul className="list-disc list-inside text-sm space-y-1">
                          {assessment.fraud_indicators.concerns.map((c: string, i: number) => (
                            <li key={i}>{c}</li>
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
                  {assessment?.metadata_flags && (
                    <div className="space-y-2">
                      <h4 className="font-semibold">Metadata Analysis</h4>
                      <ul className="list-disc list-inside text-sm space-y-1">
                        {assessment.metadata_flags.map((flag: string, i: number) => (
                          <li key={i}>{flag}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="details">Claim Details</TabsTrigger>
                <TabsTrigger value="vehicle">Vehicle & Policy</TabsTrigger>
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
                    {/* Routing Decision */}
                    <div className="p-4 rounded-lg border bg-card">
                      <h4 className="font-semibold mb-2">Routing Decision</h4>
                      <Badge className={`${routing.color} text-white`}>{routing.label}</Badge>
                      {assessment?.reasoning && (
                        <p className="text-sm mt-3 text-muted-foreground">{assessment.reasoning}</p>
                      )}
                    </div>

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
                            <ul className="list-disc list-inside text-sm space-y-1">
                              {assessment.damage_assessment.safety_concerns.map((c: string, i: number) => (
                                <li key={i} className="text-destructive">{c}</li>
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

                    {/* Recommendations */}
                    {assessment?.recommendations && (
                      <div className="space-y-3">
                        <h4 className="font-semibold">Recommendations</h4>
                        {assessment.recommendations.immediate_actions?.length > 0 && (
                          <div>
                            <p className="text-sm text-muted-foreground mb-2">Immediate Actions</p>
                            <ul className="space-y-1">
                              {assessment.recommendations.immediate_actions.map((a: string, i: number) => (
                                <li key={i} className="text-sm flex items-start gap-2">
                                  <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                                  {a}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {assessment.recommendations.estimated_timeline && (
                          <div>
                            <p className="text-sm text-muted-foreground">Estimated Timeline</p>
                            <p className="text-sm">{assessment.recommendations.estimated_timeline}</p>
                          </div>
                        )}
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
                        {hasFraudFlags && (
                          <Badge variant="destructive" className="flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Fraud Flag
                          </Badge>
                        )}
                        <Badge className={`${severity.color} text-white`}>{severity.label}</Badge>
                        <Badge className={`${routing.color} text-white`}>{routing.label}</Badge>
                        <Badge variant="outline" className={getStatusColor(claim.status)}>
                          {claim.status}
                        </Badge>
                        {(() => {
                          const legitimacy = getLegitimacyBadge(claim.ai_assessment);
                          if (legitimacy) {
                            return (
                              <Badge className={`${legitimacy.color} text-white`}>
                                {legitimacy.label}
                              </Badge>
                            );
                          }
                        })()}
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