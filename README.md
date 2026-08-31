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
