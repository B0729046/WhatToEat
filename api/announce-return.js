import {
  authorizeCron,
  cronAuthDiagnostic,
  pushLineText,
  redis,
  subscriberTargets,
} from "./_daily.js";

const MARKER = "whattoeat:message:leafy-returned:2026-10-12";
const MESSAGE = "小葉葉回來啦";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });
  if (!authorizeCron(req)) return res.status(401).json(cronAuthDiagnostic(req));
  try {
    const targets = await subscriberTargets();
    if (!targets.length)
      return res.status(409).json({ error: "目前沒有 LINE 訂閱者" });
    const firstRun = await redis("SET", MARKER, "sending", "NX", "EX", 604800);
    if (firstRun !== "OK")
      return res.status(200).json({ skipped: true, reason: "already-sent" });
    try {
      const sent = await pushLineText(MESSAGE, targets);
      await redis("SET", MARKER, "sent", "EX", 31536000);
      return res.status(200).json({ sent });
    } catch (error) {
      await redis("DEL", MARKER);
      throw error;
    }
  } catch (error) {
    console.error("Return announcement failed:", error);
    return res.status(500).json({ error: error.message });
  }
}
