import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Upload, ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ClaimConfirmation } from "./ClaimConfirmation";

interface ClaimFollowUpProps {
  assessment: any;
  claimNumber: string;
  claimId: string;
  claimData?: any;
  onReset: () => void;
}

export const ClaimFollowUp = ({ assessment, claimNumber, claimId, claimData, onReset }: ClaimFollowUpProps) => {
  const [answers, setAnswers] = useState<{ [key: string]: string }>({});
  const [additionalFiles, setAdditionalFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAdditionalFiles(prev => [...prev, ...Array.from(e.target.files || [])]);
    }
  };

  const removeFile = (index: number) => {
    setAdditionalFiles(prev => prev.filter((_, i) => i !== index));
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

      // Update answers in claim_questions table
      if (assessment.follow_up_questions) {
        for (let idx = 0; idx < assessment.follow_up_questions.length; idx++) {
          const q = assessment.follow_up_questions[idx];
          if (answers[idx]) {
            await supabase.from('claim_questions')
              .update({ 
                answer: answers[idx],
                answered_at: new Date().toISOString()
              })
              .eq('claim_id', claimId)
              .eq('question', q.question);
          }
        }
      }

      // Prepare questions with answers
      const questionsWithAnswers = assessment.follow_up_questions?.map((q: any, idx: number) => ({
        question: q.question,
        answer: answers[idx] || '',
        question_type: q.question_type,
        is_required: q.is_required
      })) || [];

      // Call finalize-assessment edge function
      toast.info("Processing your claim...");

      const { data, error } = await supabase.functions.invoke('finalize-assessment', {
        body: {
          claimData,
          initialAssessment: assessment,
          followUpAnswers: questionsWithAnswers,
          additionalImageUrls
        }
      });

      if (error) throw error;

      // Update claim in database with final assessment (stored but not shown to user)
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

      setIsCompleted(true);
      toast.success("Claim submitted successfully!");
    } catch (error) {
      console.error('Error submitting follow-up:', error);
      toast.error("Failed to complete submission. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const allRequiredAnswered = assessment.follow_up_questions
    ?.filter((q: any) => q.question_type !== 'additional_images')
    ?.every((q: any, idx: number) => {
      if (!q.is_required) return true;
      return answers[idx] && answers[idx].trim().length > 0;
    }) ?? true;

  if (isCompleted) {
    return <ClaimConfirmation claimNumber={claimNumber} onReset={onReset} />;
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={onReset}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Start Over
      </Button>

      <Card className="border-2">
        <CardHeader>
          <CardTitle>Additional Information Needed</CardTitle>
          <CardDescription>
            Claim #{claimNumber} - Please answer the following questions to complete your claim submission
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {assessment.follow_up_questions?.filter((q: any) => q.question_type !== 'additional_images').map((q: any, idx: number) => (
            <div key={idx} className="space-y-2">
              <Label htmlFor={`question-${idx}`} className="flex items-start gap-2">
                <span className="flex-1">
                  {q.question}
                  {q.is_required && <span className="text-destructive ml-1">*</span>}
                </span>
              </Label>
              <Textarea
                id={`question-${idx}`}
                placeholder="Your answer..."
                rows={3}
                value={answers[idx] || ''}
                onChange={(e) => handleAnswerChange(idx.toString(), e.target.value)}
                className="resize-none"
              />
            </div>
          ))}

          <div className="space-y-2 pt-4 border-t">
            <Label htmlFor="additional-files" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Upload Additional Photos (Optional)
            </Label>
            <p className="text-sm text-muted-foreground mb-2">
              If you have additional photos that may help with your claim, please upload them here.
            </p>
            <div className="border-2 border-dashed border-border rounded-lg p-4 hover:border-accent transition-colors">
              <input
                id="additional-files"
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <label htmlFor="additional-files" className="cursor-pointer flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Upload className="h-5 w-5" />
                Click to upload additional photos
              </label>
            </div>
            {additionalFiles.length > 0 && (
              <div className="mt-3 space-y-2">
                {additionalFiles.map((file, index) => (
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
            onClick={handleSubmitFollowUp}
            disabled={!allRequiredAnswered || isSubmitting}
            className="w-full"
            size="lg"
          >
            {isSubmitting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</>
            ) : (
              'Submit Claim'
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};