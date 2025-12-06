import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Upload, ArrowLeft, Loader2, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ClaimConfirmation } from "./ClaimConfirmation";
import { Progress } from "@/components/ui/progress";

interface ClaimFollowUpProps {
  assessment: any;
  claimNumber: string;
  claimId: string;
  claimData?: any;
  onReset: () => void;
}

interface QuestionCategory {
  id: string;
  title: string;
  description: string;
  questions: Array<{
    question: string;
    question_type: string;
    is_required: boolean;
    originalIndex: number;
  }>;
}

export const ClaimFollowUp = ({ assessment, claimNumber, claimId, claimData, onReset }: ClaimFollowUpProps) => {
  const [answers, setAnswers] = useState<{ [key: string]: string }>({});
  const [additionalFiles, setAdditionalFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  // Group questions by category
  const categories = useMemo<QuestionCategory[]>(() => {
    const questions = assessment.follow_up_questions?.filter((q: any) => q.question_type !== 'additional_images') || [];
    
    const categoryMap: { [key: string]: QuestionCategory } = {
      vehicle_verification: {
        id: 'vehicle_verification',
        title: 'Vehicle Verification',
        description: 'Confirm details about your vehicle',
        questions: []
      },
      incident_details: {
        id: 'incident_details',
        title: 'Incident Details',
        description: 'Tell us more about what happened',
        questions: []
      },
      safety_information: {
        id: 'safety_information',
        title: 'Safety Information',
        description: 'Safety-related details about the incident',
        questions: []
      },
      damage_documentation: {
        id: 'damage_documentation',
        title: 'Damage Documentation',
        description: 'Additional damage information',
        questions: []
      }
    };

    questions.forEach((q: any, idx: number) => {
      const questionWithIndex = { ...q, originalIndex: idx };
      const type = q.question_type?.toLowerCase() || 'general';
      
      if (type.includes('vehicle') || type.includes('verification')) {
        categoryMap.vehicle_verification.questions.push(questionWithIndex);
      } else if (type.includes('incident') || type.includes('collision') || type.includes('circumstances')) {
        categoryMap.incident_details.questions.push(questionWithIndex);
      } else if (type.includes('safety') || type.includes('injury') || type.includes('airbag')) {
        categoryMap.safety_information.questions.push(questionWithIndex);
      } else if (type.includes('damage') || type.includes('photo') || type.includes('documentation')) {
        categoryMap.damage_documentation.questions.push(questionWithIndex);
      } else {
        // Default to incident details for uncategorized
        categoryMap.incident_details.questions.push(questionWithIndex);
      }
    });

    // Filter out empty categories and return as array
    return Object.values(categoryMap).filter(cat => cat.questions.length > 0);
  }, [assessment.follow_up_questions]);

  const totalSteps = categories.length + 1; // +1 for additional photos step
  const isLastStep = currentStep === totalSteps - 1;
  const isFirstStep = currentStep === 0;

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

  const currentCategory = categories[currentStep];
  
  const isCurrentStepComplete = () => {
    if (isLastStep) return true; // Photos step is optional
    if (!currentCategory) return true;
    
    return currentCategory.questions.every(q => {
      if (!q.is_required) return true;
      return answers[q.originalIndex] && answers[q.originalIndex].trim().length > 0;
    });
  };

  const allRequiredAnswered = categories.every(cat =>
    cat.questions.every(q => {
      if (!q.is_required) return true;
      return answers[q.originalIndex] && answers[q.originalIndex].trim().length > 0;
    })
  );

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  if (isCompleted) {
    return <ClaimConfirmation claimNumber={claimNumber} onReset={onReset} />;
  }

  const progressValue = ((currentStep + 1) / totalSteps) * 100;

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
            Claim #{claimNumber} - Step {currentStep + 1} of {totalSteps}
          </CardDescription>
          <div className="pt-4">
            <Progress value={progressValue} className="h-2" />
            <div className="flex justify-between mt-2">
              {categories.map((cat, idx) => (
                <button
                  key={cat.id}
                  onClick={() => setCurrentStep(idx)}
                  className={`text-xs px-2 py-1 rounded transition-colors ${
                    idx === currentStep 
                      ? 'bg-primary text-primary-foreground' 
                      : idx < currentStep 
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {idx < currentStep && <Check className="inline h-3 w-3 mr-1" />}
                  {cat.title}
                </button>
              ))}
              <button
                onClick={() => setCurrentStep(totalSteps - 1)}
                className={`text-xs px-2 py-1 rounded transition-colors ${
                  currentStep === totalSteps - 1 
                    ? 'bg-primary text-primary-foreground' 
                    : currentStep > categories.length - 1
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                Photos
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Question Steps */}
          {!isLastStep && currentCategory && (
            <div className="space-y-6">
              <div className="pb-4 border-b">
                <h3 className="font-semibold text-lg">{currentCategory.title}</h3>
                <p className="text-sm text-muted-foreground">{currentCategory.description}</p>
              </div>
              
              {currentCategory.questions.map((q) => (
                <div key={q.originalIndex} className="space-y-2">
                  <Label htmlFor={`question-${q.originalIndex}`} className="flex items-start gap-2">
                    <span className="flex-1">
                      {q.question}
                      {q.is_required && <span className="text-destructive ml-1">*</span>}
                    </span>
                  </Label>
                  <Textarea
                    id={`question-${q.originalIndex}`}
                    placeholder="Your answer..."
                    rows={3}
                    value={answers[q.originalIndex] || ''}
                    onChange={(e) => handleAnswerChange(q.originalIndex.toString(), e.target.value)}
                    className="resize-none"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Additional Photos Step */}
          {isLastStep && (
            <div className="space-y-4">
              <div className="pb-4 border-b">
                <h3 className="font-semibold text-lg">Additional Photos</h3>
                <p className="text-sm text-muted-foreground">Upload any additional photos that may help with your claim (optional)</p>
              </div>
              
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
          )}

          {/* Navigation */}
          <div className="flex justify-between pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={isFirstStep}
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back
            </Button>

            {isLastStep ? (
              <Button
                onClick={handleSubmitFollowUp}
                disabled={!allRequiredAnswered || isSubmitting}
                size="lg"
              >
                {isSubmitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</>
                ) : (
                  'Submit Claim'
                )}
              </Button>
            ) : (
              <Button
                onClick={handleNext}
                disabled={!isCurrentStepComplete()}
              >
                Next
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};