import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Upload, ArrowLeft, Loader2, ChevronLeft, ChevronRight, Check, AlertCircle } from "lucide-react";
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
  // Use question text as key for answers to ensure correct mapping
  const [answers, setAnswers] = useState<{ [questionText: string]: string }>({});
  const [additionalFiles, setAdditionalFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [attemptedSteps, setAttemptedSteps] = useState<Set<number>>(new Set());
  const [showStepErrors, setShowStepErrors] = useState(false);

  // Group questions by category - all questions are required
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
      // All questions are required
      const questionWithIndex = { ...q, originalIndex: idx, is_required: true };
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

  const handleAnswerChange = (question: string, value: string) => {
    setAnswers(prev => ({ ...prev, [question]: value }));
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
    // Mark all steps as attempted for final validation
    const allSteps = new Set<number>();
    categories.forEach((_, idx) => allSteps.add(idx));
    setAttemptedSteps(allSteps);
    setShowStepErrors(true);

    // Validate all questions are answered
    if (!allRequiredAnswered) {
      toast.error("Please answer all required questions before submitting.");
      return;
    }

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

      // Update answers in claim_questions table using question text as key
      const regularQuestions = assessment.follow_up_questions?.filter(
        (q: any) => q.question_type !== 'additional_images'
      ) || [];
      
      for (const q of regularQuestions) {
        const answer = answers[q.question];
        if (answer && answer.trim()) {
          await supabase.from('claim_questions')
            .update({ 
              answer: answer,
              answered_at: new Date().toISOString()
            })
            .eq('claim_id', claimId)
            .eq('question', q.question);
        }
      }

      // Prepare questions with answers for the AI
      const questionsWithAnswers = regularQuestions.map((q: any) => ({
        question: q.question,
        answer: answers[q.question] || '',
        question_type: q.question_type,
        is_required: true
      }));

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
  
  const isStepComplete = (stepIndex: number) => {
    if (stepIndex >= categories.length) return true; // Photos step is optional
    const cat = categories[stepIndex];
    if (!cat) return true;
    
    return cat.questions.every(q => 
      answers[q.question] && answers[q.question].trim().length > 0
    );
  };

  const getUnansweredQuestions = (stepIndex: number) => {
    if (stepIndex >= categories.length) return [];
    const cat = categories[stepIndex];
    if (!cat) return [];
    
    return cat.questions.filter(q => 
      !answers[q.question] || answers[q.question].trim().length === 0
    );
  };

  const isCurrentStepComplete = () => isStepComplete(currentStep);

  const allRequiredAnswered = categories.every((cat, idx) => isStepComplete(idx));

  const handleNext = () => {
    // Mark current step as attempted
    setAttemptedSteps(prev => new Set([...prev, currentStep]));
    setShowStepErrors(true);

    if (!isCurrentStepComplete()) {
      toast.error("Please answer all questions in this section before continuing.");
      return;
    }

    if (currentStep < totalSteps - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleStepClick = (stepIndex: number) => {
    // Mark current step as attempted when leaving
    setAttemptedSteps(prev => new Set([...prev, currentStep]));
    setShowStepErrors(true);
    setCurrentStep(stepIndex);
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
        <CardHeader className="space-y-4">
          <div>
            <CardTitle>Additional Information Needed</CardTitle>
            <CardDescription>
              Claim #{claimNumber} — Step {currentStep + 1} of {totalSteps}
            </CardDescription>
          </div>
          <div>
            <Progress value={progressValue} className="h-2" />
            <div className="flex flex-wrap gap-2 mt-3">
              {categories.map((cat, idx) => {
                const stepComplete = isStepComplete(idx);
                const wasAttempted = attemptedSteps.has(idx);
                const hasErrors = wasAttempted && !stepComplete && showStepErrors;
                
                return (
                  <button
                    key={cat.id}
                    onClick={() => handleStepClick(idx)}
                    className={`text-xs px-3 py-1.5 rounded-full transition-colors font-medium flex items-center gap-1 ${
                      idx === currentStep 
                        ? 'bg-primary text-primary-foreground' 
                        : stepComplete 
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
                          : hasErrors
                            ? 'bg-destructive/10 text-destructive border border-destructive/30'
                            : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {stepComplete && <Check className="h-3 w-3" />}
                    {hasErrors && <AlertCircle className="h-3 w-3" />}
                    {cat.title}
                  </button>
                );
              })}
              <button
                onClick={() => handleStepClick(totalSteps - 1)}
                className={`text-xs px-3 py-1.5 rounded-full transition-colors font-medium flex items-center gap-1 ${
                  currentStep === totalSteps - 1 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                }`}
              >
                <Check className="h-3 w-3" />
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
              
              {currentCategory.questions.map((q) => {
                const hasAnswer = answers[q.question] && answers[q.question].trim().length > 0;
                const showError = showStepErrors && attemptedSteps.has(currentStep) && !hasAnswer;
                
                return (
                  <div key={q.question} className="space-y-2">
                    <Label htmlFor={`question-${q.originalIndex}`} className="flex items-start gap-2">
                      <span className="flex-1">
                        {q.question}
                        <span className="text-destructive ml-1">*</span>
                      </span>
                    </Label>
                    <Textarea
                      id={`question-${q.originalIndex}`}
                      placeholder="Your answer..."
                      rows={3}
                      value={answers[q.question] || ''}
                      onChange={(e) => handleAnswerChange(q.question, e.target.value)}
                      className={`resize-none ${showError ? 'border-destructive' : ''}`}
                    />
                    {showError && (
                      <p className="text-sm text-destructive">This question is required</p>
                    )}
                  </div>
                );
              })}
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
              
              {/* Show summary of incomplete sections */}
              {!allRequiredAnswered && showStepErrors && (
                <div className="mt-4 p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                    <div>
                      <p className="font-medium text-destructive">Please complete all sections before submitting</p>
                      <ul className="mt-2 text-sm text-destructive/80 list-disc list-inside">
                        {categories.map((cat, idx) => {
                          const unanswered = getUnansweredQuestions(idx);
                          if (unanswered.length === 0) return null;
                          return (
                            <li key={cat.id}>
                              <button 
                                className="underline hover:no-underline"
                                onClick={() => handleStepClick(idx)}
                              >
                                {cat.title}
                              </button>
                              : {unanswered.length} question{unanswered.length > 1 ? 's' : ''} unanswered
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>
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
              <Button onClick={handleNext}>
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