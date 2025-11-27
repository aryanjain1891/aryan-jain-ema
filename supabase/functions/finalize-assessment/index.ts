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
    const { claimData, initialAssessment, followUpAnswers, additionalImageUrls } = await req.json();
    console.log('Finalizing assessment with follow-up answers');

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Prepare comprehensive content for final assessment
    const messages = [
      {
        role: 'system',
        content: `You are an expert AUTO INSURANCE claims assessor providing FINAL triage and routing decisions.

Based on the initial damage analysis and follow-up information, provide:
1. Final severity level (low, medium, high, critical)
2. Detailed damage assessment with cost estimates
3. Routing decision (straight_through, junior_adjuster, senior_adjuster, specialist)
4. Final recommendations

Severity Guidelines:
- LOW: Minor cosmetic damage, no safety issues, under $2,000 (small dent, scratch, minor glass)
- MEDIUM: Moderate damage, functional impact, $2,000-$10,000 (panel damage, window, door)
- HIGH: Significant damage, safety concerns, $10,000-$50,000 (multiple panels, suspension, frame concerns)
- CRITICAL: Total loss potential, bodily injury, over $50,000 (major structural, fire, severe collision)

Routing Decisions:
- straight_through: Simple, well-documented, low-value claims (under $3,000, no injuries, clear liability)
- junior_adjuster: Standard claims with moderate damage and good documentation
- senior_adjuster: Complex claims, high value, or unclear liability
- specialist: Total loss potential, bodily injury, or requires expert evaluation (frame damage, flood, fire)

Respond in JSON format with:
{
  "severity_level": "low|medium|high|critical",
  "confidence_score": 0.0-1.0,
  "routing_decision": "straight_through|junior_adjuster|senior_adjuster|specialist",
  "damage_assessment": {
    "damage_types": ["specific damage types"],
    "affected_areas": ["specific vehicle areas"],
    "estimated_cost_range": "$X,XXX - $X,XXX",
    "safety_concerns": ["any safety issues"],
    "repair_complexity": "simple|moderate|complex|severe",
    "is_drivable": true|false,
    "total_loss_risk": "low|medium|high"
  },
  "recommendations": {
    "immediate_actions": ["action1", "action2"],
    "required_documentation": ["doc1", "doc2"],
    "estimated_timeline": "X-Y days/weeks"
  },
  "reasoning": "Comprehensive explanation of final assessment and routing decision"
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

INITIAL VISUAL ASSESSMENT:
${JSON.stringify(initialAssessment.visible_damage_analysis, null, 2)}
Initial Severity: ${initialAssessment.initial_severity}

FOLLOW-UP ANSWERS:
${followUpAnswers.map((qa: any) => `Q: ${qa.question}\nA: ${qa.answer}`).join('\n\n')}

${additionalImageUrls && additionalImageUrls.length > 0 ? 'Additional damage photos have been provided below.' : ''}

Please provide the final comprehensive assessment and routing decision.`
          },
          // Add additional images if provided
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
