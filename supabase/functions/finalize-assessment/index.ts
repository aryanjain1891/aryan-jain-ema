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
    const { claimData, initialAssessment, followUpAnswers, additionalImageUrls, primaryImageUrls } = await req.json();
    console.log('Finalizing assessment with follow-up answers and images');

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Prepare comprehensive content for final assessment
    const messages = [
      {
        role: 'system',
        content: `You are an expert AUTO INSURANCE claims adjuster providing FINAL assessment with fraud detection capabilities.

You have initial damage analysis and follow-up answers including vehicle and policy details.

CRITICAL FRAUD DETECTION - Check for:
1. **Vehicle Validation**:
   - VIN format and check digit validity (17 chars, no I/O/Q)
   - Make/model/year consistency across answers and images
   - License plate format matches state
   - Ownership documentation consistency
   - Vehicle in photos should match claimed make/model/year
   
2. **Policy Verification**:
   - Coverage type matches vehicle and incident
   - Policy details align with vehicle value
   - Deductible amounts are realistic
   
3. **Image & Damage Consistency**:
   - Damage description matches photos
   - Incident description plausible with damage shown
   - CRITICAL: Check if additional photos show the SAME VEHICLE as original photos
   - Compare vehicle color, body style, visible features between all images
   - Damage physics make sense (speed, impact angle, damage pattern)
   
4. **Metadata & Timing Red Flags** (Simulate these checks):
   - Flag if photo appears old or reused: "Flag: Image metadata suggests photo may have been taken significantly before incident date"
   - Flag if images appear to be from different vehicles: "Flag: Vehicle characteristics inconsistent between submitted photos"
   - Flag if damage pattern doesn't match incident description
   
5. **General Red Flags**:
   - Evasive or contradictory answers
   - Missing critical information
   - Suspicious patterns (unusual timing, location)
   - Inconsistent details between description and photos

Severity Guidelines:
- LOW: Minor damage, verified details, under $2,000
- MEDIUM: Moderate damage, verified, $2,000-$10,000
- HIGH: Significant damage, verified, $10,000-$50,000
- CRITICAL: Total loss potential, injuries, over $50,000
- FRAUDULENT: Unverifiable details, contradictions, fake images

Routing Decisions:
- straight_through: Low value, verified, clear liability, under $3,000
- junior_adjuster: Standard claims, verified details, moderate damage
- senior_adjuster: High value or complex, but verified
- specialist: Total loss potential, injuries, major structural
- fraud_investigation: Red flags, inconsistencies, suspicious patterns, unverifiable details

Respond in JSON format with:
{
  "severity_level": "low|medium|high|critical|fraudulent",
  "confidence_score": 0.0-1.0,
  "routing_decision": "straight_through|junior_adjuster|senior_adjuster|specialist|fraud_investigation",
  "fraud_indicators": {
    "has_red_flags": true/false,
    "concerns": ["specific fraud indicators"],
    "verification_status": "verified|suspicious|requires_investigation"
  },
  "metadata_flags": ["Flag: specific metadata or timing concerns - e.g. 'Metadata indicates photo taken 6 months ago'"],
  "image_consistency": {
    "all_images_same_vehicle": true/false,
    "vehicle_matches_claimed_details": true/false,
    "concerns": ["specific image consistency issues"]
  },
  "vehicle_validation": {
    "details_consistent": true/false,
    "vin_verified": true/false,
    "policy_coverage_adequate": true/false,
    "notes": "validation details"
  },
  "damage_assessment": {
    "damage_types": ["specific types"],
    "affected_areas": ["specific areas"],
    "estimated_cost_range": "$X,XXX - $X,XXX",
    "safety_concerns": ["concerns"],
    "repair_complexity": "simple|moderate|complex|severe",
    "is_drivable": true/false,
    "total_loss_risk": "none|low|medium|high"
  },
  "follow_up_analysis": [
    {
      "question": "the question asked",
      "answer": "the claimant's answer",
      "assessment": "your professional assessment of this answer - what it tells you, any red flags or concerns, how it impacts the claim",
      "credibility": "credible|questionable|suspicious|evasive",
      "impact_on_claim": "positive|neutral|negative|critical_concern"
    }
  ],
  "recommendations": {
    "immediate_actions": ["actions"],
    "required_documentation": ["documents"],
    "estimated_timeline": "X days/weeks"
  },
  "reasoning": "comprehensive explanation including fraud assessment"
}`
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `INITIAL CLAIM DATA:
Incident Type: ${claimData.incident_type}
Incident Date: ${claimData.incident_date}
Description: ${claimData.description || 'No description provided'}
Location: ${claimData.location || 'Not specified'}
Policy Number: ${claimData.policy_number}

CLAIMED VEHICLE DETAILS:
Make: ${claimData.vehicle_make || 'Not provided'}
Model: ${claimData.vehicle_model || 'Not provided'}
Year: ${claimData.vehicle_year || 'Not provided'}
VIN: ${claimData.vehicle_vin || 'Not provided'}
License Plate: ${claimData.vehicle_license_plate || 'Not provided'}
Ownership Status: ${claimData.vehicle_ownership_status || 'Not provided'}
Odometer: ${claimData.vehicle_odometer || 'Not provided'}
Purchase Date: ${claimData.vehicle_purchase_date || 'Not provided'}

INITIAL VISUAL ASSESSMENT:
${JSON.stringify(initialAssessment.visible_damage_analysis, null, 2)}
Initial Severity: ${initialAssessment.initial_severity}
Vehicle Match Analysis: ${JSON.stringify(initialAssessment.vehicle_match_analysis || {}, null, 2)}
Fraud Indicators: ${JSON.stringify(initialAssessment.fraud_indicators || {}, null, 2)}

FOLLOW-UP QUESTIONS AND ANSWERS (CRITICAL - USE THESE FOR FINAL ASSESSMENT):
${followUpAnswers.map((qa: any) => `Q: ${qa.question}\nA: ${qa.answer || 'Not answered'}`).join('\n\n')}

PRIMARY IMAGES (Original damage photos submitted with claim):
${primaryImageUrls && primaryImageUrls.length > 0 ? `${primaryImageUrls.length} primary photos showing the initial damage - these are the ORIGINAL images submitted with the claim.` : 'No primary images provided.'}

${additionalImageUrls && additionalImageUrls.length > 0 ? `ADDITIONAL IMAGES PROVIDED: ${additionalImageUrls.length} additional photos have been submitted.

CRITICAL IMAGE COMPARISON:
1. Compare the PRIMARY IMAGES (original photos) against the ADDITIONAL IMAGES (new photos)
2. Verify ALL images show the SAME VEHICLE - check color, body style, make/model, visible features
3. Check if the vehicle in photos matches the CLAIMED VEHICLE DETAILS (make, model, year)
4. Flag any inconsistencies between images or between images and claimed details` : 'No additional images provided.'}

Based on all the above information including the follow-up answers, provide the final comprehensive assessment and routing decision. Pay special attention to any discrepancies between claimed details and photos, and any concerning answers in the follow-up questions.`
          },
          // Add primary images first
          ...(primaryImageUrls && primaryImageUrls.length > 0 ? primaryImageUrls.map((url: string) => ({
            type: 'image_url',
            image_url: { url }
          })) : []),
          // Add additional images
          ...(additionalImageUrls && additionalImageUrls.length > 0 ? additionalImageUrls.map((url: string) => ({
            type: 'image_url',
            image_url: { url }
          })) : [])
        ]
      }
    ];

    // Call Lovable AI for final assessment
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
    const finalAssessment = JSON.parse(data.choices[0].message.content);

    console.log('Final assessment completed:', finalAssessment);

    return new Response(JSON.stringify({ assessment: finalAssessment }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in finalize-assessment function:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
