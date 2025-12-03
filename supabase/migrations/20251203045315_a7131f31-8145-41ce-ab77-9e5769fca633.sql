-- Drop the existing check constraint
ALTER TABLE claim_questions DROP CONSTRAINT claim_questions_question_type_check;

-- Add a new constraint with more question types
ALTER TABLE claim_questions ADD CONSTRAINT claim_questions_question_type_check 
CHECK (question_type = ANY (ARRAY[
  'coverage'::text, 
  'damage_details'::text, 
  'incident_details'::text, 
  'policy_validation'::text,
  'verification'::text,
  'safety'::text,
  'witness_info'::text,
  'additional_images'::text,
  'timeline'::text
]));