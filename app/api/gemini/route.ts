export async function POST(request: Request) {
  try {
    const { apiKey, prompt, model } = await request.json() as { apiKey?: string; prompt?: string; model?: string };
    if (!apiKey?.trim() || !prompt?.trim()) {
      return Response.json({ error: "An API key and question are required." }, { status: 400 });
    }
    if (prompt.length > 12000) {
      return Response.json({ error: "The submitted performance data is too long." }, { status: 413 });
    }
    const safeModel = model && /^[a-zA-Z0-9._-]+$/.test(model) ? model : "gemini-3.6-flash";
    const gemini = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${safeModel}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey.trim() },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: .35, maxOutputTokens: 500 },
      }),
    });
    if (!gemini.ok) {
      return Response.json({ error: "Gemini did not accept the request.", status: gemini.status }, { status: 502 });
    }
    const data = await gemini.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n").trim();
    if (!text) return Response.json({ error: "Gemini returned an empty response." }, { status: 502 });
    return Response.json({ text });
  } catch {
    return Response.json({ error: "The Gemini connection failed." }, { status: 500 });
  }
}
