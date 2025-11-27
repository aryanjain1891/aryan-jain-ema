import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle, AlertTriangle, TrendingUp, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ClaimAssessmentProps {
  claimId: string;
  onReset: () => void;
}

export const ClaimAssessment = ({ claimId, onReset }: ClaimAssessmentProps) => {
  const { toast } = useToast();
  const [claim, setClaim] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadClaimData();
  }, [claimId]);

  const loadClaimData = async () => {
    try {
      const { data: claimData, error: claimError } = await supabase
        .from('claims')
        .select('*')
        .eq('id', claimId)
        .single();

      if (claimError) throw claimError;
      setClaim(claimData);

      const { data: questionsData, error: questionsError } = await supabase
        .from('claim_questions')
        .select('*')
        .eq('claim_id', claimId)
        .is('answer', null);

      if (questionsError) throw questionsError;
      setQuestions(questionsData || []);
    } catch (error) {
      console.error('Error loading claim:', error);
      toast({
        title: "Error",
        description: "Could not load claim data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswerSubmit = async (questionId: string) => {
    const answer = answers[questionId];
    if (!answer) return;

    try {
      const { error } = await supabase
        .from('claim_questions')
        .update({
          answer,
          answered_at: new Date().toISOString(),
        })
        .eq('id', questionId);

      if (error) throw error;

      toast({
        title: "Answer Saved",
        description: "Your response has been recorded.",
      });

      // Reload questions to update UI
      await loadClaimData();
    } catch (error) {
      console.error('Error saving answer:', error);
      toast({
        title: "Error",
        description: "Could not save answer",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
          <p className="text-muted-foreground">Analyzing your claim...</p>
        </div>
      </div>
    );
  }

  if (!claim) return null;

  const severityColors = {
    low: 'bg-success/10 text-success border-success',
    medium: 'bg-warning/10 text-warning border-warning',
    high: 'bg-destructive/10 text-destructive border-destructive',
    critical: 'bg-destructive text-destructive-foreground',
  };

  const routingLabels = {
    straight_through: 'Straight-Through Processing',
    junior_adjuster: 'Junior Adjuster',
    senior_adjuster: 'Senior Adjuster',
    specialist: 'Specialist Review',
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={onReset} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" />
        File Another Claim
      </Button>

      {/* Claim Summary */}
      <Card className="border-2">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl">Claim #{claim.claim_number}</CardTitle>
              <CardDescription>Filed on {new Date(claim.created_at).toLocaleDateString()}</CardDescription>
            </div>
            <Badge variant="outline" className="text-lg px-4 py-2">
              {claim.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* AI Assessment Results */}
          {claim.ai_assessment && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-accent" />
                <h3 className="text-lg font-semibold">AI Assessment</h3>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg border bg-card">
                  <p className="text-sm text-muted-foreground mb-2">Severity Level</p>
                  <Badge 
                    className={`text-sm ${severityColors[claim.severity_level as keyof typeof severityColors]}`}
                  >
                    {claim.severity_level?.toUpperCase()}
                  </Badge>
                </div>

                <div className="p-4 rounded-lg border bg-card">
                  <p className="text-sm text-muted-foreground mb-2">Confidence Score</p>
                  <p className="text-2xl font-bold text-foreground">
                    {(claim.confidence_score * 100).toFixed(0)}%
                  </p>
                </div>

                <div className="p-4 rounded-lg border bg-card">
                  <p className="text-sm text-muted-foreground mb-2">Routing Decision</p>
                  <p className="font-medium text-foreground">
                    {routingLabels[claim.routing_decision as keyof typeof routingLabels]}
                  </p>
                </div>

                <div className="p-4 rounded-lg border bg-card">
                  <p className="text-sm text-muted-foreground mb-2">Estimated Cost</p>
                  <p className="font-medium text-foreground">
                    {claim.ai_assessment.damage_assessment?.estimated_cost_range || 'TBD'}
                  </p>
                </div>
              </div>

              {claim.ai_assessment.damage_assessment && (
                <div className="p-4 rounded-lg border bg-secondary/50">
                  <h4 className="font-semibold mb-2">Damage Assessment</h4>
                  <div className="space-y-2 text-sm">
                    {claim.ai_assessment.damage_assessment.damage_types && (
                      <div>
                        <span className="text-muted-foreground">Damage Types: </span>
                        <span className="text-foreground">
                          {claim.ai_assessment.damage_assessment.damage_types.join(', ')}
                        </span>
                      </div>
                    )}
                    {claim.ai_assessment.damage_assessment.repair_complexity && (
                      <div>
                        <span className="text-muted-foreground">Complexity: </span>
                        <span className="text-foreground capitalize">
                          {claim.ai_assessment.damage_assessment.repair_complexity}
                        </span>
                      </div>
                    )}
                    {claim.ai_assessment.damage_assessment.safety_concerns?.length > 0 && (
                      <div className="flex items-start gap-2 mt-3">
                        <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
                        <div>
                          <span className="text-destructive font-medium">Safety Concerns: </span>
                          <span className="text-foreground">
                            {claim.ai_assessment.damage_assessment.safety_concerns.join(', ')}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {claim.ai_assessment.reasoning && (
                <div className="p-4 rounded-lg border bg-accent/5">
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-accent" />
                    AI Reasoning
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {claim.ai_assessment.reasoning}
                  </p>
                </div>
              )}
            </div>
          )}

          <Separator />

          {/* Claim Details */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Claim Details</h3>
            <div className="grid gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Policy Number: </span>
                <span className="font-medium">{claim.policy_number}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Incident Type: </span>
                <span className="font-medium">{claim.incident_type}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Incident Date: </span>
                <span className="font-medium">
                  {new Date(claim.incident_date).toLocaleString()}
                </span>
              </div>
              {claim.location && (
                <div>
                  <span className="text-muted-foreground">Location: </span>
                  <span className="font-medium">{claim.location}</span>
                </div>
              )}
              {claim.description && (
                <div>
                  <span className="text-muted-foreground">Description: </span>
                  <p className="mt-1 text-foreground">{claim.description}</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Follow-up Questions */}
      {questions.length > 0 && (
        <Card className="border-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-accent" />
              <CardTitle>Follow-up Questions</CardTitle>
            </div>
            <CardDescription>
              Please answer these questions to help us process your claim faster
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {questions.map((question) => (
              <div key={question.id} className="space-y-3 p-4 rounded-lg border bg-card">
                <div className="flex items-start justify-between">
                  <Label className="text-base">
                    {question.question}
                    {question.is_required && <span className="text-destructive ml-1">*</span>}
                  </Label>
                  <Badge variant="outline" className="text-xs">
                    {question.question_type.replace('_', ' ')}
                  </Badge>
                </div>
                <Textarea
                  placeholder="Your answer..."
                  value={answers[question.id] || ''}
                  onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })}
                  rows={3}
                />
                <Button
                  onClick={() => handleAnswerSubmit(question.id)}
                  disabled={!answers[question.id]}
                  size="sm"
                >
                  Submit Answer
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Next Steps */}
      <Card className="bg-accent/5 border-accent">
        <CardHeader>
          <CardTitle className="text-accent">What Happens Next?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex gap-3">
            <CheckCircle className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Your claim has been triaged</p>
              <p className="text-muted-foreground">
                Based on AI analysis, it's been routed to: {routingLabels[claim.routing_decision as keyof typeof routingLabels]}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <CheckCircle className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">An adjuster will contact you</p>
              <p className="text-muted-foreground">
                Expect a call or email within 24-48 hours for next steps
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <CheckCircle className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Track your claim status</p>
              <p className="text-muted-foreground">
                Save your claim number: <strong>{claim.claim_number}</strong>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};