# WhatToEat 專案協作規則

## 溝通與執行

- 使用繁體中文與使用者溝通。
- 以手機版使用體驗為優先，再補充桌面版排版。
- 使用者要求實作或修改時，應自行判斷並直接完成安全且在專案範圍內的檔案變更，不重複詢問是否同意寫入。
- 若執行環境本身強制要求權限核准，依系統規則處理，不以其他方式規避安全限制。
- 保留使用者既有修改，不覆蓋或回復無關變更。

## 技術架構

- 專案位置：`C:\Projects\WhatToEat`。
- 前端使用 React、Vite 與 JavaScript。
- 後端使用 Vercel Functions。
- 共享資料使用 Upstash Redis。
- 正式站：`https://what-to-eat-chi-pink.vercel.app/`。
- GitHub：`https://github.com/B0729046/WhatToEat.git`。
- 不把 Upstash token、API key 或其他秘密寫入 Git。

## 產品規則

- 固定使用者為「威威」與「小蘇蘇」。
- 使用者可以複選餐廳投票。
- 每日票數以 Asia/Taipei 日期區分並自動重置。
- 排行榜第一名自動成為當日選擇並寫入用餐紀錄；沒有任何票時清除當日自動選擇。
- 用餐歷史保留餐廳與日期，並允許更正或刪除。
- 餐廳由手機貼上 Google Maps 餐廳分享網址新增。
- 餐廳保留 Google Maps 連結。
- 餐廳分類可複選，價錢可由使用者編輯。
- 刪除餐廳只能放在「更多設定」，不要直接出現在排行榜。
- 不恢復或建立展示用假餐廳資料；只有使用者明確要求的測試紀錄例外。
- 排行榜卡片保持緊湊，詳細資訊以長按卡片 0.5 秒顯示。

## UI 原則

- 排行榜是首頁最重要的內容，需醒目但不占用過多手機畫面。
- 避免不必要的英文標籤、說明文字、頭貼與重複資訊。
- 投票必須立即產生視覺回饋，再於背景同步 Redis。
- 新增投票時短暫在畫面中央顯示半透明提示；取消投票不顯示。
- 所有互動按鈕需有清楚的可用、停用與選取狀態。

## 修改與驗證

- 使用 `apply_patch` 修改文字檔。
- 修改 JavaScript、JSX 或 CSS 後，依變更範圍執行：
  - `npx --yes prettier@3.6.2 --write <變更檔案>`
  - `npm run build`
  - `npm run lint`
  - Vercel Function 變更另執行 `node --check api/state.js`
  - 提交前執行 `git diff --check`
- 不以建置成功取代功能邏輯檢查。
- 不用測試操作污染正式 Upstash 資料；只有使用者明確要求寫入的資料才可修改。

## Git 與部署

- 完成功能且驗證通過後，若該工作本身包含更新正式站，提交到 `main` 並推送 `origin main`。
- Commit message 使用簡潔英文描述實際變更。
- 推送後確認 Vercel 正式站回傳 HTTP 200，並確認新的前端資產或 API 行為已部署。
- 不使用 `git reset --hard`、`git checkout --` 等可能破壞使用者修改的指令。
