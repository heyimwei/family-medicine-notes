"use client";

import { ChangeEvent, useMemo, useState } from "react";

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

export default function MedicationWorkspace() {
  const [screen, setScreen] = useState<"home" | "add" | "admin">("home");
  const [photos, setPhotos] = useState<File[]>([]);
  const [medications, setMedications] = useState<Medication[]>(startingMedications);
  const [notice, setNotice] = useState("這是本機畫面原型，尚未連接真實帳號或醫療資料。");
  const confirmedCount = useMemo(
    () => medications.filter((medication) => medication.status === "已確認").length,
    [medications],
  );

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
    setMedications((current) =>
      current.map((medication) =>
        medication.status === "待確認"
          ? { ...medication, status: "已確認", dose: "請依藥袋核對", schedule: "請依藥袋核對" }
          : medication,
      ),
    );
    setNotice("範例已標記為確認。正式系統會在這一步寫入受權限保護的資料庫。\n");
  }

  return (
    <main className="shell">
      <header className="topbar">
        <button className="brand" onClick={() => setScreen("home")} aria-label="回到我的用藥">
          <span className="brand-mark">安</span>
          <span>安心用藥紀錄</span>
        </button>
        <div className="user-area">
          <span className="user-name">王媽媽</span>
          <button className="outline-button" onClick={() => setScreen("admin")}>管理者</button>
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
              <button className="primary-button" onClick={() => setNotice("正式版會先送出擷取工作，再讓你逐筆核對後儲存。")}>開始辨識並核對</button>
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
          <p className="admin-note">正式版會在伺服器端驗證管理員角色，前端按鈕本身不構成授權。</p>
        </section>
      )}

      <footer className="footer-note" role="status">{notice}</footer>
    </main>
  );
}