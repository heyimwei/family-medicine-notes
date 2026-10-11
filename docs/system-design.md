# 長輩用藥說明與個人紀錄系統：正式設計規格

> 文件狀態：需求確認完成，尚未開始實作或部署。
> 產品定位：家族限定的個人用藥資訊整理與衛教輔助系統；不是診斷、處方或醫療建議服務。

## 1. 目標與範圍

### 1.1 要解決的問題

長輩取得台灣醫療院所的處方箋、藥袋或藥盒後，能以拍照、上傳照片或手動輸入建立自己的用藥紀錄，並閱讀易懂的藥品一般用途與官方資料來源。系統需保留每位使用者的歷次紀錄，避免每次查詢都失去脈絡。

### 1.2 系統明確不做的事

- 不診斷疾病、不判定疾病階段、不推論病情改善或惡化。
- 不建議開始、停止、更換、增加或減少任何藥物或劑量。
- 不自動把影像辨識結果寫成正式紀錄；使用者或管理員必須逐筆確認。
- 不串接健保雲端藥歷、病歷或其他未經使用者上傳的醫療紀錄。
- 第一版不含吃藥提醒、服藥打卡、剩藥提醒、回診提醒、過敏或不良反應紀錄。
- 第一版不提供使用者自行刪除帳號或紀錄。

## 2. 使用者與權限

| 角色 | 帳號建立方式 | 資料可見範圍 | 可執行操作 |
| --- | --- | --- | --- |
| 長輩使用者 (`USER`) | 由管理員建立，提供初始密碼 | 僅自己的資料 | 登入、建議性修改密碼、拍照／上傳／手動建立草稿、確認草稿、瀏覽自己的紀錄 |
| 管理員 (`ADMIN`) | 系統初始管理員 | 全部帳號與資料 | 建立／停用帳號、代建紀錄、修正／刪除資料、檢視圖片、查閱稽核紀錄 |

帳號首次登入後顯示「建議修改初始密碼」提示，但不強制阻擋後續操作；使用者可在設定頁隨時變更密碼。

## 3. 核心使用流程

```text
登入
  -> 首頁：我的用藥紀錄
  -> 新增用藥紀錄
     -> 拍照 / 相簿上傳 / 手動輸入
     -> 顯示照片預覽，允許移除或新增照片
     -> AI 擷取候選內容（或直接建立手動草稿）
     -> 逐筆確認：藥名、劑量、頻率、天數、備註
     -> 官方資料比對與來源顯示
     -> 使用者按「確認儲存」
     -> 建立正式處方與藥品紀錄
  -> 查看單一藥品
     -> 本次處方資訊
     -> 一般用途與官方來源
     -> 本次就診原因／科別／醫師或藥師交代
     -> 安全提醒
```

### 3.1 影像輸入規格

- 支援手機相機拍攝與相簿圖片上傳；桌面版亦支援選檔上傳。
- 僅接受 `image/jpeg`、`image/png`、`image/webp`；上傳前與伺服器端皆驗證 MIME type、檔案簽名及大小。
- 第一版最大檔案大小：10 MB；超出時要求使用者重拍或壓縮。
- 介面必須提供大按鈕、清楚的「重新拍攝／換一張／加入下一張」操作與可讀錯誤訊息。
- 原始照片長期保存於私有 Storage；不提供公開 URL。
- 儲存前移除 EXIF 位置資訊；保留系統建立時間、檔案雜湊、MIME type 與大小供稽核。

## 4. 醫療安全與內容政策

### 4.1 顯示層固定安全文字

每個藥品頁與辨識確認頁都必須顯示：

> 本系統僅協助整理藥袋與藥品資訊，不提供診斷或個人化用藥建議。請勿依本頁內容自行停藥、換藥或調整劑量；有疑問請詢問醫師或藥師。

辨識不確定或官方比對失敗時，改顯示：

> 此藥品資訊尚未能可靠確認。請核對藥袋、詢問開立院所或藥師，勿依系統猜測結果服用。

### 4.2 就診脈絡欄位

使用 `就診原因`、`就診科別`、`醫師／藥師交代` 三個欄位，不使用或自動生成「疾病階段」。若使用者希望保存醫療文件上的階段文字，只能以原文備註方式輸入，且標記為「使用者輸入，未經系統判讀」。

### 4.3 藥品資料策略

1. 優先以 TFDA 藥品許可證資料集比對許可證字號、中文／英文藥名、成分、劑型與適應症。
2. 若藥袋有健保代碼，另保留為查詢線索；不可把代碼單獨視為唯一識別。
3. 每一筆說明記錄來源 URL、來源資料更新日、比對方法與比對信心等級。
4. GPT 只根據已比對的官方欄位，產生「一般常見用途」與白話說明；輸出必須是結構化資料，禁止額外推論病名、病程、劑量調整或相互作用結論。
5. 對應到多筆官方候選資料、劑型／劑量矛盾、或影像文字不清時，狀態維持 `NEEDS_REVIEW`，不得產生可當作正式紀錄的藥品連結。

## 5. 技術架構

```text
瀏覽器（長輩介面 / 管理後台）
    |
    | HTTPS；僅使用應用程式 API
    v
Next.js（Vercel）
    |- Server-side Auth / Authorization
    |- 上傳驗證、短效簽名 URL、影像工作流程
    |- OpenAI API 呼叫與結構化輸出驗證
    `- 稽核紀錄、速率限制與錯誤紀錄
    |
    +--> Supabase Auth（帳號、密碼、工作階段）
    +--> Supabase PostgreSQL（正式紀錄、RLS、稽核）
    `--> Supabase Storage 私有 bucket（原始照片）

官方資料同步工作（排程）
    `--> TFDA 官方開放資料 -> 藥品參考資料表
```

### 5.1 平台責任

- **Vercel**：部署 Next.js 前端與受保護 API route；保存伺服器端環境變數。
- **Supabase Auth**：email／密碼帳號、密碼雜湊與登入工作階段。
- **Supabase PostgreSQL**：結構化紀錄、資料列權限（RLS）、資料庫備份。
- **Supabase Storage**：私有的原始藥單、藥袋、藥盒照片。
- **OpenAI API**：影像文字擷取及已驗證資料的白話改寫；API key 僅能在伺服器端使用。

## 6. 資料模型

### 6.1 主要資料表

| 資料表 | 重要欄位 | 用途 |
| --- | --- | --- |
| `profiles` | `id`, `role`, `display_name`, `is_active`, `must_change_password_hint` | Supabase Auth 使用者的應用程式角色與顯示資料 |
| `encounters` | `id`, `owner_id`, `visit_date`, `reason`, `department`, `instructions`, `source` | 一次就診或一次用藥建立脈絡 |
| `prescriptions` | `id`, `encounter_id`, `status`, `confirmed_at`, `confirmed_by` | 使用者確認前後的處方容器 |
| `prescription_items` | `id`, `prescription_id`, `drug_reference_id`, `entered_name`, `dose_text`, `frequency_text`, `duration_days`, `notes`, `verification_status` | 每一顆／項藥品及處方寫法 |
| `drug_references` | `id`, `source`, `source_identifier`, `name_zh`, `name_en`, `ingredients`, `indications`, `dosage_form`, `source_url`, `source_updated_at` | 官方藥品參考資料快照 |
| `uploaded_images` | `id`, `owner_id`, `storage_path`, `sha256`, `mime_type`, `byte_size`, `uploaded_at` | 私有原始影像的中繼資料 |
| `extraction_jobs` | `id`, `image_id`, `status`, `model`, `raw_result_encrypted`, `error_code`, `created_at` | AI 擷取工作、失敗追蹤與結果版本 |
| `audit_logs` | `id`, `actor_id`, `action`, `entity_type`, `entity_id`, `before_summary`, `after_summary`, `ip_hash`, `created_at` | 可追溯的安全與管理操作 |

### 6.2 關聯與資料完整性

- `profiles 1 -> N encounters`：長輩只能擁有自己的就診紀錄。
- `encounters 1 -> N prescriptions 1 -> N prescription_items`：同次就診可保留多張藥單與多項藥品。
- `uploaded_images` 可與 `encounters` 和／或 `extraction_jobs` 關聯；不得僅依檔名推論擁有者。
- 已確認的 `prescription_items` 保存當時的官方參考資料版本或快照，避免官方資料後續更新造成歷史畫面無法解釋。
- 所有主表使用 UUID、UTC 時間戳、`created_at`、`updated_at`；刪除採管理員可追溯的 soft delete，照片於核准刪除後才執行受控實體刪除。

## 7. 權限與 API 合約

### 7.1 伺服器端規則

- 所有 API route 先驗證 session，再從資料庫讀取角色；不得相信前端傳入的 `role`、`ownerId` 或 storage path。
- `USER` 的讀寫條件固定為 `owner_id = auth.uid()`；`ADMIN` 由伺服器端明確判斷。
- Supabase RLS 為第二層防線；service role key 僅限 Next.js server 使用，永不送入 client bundle。
- 圖片讀取一律由授權 API 核發短效簽名 URL，並記錄 `IMAGE_VIEWED` audit log。

### 7.2 第一版 API

| 方法與路徑 | 權限 | 行為 |
| --- | --- | --- |
| `POST /api/uploads/presign` | USER / ADMIN | 驗證檔案後取得私有上傳授權 |
| `POST /api/extractions` | USER / ADMIN | 建立影像擷取工作；不可直接確認藥品 |
| `GET /api/extractions/{id}` | 擁有者 / ADMIN | 讀取候選結果與待確認欄位 |
| `POST /api/prescriptions` | USER / ADMIN | 建立草稿處方與就診脈絡 |
| `POST /api/prescriptions/{id}/confirm` | 擁有者 / ADMIN | 驗證所有必要欄位後，確認寫入正式紀錄 |
| `GET /api/medications` | USER / ADMIN | 長輩取自己的清單；管理員可依使用者篩選 |
| `POST /api/admin/users` | ADMIN | 建立長輩帳號與初始密碼流程 |
| `PATCH /api/admin/users/{id}` | ADMIN | 停用／啟用帳號或管理員代為重設密碼 |
| `DELETE /api/admin/records/{type}/{id}` | ADMIN | 受控刪除並寫入稽核紀錄 |
| `GET /api/admin/audit-logs` | ADMIN | 查閱操作紀錄 |

## 8. 資安、隱私與營運要求

### 8.1 必要防護

- HTTPS、secure + httpOnly + sameSite cookie、CSRF 防護、CSP、輸入驗證與輸出編碼。
- 登入與 AI 擷取 API 的 IP／帳號速率限制；連續失敗登入觸發暫時鎖定與管理員通知。
- 不在 application log、前端分析工具、錯誤追蹤服務中記錄處方內容、圖片 URL、密碼、access token 或 OpenAI API key。
- 開發、測試與正式環境分離；測試環境只能使用去識別的範例圖片。
- 只允許管理員邀請帳號，禁止公開註冊；正式網域啟用安全標頭與 Preview deployment 保護。

### 8.2 備份與還原

- 資料庫：使用 Supabase 的每日備份及付費方案 point-in-time recovery，並每季做一次還原演練。
- 圖片：建立每天至少一次的私有 bucket 物件清單與異地／獨立帳號備份策略；資料庫備份不包含 Storage 物件。
- 稽核紀錄：不可讓一般使用者編輯或刪除；保留期限於部署前由管理員設定。
- 建立事件通報流程：登入異常、大量下載、上傳惡意檔案、AI provider 錯誤、備份失敗都需可被管理員察覺。

## 9. 介面與無障礙準則

- 全繁體中文；預設大字、對比清楚、按鈕最小觸控目標 48px。
- 首頁只保留「新增藥單」、「我的用藥」、「設定」三個主要入口。
- 不靠顏色單獨傳達狀態；所有狀態附文字，例如「待確認」、「已確認」、「查無可靠比對」。
- 長文字一律分段、避免醫療術語堆疊；英文藥名可保留但需與中文說明分開顯示。
- 未來語音朗讀預留內容欄位與播放入口，但第一版不實作國語／台語 TTS。

## 10. 驗收條件

1. 長輩可在手機瀏覽器拍照或從相簿上傳藥袋圖片，並在上傳前預覽與替換。
2. 上傳後任何 AI 結果都只能存在草稿；未逐項確認不可出現在正式用藥清單。
3. 使用者 A 不能透過介面、API 或猜測 ID 讀取使用者 B 的資料或圖片；管理員可以。
4. 管理員可建立帳號、代建紀錄、停用帳號與受控刪除資料，且每次操作都有 audit log。
5. 每筆已比對藥品都可看到官方資料來源、資料更新資訊與比對狀態。
6. 比對不確定時不會顯示肯定藥品結論，且會提供重新拍照／手動修正／詢問藥師提示。
7. 所有藥品頁均顯示非醫療建議與不可自行調藥警示。
8. 已完成資料庫與圖片備份的還原演練，並記錄結果。

## 11. 實作前待辦

1. 建立 Next.js + TypeScript 專案與測試、格式化、CI 基線。
2. 建立 Supabase 專案，設定 Auth、私有 Storage bucket、RLS 與正式資料庫 migration。
3. 確認 TFDA 資料集下載／同步方式、授權條款、欄位映射及資料更新排程。
4. 設計 AI 的 JSON Schema、提示詞、錯誤回退與人機確認畫面。
5. 建立管理員初始化機制，避免公開註冊與第一個管理員被任意建立。
6. 配置 Vercel Preview／Production 環境、環境變數、網域與備份監控。