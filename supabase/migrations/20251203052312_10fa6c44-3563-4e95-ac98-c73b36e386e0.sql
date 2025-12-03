-- Drop existing check constraints
ALTER TABLE claims DROP CONSTRAINT IF EXISTS claims_routing_decision_check;
ALTER TABLE claims DROP CONSTRAINT IF EXISTS claims_severity_level_check;
ALTER TABLE claims DROP CONSTRAINT IF EXISTS claims_status_check;

-- Add updated check constraints with all needed values
ALTER TABLE claims ADD CONSTRAINT claims_routing_decision_check 
CHECK (routing_decision = ANY (ARRAY['straight_through', 'junior_adjuster', 'senior_adjuster', 'specialist', 'fraud_investigation']));

ALTER TABLE claims ADD CONSTRAINT claims_severity_level_check 
CHECK (severity_level = ANY (ARRAY['low', 'medium', 'high', 'critical', 'fraudulent', 'invalid_images']));

ALTER TABLE claims ADD CONSTRAINT claims_status_check 
CHECK (status = ANY (ARRAY['submitted', 'under_review', 'in_progress', 'resolved', 'denied', 'assessed']));