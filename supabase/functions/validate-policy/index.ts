import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { policyNumber } = await req.json();
    console.log('Validating policy:', policyNumber);

    // Mock policy validation - In production, this would integrate with Policy Admin System (PAS)
    // For MVP, we'll simulate validation with pattern matching

    const isValidFormat = /^POL-\d{6,8}$/.test(policyNumber);

    // Deterministic validation for demo/testing
    let status = 'active';
    if (policyNumber === 'POL-123456') {
      status = 'active';
    } else if (policyNumber === 'POL-000000') {
      status = 'lapsed';
    } else {
      // Simulate random status for other numbers
      const statuses = ['active', 'lapsed', 'pending'];
      status = statuses[Math.floor(Math.random() * statuses.length)];
    }

    const randomStatus = status;

    // Mock policy details
    const policyDetails = isValidFormat ? {
      policy_number: policyNumber,
      status: randomStatus,
      policy_holder: 'Sample Policy Holder',
      coverage_type: ['Comprehensive', 'Collision'],
      effective_date: '2024-01-01',
      expiration_date: '2025-01-01',
      valid: randomStatus === 'active'
    } : {
      policy_number: policyNumber,
      status: 'invalid',
      valid: false,
      message: 'Policy number format invalid. Expected format: POL-XXXXXX'
    };

    console.log('Policy validation result:', policyDetails);

    return new Response(JSON.stringify(policyDetails), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in validate-policy function:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      valid: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});