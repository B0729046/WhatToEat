import {
  authorizeCron,
  cronAuthDiagnostic,
  lineTargetForUser,
  pushLineText,
  redis,
} from "./_daily.js";

const MARKER = "whattoeat:message:apology:2026-09-11:sususu";
const MESSAGE =
  "小蘇蘇貴賓，昨天小管家的回覆失了分寸，把玩笑說得像在兇您，是我服務不周。鄭重向您道歉；往後會保持有禮又好玩的語氣，不再拿您開過頭的玩笑。";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });
  if (!authorizeCron(req)) return res.status(401).json(cronAuthDiagnostic(req));
  try {
    const target = await lineTargetForUser("小蘇蘇");
    if (!target)
      return res.status(409).json({ error: "小蘇蘇尚未綁定 LINE 身分" });
    const firstRun = await redis("SET", MARKER, "sending", "NX", "EX", 604800);
    if (firstRun !== "OK")
      return res.status(200).json({ skipped: true, reason: "already-sent" });
    try {
      await pushLineText(MESSAGE, [target]);
      await redis("SET", MARKER, "sent", "EX", 31536000);
      return res.status(200).json({ sent: true });
    } catch (error) {
      await redis("DEL", MARKER);
      throw error;
    }
  } catch (error) {
    console.error("Apology push failed:", error);
    return res.status(500).json({ error: error.message });
  }
}
