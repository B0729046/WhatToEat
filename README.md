# WhatToEat

給朋友快速決定「今天吃什麼」的純前端工具。可依餐別、預算、料理與地區篩選，再以動畫隨機抽選。

## 技術與本機執行

Vite、React（JavaScript）、Tailwind CSS v4、Motion for React（Framer Motion）與 Lucide React。資料在 `src/data/foods.js`，不使用後端或資料庫。

```powershell
cd C:\Projects\WhatToEat
$env:NODE_OPTIONS="--use-system-ca"
npm install
npm run dev
```

開啟終端顯示的網址（通常是 `http://localhost:5173`）。正式建置使用 `npm run build`。

公司網路若需 Windows System CA，可為目前使用者永久設定（重開終端後生效）：

```powershell
[Environment]::SetEnvironmentVariable("NODE_OPTIONS", "--use-system-ca", "User")
```

## 修改資料

編輯 `src/data/foods.js`。每筆需有 `name`、`category`、`price`、`area`、`meal`，篩選選項會自動產生。

## 初始化 Git 並 Push 到 GitHub

先在 GitHub 建立空白的公開 `WhatToEat` repository，再執行：

```powershell
git init
git add .
git commit -m "Initial WhatToEat app"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/WhatToEat.git
git push -u origin main
```

把 `YOUR_USERNAME` 換成 GitHub 帳號。也可在 commit 後使用 `gh repo create WhatToEat --public --source=. --remote=origin --push`。

## 部署到 Vercel

1. 登入 [Vercel](https://vercel.com/)，選 **Add New → Project**。
2. 匯入 GitHub 的 `WhatToEat` repository。
3. Framework Preset 選 **Vite**，Build Command 為 `npm run build`，Output Directory 為 `dist`。
4. 按 **Deploy**，完成後會得到公開的 `*.vercel.app` 網址；往後 push 到 `main` 會自動重新部署。

本專案不需要環境變數、API 或資料庫。
