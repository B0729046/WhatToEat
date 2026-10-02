import { authorizeCron, cronAuthDiagnostic } from "./_daily.js";
export default async function handler(req, res) {
  if (req.method !== "GET")
    return res.status(405).json({ error: "Method not allowed" });
  if (!authorizeCron(req)) return res.status(401).json(cronAuthDiagnostic(req));
  return res.status(200).json({
    skipped: true,
    reason: "meal-history-is-manual-only",
  });
}
