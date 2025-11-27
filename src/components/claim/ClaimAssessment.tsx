import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { AlertCircle, CheckCircle, Clock, Shield, Upload, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ClaimAssessmentProps {
  assessment: any;
  claimNumber: string;
  claimId: string;
  claimData?: any;
  onReset: () => void;
}

export const ClaimAssessment = ({ assessment, claimNumber, claimId, claimData, onReset }: ClaimAssessmentProps) => {
  const [answers, setAnswers] = useState<{ [key: string]: string }>({});
  const [additionalFiles, setAdditionalFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showFinalAssessment, setShowFinalAssessment] = useState(false);
  const [finalAssessment, setFinalAssessment] = useState<any>(null);

  const isInitialAssessment = !assessment.routing_decision;

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAdditionalFiles(Array.from(e.target.files));
    }
  };

  const handleSubmitFollowUp = async () => {
    setIsSubmitting(true);
    try {
      // Upload additional images if any
      let additionalImageUrls: string[] = [];

      if (additionalFiles.length > 0) {
        toast.info("Uploading additional images...");

        for (const file of additionalFiles) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${claimNumber}-additional-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from('claim-files')
            .upload(fileName, file);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('claim-files')
            .getPublicUrl(fileName);

          additionalImageUrls.push(publicUrl);

          // Save to claim_files table
          await supabase.from('claim_files').insert({
            claim_id: claimId,
            file_name: file.name,
            file_type: file.type,
            file_url: publicUrl,
            file_size: file.size,
          });
        }
      }

      // Prepare questions with answers
      const questionsWithAnswers = assessment.follow_up_questions.map((q: any, idx: number) => ({
        question: q.question,
        answer: answers[idx] || '',
        question_type: q.question_type,
        is_required: q.is_required
      }));

      // Call finalize-assessment edge function
      toast.info("Generating final assessment...");

      const { data, error } = await supabase.functions.invoke('finalize-assessment', {
        body: {
          claimData,
          initialAssessment: assessment,
          followUpAnswers: questionsWithAnswers,
          additionalImageUrls
        }
      });

      if (error) throw error;

      // Update claim in database with final assessment
      await supabase
        .from('claims')
        .update({
          severity_level: data.assessment.severity_level,
          confidence_score: data.assessment.confidence_score,
          routing_decision: data.assessment.routing_decision,
          ai_assessment: data.assessment,
          status: 'assessed'
        })
        .eq('id', claimId);

      setFinalAssessment(data.assessment);
      setShowFinalAssessment(true);

      toast.success("Final assessment complete!");
    } catch (error) {
      console.error('Error submitting follow-up:', error);
      toast.error("Failed to complete assessment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const allRequiredAnswered = assessment.follow_up_questions
    ?.every((q: any, idx: number) => {
      if (!q.is_required) return true;
      if (q.question_type === 'additional_images') {
        return additionalFiles.length > 0;
      }
      return answers[idx] && answers[idx].trim().length > 0;
    });

  const displayAssessment = showFinalAssessment ? finalAssessment : assessment;
  const severityLevel = displayAssessment.severity_level || displayAssessment.initial_severity;

  const severityConfig = {
    low: { color: "bg-emerald-500", icon: CheckCircle, label: "Low Risk" },
    medium: { color: "bg-amber-500", icon: Clock, label: "Moderate Risk" },
    high: { color: "bg-orange-500", icon: AlertCircle, label: "High Risk" },
    critical: { color: "bg-red-500", icon: AlertCircle, label: "Critical" },
  };

  const config = severityConfig[severityLevel as keyof typeof severityConfig] || severityConfig.medium;

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={onReset}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        File Another Claim
      </Button>

      {isInitialAssessment && !showFinalAssessment ? (
        <>
          <Card className="border-border/50 bg-gradient-to-br from-card to-card/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <config.icon className="h-5 w-5" />
                Initial Damage Analysis
              </CardTitle>
              <CardDescription>
                Based on uploaded vehicle photos - Claim #{claimNumber}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge className={`${config.color} text-white`}>
                  {config.label}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Preliminary Severity
                </span>
              </div>

              {displayAssessment.visible_damage_analysis && (
                <div className="space-y-3 pt-2">
                  <div>
                    <h4 className="font-medium text-sm mb-2">Visible Damage</h4>
                    <div className="flex flex-wrap gap-2">
                      {displayAssessment.visible_damage_analysis.damage_types?.map((type: string, idx: number) => (
                        <Badge key={idx} variant="outline">{type}</Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-sm mb-2">Affected Areas</h4>
                    <div className="flex flex-wrap gap-2">
                      {displayAssessment.visible_damage_analysis.affected_areas?.map((area: string, idx: number) => (
                        <Badge key={idx} variant="secondary">{area}</Badge>
                      ))}
                    </div>
                  </div>

                  {displayAssessment.visible_damage_analysis.preliminary_notes && (
                    <div className="bg-muted/50 p-3 rounded-lg">
                      <p className="text-sm">{displayAssessment.visible_damage_analysis.preliminary_notes}</p>
                    </div>
                  )}
                </div>
              )}

              {displayAssessment.reasoning && (
                <div className="bg-primary/5 p-4 rounded-lg border border-primary/10">
                  <p className="text-sm leading-relaxed">{displayAssessment.reasoning}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-accent/30 bg-gradient-to-br from-accent/5 to-accent/10">
            <CardHeader>
              <CardTitle>Follow-Up Information Needed</CardTitle>
              <CardDescription>
                Please answer these questions to complete your claim assessment
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {displayAssessment.follow_up_questions?.map((q: any, idx: number) => (
                <div key={idx} className="space-y-2">
                  <Label htmlFor={`question-${idx}`} className="flex items-start gap-2">
                    <span className="flex-1">
                      {q.question}
                      {q.is_required && <span className="text-destructive ml-1">*</span>}
                    </span>
                  </Label>
                  {q.question_type === 'additional_images' ? (
                    <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded">
                      <p className="mb-2">{q.reasoning}</p>
                      <p className="text-xs">You can upload additional photos below</p>
                    </div>
                  ) : (
                    <>
                      <Textarea
                        id={`question-${idx}`}
                        placeholder="Your answer..."
                        rows={3}
                        value={answers[idx] || ''}
                        onChange={(e) => handleAnswerChange(idx.toString(), e.target.value)}
                        className="resize-none"
                      />
                      <p className="text-xs text-muted-foreground">{q.reasoning}</p>
                    </>
                  )}
                </div>
              ))}

              <div className="space-y-2 pt-4 border-t">
                <Label htmlFor="additional-files" className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Upload Additional Photos (Optional)
                </Label>
                <Input
                  id="additional-files"
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileChange}
                  className="cursor-pointer"
                />
                {additionalFiles.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {additionalFiles.length} file(s) selected
                  </p>
                )}
              </div>

              <Button
                onClick={handleSubmitFollowUp}
                disabled={!allRequiredAnswered || isSubmitting}
                className="w-full"
                size="lg"
              >
                {isSubmitting ? "Processing..." : "Complete Assessment"}
              </Button>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card className="border-border/50 bg-gradient-to-br from-card to-card/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <config.icon className="h-5 w-5" />
              Final Assessment Complete
            </CardTitle>
            <CardDescription>
              Claim #{claimNumber} has been analyzed and routed
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge className={`${config.color} text-white`}>
                  {config.label}
                </Badge>
              </div>
              {displayAssessment.confidence_score && (
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Confidence</p>
                  <p className="text-lg font-semibold">
                    {Math.round(displayAssessment.confidence_score * 100)}%
                  </p>
                </div>
              )}
            </div>

            {displayAssessment.damage_assessment && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    Damage Types
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {displayAssessment.damage_assessment.damage_types?.map((type: string, idx: number) => (
                      <Badge key={idx} variant="outline">{type}</Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Estimated Cost</h4>
                  <p className="text-xl font-bold text-primary">
                    {displayAssessment.damage_assessment.estimated_cost_range}
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Repair Complexity</h4>
                  <Badge variant="secondary">
                    {displayAssessment.damage_assessment.repair_complexity}
                  </Badge>
                </div>

                {displayAssessment.damage_assessment.safety_concerns?.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm text-destructive">Safety Concerns</h4>
                    <ul className="text-sm space-y-1">
                      {displayAssessment.damage_assessment.safety_concerns.map((concern: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                          {concern}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {displayAssessment.damage_assessment.is_drivable !== undefined && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Vehicle Status</h4>
                    <Badge variant={displayAssessment.damage_assessment.is_drivable ? "default" : "destructive"}>
                      {displayAssessment.damage_assessment.is_drivable ? "Drivable" : "Not Drivable"}
                    </Badge>
                  </div>
                )}

                {displayAssessment.damage_assessment.total_loss_risk && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Total Loss Risk</h4>
                    <Badge variant="outline">
                      {displayAssessment.damage_assessment.total_loss_risk}
                    </Badge>
                  </div>
                )}
              </div>
            )}

            {displayAssessment.routing_decision && (
              <div className="bg-primary/5 p-4 rounded-lg border border-primary/10">
                <h4 className="font-medium mb-2">Routing Decision</h4>
                <Badge className="mb-2" variant="default">
                  {displayAssessment.routing_decision.replace('_', ' ').toUpperCase()}
                </Badge>
                <p className="text-sm text-muted-foreground mt-2">
                  {displayAssessment.reasoning}
                </p>
              </div>
            )}

            {displayAssessment.recommendations && (
              <div className="space-y-4 pt-4 border-t">
                <div>
                  <h4 className="font-medium mb-2">Immediate Actions</h4>
                  <ul className="space-y-1 text-sm">
                    {displayAssessment.recommendations.immediate_actions?.map((action: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
                        {action}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Required Documentation</h4>
                  <div className="flex flex-wrap gap-2">
                    {displayAssessment.recommendations.required_documentation?.map((doc: string, idx: number) => (
                      <Badge key={idx} variant="outline">{doc}</Badge>
                    ))}
                  </div>
                </div>
                {displayAssessment.recommendations.estimated_timeline && (
                  <div>
                    <h4 className="font-medium mb-2">Estimated Timeline</h4>
                    <p className="text-sm text-muted-foreground">
                      {displayAssessment.recommendations.estimated_timeline}
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
