import {
  authorizeCron,
  cronAuthDiagnostic,
  lineTargetForUser,
  pushLineText,
  redis,
} from "./_daily.js";

const MARKER = "whattoeat:message:sususu-android-map-test:2026-11-24";
const MESSAGE = "小蘇蘇，Android 地圖按鈕已修復，請再測試看看。";

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
    console.error("Sususu map test notification failed:", error);
    return res.status(500).json({ error: error.message });
  }
}
