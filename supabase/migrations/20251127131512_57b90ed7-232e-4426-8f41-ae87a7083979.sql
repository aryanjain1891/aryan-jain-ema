-- Create claims table for FNOL intake
CREATE TABLE IF NOT EXISTS public.claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_number TEXT UNIQUE NOT NULL DEFAULT 'CLM-' || LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0'),
  policy_number TEXT NOT NULL,
  policy_status TEXT CHECK (policy_status IN ('active', 'lapsed', 'pending')) DEFAULT 'pending',
  
  -- Claim details
  incident_type TEXT NOT NULL,
  incident_date TIMESTAMPTZ NOT NULL,
  description TEXT,
  location TEXT,
  
  -- AI Assessment
  severity_level TEXT CHECK (severity_level IN ('low', 'medium', 'high', 'critical')),
  ai_assessment JSONB,
  confidence_score NUMERIC(3, 2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  
  -- Triage routing
  assigned_to TEXT,
  routing_decision TEXT CHECK (routing_decision IN ('straight_through', 'junior_adjuster', 'senior_adjuster', 'specialist')),
  
  -- Status
  status TEXT CHECK (status IN ('submitted', 'under_review', 'in_progress', 'resolved', 'denied')) DEFAULT 'submitted',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create claim_files table for document/photo uploads
CREATE TABLE IF NOT EXISTS public.claim_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  
  -- AI Analysis
  ai_analysis JSONB,
  damage_detected TEXT[],
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create claim_questions table for follow-up questions
CREATE TABLE IF NOT EXISTS public.claim_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT,
  question_type TEXT CHECK (question_type IN ('coverage', 'damage_details', 'incident_details', 'policy_validation')),
  is_required BOOLEAN DEFAULT false,
  asked_at TIMESTAMPTZ DEFAULT NOW(),
  answered_at TIMESTAMPTZ
);

-- Create indexes
CREATE INDEX idx_claims_claim_number ON public.claims(claim_number);
CREATE INDEX idx_claims_policy_number ON public.claims(policy_number);
CREATE INDEX idx_claims_status ON public.claims(status);
CREATE INDEX idx_claims_severity ON public.claims(severity_level);
CREATE INDEX idx_claim_files_claim_id ON public.claim_files(claim_id);
CREATE INDEX idx_claim_questions_claim_id ON public.claim_questions(claim_id);

-- Enable RLS
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_questions ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Public access for MVP - in production would be authenticated)
CREATE POLICY "Anyone can create claims" ON public.claims
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can view claims" ON public.claims
  FOR SELECT USING (true);

CREATE POLICY "Anyone can update claims" ON public.claims
  FOR UPDATE USING (true);

CREATE POLICY "Anyone can create claim files" ON public.claim_files
  FOR ALL USING (true);

CREATE POLICY "Anyone can view claim files" ON public.claim_files
  FOR SELECT USING (true);

CREATE POLICY "Anyone can manage claim questions" ON public.claim_questions
  FOR ALL USING (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for claims table
CREATE TRIGGER update_claims_updated_at
  BEFORE UPDATE ON public.claims
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for claim files
INSERT INTO storage.buckets (id, name, public)
VALUES ('claim-files', 'claim-files', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Anyone can upload claim files" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'claim-files');

CREATE POLICY "Anyone can view claim files" ON storage.objects
  FOR SELECT USING (bucket_id = 'claim-files');

CREATE POLICY "Anyone can update claim files" ON storage.objects
  FOR UPDATE USING (bucket_id = 'claim-files');