# Phase 0 Research：長輩用藥說明與個人紀錄

**Date**: 2026-10-30  
**Scope**: 僅為 [spec.md](./spec.md) 的 FR-001 至 FR-022 選定實作方式；不新增產品需求。

## 1. 後端權威、RLS 與 service-role

**Decision**: 每一個 Route Handler 都先透過 Supabase session 與 `profiles.is_active` 建立 caller 身分，再由 server-only service-role client 執行「已明確加入 owner/admin scope」的查詢。RLS 保留為第二層防線；一般使用者只具必要的讀取/建立草稿權限，正式資料更新與刪除只走受控的管理員 server API。

**Rationale**: service role 會繞過 RLS；現有 `app/api/medications/route.ts` 已先取得 caller 所屬處方再查 item，證明此範圍限制可在 server 落實。反之，`supabase/migrations/0001_initial_schema.sql` 現有 owner `FOR ALL` policies 會讓使用者直接更新/刪除其正式資料，與 FR-016 衝突。

**Alternatives considered**:

- 只依賴 service-role：拒絕，會造成跨帳號資料外洩。
- 只依賴 RLS：拒絕，現有 route 使用 service role，仍必須在 application layer 限縮查詢。
- 只從 UI 隱藏刪除按鈕：拒絕，無法阻擋直接 API/SDK 呼叫。

## 2. 正式確認的資料一致性

**Decision**: 「確認儲存」由一個資料庫 transaction/RPC 執行，並接收/保存 idempotency key。交易內依序驗證 caller、target owner、影像歸屬、影像未刪除、欄位完整性與官方參考資料，然後原子寫入 encounter、confirmed prescription、items、圖片關聯與 audit log。

**Rationale**: 現有 confirm handler 依序寫入多張表，任一後續失敗都可能留下 encounter 或 prescription。FR-022 要求正式狀態以後端確認結果為準，因此不能讓部分寫入或重試產生多筆正式紀錄。

**Alternatives considered**:

- 維持多個獨立 insert 並在失敗時前端重試：拒絕，不能保證回滾或去重。
- 前端先將狀態標記為 confirmed：拒絕，違反後端權威。

## 3. 管理員代管、圖片與稽核

**Decision**: 管理 API 只接受管理員明確指定的 target owner 或 resource ID；不得信任一般 client 傳入的 role/owner。圖片保持 private bucket，另提供授權後才核發短效 signed read URL 的 route，並寫入 `IMAGE_VIEWED` audit log。受控的修改、停用、刪除均以 soft delete 為預設且記錄前後摘要。

**Rationale**: 現有擷取、上傳和確認一律將 owner 固定為 caller，無法滿足 FR-017 的管理員代建；現有 bucket 已是私有但尚無讀取授權端點。操作必須能對應 FR-018 的 actor、時間、動作與對象。

**Alternatives considered**:

- 管理員 impersonate 長輩 session：拒絕，稽核邊界不清。
- 公開 bucket 或長效 URL：拒絕，違反 FR-015。
- hard delete：拒絕，破壞可追溯性與復原空間。

## 4. TFDA 同步與保守藥品比對

**Decision**: 以 [TFDA「全部藥品許可證資料集」](https://data.gov.tw/dataset/9122?page=1) 作為唯一可寫入 `drug_references` 的官方來源。同步工作下載官方 CSV/JSON，依 `(source='TFDA', source_identifier=許可證字號)` upsert，保留來源 URL、官方異動日與匯入時間；同步失敗保留上一版資料並留下可查錯誤。比對順序為：許可證字號精確匹配 → 中文/英文名稱、劑型與成分可唯一匹配 → `NEEDS_REVIEW`。

**Rationale**: 該官方資料集提供許可證字號、品名、適應症、劑型、主成分與異動日期等欄位，能符合 FR-011 的來源/更新資訊。藥名單獨命中、多候選、劑型或劑量矛盾、來源同步失敗都不能安全地自動選定官方資料。

**Alternatives considered**:

- 每次頁面載入即時搜尋外部服務：拒絕，資料版本與可用性不可重現。
- 只用名稱自動對照：拒絕，醫療資訊誤配風險過高。
- 讓 AI 決定官方匹配：拒絕，AI 不可取代官方資料與人工核對。

## 5. AI 影像擷取與安全狀態

**Decision**: OpenAI Responses structured output 僅儲存於 `extraction_jobs.result`。每張圖片有自己的 job/result；`unreadableAreas` 非空、低信心、JSON schema 解析失敗或資料矛盾時，候選一律 `NEEDS_REVIEW`。確認 endpoint 重新在 server 查驗 `drugReferenceId`，不信任 client UUID。

**Rationale**: 現有 schema 已要求「逐字擷取、不可猜測」，符合 FR-007、FR-012、FR-014。模型結果是候選而非處方事實；正式 `prescription_items` 只能由確認交易建立。

**Alternatives considered**:

- 擷取後直接建立 confirmed record：拒絕，違反逐項人工確認與 FR-022。
- 忽略讀不清區域：拒絕，可能把不確定內容顯示為正確。

## 6. 測試策略

**Decision**: 採三層測試：`lint`、`typecheck`、`build` 作快速靜態基線；Vitest 測 Zod、route handler、權限與 transaction failure；Playwright 搭配本機 Supabase/Docker、兩個 USER 與一個 ADMIN 的去識別 fixture 驗收跨帳號隔離及完整流程。

**Rationale**: 現有專案只有靜態 scripts，無測試框架；核心風險在 server-side authorization、service-role ownership、確認前不得正式化、私有圖片與 audit evidence。mock 讓單元測試快速定位錯誤，E2E 才能證明 RLS/Storage/流程行為。

**Alternatives considered**:

- 只測 E2E：拒絕，慢且難定位。
- 只 mock Supabase：拒絕，無法驗證 RLS 與 private Storage。
- 使用 production/shared project 測試：拒絕，會污染資料並增加個資風險。

## Resolved Research Outcome

沒有保留 `NEEDS CLARIFICATION`。實作前仍需由人工審查同步資料集、部署設定與資料保留操作是否符合實際環境；這些是部署治理檢查，不是本功能行為的未決假設。
