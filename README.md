# 安心用藥紀錄

家族限定的繁體中文用藥資訊整理系統。使用者可以拍攝或上傳藥袋照片、確認擷取結果，並保存自己的用藥紀錄；管理員可管理帳號與稽核紀錄。

## 狀態

- 已完成：Next.js 介面、手機拍照／相簿選檔、登入頁、受保護 API、私有圖片上傳流程、OpenAI 影像擷取流程、使用者／管理員權限 schema、Supabase PostgreSQL/RLS migration、Git repository。
- 尚未完成：建立外部 Supabase／OpenAI 帳號、套用 migration、TFDA 同步排程、正式管理員初始化、部署與備份還原演練。

本系統不是診斷或用藥建議服務。使用者必須確認每筆結果，且不可依系統內容自行停藥、換藥或調整劑量。

## 本機啟動（PowerShell）

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

開啟 `http://localhost:3000`。未填 Supabase 設定時會啟動安全的示範畫面，不會把照片上傳到任何外部服務。

## 接上真實服務（PowerShell）

1. 於 Supabase 建立 project，建立私有 bucket 前先套用本專案 migration。
2. 將 URL、anon key、service role key 與 OpenAI API key 寫入 `.env.local`；`.env.local` 已被 Git 忽略。
3. 套用 migration 後，首次管理員需由 Supabase SQL Editor 建立 profile：

```sql
insert into public.profiles (id, role, display_name)
values ('<Supabase Auth user UUID>', 'ADMIN', '管理員姓名');
```

4. 以管理員帳號登入，從後台建立長輩帳號。服務端會建立 `USER` profile，長輩不能自行取得管理員權限。

> `SUPABASE_SERVICE_ROLE_KEY` 與 `OPENAI_API_KEY` 絕不可放到 `NEXT_PUBLIC_` 變數、前端程式碼、Git commit 或截圖中。

## 建議的下一步

1. 建立 Supabase 專案並設定 Auth、私有 `medication-images` bucket。
2. 使用 Supabase CLI 套用 `supabase/migrations/0001_initial_schema.sql`。
3. 實作受伺服器端驗證保護的登入、上傳、擷取、確認與管理 API。
4. 建立 TFDA 資料集的可重複同步程序與欄位比對測試。
5. 完成安全驗證、備份／還原演練後，再配置 Vercel Production。
