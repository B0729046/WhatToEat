const DEFAULT_MODEL = "gemini-2.5-flash-lite";
let detectedModel = "";

function modelName(value) {
  return String(value || "").replace(/^models\//, "");
}

async function detectTextModel(apiKey) {
  if (detectedModel) return detectedModel;
  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000",
    {
      headers: { "x-goog-api-key": apiKey },
      signal: AbortSignal.timeout(6000),
    },
  );
  if (!response.ok)
    throw new Error(`Gemini model list failed (${response.status})`);
  const data = await response.json();
  const models = (data.models || [])
    .filter(
      (item) =>
        item.supportedGenerationMethods?.includes("generateContent") &&
        /gemini/i.test(item.name) &&
        !/(embedding|image|tts|audio)/i.test(item.name),
    )
    .sort((a, b) => {
      const score = (item) =>
        /flash-lite/i.test(item.name) ? 0 : /flash/i.test(item.name) ? 1 : 2;
      return score(a) - score(b);
    });
  detectedModel = modelName(models[0]?.name);
  if (!detectedModel) throw new Error("No Gemini text model is available");
  return detectedModel;
}

async function requestReply(apiKey, model, body) {
  return await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName(model))}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify(body),
    },
  );
}

export async function generateAiReply(message) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  let model = process.env.GEMINI_MODEL || detectedModel || DEFAULT_MODEL;
  const body = {
    system_instruction: {
      parts: [
        {
          text: [
            "你是名叫「吃什麼勒」的私人餐飲禮賓管家，正在服務目前傳訊息的單一貴賓。",
            "一律使用繁體中文，最多 120 字。",
            "用高級飯店禮賓般殷勤、優雅且有儀式感的口吻，把使用者當尊貴賓客。",
            "可以帶一點俏皮幽默，但不要制式客服腔、過度奉承或堆砌浮誇敬語。",
            "稱呼可自然使用「貴賓」或「您」，不要每句重複稱呼。",
            "每次只對當前使用者說話，禁止稱呼「二位」「兩位」「你們」或把對方與另一半合併稱呼。",
            "提到另一半時使用第三人稱，例如「您的另一半」，不可把兩人一起當成回覆對象。",
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
  };
  let response = await requestReply(apiKey, model, body);
  if (response.status === 404) {
    model = await detectTextModel(apiKey);
    response = await requestReply(apiKey, model, body);
  }
  if (!response.ok) {
    const details = (await response.text()).slice(0, 300);
    throw new Error(
      `Gemini API failed (${response.status}) using ${model}: ${details}`,
    );
  }
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();
  return text ? text.slice(0, 450) : null;
}
