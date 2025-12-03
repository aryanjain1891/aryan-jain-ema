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
    const { documentUrl } = await req.json();
    console.log('Parsing policy document:', documentUrl);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are an expert at extracting vehicle and policy information from insurance documents.
            
Extract the following information if present in the document:
- Policy number
- Vehicle make (manufacturer)
- Vehicle model
- Vehicle year
- VIN (Vehicle Identification Number)
- License plate number
- Ownership status (owned, leased, financed)

Return ONLY a JSON object with these fields. Use null for any field not found in the document.

Response format:
{
  "policy_number": "string or null",
  "vehicle_make": "string or null",
  "vehicle_model": "string or null",
  "vehicle_year": "number or null",
  "vehicle_vin": "string or null",
  "vehicle_license_plate": "string or null",
  "vehicle_ownership_status": "owned|leased|financed or null",
  "extraction_confidence": 0.0-1.0,
  "notes": "any relevant notes about extraction quality"
}`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Please extract vehicle and policy information from this insurance document.'
              },
              {
                type: 'image_url',
                image_url: { url: documentUrl }
              }
            ]
          }
        ],
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

    console.log('Extracted policy data:', extractedData);

    return new Response(JSON.stringify({ data: extractedData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in parse-policy-document function:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
