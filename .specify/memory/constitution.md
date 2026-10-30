<!--
Sync Impact Report
Version change: unratified template -> 1.0.0
Modified principles: none; this is the initial adoption.
Added sections: Core Principles, Requirements and Traceability Controls,
Development Workflow and Quality Gates, Governance.
Removed sections: none.
Follow-up TODOs: none.
-->

# 安心用藥紀錄 Constitution

## Core Principles

### I. 核准需求是唯一實作依據

所有功能、資料模型、介面、整合、測試與變更 MUST 源自已由專案負責人核准的
需求、`spec.md`、`plan.md` 與 `tasks.md`。AI 與開發者 MUST NOT 自行新增、刪除或
變更需求範圍。需求不明確、互相矛盾或缺少驗收條件時，MUST 先提出
Clarification 並取得核准；不得以推測直接實作。

理由：用藥資訊系統的範圍與內容必須受控，避免未經同意的功能改變影響使用者。

### II. 端到端可追溯與後端權威

每項需求 MUST 能從需求來源追溯至 Specification、Plan、Task、Code 與 Test，並能
反向由程式與測試追溯其對應 Task 與規格。所有可持久化或可影響使用者畫面的狀態
MUST 以後端為唯一真實來源；前端快取、表單草稿或 AI 回應 MUST NOT 被視為已確認
的系統事實。

理由：可追溯性使變更可審核與回歸驗證，後端權威可避免不同客戶端產生不一致資料。

### III. 任務細粒度與可驗證交付

每一項 Task MUST 有單一明確目的、可辨識的產出、相依關係與獨立驗證方式。Task
MUST 能在不依賴未完成的無關工作下完成與測試；過大的工作 MUST 拆分為可獨立審查
與執行的子項。每個 Task 的驗證 MUST 明確指出測試、檢查或人工驗收證據。

理由：細粒度任務讓進度、風險與測試責任可管理，也避免將未驗證的工作包裝為完成。

### IV. 繁體中文文件與人工審查

所有規格、設計文件、測試說明及程式註解 MUST 使用繁體中文；程式識別字 MUST 使用
英文。所有 AI 產出，包括需求詮釋、規格、程式、測試與文件，MUST 經人類審查、確認
其正確性與適用性後方可採用。AI 產出 MUST NOT 因產生即被視為已核准的需求或證據。

理由：一致的文件語言提高利害關係人的可讀性；人工審查保留對系統行為的最終責任。

### V. 規格驅動流程與一致性閘門

開發 MUST 依序遵循 Constitution → Specify → Clarify → Plan → Tasks → Analyze →
Implement。除非專案負責人明確核准並記錄例外，MUST NOT 直接跳至程式實作。每次
實作完成前，MUST 比對 `spec.md`、`plan.md`、`tasks.md` 與程式碼的一致性；發現差異
MUST 修正工件或提出 Clarification，不得隱藏或忽略。

理由：明確流程讓需求先於實作，並以跨工件檢查阻止規格漂移。

## Requirements and Traceability Controls

- 每一份 `spec.md` MUST 陳述可驗收的需求與範圍界線；詳細功能行為 MUST 留在
  `spec.md`，不得以 Constitution 取代功能規格。
- `plan.md` MUST 指向其實作的規格要求，並說明技術選擇如何滿足需求。
- `tasks.md` MUST 對應 Plan 與 Specification，並為每項 Task 記錄可驗證完成條件。
- Code review 與 Test 證據 SHOULD 引用對應的 Task 或需求識別；若無法建立追溯鏈，
  該變更 MUST NOT 被宣告為完成。

## Development Workflow and Quality Gates

1. 在實作前，MUST 先完成並由人工審查當前階段的工件。
2. 在 Plan 前，需求歧義 SHOULD 透過 Clarify 處理；若 Clarification 未完成，Plan MUST
   明確列出阻塞項，且 MUST NOT 將其假設成已核准需求。
3. 在 Implement 前，MUST 執行 Analyze 或記錄經核准的跳過理由。
4. 實作與測試完成後，MUST 檢查規格、計畫、任務、程式與測試的雙向一致性，並記錄
   未完成、風險或環境限制。
5. 所有採用的 AI 產出 MUST 保留足以進行人工審查的來源或變更證據。

## Governance

本 Constitution 高於一般開發慣例、AI 建議與未記錄的口頭假設。任何變更 MUST 由
專案負責人核准，並在修訂時更新本文件頂端的 Sync Impact Report、版本與日期。

版本採 Semantic Versioning：移除或重新定義既有治理義務為 MAJOR；新增或實質擴張
原則、流程或強制控制為 MINOR；不改變治理意義的文字澄清或排版修正為 PATCH。

每次規格、計畫、任務或實作審查 MUST 驗證本 Constitution 的遵循情況。任何例外 MUST
記錄其範圍、理由、核准者、到期或複查條件；未記錄的例外 MUST 視為不符合。

**Version**: 1.0.0 | **Ratified**: 2026-10-11 | **Last Amended**: 2026-10-11
