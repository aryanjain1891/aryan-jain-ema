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
    const { claimData, imageUrls } = await req.json();
    console.log('Assessing claim:', claimData);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Prepare content for AI assessment
    const messages = [
      {
        role: 'system',
        content: `You are an expert AUTO INSURANCE claims adjuster with computer vision capabilities analyzing vehicle damage photos for initial assessment.

CRITICAL VALIDATION REQUIREMENTS:
1. **Image Authenticity Check**: Verify these are REAL photographs of actual vehicle damage, not:
   - AI-generated images (look for artifacts, unnatural patterns, impossible physics)
   - Stock photos or internet images (reverse image search indicators)
   - Digitally manipulated images (inconsistent lighting, cloning, editing artifacts)
   - Screenshots, renders, or CGI
   - Incoherent/mismatched images (different vehicles, unrelated damage scenes, inconsistent weather/lighting)
   
2. **Vehicle Verification**: The images must show:
   - Actual physical vehicle damage consistent with the incident description
   - Realistic lighting, shadows, reflections, and environmental context
   - Consistent vehicle make/model/color across all photos
   - Physical realism (proper perspective, proportions, damage physics)

If images appear fake, AI-generated, incoherent, or suspicious, set initial_severity to "invalid_images".

Your task:
1. FIRST: Validate image authenticity and coherence
2. Analyze the uploaded vehicle damage photos (if authentic)
3. Provide initial severity assessment (low, medium, high, critical, invalid_images)
4. Generate intelligent follow-up questions

MANDATORY QUESTIONS (Ask ONLY if information is missing or conflicting):
- Incident context (if description is vague)
- Safety status (injuries, drivability) if not mentioned

ABSOLUTELY FORBIDDEN QUESTIONS (NEVER ASK THESE, EVEN IF MISSING):
- Vehicle make, model, year, VIN, license plate
- Vehicle ownership status
- Odometer reading
- Purchase date
- Any questions about the vehicle identity or history

If this information appears missing, simply proceed with the assessment based on the visual evidence only. Do not attempt to gather this data.

ADDITIONAL QUESTIONS based on damage analysis:
- Specific damage details not visible in photos
- Request for specific additional angles if critical for assessment (e.g., undercarriage, internal)
- Incident context if unclear

Question Types:
- "safety": Injuries, airbags, drivability
- "additional_images": Requests for additional photos (damage only)
- "damage_details": Damage extent and specifics
- "incident_details": How the incident occurred

Respond in JSON format with:
{
  "initial_severity": "low|medium|high|critical|invalid_images",
  "confidence_score": 0.0-1.0,
  "fraud_indicators": {
    "has_red_flags": true/false,
    "verification_status": "verified|suspicious|fraudulent|insufficient_data",
    "concerns": ["specific fraud concerns if any"]
  },
  "image_authenticity": {
    "appears_authentic": true/false,
    "confidence": 0.0-1.0,
    "concerns": ["specific red flags about image authenticity"],
    "validation_notes": "detailed assessment of image quality and authenticity"
  },
  "visible_damage_analysis": {
    "damage_types": ["specific damage types"],
    "affected_areas": ["specific areas"],
    "preliminary_notes": "detailed description of visible damage"
  },
  "follow_up_questions": [
    {
      "question": "specific question text",
      "question_type": "safety|additional_images|damage_details|incident_details",
      "is_required": true/false,
      "reasoning": "why this question matters"
    }
  ],
  "reasoning": "explanation of severity, image validation, and question selection"
}`
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Incident Type: ${claimData.incident_type}
Incident Date: ${claimData.incident_date}
Description: ${claimData.description || 'No description provided'}
Location: ${claimData.location || 'Not specified'}
Policy Number: ${claimData.policy_number}

VEHICLE DETAILS (ALREADY VERIFIED):
Make: ${claimData.vehicle_make}
Model: ${claimData.vehicle_model}
Year: ${claimData.vehicle_year}
VIN: ${claimData.vehicle_vin}
License Plate: ${claimData.vehicle_license_plate}
Ownership: ${claimData.vehicle_ownership_status}
Odometer: ${claimData.vehicle_odometer}

Please assess this claim and provide your analysis.`
          },
          // Add images if provided
          ...(imageUrls && imageUrls.length > 0 ? imageUrls.map((url: string) => ({
            type: 'image_url',
            image_url: { url }
          })) : [])
        ]
      }
    ];

    // Call Lovable AI with vision capability
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
    const assessment = JSON.parse(data.choices[0].message.content);

    console.log('AI Assessment completed:', assessment);

    return new Response(JSON.stringify({ assessment }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in assess-claim function:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});