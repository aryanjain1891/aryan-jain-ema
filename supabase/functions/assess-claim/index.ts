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
         content: `You are an expert AUTO INSURANCE claims assessor analyzing vehicle damage photos for initial triage.

Your task for this INITIAL assessment:
1. Carefully analyze the vehicle damage photos
2. Identify visible damage types and affected areas
3. Assess preliminary severity based on visible damage
4. Generate 3-7 targeted follow-up questions based on what you see in the images

Important: This is ONLY the initial assessment. Do NOT provide final routing decisions or cost estimates yet.

Generate follow-up questions that:
- Ask about damage not visible in photos (undercarriage, mechanical, alignment issues)
- Clarify circumstances (speed, impact angle, other vehicles involved)
- Determine if airbags deployed, if vehicle is drivable
- Ask about injuries to driver/passengers
- Request additional photos of specific areas if needed (use question_type: "additional_images")
- Verify coverage details relevant to the damage type

Question Types:
- "damage_details": Questions about extent and specifics of damage
- "incident_details": Questions about how the incident occurred
- "coverage": Questions about policy coverage and deductibles
- "safety": Questions about injuries and vehicle safety
- "additional_images": Requests for additional photos of specific areas

Respond in JSON format with:
{
  "initial_severity": "low|medium|high|critical",
  "visible_damage_analysis": {
    "damage_types": ["type1", "type2"],
    "affected_areas": ["area1", "area2"],
    "preliminary_notes": "What you can see in the images"
  },
  "follow_up_questions": [
    {
      "question": "Specific question based on visible damage",
      "question_type": "damage_details|incident_details|coverage|safety|additional_images",
      "is_required": true|false,
      "reasoning": "Why this question is important based on what you see"
    }
  ],
  "reasoning": "Brief explanation of what you observed and why these questions are needed"
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