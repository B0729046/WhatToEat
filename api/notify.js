import { authorizeCron, pushLineLeaders } from "./_daily.js";
export default async function handler(req, res) {
  if (req.method !== "GET")
    return res.status(405).json({ error: "Method not allowed" });
  if (!authorizeCron(req))
    return res.status(401).json({ error: "Unauthorized" });
  try {
    return res.status(200).json(await pushLineLeaders());
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}
