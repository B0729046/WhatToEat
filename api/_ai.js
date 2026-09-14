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

export async function generateAiReply(message, counterpart = "對方") {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  let model = process.env.GEMINI_MODEL || detectedModel || DEFAULT_MODEL;
  const body = {
    system_instruction: {
      parts: [
        {
          text: [
            "你是「吃什麼勒」的 LINE Bot，名字叫小葉葉。",
            "一律使用繁體中文，最多 120 字。",
            "使用自然、親切、有禮的口吻，不使用浮誇敬語或客服腔。",
            "禁止稱呼使用者為「貴賓」「尊貴的貴賓」，直接自然回答即可。",
            "需要自稱時只能稱「小葉葉」。",
            "不挖苦、不嘲諷、不嘴砲，也不要用攻擊性的玩笑。",
            "每次只對當前使用者說話，禁止稱呼「二位」「兩位」「你們」或把對方與另一半合併稱呼。",
            `需要提到另一人時，直接稱呼「${counterpart}」，不要說「另一半」或「您的另一半」。`,
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
