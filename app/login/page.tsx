"use client";

import { FormEvent, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function LoginPage() {
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setIsSubmitting(true);
    setMessage("");
    try {
      const client = createSupabaseBrowserClient();
      const { error } = await client.auth.signInWithPassword({ email: String(form.get("email")), password: String(form.get("password")) });
      if (error) setMessage("登入失敗，請確認帳號與密碼。若持續失敗請聯絡管理員。");
      else window.location.assign("/");
    } catch {
      setMessage("系統尚未完成設定，請由管理員填入 .env.local 後再登入。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return <main className="login-page"><section className="login-card">
    <span className="brand-mark">安</span><h1>安心用藥紀錄</h1><p>請使用管理員建立的帳號登入。</p>
    <form onSubmit={signIn} className="login-form">
      <label>電子郵件<input name="email" type="email" autoComplete="email" required /></label>
      <label>密碼<input name="password" type="password" autoComplete="current-password" required /></label>
      <button className="primary-button" disabled={isSubmitting}>{isSubmitting ? "登入中…" : "登入"}</button>
    </form>
    {message && <p className="form-message" role="alert">{message}</p>}
  </section></main>;
}