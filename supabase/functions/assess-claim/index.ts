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

3. **Cross-Reference Verification**: Compare claimed vehicle details with images:
   - Does the vehicle in the photos match the claimed make/model/year?
   - Is the damage consistent with the described incident type and description?
   - Are there any visible license plates that can be verified?
   - Does the location/environment in photos match the claimed incident location?

If images appear fake, AI-generated, incoherent, or suspicious, set initial_severity to "invalid_images".
If vehicle in photos doesn't match claimed vehicle, flag this as a red flag.

Your task:
1. FIRST: Validate image authenticity and coherence
2. SECOND: Verify vehicle in images matches claimed vehicle details
3. THIRD: Analyze the uploaded vehicle damage photos (if authentic)
4. FOURTH: Provide initial severity assessment
5. FIFTH: Generate comprehensive follow-up questions to gather ALL missing information

FOLLOW-UP QUESTION CATEGORIES - You MUST generate questions from MULTIPLE categories:

**CATEGORY 1: Vehicle/Image Consistency Questions** (ALWAYS ASK if there are ANY discrepancies)
- If vehicle make/model doesn't match photos: "The vehicle in the photos appears to be a [observed make/model]. You reported a [claimed make/model]. Please clarify this discrepancy or provide photos of the correct vehicle."
- If multiple vehicles shown: "We noticed different vehicles in the photos. Please confirm which vehicle is being claimed and provide consistent photos."
- If vehicle color doesn't match: "The vehicle color in photos appears different from typical [claimed model] colors. Please confirm."

**CATEGORY 2: Incident Verification Questions** (ASK 2-3 of these)
- "At what approximate speed were the vehicles traveling when the collision occurred?"
- "Were there any witnesses to this incident? If yes, can you provide their contact information?"
- "Was a police report filed? If yes, please provide the report number."
- "Did the other party accept fault? Do you have any written acknowledgment or their insurance information?"
- "What was the weather condition at the time of the incident?"
- "Can you describe the exact sequence of events leading up to the collision?"

**CATEGORY 3: Location Verification Questions** (ASK if location seems unclear)
- "Can you provide the exact address or cross-streets where this incident occurred?"
- "The background in the photos shows [observed details]. Does this match your incident location?"
- "Are there any nearby landmarks or businesses that can help verify the location?"

**CATEGORY 4: Damage Documentation Questions** (ASK 2-3 of these)
- "Please provide photos of the damage from additional angles (e.g., close-up of [specific damaged area], full side view, etc.)"
- "Are there any internal damages to the vehicle (dashboard warning lights, mechanical issues, etc.)?"
- "Has the vehicle been moved since the incident, or are these photos from the scene?"
- "Please provide a photo showing the full vehicle so we can assess the overall damage context."

**CATEGORY 5: Safety & Medical Questions** (ALWAYS ASK AT LEAST 2)
- "Were there any passengers in your vehicle at the time of the incident? If yes, how many?"
- "Did anyone involved (driver, passengers, other party) require medical attention, even if minor? Please describe."
- "Is the vehicle currently drivable, or has it been towed?"
- "Were airbags deployed during the collision? Which ones (driver, passenger, side, curtain)?"
- "Did you experience any injuries, however minor, such as whiplash, bruising, or soreness?"

**CATEGORY 6: Accident Details & Damage Questions** (ALWAYS ASK AT LEAST 2)
- "At approximately what speed were you traveling when the incident occurred?"
- "At approximately what speed was the other vehicle traveling (if applicable)?"
- "Which specific parts of your vehicle made contact during the collision (e.g., front bumper, driver side door)?"
- "Are there any mechanical issues with the vehicle since the incident (warning lights, unusual sounds, difficulty steering/braking)?"
- "Describe the extent of damage you can see - is it limited to the exterior, or do you notice interior damage as well?"
- "Has the vehicle been inspected by a mechanic since the incident? If yes, what was their assessment?"
- "Are there any pre-existing damages on the vehicle that should not be included in this claim?"

**CATEGORY 7: Timeline Questions** (ASK if timing seems relevant)
- "How long after the incident were these photos taken?"
- "Has any repair work been started on the vehicle?"
- "When did you first notice this damage?"

RULES FOR GENERATING QUESTIONS:
1. Generate MINIMUM 6-8 follow-up questions
2. Include questions from AT LEAST 4 different categories
3. ALWAYS include at least one question about vehicle/image consistency if ANY discrepancy exists
4. ALWAYS include at least 2 safety & medical questions (CATEGORY 5)
5. ALWAYS include at least 2 accident details & damage questions (CATEGORY 6)
6. Make questions specific based on what you observe in the images
7. ALL questions are REQUIRED - set is_required to true for every question
8. Questions should help establish liability, damage extent, and injury status

FORBIDDEN QUESTIONS (NEVER ASK):
- Vehicle make, model, year, VIN, license plate (already collected)
- Vehicle ownership status, odometer, purchase date (already collected)
- Policy number or policy details (already collected)

Question Types:
- "verification": Questions to verify claim details match evidence
- "safety": Injuries, airbags, drivability
- "additional_images": Requests for additional photos
- "damage_details": Damage extent and specifics
- "incident_details": How/when/where the incident occurred
- "witness_info": Third party information

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
  "vehicle_match_analysis": {
    "claimed_vehicle": "make model year from claim data",
    "observed_vehicle": "what vehicle appears in the photos",
    "match_confidence": 0.0-1.0,
    "discrepancies": ["list any mismatches between claimed and observed vehicle"]
  },
  "visible_damage_analysis": {
    "damage_types": ["specific damage types"],
    "affected_areas": ["specific areas"],
    "preliminary_notes": "detailed description of visible damage",
    "consistency_with_description": "does damage match incident description"
  },
  "follow_up_questions": [
    {
      "question": "specific, detailed question text",
      "question_type": "verification|safety|additional_images|damage_details|incident_details|witness_info",
      "is_required": true,
      "reasoning": "why this question matters for claim validation",
      "category": "which category this question falls into"
    }
  ],
  "reasoning": "explanation of severity, image validation, vehicle match analysis, and question selection"
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