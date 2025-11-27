import { useState } from "react";
import { Upload, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ClaimIntakeFormProps {
  onClaimCreated: (claimId: string) => void;
}

export const ClaimIntakeForm = ({ onClaimCreated }: ClaimIntakeFormProps) => {
  const { toast } = useToast();
  const [isValidating, setIsValidating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [policyStatus, setPolicyStatus] = useState<'active' | 'lapsed' | 'invalid' | null>(null);
  
  const [formData, setFormData] = useState({
    policy_number: "",
    incident_type: "",
    incident_date: "",
    description: "",
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

      // Trigger AI assessment
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
        console.error('Assessment error:', assessmentError);
      }

      // Update claim with assessment
      if (assessmentData?.assessment) {
        await supabase
          .from('claims')
          .update({
            severity_level: assessmentData.assessment.severity_level,
            confidence_score: assessmentData.assessment.confidence_score,
            routing_decision: assessmentData.assessment.routing_decision,
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
        title: "Claim Submitted",
        description: `Claim ${claim.claim_number} has been successfully created.`,
      });

      onClaimCreated(claim.id);
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

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle>File a New Claim</CardTitle>
        <CardDescription>
          Provide your policy information and incident details. Our AI will assess and route your claim automatically.
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
              <p className="text-sm text-success">✓ Policy is active and eligible for claims</p>
            )}
            {policyStatus === 'lapsed' && (
              <p className="text-sm text-destructive">This policy has lapsed. Please renew before filing a claim.</p>
            )}
          </div>

          {/* Incident Details */}
          <div className="space-y-2">
            <Label htmlFor="incident_type">Incident Type *</Label>
            <Input
              id="incident_type"
              placeholder="e.g., Auto Accident, Water Damage, Theft"
              value={formData.incident_type}
              onChange={(e) => setFormData({ ...formData, incident_type: e.target.value })}
              required
            />
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
              placeholder="Describe what happened in detail..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              required
            />
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label>Upload Photos/Documents</Label>
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-accent transition-colors cursor-pointer">
              <input
                type="file"
                multiple
                accept="image/*,.pdf"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Click to upload or drag and drop
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Photos of damage, police reports, etc.
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
            disabled={isSubmitting || policyStatus !== 'active'}
            size="lg"
          >
            {isSubmitting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing Claim...</>
            ) : (
              'Submit Claim'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};