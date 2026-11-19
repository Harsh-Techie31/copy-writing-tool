// Server-side proxy to the Gemini API. The API key stays on the server
// (Vercel function in production, Vite dev middleware locally).

const DEFAULT_MODEL = "gemini-3.8-flash";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY is not set" });
  }

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const { system, userContent } = req.body || {};

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system || "" }] },
          contents: [{ role: "user", parts: [{ text: userContent || "" }] }],
          generationConfig: {
            // Every prompt in the app asks for strict JSON.
            responseMimeType: "application/json",
            maxOutputTokens: 4096,
            temperature: 0.7,
          },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res
        .status(response.status)
        .json({ error: data.error?.message || "Gemini API error" });
    }

    const text = (data.candidates?.[0]?.content?.parts || [])
      .filter((p) => typeof p.text === "string" && !p.thought)
      .map((p) => p.text)
      .join("\n");

    if (!text) {
      const reason = data.candidates?.[0]?.finishReason || data.promptFeedback?.blockReason;
      return res.status(502).json({ error: `Empty response from Gemini${reason ? ` (${reason})` : ""}` });
    }

    return res.status(200).json({ text });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
}
