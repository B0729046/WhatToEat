# WhatToEat

共享餐廳清單、抽籤、投票與最近投票紀錄。前端使用 React + Vite，後端使用 Vercel Function，資料儲存在 Upstash Redis。

## 本機開發

1. 複製 `.env.example` 為 `.env.local`，填入 Upstash Redis REST 憑證。
2. 安裝 Vercel CLI：`npm install -g vercel`。
3. 執行 `vercel dev`，讓前端與 `/api/state` Function 一起啟動。

只執行 `npm run dev` 會啟動 Vite 前端，但不會模擬 Vercel Function。

## 部署到 Vercel

將專案匯入 Vercel，並在 Project Settings > Environment Variables 設定：

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

也相容 Vercel KV 的 `KV_REST_API_URL` 與 `KV_REST_API_TOKEN`。部署後所有訪客會共用餐廳、票數及最近 50 筆投票紀錄。

## 指令

- `npm run build`：建立正式版前端
- `npm run lint`：檢查程式碼
- `npm run preview`：預覽已建置的前端（不包含 API）

# LINE 投票速報與每日結算

Vercel Cron 會執行兩個排程：

- 台北時間 17:30 左右呼叫 `/api/notify`，透過 LINE Messaging API 推播目前最高票。
- 台北午夜後呼叫 `/api/finalize`，將前一天最高票餐廳寫入用餐紀錄。

請在 Vercel 設定以下環境變數：

- `LINE_CHANNEL_ACCESS_TOKEN`：LINE Messaging API channel access token。
- `LINE_CHANNEL_SECRET`：用來驗證 LINE Webhook 簽章。
- `LINE_TARGET_ID`：舊版單一接收者，首次執行時會自動搬入訂閱者清單，之後可移除。
- `CRON_SECRET`：保護 LINE 推播排程端點的隨機密鑰。

LINE Notify 已停止服務，本專案改用 LINE Official Account 的 Messaging API。

在 LINE Developers 將 Webhook URL 設為：

`https://what-to-eat-chi-pink.vercel.app/api/line-webhook`

啟用 Webhook 後，加入官方帳號或傳送「訂閱」會加入推播清單；傳送「取消訂閱」會移除；傳送「狀態」可查詢目前狀態。

兩位使用者各自傳送「我是威威」或「我是小蘇蘇」完成身分綁定。傳送「催票」會提醒尚未投票的另一位，傳送「戰況」會即時回覆目前領先、各自票數與共同選擇。

GitHub Actions 會在台北時間 17:00 與 17:25 呼叫催票端點。請在 GitHub repository 的 Settings > Secrets and variables > Actions 新增名為 `CRON_SECRET` 的 Repository secret，值需與 Vercel 的 `CRON_SECRET` 完全相同。
