import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a video safety analysis system.

You will receive frames from a video.

Your tasks:
1. Describe what is happening across the frames.
2. Determine whether any harmful or abnormal event occurred.

Consider the following as harmful:
- Violence or physical fights
- Accidents or falls
- Fire or explosions
- Theft or suspicious behavior
- Medical emergencies
- Dangerous or unsafe behavior

You MUST respond with valid JSON in this exact format (no markdown, no extra text):
{
  "summary": "<2-4 sentence description of what is happening>",
  "bad_event": true or false,
  "reason": "<one short sentence explaining the decision>",
  "confidence": <number from 0 to 1>
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { frames } = await req.json();

    if (!frames || !Array.isArray(frames) || frames.length === 0) {
      return new Response(
        JSON.stringify({ error: "No frames provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build content array with frames as images
    const content: any[] = [
      {
        type: "text",
        text: "Analyze these video frames for safety concerns. Respond ONLY with valid JSON.",
      },
    ];

    for (const frame of frames) {
      // frame is a data URL like "data:image/jpeg;base64,..."
      const base64 = frame.split(",")[1];
      if (base64) {
        content.push({
          type: "image_url",
          image_url: {
            url: `data:image/jpeg;base64,${base64}`,
          },
        });
      }
    }

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content },
          ],
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI usage limit reached. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const messageContent = data.choices?.[0]?.message?.content;

    if (!messageContent) {
      throw new Error("No response from AI model");
    }

    // Parse the JSON response from AI
    let analysisResult;
    try {
      // Try to extract JSON from the response (handle markdown code blocks)
      const jsonMatch = messageContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseErr) {
      console.error("Failed to parse AI response:", messageContent);
      analysisResult = {
        summary: messageContent.substring(0, 500),
        bad_event: false,
        reason: "Could not parse structured response",
        confidence: 0.5,
      };
    }

    return new Response(JSON.stringify(analysisResult), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-video error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
