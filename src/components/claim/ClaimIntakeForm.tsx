import { useState } from "react";
import { Upload, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ClaimAssessment } from "./ClaimAssessment";

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
    description: "I was driving on Highway 101 near exit 15 when another vehicle suddenly changed lanes without signaling and collided with the front right side of my vehicle. The impact caused significant damage to the front bumper, right headlight, and right fender. Both vehicles pulled over to the shoulder safely. The other driver admitted fault and we exchanged insurance information. No injuries were reported, but my vehicle is not drivable due to the damage.",
    location: "",
  });

  const [files, setFiles] = useState<File[]>([]);

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
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

    if (files.length === 0) {
      toast({
        title: "Photos Required",
        description: "Please upload at least one photo of the vehicle damage for AI assessment.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Upload files to storage
      const fileUrls: string[] = [];
      for (const file of files) {
        const fileName = `${Date.now()}-${file.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('claim-files')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('claim-files')
          .getPublicUrl(fileName);

        fileUrls.push(publicUrl);
      }

      // Create claim record
      const { data: claim, error: claimError } = await supabase
        .from('claims')
        .insert({
          ...formData,
          policy_status: policyStatus,
        })
        .select()
        .single();

      if (claimError) throw claimError;

      // Save file records
      if (fileUrls.length > 0) {
        const fileRecords = files.map((file, index) => ({
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

      // Trigger initial AI assessment
      toast({
        title: "Analyzing Damage",
        description: "Our AI is analyzing the vehicle damage photos...",
      });

      const { data: assessmentData, error: assessmentError } = await supabase.functions.invoke('assess-claim', {
        body: {
          claimData: {
            ...formData,
            claim_id: claim.id,
          },
          imageUrls: fileUrls,
        }
      });

      if (assessmentError) {
        throw assessmentError;
      }

      // Update claim with initial assessment
      if (assessmentData?.assessment) {
        await supabase
          .from('claims')
          .update({
            severity_level: assessmentData.assessment.initial_severity,
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
        title: "Initial Assessment Complete",
        description: "Please answer follow-up questions to complete your claim.",
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
    });
    setFiles([]);
    setPolicyStatus(null);
  };

  if (assessment) {
    return (
      <ClaimAssessment
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
          Provide your policy information and vehicle damage photos. Our AI will analyze the damage and guide you through the claims process.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Policy Validation */}
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
            {policyStatus === 'lapsed' && (
              <p className="text-sm text-destructive">This policy has lapsed. Please renew before filing a claim.</p>
            )}
            {!policyStatus && (
              <p className="text-xs text-muted-foreground mt-1">Tip: Use <code className="bg-muted px-1 rounded">POL-123456</code> for testing.</p>
            )}
          </div>

          {/* Incident Details */}
          <div className="space-y-2">
            <Label htmlFor="incident_type">Auto Incident Type *</Label>
            <Select
              value={formData.incident_type}
              onValueChange={(value) => setFormData({ ...formData, incident_type: value })}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select auto incident type" />
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

          <div className="space-y-2">
            <Label htmlFor="incident_date">Incident Date *</Label>
            <Input
              id="incident_date"
              type="datetime-local"
              value={formData.incident_date}
              onChange={(e) => setFormData({ ...formData, incident_date: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              placeholder="City, State or Address"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              placeholder="Describe the auto incident (what happened, when, any injuries, other vehicles involved, etc.)..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              required
            />
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label>Upload Vehicle Damage Photos (Required for AI Assessment) *</Label>
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-accent transition-colors cursor-pointer">
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Click to upload vehicle damage photos
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Required: Photos of all visible damage for AI analysis
                </p>
              </label>
            </div>
            {files.length > 0 && (
              <div className="mt-4 space-y-2">
                {files.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-secondary rounded">
                    <span className="text-sm truncate">{file.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting || policyStatus !== 'active' || files.length === 0}
            size="lg"
          >
            {isSubmitting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing Damage...</>
            ) : (
              'Submit for AI Assessment'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
