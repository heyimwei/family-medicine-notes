"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import type { AppUser } from "@/lib/auth";

type Medication = {
  id: string;
  name: string;
  genericName: string;
  use: string;
  dose: string;
  schedule: string;
  status: "已確認" | "待確認";
  source: string;
};

const startingMedications: Medication[] = [
  {
    id: "med-1",
    name: "脈優錠 5 毫克",
    genericName: "Amlodipine",
    use: "常見用於控制血壓；請依醫師開立方式服用。",
    dose: "1 錠",
    schedule: "每天早上一次",
    status: "已確認",
    source: "TFDA 藥品許可證資料（範例）",
  },
  {
    id: "med-2",
    name: "胃舒平膠囊",
    genericName: "待核對成分",
    use: "藥袋文字尚待確認，請核對藥名、劑量與服用方式。",
    dose: "未確認",
    schedule: "未確認",
    status: "待確認",
    source: "尚未完成官方資料比對",
  },
];

function UploadIcon() {
  return <span aria-hidden="true" className="icon">⌁</span>;
}

type WorkspaceProps = { demoMode: boolean; user?: AppUser };

export default function MedicationWorkspace({ demoMode, user }: WorkspaceProps) {
  const [screen, setScreen] = useState<"home" | "add" | "admin">("home");
  const [photos, setPhotos] = useState<File[]>([]);
  const [uploadedImageIds, setUploadedImageIds] = useState<string[]>([]);
  const [medications, setMedications] = useState<Medication[]>(demoMode ? startingMedications : []);
  const [notice, setNotice] = useState(demoMode ? "這是本機畫面原型，尚未連接真實帳號或醫療資料。" : "正在讀取你的用藥紀錄。");
  const [isWorking, setIsWorking] = useState(false);
  const [adminCreateMessage, setAdminCreateMessage] = useState("");
  const confirmedCount = useMemo(
    () => medications.filter((medication) => medication.status === "已確認").length,
    [medications],
  );

  useEffect(() => {
    if (demoMode) return;
    void fetch("/api/medications").then(async (response) => {
      if (!response.ok) throw new Error("MEDICATION_LOAD_FAILED");
      const body = await response.json() as { medications: Array<{ id: string; entered_name: string; dose_text: string | null; frequency_text: string | null; verification_status: "CONFIRMED" | "NEEDS_REVIEW"; drug_references: { name_en: string | null; indications: string | null; source_url: string | null } | null }> };
      setMedications(body.medications.map((medication) => ({
        id: medication.id,
        name: medication.entered_name,
        genericName: medication.drug_references?.name_en ?? "待核對成分",
        use: medication.drug_references?.indications ?? "尚未完成官方資料比對，請以藥袋與藥師說明為準。",
        dose: medication.dose_text ?? "未確認",
        schedule: medication.frequency_text ?? "未確認",
        status: medication.verification_status === "CONFIRMED" ? "已確認" : "待確認",
        source: medication.drug_references?.source_url ?? "尚未完成官方資料比對",
      })));
      setNotice("已載入你的已確認與待確認紀錄。");
    }).catch(() => setNotice("目前無法讀取用藥紀錄，請重新整理或聯絡管理員。"));
  }, [demoMode]);

  function choosePhotos(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    const supported = selected.filter((file) => ["image/jpeg", "image/png", "image/webp"].includes(file.type));
    setPhotos((current) => [...current, ...supported].slice(0, 5));
    setNotice(
      supported.length === selected.length
        ? `已加入 ${supported.length} 張照片。送出前可再檢查。`
        : "只接受 JPG、PNG 或 WEBP 圖片；不支援的檔案沒有加入。",
    );
  }

  function confirmExample() {
    if (!demoMode) return;
    setMedications((current) =>
      current.map((medication) =>
        medication.status === "待確認"
          ? { ...medication, status: "已確認", dose: "請依藥袋核對", schedule: "請依藥袋核對" }
          : medication,
      ),
    );
    setNotice("範例已標記為確認。正式系統會在這一步寫入受權限保護的資料庫。\n");
  }

  async function sha256(file: File) {
    const hash = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    return Array.from(new Uint8Array(hash)).map((value) => value.toString(16).padStart(2, "0")).join("");
  }

  async function startRecognition() {
    if (demoMode) { setNotice("範例模式不會將照片送出。部署前填入 .env.local 後會啟用真實辨識。\n"); return; }
    setIsWorking(true);
    try {
      const imageIds: string[] = [];
      for (const photo of photos) {
        const response = await fetch("/api/uploads/presign", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filename: photo.name, mimeType: photo.type, byteSize: photo.size, sha256: await sha256(photo) }) });
        if (!response.ok) throw new Error("PRESIGN_FAILED");
        const upload = await response.json() as { imageId: string; signedUrl: string; token: string };
        const uploadResponse = await fetch(upload.signedUrl, { method: "PUT", headers: { "x-upsert": "false", Authorization: `Bearer ${upload.token}`, "Content-Type": photo.type }, body: photo });
        if (!uploadResponse.ok) throw new Error("UPLOAD_FAILED");
        imageIds.push(upload.imageId);
      }
      setUploadedImageIds(imageIds);
      const extractionResponse = await fetch("/api/extractions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageIds }) });
      if (!extractionResponse.ok) throw new Error("EXTRACTION_FAILED");
      const extraction = await extractionResponse.json() as { result: { medications: Array<{ name: string; doseText?: string; frequencyText?: string }> } };
      setMedications(extraction.result.medications.map((item, index) => ({ id: `draft-${index}`, name: item.name, genericName: "待核對成分", use: "尚未完成官方資料比對，請核對藥袋。", dose: item.doseText ?? "未確認", schedule: item.frequencyText ?? "未確認", status: "待確認", source: "AI 擷取草稿，尚未儲存" })));
      setScreen("home");
      setNotice("已產生草稿。請逐筆核對名稱、劑量與頻率後，再按下確認儲存。");
    } catch {
      setNotice("照片上傳或辨識失敗。請確認網路、照片格式，或改用手動輸入。\n");
    } finally { setIsWorking(false); }
  }

  async function confirmMedicationRecords() {
    if (demoMode) { confirmExample(); return; }
    const pending = medications.filter((medication) => medication.status === "待確認");
    if (pending.length === 0) return;
    setIsWorking(true);
    try {
      const response = await fetch("/api/prescriptions/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageIds: uploadedImageIds, items: pending.map((medication) => ({ enteredName: medication.name, doseText: medication.dose === "未確認" ? undefined : medication.dose, frequencyText: medication.schedule === "未確認" ? undefined : medication.schedule })) }) });
      if (!response.ok) throw new Error("CONFIRM_FAILED");
      setMedications((current) => current.map((medication) => medication.status === "待確認" ? { ...medication, status: "已確認", source: "已確認；官方資料比對待同步" } : medication));
      setNotice("已儲存確認後的用藥紀錄。請留意：這不代表系統確認用藥正確，仍應以藥袋與藥師說明為準。\n");
    } catch { setNotice("儲存失敗，草稿尚未寫入。請稍後重試。\n"); }
    finally { setIsWorking(false); }
  }

  async function createElderAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (demoMode) { setAdminCreateMessage("示範模式不會建立帳號。請先設定 Supabase。\n"); return; }
    const form = new FormData(event.currentTarget);
    setIsWorking(true);
    setAdminCreateMessage("");
    try {
      const response = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayName: form.get("displayName"), email: form.get("email"), password: form.get("password") }) });
      if (!response.ok) throw new Error("USER_CREATE_FAILED");
      event.currentTarget.reset();
      setAdminCreateMessage("帳號已建立。請以安全方式把初始密碼交給長輩，並提醒他登入後可自行修改。\n");
    } catch { setAdminCreateMessage("帳號建立失敗。請檢查電子郵件是否重複、密碼是否至少 12 碼，或聯絡系統管理員。\n"); }
    finally { setIsWorking(false); }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <button className="brand" onClick={() => setScreen("home")} aria-label="回到我的用藥">
          <span className="brand-mark">安</span>
          <span>安心用藥紀錄</span>
        </button>
        <div className="user-area">
          <span className="user-name">{user?.displayName ?? "王媽媽"}</span>
          {user?.role === "ADMIN" && <button className="outline-button" onClick={() => setScreen("admin")}>管理者</button>}
        </div>
      </header>

      <section className="safety-banner" aria-label="醫療安全提醒">
        <strong>重要提醒</strong>
        <span>這裡協助整理用藥資訊，不提供診斷或調整藥物建議。任何疑問請詢問醫師或藥師。</span>
      </section>

      {screen === "home" && (
        <>
          <section className="hero">
            <p className="eyebrow">王媽媽的用藥</p>
            <h1>今天想查看哪一個藥？</h1>
            <p>已確認 {confirmedCount} 項用藥。新的藥袋可以拍照後慢慢核對。</p>
            <button className="primary-button large" onClick={() => setScreen("add")}>
              <UploadIcon /> 新增藥單或藥袋
            </button>
          </section>

          <section className="content-section" aria-labelledby="medication-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">我的紀錄</p>
                <h2 id="medication-title">目前用藥</h2>
              </div>
              <button className="text-button" onClick={() => setScreen("add")}>手動新增</button>
            </div>
            <div className="medication-grid">
              {medications.map((medication) => (
                <article className="medication-card" key={medication.id}>
                  <div className="card-topline">
                    <span className={`status ${medication.status === "已確認" ? "confirmed" : "review"}`}>
                      {medication.status}
                    </span>
                    <span className="pill-icon" aria-hidden="true">●</span>
                  </div>
                  <h3>{medication.name}</h3>
                  <p className="generic">{medication.genericName}</p>
                  <p className="use-text">{medication.use}</p>
                  <dl>
                    <div><dt>一次吃多少</dt><dd>{medication.dose}</dd></div>
                    <div><dt>什麼時候吃</dt><dd>{medication.schedule}</dd></div>
                  </dl>
                  <p className="source">來源：{medication.source}</p>
                </article>
              ))}
            </div>
            {medications.some((medication) => medication.status === "待確認") && <button className="primary-button" onClick={confirmMedicationRecords} disabled={isWorking}>確認並儲存待確認項目</button>}
          </section>
        </>
      )}

      {screen === "add" && (
        <section className="workflow" aria-labelledby="add-title">
          <button className="back-button" onClick={() => setScreen("home")}>← 回到我的用藥</button>
          <p className="eyebrow">新增紀錄</p>
          <h1 id="add-title">拍下藥袋，或上傳照片</h1>
          <p className="lead">請讓藥名、劑量與服用方式清楚入鏡。可以一次加入多張照片。</p>

          <div className="upload-actions">
            <label className="capture-card">
              <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={choosePhotos} />
              <span className="capture-icon">▣</span>
              <strong>現在拍照</strong>
              <span>使用手機相機拍藥袋或藥盒</span>
            </label>
            <label className="capture-card">
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={choosePhotos} />
              <span className="capture-icon">⌑</span>
              <strong>從相簿選擇</strong>
              <span>上傳已拍好的照片</span>
            </label>
            <button className="capture-card button-card" onClick={() => setNotice("手動輸入表單會在串接資料庫時啟用。")}>
              <span className="capture-icon">✎</span>
              <strong>手動輸入</strong>
              <span>沒有照片也可以建立紀錄</span>
            </button>
          </div>

          {photos.length > 0 && (
            <section className="photo-review" aria-labelledby="photo-title">
              <h2 id="photo-title">已選擇的照片（{photos.length}）</h2>
              <ul>{photos.map((photo, index) => <li key={`${photo.name}-${index}`}>{photo.name} · {Math.ceil(photo.size / 1024)} KB</li>)}</ul>
              <button className="primary-button" onClick={startRecognition} disabled={isWorking}>{isWorking ? "處理中…" : "開始辨識並核對"}</button>
            </section>
          )}

          <aside className="help-box">
            <strong>拍得更清楚的小方法</strong>
            <p>把藥袋攤平、避免反光，並拍到完整藥名與服用說明。若文字不清楚，系統會請你重新確認，不會自行猜測。</p>
          </aside>
        </section>
      )}

      {screen === "admin" && (
        <section className="workflow" aria-labelledby="admin-title">
          <button className="back-button" onClick={() => setScreen("home")}>← 回到長輩畫面</button>
          <p className="eyebrow">僅管理者可見</p>
          <h1 id="admin-title">管理後台</h1>
          <div className="admin-grid">
            <article><strong>長輩帳號</strong><span>建立帳號、重設密碼、停用帳號</span><button className="outline-button">管理帳號</button></article>
            <article><strong>用藥紀錄</strong><span>協助建立、修正或受控刪除資料</span><button className="outline-button">查看紀錄</button></article>
            <article><strong>稽核紀錄</strong><span>追蹤帳號、資料與圖片的管理操作</span><button className="outline-button">查看紀錄</button></article>
          </div>
          <form className="admin-create-form" onSubmit={createElderAccount}>
            <h2>建立長輩帳號</h2>
            <p>初始密碼至少 12 碼；系統不會透過畫面或日誌再次顯示該密碼。</p>
            <label>顯示名稱<input name="displayName" maxLength={80} required /></label>
            <label>電子郵件<input name="email" type="email" required /></label>
            <label>初始密碼<input name="password" type="password" minLength={12} autoComplete="new-password" required /></label>
            <button className="primary-button" disabled={isWorking}>建立帳號</button>
            {adminCreateMessage && <p className="form-message" role="status">{adminCreateMessage}</p>}
          </form>
          <p className="admin-note">正式版會在伺服器端驗證管理員角色，前端按鈕本身不構成授權。</p>
        </section>
      )}

      <footer className="footer-note" role="status">{notice}</footer>
    </main>
  );
}
