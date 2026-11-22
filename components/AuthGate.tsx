"use client";

import React, { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AuthGate() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMsg("פרטי ההתחברות אינם נכונים או שהמשתמש אינו מורשה.");
      }
    } catch {
      setErrorMsg("אירעה שגיאה בעת ניסיון ההתחברות. נסה שוב.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-gray-900 text-gray-100 flex items-center justify-center p-4 font-sans"
    >
      <div className="w-full max-w-md bg-gray-800 border border-gray-700 rounded-2xl p-6 shadow-xl">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-cyan-400">NEXUS FLOW</h1>
          <p className="text-gray-400 text-sm mt-1">
            כניסה למערכת ניהול שירות ברי מים
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1.5">
              כתובת אימייל
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full rounded-xl bg-gray-900 border border-gray-700 px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1.5">
              סיסמה
            </label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl bg-gray-900 border border-gray-700 px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {errorMsg && (
            <div className="rounded-xl bg-red-950/60 border border-red-800/80 px-3.5 py-2.5 text-xs text-red-200">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-white font-semibold py-2.5 text-sm transition cursor-pointer"
          >
            {submitting ? "מתחבר..." : "התחברות למערכת"}
          </button>
        </form>
      </div>
    </main>
  );
}