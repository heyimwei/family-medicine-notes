# Data Model：長輩用藥說明與個人紀錄

本模型對應 `supabase/migrations/0001_initial_schema.sql`，後續 migration 必須補足下列約束與欄位。所有時間儲存為 UTC；所有正式讀取預設排除 `deleted_at IS NOT NULL`。

## Entities

| Entity | 重要欄位 | 關係與規則 |
| --- | --- | --- |
| `profiles` | `id`, `role`, `display_name`, `is_active`, `password_change_hint_dismissed` | 對應 `auth.users`。只有 `ADMIN` 可建立、停用或協助重設；停用者不能取得 app 資料。 |
| `encounters` | `id`, `owner_id`, `visit_date`, `reason`, `department`, `instructions`, `deleted_at` | 一名 owner 有多次就診脈絡。欄位允許未提供，但 UI 必須明示。 |
| `prescriptions` | `id`, `encounter_id`, `status`, `confirmed_at`, `confirmed_by`, `deleted_at` | 一個 encounter 有多筆處方容器；正式列表只接受 `status=CONFIRMED`。 |
| `prescription_items` | `id`, `prescription_id`, `entered_name`, `dose_text`, `frequency_text`, `duration_days`, `notes`, `drug_reference_id`, `verification_status`, `deleted_at` | 每筆處方有 1–50 項。`entered_name` 必填；天數若存在須為正數；來源無法唯一對應時仍可保留人工確認的原始處方文字，但狀態為 `NEEDS_REVIEW`。 |
| `uploaded_images` | `id`, `owner_id`, `encounter_id`, `storage_path`, `sha256`, `mime_type`, `byte_size`, `deleted_at` | 每筆只屬於一位 owner；限 JPEG/PNG/WebP、最多 10 MiB；實體檔案在 private bucket，不保存公開 URL。 |
| `extraction_jobs` | `id`, `image_id`, `owner_id`, `status`, `model`, `result`, `error_code`, `completed_at` | 每張圖片至少一個 job；結果永遠是草稿，不能直接成為 prescription item。 |
| `drug_references` | `id`, `source`, `source_identifier`, `name_zh`, `name_en`, `ingredients`, `indications`, `dosage_form`, `source_url`, `source_updated_at`, `imported_at` | 來源固定 `TFDA`；`(source, source_identifier)` 唯一。後續 migration 加入比對方法、比對信心與歷史快照/版本證據，避免官方更新改寫歷史可解釋性。 |
| `audit_logs` | `id`, `actor_id`, `action`, `entity_type`, `entity_id`, `before_summary`, `after_summary`, `ip_hash`, `created_at` | 管理員帳號/資料/圖片動作與圖片檢視必須有 actor、時間、動作、目標；一般使用者不可讀寫。 |

## Relationships

```text
auth.users 1 ── 1 profiles
profiles 1 ── N encounters 1 ── N prescriptions 1 ── N prescription_items
profiles 1 ── N uploaded_images ── 0..1 encounters
uploaded_images 1 ── N extraction_jobs
drug_references 1 ── N prescription_items
profiles 1 ── N audit_logs (actor)
```

## State Transitions

### Prescription

```text
DRAFT ──(server transaction + explicit confirmation)──> CONFIRMED
DRAFT/CONFIRMED ──(ADMIN soft delete + audit)─────────> DELETED
```

- `DRAFT` 不出現在正式用藥清單。
- `CONFIRMED` 只能在 owner/admin 的確認交易成功後建立；`confirmed_by` 必填。
- `DELETED` 保留 audit trace，不可被一般使用者復原或查看。

### Prescription item verification

```text
AI/manual candidate ──> NEEDS_REVIEW
unique official candidate ──> MATCHED
explicit human confirmation + valid reference ──> CONFIRMED
```

- `MATCHED` 不等於處方正確；它只表示 server 找到單一官方候選，仍需人工確認。
- 多候選、名稱單獨匹配、劑型/劑量矛盾、已註銷或同步失敗皆維持 `NEEDS_REVIEW`。

### Extraction job

```text
QUEUED -> PROCESSING -> SUCCEEDED | FAILED
```

- `SUCCEEDED.result` 是 schema 驗證後的擷取草稿；低信心或讀不清區域仍禁止自動確認。
- 每張圖片保存自己的結果，避免將多張圖的聚合結果重複寫入所有 job。

## Authorization Invariants

1. `USER` 僅能讀自己的非刪除資料與授權簽發的圖片 URL，不能直接 update/delete 正式紀錄或圖片。
2. `ADMIN` 能以明確目標 owner 操作資料；每個代管、停用、修改、刪除與圖片檢視都寫 audit log。
3. service-role query 必須在 server 依 caller role 加上 owner/admin 範圍；不得把 RLS 當作 service-role 的唯一保護。
4. confirm transaction 驗證所有 image ID 都屬於 target owner 且未刪除，並防止同一 idempotency key 重複建立正式紀錄。
