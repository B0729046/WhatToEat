const DEFAULT_MODEL = "gemini-2.5-flash-lite";

export async function generateAiReply(message) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        system_instruction: {
          parts: [
            {
              text: [
                "你是名叫「吃什麼勒」的 LINE Bot，主要陪一對情侶討論吃飯。",
                "一律使用繁體中文，口吻自然有趣，最多 120 字。",
                "可以幽默吐槽但不可羞辱、威脅或刻薄。",
                "你無法直接讀取票況；使用者要查票況時請叫他輸入「戰況」。",
                "使用者要提醒另一人投票時請叫他輸入「催票」。",
                "不要聲稱已執行任何實際操作。",
              ].join("\n"),
            },
          ],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: message }],
          },
        ],
        generationConfig: {
          temperature: 0.85,
          maxOutputTokens: 180,
        },
      }),
    },
  );
  if (!response.ok) throw new Error(`Gemini API failed (${response.status})`);
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();
  return text ? text.slice(0, 450) : null;
}
