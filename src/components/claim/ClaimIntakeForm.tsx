import { useState } from "react";
import { Upload, Loader2, CheckCircle, AlertCircle, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ClaimFollowUp } from "./ClaimFollowUp";

export const ClaimIntakeForm = () => {
  const { toast } = useToast();
  const [isValidating, setIsValidating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [policyStatus, setPolicyStatus] = useState<'active' | 'lapsed' | 'invalid' | null>(null);
  const [assessment, setAssessment] = useState<any>(null);
  const [claimNumber, setClaimNumber] = useState<string>("");
  const [claimId, setClaimId] = useState<string>("");

  const [formData, setFormData] = useState({
    policy_number: "",
    incident_type: "",
    incident_date: "",
    description: "",
    location: "",
    // Vehicle details
    vehicle_make: "",
    vehicle_model: "",
    vehicle_year: "",
    vehicle_vin: "",
    vehicle_license_plate: "",
    vehicle_ownership_status: "",
    vehicle_odometer: "",
    vehicle_purchase_date: "",
  });

  const [damageFiles, setDamageFiles] = useState<File[]>([]);
  const [policyDocument, setPolicyDocument] = useState<File | null>(null);

  const validatePolicy = async () => {
    if (!formData.policy_number) {
      toast({
        title: "Policy Number Required",
        description: "Please enter a policy number to validate",
        variant: "destructive",
      });
      return;
    }

    setIsValidating(true);
    try {
      const { data, error } = await supabase.functions.invoke('validate-policy', {
        body: { policyNumber: formData.policy_number }
      });

      if (error) throw error;

      if (data.valid && data.status === 'active') {
        setPolicyStatus('active');
        toast({
          title: "Policy Validated",
          description: "Your policy is active and ready to file a claim.",
        });
      } else if (data.status === 'lapsed') {
        setPolicyStatus('lapsed');
        toast({
          title: "Policy Lapsed",
          description: "This policy is no longer active. Please contact support.",
          variant: "destructive",
        });
      } else {
        setPolicyStatus('invalid');
        toast({
          title: "Invalid Policy",
          description: data.message || "Policy number not found.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Policy validation error:', error);
      toast({
        title: "Validation Error",
        description: "Could not validate policy. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleDamageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setDamageFiles(prev => [...prev, ...newFiles]);
    }
  };

  const handlePolicyDocumentChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPolicyDocument(file);

      // Auto-upload and extract details
      try {
        toast({
          title: "Processing Policy",
          description: "Extracting vehicle details from your policy...",
        });

        const fileName = `policy-${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('claim-files')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data, error } = await supabase.functions.invoke('extract-policy-details', {
          body: { storagePath: fileName }
        });

        if (error) throw error;

        if (data?.extractedData) {
          const extracted = data.extractedData;
          setFormData(prev => ({
            ...prev,
            policy_number: extracted.policy_number || prev.policy_number,
            vehicle_make: extracted.vehicle_make || prev.vehicle_make,
            vehicle_model: extracted.vehicle_model || prev.vehicle_model,
            vehicle_year: extracted.vehicle_year?.toString() || prev.vehicle_year,
            vehicle_vin: extracted.vehicle_vin || prev.vehicle_vin,
            vehicle_license_plate: extracted.vehicle_license_plate || prev.vehicle_license_plate,
            vehicle_ownership_status: extracted.vehicle_ownership_status || prev.vehicle_ownership_status,
          }));

          if (extracted.policy_status === 'active') {
            setPolicyStatus('active');
          }

          toast({
            title: "Details Extracted",
            description: "We've pre-filled the vehicle details from your policy. Please review them.",
          });
        }
      } catch (error) {
        console.error('Extraction error:', error);
        toast({
          title: "Extraction Failed",
          description: "Could not extract details. Please enter them manually.",
          variant: "destructive",
        });
      }
    }
  };

  const removeDamageFile = (index: number) => {
    setDamageFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (policyStatus !== 'active') {
      toast({
        title: "Cannot Submit",
        description: "Please validate an active policy before submitting.",
        variant: "destructive",
      });
      return;
    }

    if (damageFiles.length === 0) {
      toast({
        title: "Photos Required",
        description: "Please upload at least one photo of the vehicle damage.",
        variant: "destructive",
      });
      return;
    }

    if (!policyDocument) {
      toast({
        title: "Policy Document Required",
        description: "Please upload your insurance policy document.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Upload damage photos
      const fileUrls: string[] = [];
      for (const file of damageFiles) {
        const fileName = `${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('claim-files')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('claim-files')
          .getPublicUrl(fileName);

        fileUrls.push(publicUrl);
      }

      // Upload policy document
      let policyDocumentUrl = "";
      const policyFileName = `policy-${Date.now()}-${policyDocument.name}`;
      const { error: policyUploadError } = await supabase.storage
        .from('claim-files')
        .upload(policyFileName, policyDocument);

      if (policyUploadError) throw policyUploadError;

      const { data: { publicUrl: policyUrl } } = supabase.storage
        .from('claim-files')
        .getPublicUrl(policyFileName);
      policyDocumentUrl = policyUrl;

      // Create claim record with vehicle details
      const { data: claim, error: claimError } = await supabase
        .from('claims')
        .insert({
          policy_number: formData.policy_number,
          incident_type: formData.incident_type,
          incident_date: formData.incident_date,
          description: formData.description,
          location: formData.location,
          policy_status: policyStatus,
          vehicle_make: formData.vehicle_make,
          vehicle_model: formData.vehicle_model,
          vehicle_year: formData.vehicle_year ? parseInt(formData.vehicle_year) : null,
          vehicle_vin: formData.vehicle_vin,
          vehicle_license_plate: formData.vehicle_license_plate,
          vehicle_ownership_status: formData.vehicle_ownership_status,
          vehicle_odometer: formData.vehicle_odometer ? parseInt(formData.vehicle_odometer) : null,
          vehicle_purchase_date: formData.vehicle_purchase_date || null,
          policy_document_url: policyDocumentUrl,
        })
        .select()
        .single();

      if (claimError) throw claimError;

      // Save damage file records
      if (fileUrls.length > 0) {
        const fileRecords = damageFiles.map((file, index) => ({
          claim_id: claim.id,
          file_name: file.name,
          file_type: file.type,
          file_url: fileUrls[index],
          file_size: file.size,
        }));

        const { error: filesError } = await supabase
          .from('claim_files')
          .insert(fileRecords);

        if (filesError) throw filesError;
      }

      // Save policy document record
      await supabase.from('claim_files').insert({
        claim_id: claim.id,
        file_name: policyDocument.name,
        file_type: policyDocument.type,
        file_url: policyDocumentUrl,
        file_size: policyDocument.size,
      });

      // Trigger AI assessment
      toast({
        title: "Analyzing...",
        description: "Our AI is analyzing your claim details and photos...",
      });

      const { data: assessmentData, error: assessmentError } = await supabase.functions.invoke('assess-claim', {
        body: {
          claimData: {
            ...formData,
            claim_id: claim.id,
            vehicle_year: formData.vehicle_year ? parseInt(formData.vehicle_year) : null,
            vehicle_odometer: formData.vehicle_odometer ? parseInt(formData.vehicle_odometer) : null,
          },
          imageUrls: fileUrls,
        }
      });

      if (assessmentError) throw assessmentError;

      // Update claim with initial assessment (stored but not shown to user)
      if (assessmentData?.assessment) {
        await supabase
          .from('claims')
          .update({
            severity_level: assessmentData.assessment.initial_severity,
            confidence_score: assessmentData.assessment.confidence_score,
            ai_assessment: assessmentData.assessment,
          })
          .eq('id', claim.id);

        // Save follow-up questions
        if (assessmentData.assessment.follow_up_questions) {
          const questions = assessmentData.assessment.follow_up_questions.map((q: any) => ({
            claim_id: claim.id,
            question: q.question,
            question_type: q.question_type,
            is_required: q.is_required,
          }));

          await supabase.from('claim_questions').insert(questions);
        }
      }

      toast({
        title: "Information Received",
        description: "Please answer a few follow-up questions to complete your claim.",
      });

      setAssessment(assessmentData.assessment);
      setClaimNumber(claim.claim_number);
      setClaimId(claim.id);
    } catch (error) {
      console.error('Submission error:', error);
      toast({
        title: "Submission Failed",
        description: "Could not submit claim. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setAssessment(null);
    setClaimNumber("");
    setClaimId("");
    setFormData({
      policy_number: "",
      incident_type: "",
      incident_date: "",
      description: "",
      location: "",
      vehicle_make: "",
      vehicle_model: "",
      vehicle_year: "",
      vehicle_vin: "",
      vehicle_license_plate: "",
      vehicle_ownership_status: "",
      vehicle_odometer: "",
      vehicle_purchase_date: "",
    });
    setDamageFiles([]);
    setPolicyDocument(null);
    setPolicyStatus(null);
  };

  if (assessment) {
    return (
      <ClaimFollowUp
        assessment={assessment}
        claimNumber={claimNumber}
        claimId={claimId}
        claimData={formData}
        onReset={handleReset}
      />
    );
  }

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle>File a New Auto Insurance Claim</CardTitle>
        <CardDescription>
          Provide your policy information, vehicle details, and damage photos. We'll guide you through the claims process.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Policy Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Policy Information</h3>

            <div className="space-y-2">
              <Label htmlFor="policy_number">Policy Number *</Label>
              <div className="flex gap-2">
                <Input
                  id="policy_number"
                  placeholder="POL-123456"
                  value={formData.policy_number}
                  onChange={(e) => setFormData({ ...formData, policy_number: e.target.value })}
                  disabled={policyStatus === 'active'}
                  required
                />
                <Button
                  type="button"
                  onClick={validatePolicy}
                  disabled={isValidating || policyStatus === 'active'}
                  variant={policyStatus === 'active' ? 'default' : 'outline'}
                  className="min-w-[120px]"
                >
                  {isValidating ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Checking</>
                  ) : policyStatus === 'active' ? (
                    <><CheckCircle className="mr-2 h-4 w-4" /> Validated</>
                  ) : policyStatus === 'lapsed' ? (
                    <><AlertCircle className="mr-2 h-4 w-4" /> Lapsed</>
                  ) : policyStatus === 'invalid' ? (
                    <><AlertCircle className="mr-2 h-4 w-4" /> Invalid</>
                  ) : (
                    'Validate'
                  )}
                </Button>
              </div>
              {policyStatus === 'active' && (
                <p className="text-sm text-emerald-600">✓ Policy is active and eligible for claims</p>
              )}
              {!policyStatus && (
                <p className="text-xs text-muted-foreground mt-1">Tip: Use <code className="bg-muted px-1 rounded">POL-123456</code> for testing.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="policy_document">Insurance Policy Document *</Label>
              <div className="border-2 border-dashed border-border rounded-lg p-4 hover:border-accent transition-colors">
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handlePolicyDocumentChange}
                  className="hidden"
                  id="policy-upload"
                />
                <label htmlFor="policy-upload" className="cursor-pointer flex items-center gap-3">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">
                      {policyDocument ? policyDocument.name : "Upload your policy document"}
                    </p>
                    <p className="text-xs text-muted-foreground">PDF, JPG, or PNG</p>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Vehicle Details Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Vehicle Details</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vehicle_make">Make *</Label>
                <Input
                  id="vehicle_make"
                  placeholder="e.g., Toyota"
                  value={formData.vehicle_make}
                  onChange={(e) => setFormData({ ...formData, vehicle_make: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vehicle_model">Model *</Label>
                <Input
                  id="vehicle_model"
                  placeholder="e.g., Camry"
                  value={formData.vehicle_model}
                  onChange={(e) => setFormData({ ...formData, vehicle_model: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vehicle_year">Year *</Label>
                <Input
                  id="vehicle_year"
                  type="number"
                  placeholder="e.g., 2022"
                  min="1900"
                  max={new Date().getFullYear() + 1}
                  value={formData.vehicle_year}
                  onChange={(e) => setFormData({ ...formData, vehicle_year: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vehicle_vin">VIN *</Label>
                <Input
                  id="vehicle_vin"
                  placeholder="17-character VIN"
                  maxLength={17}
                  value={formData.vehicle_vin}
                  onChange={(e) => setFormData({ ...formData, vehicle_vin: e.target.value.toUpperCase() })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vehicle_license_plate">License Plate *</Label>
                <Input
                  id="vehicle_license_plate"
                  placeholder="e.g., ABC1234"
                  value={formData.vehicle_license_plate}
                  onChange={(e) => setFormData({ ...formData, vehicle_license_plate: e.target.value.toUpperCase() })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vehicle_ownership_status">Ownership Status *</Label>
                <Select
                  value={formData.vehicle_ownership_status}
                  onValueChange={(value) => setFormData({ ...formData, vehicle_ownership_status: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select ownership status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owned">Owned (Paid Off)</SelectItem>
                    <SelectItem value="financed">Financed</SelectItem>
                    <SelectItem value="leased">Leased</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="vehicle_odometer">Odometer Reading (miles) *</Label>
                <Input
                  id="vehicle_odometer"
                  type="number"
                  placeholder="e.g., 45000"
                  value={formData.vehicle_odometer}
                  onChange={(e) => setFormData({ ...formData, vehicle_odometer: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vehicle_purchase_date">Purchase Date</Label>
                <Input
                  id="vehicle_purchase_date"
                  type="date"
                  value={formData.vehicle_purchase_date}
                  onChange={(e) => setFormData({ ...formData, vehicle_purchase_date: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Incident Details Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Incident Details</h3>

            <div className="space-y-2">
              <Label htmlFor="incident_type">Incident Type *</Label>
              <Select
                value={formData.incident_type}
                onValueChange={(value) => setFormData({ ...formData, incident_type: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select incident type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="collision">Collision</SelectItem>
                  <SelectItem value="hit_and_run">Hit and Run</SelectItem>
                  <SelectItem value="theft">Vehicle Theft</SelectItem>
                  <SelectItem value="vandalism">Vandalism</SelectItem>
                  <SelectItem value="weather">Weather/Hail Damage</SelectItem>
                  <SelectItem value="glass">Glass Damage</SelectItem>
                  <SelectItem value="animal">Animal Collision</SelectItem>
                  <SelectItem value="fire">Fire</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="incident_date">Incident Date & Time *</Label>
                <Input
                  id="incident_date"
                  type="datetime-local"
                  value={formData.incident_date}
                  onChange={(e) => setFormData({ ...formData, incident_date: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location *</Label>
                <Input
                  id="location"
                  placeholder="City, State or Address"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description of Incident *</Label>
              <Textarea
                id="description"
                placeholder="Describe what happened in detail (what occurred, other vehicles involved, any injuries, weather conditions, etc.)..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                required
              />
            </div>
          </div>

          {/* Damage Photos Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Vehicle Damage Photos</h3>

            <div className="space-y-2">
              <Label>Upload Photos of All Visible Damage *</Label>
              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-accent transition-colors cursor-pointer">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleDamageFileChange}
                  className="hidden"
                  id="damage-upload"
                />
                <label htmlFor="damage-upload" className="cursor-pointer">
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Click to upload vehicle damage photos
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Upload clear photos of all damaged areas
                  </p>
                </label>
              </div>
              {damageFiles.length > 0 && (
                <div className="mt-4 space-y-2">
                  {damageFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-secondary rounded">
                      <span className="text-sm truncate">{file.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeDamageFile(index)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting || policyStatus !== 'active' || damageFiles.length === 0 || !policyDocument}
            size="lg"
          >
            {isSubmitting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</>
            ) : (
              'Submit Claim'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};