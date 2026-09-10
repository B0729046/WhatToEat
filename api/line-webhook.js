import { createHmac, timingSafeEqual } from "node:crypto";
import {
  battleText,
  bindLineIdentity,
  isLineSubscribed,
  lineIdentity,
  lineTargetForUser,
  pushLineText,
  replyLineMessage,
  subscribeLineTarget,
  todayVoteStatus,
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

const helpText = [
  "吃什麼勒｜可用功能",
  "「戰況」查看今日領先餐廳、雙方票數與共同選擇。",
  "「催票」提醒尚未投票的另一位。",
].join("\n");

async function handleEvent(event) {
  const target = sourceTarget(event.source);
  if (!target) return;
  if (event.type === "follow" || event.type === "join") {
    await subscribeLineTarget(target);
    if (event.replyToken)
      await replyLineMessage(
        event.replyToken,
        `已訂閱「吃什麼勒」，每天 17:30 左右會收到投票速報。\n\n${helpText}`,
      );
    return;
  }
  if (event.type === "unfollow" || event.type === "leave") {
    await unsubscribeLineTarget(target);
    return;
  }
  if (event.type !== "message" || event.message?.type !== "text") return;
  const command = event.message.text.trim().replace(/\s+/g, "");
  if (["功能", "說明", "help"].includes(command.toLowerCase())) {
    await replyLineMessage(event.replyToken, helpText);
    return;
  }
  const identityMatch = command.match(
    /^\u6211\u662f(\u5a01\u5a01|\u5c0f\u8607\u8607)$/,
  );
  if (identityMatch) {
    await bindLineIdentity(target, identityMatch[1]);
    await replyLineMessage(
      event.replyToken,
      `\u8a18\u4f4f\u4e86\uff0c\u4f60\u662f${identityMatch[1]}\u3002\u4e4b\u5f8c\u50ac\u7968\u6703\u7cbe\u6e96\u901a\u77e5\u53e6\u4e00\u4f4d\u3002`,
    );
  } else if (command === "\u8a02\u95b1") {
    await subscribeLineTarget(target);
    await replyLineMessage(
      event.replyToken,
      `訂閱成功！每天 17:30 左右會收到目前最高票餐廳。\n\n${helpText}`,
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
  } else if (command === "\u6230\u6cc1") {
    await replyLineMessage(
      event.replyToken,
      battleText(await todayVoteStatus()),
    );
  } else if (command === "\u50ac\u7968") {
    const identity = await lineIdentity(target);
    if (!identity) {
      await replyLineMessage(
        event.replyToken,
        "\u5148\u544a\u8a34\u6211\u4f60\u662f\u8ab0\uff1a\u50b3\u300c\u6211\u662f\u5a01\u5a01\u300d\u6216\u300c\u6211\u662f\u5c0f\u8607\u8607\u300d\u3002",
      );
      return;
    }
    const status = await todayVoteStatus();
    const other =
      identity === "\u5a01\u5a01" ? "\u5c0f\u8607\u8607" : "\u5a01\u5a01";
    if (status.counts[identity] === 0) {
      await replyLineMessage(
        event.replyToken,
        "\u4f60\u81ea\u5df1\u90fd\u9084\u6c92\u6295\uff0c\u5148\u9078\u597d\u518d\u4f86\u50ac\u4eba\u3002",
      );
    } else if (status.counts[other] > 0) {
      await replyLineMessage(event.replyToken, battleText(status));
    } else {
      const otherTarget = await lineTargetForUser(other);
      const nudge =
        identity === "\u5a01\u5a01"
          ? "\u5a01\u5a01\u6b63\u5728\u7b49\u59b3\u6c7a\u5b9a\u665a\u9910\uff0c\u518d\u4e0d\u6295\u4ed6\u5c31\u8981\u958b\u59cb\u4e82\u9078\u4e86\u3002"
          : "\u5c0f\u8607\u8607\u5df2\u7d93\u9078\u597d\u4e86\uff0c\u5a01\u5a01\u518d\u4e0d\u6295\u5c31\u8996\u540c\u653e\u68c4\u4eba\u6b0a\u3002";
      await pushLineText(nudge, otherTarget ? [otherTarget] : undefined);
      await replyLineMessage(
        event.replyToken,
        `\u5df2\u7d93\u5e6b\u4f60\u6233${other}\u4e86\u3002`,
      );
    }
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
