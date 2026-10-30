# Implementation Plan: 長輩用藥說明與個人紀錄

**Branch**: `001-medicine-records` | **Date**: 2026-10-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-medicine-records/spec.md`

## Summary

以 Next.js 15 App Router 建立全繁體中文、家族限定的用藥紀錄服務。瀏覽器只負責呈現、選圖與編輯草稿；Next.js Route Handlers 先驗證 Supabase session 與 `profiles` 角色/啟用狀態，再執行受限資料操作。Supabase PostgreSQL 保存正式紀錄與稽核資料，私有 Storage 保存原始圖片；OpenAI Responses 的影像擷取僅產生待確認草稿；TFDA 官方資料同步與比對提供可追溯的一般用途來源。只有後端交易成功建立的 `CONFIRMED` 處方才是正式紀錄。

## Technical Context

**Language/Version**: TypeScript 5.8、Node.js（Next.js 15.2.4 runtime）

**Primary Dependencies**: Next.js 15 App Router、React 19、`@supabase/ssr`、`@supabase/supabase-js`、Zod 3、OpenAI Responses API；新增 Vitest 與 Playwright 作測試

**Storage**: Supabase PostgreSQL（RLS + migration）、Supabase Auth、私有 `medication-images` Storage bucket；TFDA 官方資料快照寫入 PostgreSQL

**Testing**: ESLint、TypeScript、Next.js production build；Vitest 的 validation/route/integration 測試；Playwright + 本機 Supabase/Docker 的去識別 E2E

**Target Platform**: 支援現代手機與桌面瀏覽器的 Vercel/Node.js Web application；Supabase 託管服務

**Project Type**: 單一 Next.js 全端 Web application

**Performance Goals**: 主要讀取 API 在正常資料量下 p95 小於 500 ms（不含影像擷取）；圖片建立後立即提供草稿處理狀態；一次最多 5 張、每張最多 10 MiB

**Constraints**: 全繁體中文、大按鈕與最小 48 px 觸控目標；不可公開原始圖片、不可讓 API key 進入瀏覽器；不可診斷或調整用藥；未確認或無可靠官方對應的資料不得被宣稱為確定；正式確認與稽核寫入必須具原子性與重試去重

**Scale/Scope**: 少數受邀家人、兩種角色（`USER`/`ADMIN`）、單一私有圖片 bucket；第一版不含提醒、打卡、過敏/不良反應或語音朗讀

## Constitution Check

### Phase 0 gate — PASS

| 憲章要求 | 設計回應 | 結果 |
| --- | --- | --- |
| 核准需求是唯一依據 | 範圍僅實作 FR-001 至 FR-022；排除清單明列於本計畫與 quickstart。 | PASS |
| 後端權威與可追溯 | 明定 session/profile 驗證、service-role 範圍限制、RLS、正式確認交易、audit log 與需求驗證矩陣。 | PASS |
| 任務細粒度、可驗證 | 後續 `tasks.md` 必須將 migration、route、UI、TFDA 同步、測試拆成可獨立驗證工作。 | PASS |
| 繁中與人工審查 | 本文件及其生成設計工件均為繁中；AI 擷取與本計畫都需人工審查，不能自行變更需求。 | PASS |
| 規格驅動流程 | 本階段只完成 Plan；Implement 前需生成 Tasks、執行 Analyze，並取得人工審查。 | PASS |

**Required review before implementation**: 專案負責人需確認本計畫與 `research.md` 的安全邊界、官方資料來源與測試策略；這是治理審查，不是未解析的功能需求。

## Project Structure

### Documentation (this feature)

```text
specs/001-medicine-records/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── openapi.yaml
└── tasks.md                    # 由 speckit-tasks 產生，尚未建立
```

### Source Code (repository root)

```text
app/
├── api/
│   ├── admin/users/route.ts
│   ├── extractions/route.ts
│   ├── medications/route.ts
│   ├── prescriptions/confirm/route.ts
│   └── uploads/presign/route.ts
├── auth/signout/route.ts
├── login/page.tsx
├── layout.tsx
└── page.tsx
components/
└── medication-workspace.tsx
lib/
├── supabase/{admin,browser,server}.ts
├── auth.ts
├── env.ts
└── validation.ts
supabase/migrations/
└── 0001_initial_schema.sql
tests/                           # 後續建立：unit、integration、e2e fixture
```

**Structure Decision**: 維持現有單一 Next.js 專案。HTTP route、授權與資料寫入在 `app/api`/`lib`；UI 保持在 `app`/`components`；所有 schema 變更透過 `supabase/migrations`。不新建獨立後端或微服務，避免在少量家族使用者場景增加部署與授權複雜度。

## Design Decisions and Delivery Sequence

1. 先補足資料庫約束、最小權限 RLS 與受控 server-side mutation。一般使用者不能直接更新或刪除正式紀錄/圖片；所有 list/detail query 預設排除 soft-deleted 資料。
2. 將草稿、官方比對與正式確認分開。影像擷取結果只進 `extraction_jobs.result`；確認端點以資料庫 transaction/RPC 驗證影像歸屬、目標 owner、所有項目、官方 reference，再一次寫入 encounter、prescription、items、圖片關聯與 audit log。
3. 以受權限保護的 signed read URL 支援圖片檢視；管理員代管使用明確 target owner/resource，並在 audit log 記錄 actor、動作、對象與摘要。
4. 建立可重跑的 TFDA 同步與保守比對。官方許可證字號精確匹配優先；其他情況只有在名稱、劑型、成分可唯一對應時才標為 `MATCHED`，仍需人工確認；不確定永遠維持 `NEEDS_REVIEW`。
5. 最後補強長輩 UI、管理後台與自動化測試。所有 UI 顯示的正式狀態都由 server 回傳，不以 React local state 或 AI 內容為權威。

## Constitution Check (post-design)

### Phase 1 gate — PASS

設計工件將每個外部 API 的 authentication、ownership、回應狀態與錯誤碼寫入 contract；資料模型定義 state transition、soft-delete 與稽核欄位；quickstart 定義以本機去識別資料驗證的指令與預期結果。未引入未核准的醫療建議、公開註冊、公開圖片或第一版排除功能。

**Known implementation risks to track in Tasks**:

- 現有 `/api/prescriptions/confirm` 是多步 service-role 寫入，失敗時可能留下半完成資料；必須以 transaction/RPC 與 idempotency key 取代。
- 現有 owner `FOR ALL` RLS policies 允許直接更新/刪除，違反 FR-016；必須以 migration 收緊。
- 現有管理員僅能建立使用者，尚未有代建、修改、停用、刪除、圖片檢視或 audit 查閱端點。
- 現有 TFDA 同步/唯一比對、圖片讀取 signed URL、草稿讀取 API、密碼提示與 UI 明細尚未完成。

## Complexity Tracking

無憲章違反；不需要例外追蹤。
