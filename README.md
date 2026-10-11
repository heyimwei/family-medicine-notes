# 安心用藥紀錄

家族限定的繁體中文用藥資訊整理系統。使用者可以拍攝或上傳藥袋照片、確認擷取結果，並保存自己的用藥紀錄；管理員可管理帳號與稽核紀錄。

## 狀態

- 已完成：Next.js 介面骨架、手機拍照／相簿選檔介面、管理後台原型、Supabase PostgreSQL/RLS migration、Git repository。
- 尚未完成：Supabase 專案設定、真實登入、私有圖片上傳、TFDA 資料同步、OpenAI 擷取、管理員初始化、部署。

本系統不是診斷或用藥建議服務。使用者必須確認每筆結果，且不可依系統內容自行停藥、換藥或調整劑量。

## 本機啟動（PowerShell）

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

開啟 `http://localhost:3000`。目前畫面使用範例資料，不會把照片上傳到任何外部服務。

## 建議的下一步

1. 建立 Supabase 專案並設定 Auth、私有 `medication-images` bucket。
2. 使用 Supabase CLI 套用 `supabase/migrations/0001_initial_schema.sql`。
3. 實作受伺服器端驗證保護的登入、上傳、擷取、確認與管理 API。
4. 建立 TFDA 資料集的可重複同步程序與欄位比對測試。
5. 完成安全驗證、備份／還原演練後，再配置 Vercel Production。