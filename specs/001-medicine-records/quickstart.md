# Quickstart：驗證長輩用藥紀錄

本指南是 feature 完成後的可重跑驗收流程，不放入真實藥袋、真實帳密、service-role key 或 OpenAI API key。

## Prerequisites

- **PowerShell**：Node.js 與 npm；Docker Desktop；Supabase CLI（供本機測試）。
- 本機 Supabase 已依 migration 建立 schema、private `medication-images` bucket、去識別資料與三個帳號：`USER_A`、`USER_B`、`ADMIN`。
- `.env.local` 僅有本機或測試環境的 URL/key；不可 commit。影像 fixture 為去識別的 JPEG/PNG/WebP。

## Install and static verification

在 **PowerShell，專案根目錄** 執行：

```powershell
npm install
npm run lint
npm run typecheck
npm run build
```

預期：三個指令皆以 exit code 0 結束，且不出現 secret、型別或 production build error。

## Automated verification

在 **PowerShell，專案根目錄** 執行：

```powershell
npm run test:unit
npm run test:integration
npm run test:e2e
```

預期：

- unit：拒絕非法 MIME、超過 10 MiB、無效 hash/UUID、空藥品與過長欄位；不呼叫真實 OpenAI。
- integration：未登入一律 `401`、一般 USER 呼叫管理 API 為 `403`、停用帳號無法讀取、外來 image ID 為 `403`、confirm 失敗不留下半完成正式資料。
- E2E：以去識別圖片完成 `USER_A` 草稿 → 核對 → 確認；`USER_B` 無法讀 A 的紀錄或圖片；`ADMIN` 代管操作與圖片檢視皆產生 audit record。

若目前尚未新增這些 scripts，這代表 feature 尚未完成測試基線，不可把上述結果宣告為已通過。

## Manual acceptance scenarios

| Scenario | 操作 | Expected outcome |
| --- | --- | --- |
| 確認前草稿 | 以 USER_A 上傳去識別圖片，進行擷取但不按確認 | 候選顯示待確認，不出現在正式清單。 |
| 不可靠比對 | 使用模糊、多候選或無來源 fixture | 顯示待確認與詢問醫師/藥師提示；不出現確定用途。 |
| 正式確認 | USER_A 修正必要欄位並確認 | 後端交易建立正式紀錄，顯示處方、就診脈絡、來源狀態與非醫療建議聲明。 |
| 跨帳號隔離 | USER_B 嘗試猜測 USER_A 的 record/image ID | API 與圖片檢視皆拒絕；不得取得 signed URL。 |
| 管理員受控操作 | ADMIN 代建、修正、停用或 soft-delete 一筆測試資料 | 資料狀態正確，audit log 有 actor/time/action/target。 |
| 範圍檢查 | 檢視 UI/route 清單 | 不存在公開註冊、提醒、打卡、過敏/不良反應或自助刪除功能。 |

完整 request/response 與錯誤碼見 [contracts/openapi.yaml](./contracts/openapi.yaml)，資料欄位與狀態見 [data-model.md](./data-model.md)。
