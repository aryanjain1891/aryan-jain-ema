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
        content: `You are an expert insurance claims assessor for FNOL (First Notice of Loss) triage. 
        
Your task is to:
1. Analyze incident descriptions and damage photos
2. Determine severity level (low, medium, high, critical)
3. Identify damage types and estimate scope
4. Suggest routing decision (straight_through, junior_adjuster, senior_adjuster, specialist)
5. Generate follow-up questions to gather missing critical information

Severity Guidelines:
- LOW: Minor cosmetic damage, no safety issues, under $2,000 estimated (e.g., small dent, minor scratch)
- MEDIUM: Moderate damage, functional impact, $2,000-$10,000 (e.g., broken window, door damage)
- HIGH: Significant damage, safety concerns, $10,000-$50,000 (e.g., structural damage, multiple panels)
- CRITICAL: Total loss potential, bodily injury, over $50,000 (e.g., frame damage, fire, flooding)

Routing Decisions:
- straight_through: Simple, low-value claims that can be auto-processed
- junior_adjuster: Standard claims with clear documentation
- senior_adjuster: Complex claims requiring experience
- specialist: Total loss, bodily injury, or specialized damage types

Respond in JSON format with:
{
  "severity_level": "low|medium|high|critical",
  "confidence_score": 0.0-1.0,
  "routing_decision": "straight_through|junior_adjuster|senior_adjuster|specialist",
  "damage_assessment": {
    "damage_types": ["type1", "type2"],
    "estimated_cost_range": "$X,XXX - $X,XXX",
    "safety_concerns": ["concern1"],
    "repair_complexity": "simple|moderate|complex|severe"
  },
  "follow_up_questions": [
    {
      "question": "Question text?",
      "question_type": "coverage|damage_details|incident_details|policy_validation",
      "is_required": true|false,
      "reasoning": "Why this question is important"
    }
  ],
  "reasoning": "Brief explanation of assessment"
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