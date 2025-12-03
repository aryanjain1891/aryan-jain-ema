import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const { policyUrl } = await req.json();
        console.log('Extracting details from policy:', policyUrl);

        const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
        if (!LOVABLE_API_KEY) {
            throw new Error('LOVABLE_API_KEY is not configured');
        }

        // Prepare content for AI extraction
        const messages = [
            {
                role: 'system',
                content: `You are an expert insurance policy analyzer. Your task is to extract VEHICLE information from the provided policy document (image or PDF).
        
        Extract the following fields if present:
        - Vehicle Make
        - Vehicle Model
        - Vehicle Year
        - VIN (Vehicle Identification Number)
        - License Plate
        - Ownership Status (Owned, Leased, Financed)
        - Policy Number
        - Policy Status (Active/Expired)
        - Coverage Details (brief summary)

        Respond in JSON format:
        {
          "vehicle_make": "string or null",
          "vehicle_model": "string or null",
          "vehicle_year": number or null,
          "vehicle_vin": "string or null",
          "vehicle_license_plate": "string or null",
          "vehicle_ownership_status": "owned|leased|financed or null",
          "policy_number": "string or null",
          "policy_status": "active|expired|unknown",
          "coverage_summary": "string or null"
        }`
            },
            {
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: `Please extract the vehicle and policy details from this document.`
                    },
                    {
                        type: 'image_url',
                        image_url: { url: policyUrl }
                    }
                ]
            }
        ];

        // Call Lovable AI (Gemini)
        const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${LOVABLE_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'google/gemini-2.5-flash',
                messages,
                response_format: { type: 'json_object' }
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('AI API error:', response.status, errorText);
            throw new Error(`AI API error: ${response.status}`);
        }

        const data = await response.json();
        const extractedData = JSON.parse(data.choices[0].message.content);

        console.log('Extraction completed:', extractedData);

        return new Response(JSON.stringify({ extractedData }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Error in extract-policy-details function:', error);
        return new Response(JSON.stringify({
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
