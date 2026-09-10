import { createHmac, timingSafeEqual } from "node:crypto";
import {
  isLineSubscribed,
  replyLineMessage,
  subscribeLineTarget,
  unsubscribeLineTarget,
} from "./_daily.js";

export const config = { api: { bodyParser: false } };

async function rawRequestBody(req) {
  if (typeof req.body === "string") return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString("utf8");
  if (req.body && typeof req.body === "object") return JSON.stringify(req.body);
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

function validSignature(rawBody, signature) {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  const received = Buffer.from(signature, "base64");
  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  );
}

function sourceTarget(source = {}) {
  return source.userId || source.groupId || source.roomId || "";
}

async function handleEvent(event) {
  const target = sourceTarget(event.source);
  if (!target) return;
  if (event.type === "follow" || event.type === "join") {
    await subscribeLineTarget(target);
    if (event.replyToken)
      await replyLineMessage(
        event.replyToken,
        "\u5df2\u8a02\u95b1\u300c\u5403\u4ec0\u9ebc\u52d2\u300d\uff0c\u6bcf\u5929 17:30 \u5de6\u53f3\u6703\u6536\u5230\u6295\u7968\u901f\u5831\u3002\n\u50b3\u300c\u53d6\u6d88\u8a02\u95b1\u300d\u53ef\u505c\u6b62\u901a\u77e5\u3002",
      );
    return;
  }
  if (event.type === "unfollow" || event.type === "leave") {
    await unsubscribeLineTarget(target);
    return;
  }
  if (event.type !== "message" || event.message?.type !== "text") return;
  const command = event.message.text.trim().replace(/\s+/g, "");
  if (command === "\u8a02\u95b1") {
    await subscribeLineTarget(target);
    await replyLineMessage(
      event.replyToken,
      "\u8a02\u95b1\u6210\u529f\uff01\u6bcf\u5929 17:30 \u5de6\u53f3\u6703\u6536\u5230\u76ee\u524d\u6700\u9ad8\u7968\u9910\u5ef3\u3002",
    );
  } else if (command === "\u53d6\u6d88\u8a02\u95b1") {
    await unsubscribeLineTarget(target);
    await replyLineMessage(
      event.replyToken,
      "\u5df2\u53d6\u6d88\u8a02\u95b1\uff0c\u4e4b\u5f8c\u4e0d\u6703\u518d\u6536\u5230\u6bcf\u65e5\u6295\u7968\u901f\u5831\u3002",
    );
  } else if (command === "\u72c0\u614b") {
    const subscribed = await isLineSubscribed(target);
    await replyLineMessage(
      event.replyToken,
      subscribed
        ? "\u76ee\u524d\u5df2\u8a02\u95b1\u6bcf\u65e5\u6295\u7968\u901f\u5831\u3002"
        : "\u76ee\u524d\u672a\u8a02\u95b1\uff0c\u50b3\u300c\u8a02\u95b1\u300d\u5373\u53ef\u958b\u555f\u3002",
    );
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });
  try {
    const rawBody = await rawRequestBody(req);
    if (!validSignature(rawBody, req.headers["x-line-signature"]))
      return res.status(401).json({ error: "Invalid LINE signature" });
    const payload = JSON.parse(rawBody);
    await Promise.all((payload.events || []).map(handleEvent));
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Webhook processing failed" });
  }
}
