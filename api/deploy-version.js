export default function handler(_req, res) {
  return res.status(200).json({
    commit: process.env.VERCEL_GIT_COMMIT_SHA || "unknown",
  });
}
