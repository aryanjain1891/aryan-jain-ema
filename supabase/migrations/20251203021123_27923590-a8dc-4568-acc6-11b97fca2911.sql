-- Add vehicle details and policy document columns to claims table
ALTER TABLE public.claims 
ADD COLUMN IF NOT EXISTS vehicle_make TEXT,
ADD COLUMN IF NOT EXISTS vehicle_model TEXT,
ADD COLUMN IF NOT EXISTS vehicle_year INTEGER,
ADD COLUMN IF NOT EXISTS vehicle_vin TEXT,
ADD COLUMN IF NOT EXISTS vehicle_license_plate TEXT,
ADD COLUMN IF NOT EXISTS vehicle_ownership_status TEXT,
ADD COLUMN IF NOT EXISTS vehicle_odometer INTEGER,
ADD COLUMN IF NOT EXISTS vehicle_purchase_date DATE,
ADD COLUMN IF NOT EXISTS policy_document_url TEXT;