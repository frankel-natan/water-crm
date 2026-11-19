"use client";

import React, { useState } from "react";
import { supabase } from "@/lib/supabase";

interface RoutePlannerProps {
  tickets: any[];
  onRefresh: () => Promise<void>;
}

const PRIORITY_WEIGHT: Record<string, number> = {
  urgent: 1,
  high: 2,
  normal: 3,
};

export default function RoutePlanner({ tickets, onRefresh }: RoutePlannerProps) {
  const todayStr = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedCity, setSelectedCity] = useState<string>("all");
  const [isOptimizing, setIsOptimizing] = useState(false);

  // קריאות פתוחות
  const openTickets = tickets.filter((t) => t.status !== "completed");

  // רשימת ערים ייחודיות מהקריאות הפתוחות
  const cities = Array.from(
    new Set(openTickets.map((t) => (t.sites?.city || "כללי").trim()).filter(Boolean))
  );

  // סינון קריאות לפי תאריך נבחר (קריאות ללא scheduled_at מוצגות כ"ממתינות לשיבוץ" להיום)
  const dayTickets = openTickets
    .filter((t) => {
      const ticketDate = t.scheduled_at ? t.scheduled_at.split("T")[0] : todayStr;
      const matchesDate = ticketDate === selectedDate;
      const matchesCity =
        selectedCity === "all" || (t.sites?.city || "כללי").trim() === selectedCity;
      return matchesDate && matchesCity;
    })
    .sort((a, b) => {
      if (a.scheduled_at && b.scheduled_at) {
        return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
      }
      return (PRIORITY_WEIGHT[a.priority] || 3) - (PRIORITY_WEIGHT[b.priority] || 3);
    });

  // אופטימיזציית מסלול: קיבוץ לפי עיר + תעדוף דחיפות + הקצאת חלונות זמן כל 90 דקות מ-08:30
  const handleOptimizeRoute = async () => {
    if (dayTickets.length === 0) return;
    setIsOptimizing(true);

    try {
      // מציאת העיר עם הדחיפות הגבוהה ביותר כנקודת פתיחה
      const sorted = [...dayTickets].sort((a, b) => {
        const cityA = (a.sites?.city || "").trim();
        const cityB = (b.sites?.city || "").trim();
        const prioA = PRIORITY_WEIGHT[a.priority] || 3;
        const prioB = PRIORITY_WEIGHT[b.priority] || 3;

        if (cityA === cityB) return prioA - prioB;
        if (prioA !== prioB) return prioA - prioB;
        return cityA.localeCompare(cityB, "he");
      });

      // בניית עדכוני שעות ברצף החל מ-08:30 (מרווח של שעה וחצי בין קריאות)
      let currentMinutes = 8 * 60 + 30; // 08:30

      for (const ticket of sorted) {
        const hours = Math.floor(currentMinutes / 60);
        const mins = currentMinutes % 60;
        const timeStr = `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:00`;
        const scheduledIso = new Date(`${selectedDate}T${timeStr}`).toISOString();

        await supabase
          .from("service_tickets")
          .update({ scheduled_at: scheduledIso })
          .eq("id", ticket.id);

        currentMinutes += 90;
      }

      await onRefresh();
    } catch (err) {
      console.error(err);
      alert("אירעה שגיאה בסידור המסלול.");
    } finally {
      setIsOptimizing(false);
    }
  };

  // פתיחת כל המסלול היומי ב-Google Maps (Multi-stop route)
  const handleOpenFullDayGoogleMaps = () => {
    const stops = dayTickets
      .map((t) => `${t.sites?.address || ""}, ${t.sites?.city || ""}`.trim())
      .filter((s) => s.length > 2);

    if (stops.length === 0) {
      alert("אין כתובות תקינות במסלול זה.");
      return;
    }

    if (stops.length === 1) {
      window.open(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stops[0])}`,
        "_blank"
      );
      return;
    }

    const destination = encodeURIComponent(stops[stops.length - 1]);
    const waypoints = stops
      .slice(0, -1)
      .map((s) => encodeURIComponent(s))
      .join("|");

    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${destination}&waypoints=${waypoints}&travelmode=driving`,
      "_blank"
    );
  };

  // עדכון ידני של שעה לקריאה ספציפית
  const handleTimeChange = async (ticketId: number, newTime: string) => {
    if (!newTime) return;
    try {
      const scheduledIso = new Date(`${selectedDate}T${newTime}:00`).toISOString();
      await supabase
        .from("service_tickets")
        .update({ scheduled_at: scheduledIso })
        .eq("id", ticketId);
      await onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  // חישוב חיסכון מוערך בק"מ (הדגמה עסקית למנהל)
  const uniqueCitiesCount = new Set(dayTickets.map((t) => t.sites?.city)).size;
  const estimatedSavedKm = dayTickets.length > 1 ? Math.max(12, (dayTickets.length - uniqueCitiesCount) * 14) : 0;

  return (
    <div className="space-y-6">
      {/* סרגל שליטה עליון: תאריך, סינון עיר וכפתור אופטימיזציה */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-[11px] text-gray-400 mb-1">תאריך יומן עבודה</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-cyan-400 outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] text-gray-400 mb-1">סינון לפי אזור / עיר</label>
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-cyan-400 outline-none min-w-[150px]"
            >
              <option value="all">כל האזורים ({openTickets.length})</option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleOptimizeRoute}
            disabled={isOptimizing || dayTickets.length === 0}
            className="bg-gradient-to-l from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg transition cursor-pointer disabled:opacity-50"
          >
            {isOptimizing ? "מחשב מסלול..." : "⚡ סדר מסלול אופטימלי (אזור + דחיפות)"}
          </button>

          <button
            onClick={handleOpenFullDayGoogleMaps}
            disabled={dayTickets.length === 0}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg transition cursor-pointer disabled:opacity-50"
          >
            🗺️ פתח מסלול יומי במפה
          </button>
        </div>
      </div>

      {/* סרגל תובנות מסלול */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800/70 border border-gray-700 rounded-xl p-4 flex justify-between items-center">
          <div>
            <div className="text-xs text-gray-400">תחנות מתוכננות ליום זה</div>
            <div className="text-xl font-bold text-white mt-0.5">{dayTickets.length} ביקורים</div>
          </div>
          <span className="text-2xl">📍</span>
        </div>

        <div className="bg-gray-800/70 border border-gray-700 rounded-xl p-4 flex justify-between items-center">
          <div>
            <div className="text-xs text-gray-400">אשכולות ערים במסלול</div>
            <div className="text-xl font-bold text-cyan-400 mt-0.5">{uniqueCitiesCount} ערים</div>
          </div>
          <span className="text-2xl">🏙️</span>
        </div>

        <div className="bg-gray-800/70 border border-gray-700 rounded-xl p-4 flex justify-between items-center">
          <div>
            <div className="text-xs text-gray-400">חיסכון דלק וזמן מוערך</div>
            <div className="text-xl font-bold text-emerald-400 mt-0.5">~{estimatedSavedKm} ק&quot;מ</div>
          </div>
          <span className="text-2xl">⛽</span>
        </div>
      </div>

      {/* ציר זמן (Timeline) של יום העבודה */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
        <div className="flex justify-between items-center mb-5 border-b border-gray-700 pb-3">
          <h3 className="text-lg font-bold text-white">
            לו&quot;ז עבודה ומסלול נסיעה - יוסי הטכנאי ({new Date(selectedDate).toLocaleDateString("he-IL")})
          </h3>
          <span className="text-xs text-gray-400">ניתן לשנות שעת הגעה ידנית בכל תחנה</span>
        </div>

        {dayTickets.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            אין קריאות פתוחות המתוזמנות לתאריך זה. בחר תאריך אחר או פתח קריאה חדשה.
          </div>
        ) : (
          <div className="relative border-r-2 border-cyan-600/50 pr-6 space-y-5 mr-3">
            {dayTickets.map((ticket, index) => {
              const timeValue = ticket.scheduled_at
                ? new Date(ticket.scheduled_at).toTimeString().slice(0, 5)
                : "09:00";
              const fullAddress = `${ticket.sites?.address || ""}, ${ticket.sites?.city || ""}`.trim();

              return (
                <div
                  key={ticket.id}
                  className="relative bg-gray-900/90 border border-gray-700 hover:border-cyan-500/60 rounded-xl p-4 transition"
                >
                  {/* נקודת ציון על ציר הזמן */}
                  <div className="absolute -right-[33px] top-5 w-4 h-4 rounded-full bg-cyan-500 border-4 border-gray-900" />

                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="bg-cyan-950 text-cyan-300 border border-cyan-800 text-xs font-bold px-2.5 py-0.5 rounded-full">
                          תחנה #{index + 1}
                        </span>
                        <span className="font-mono text-xs text-gray-400">קריאה #{ticket.id}</span>
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded font-semibold ${
                            ticket.priority === "urgent"
                              ? "bg-red-900/60 text-red-300 border border-red-700"
                              : ticket.priority === "high"
                              ? "bg-orange-900/60 text-orange-300 border border-orange-700"
                              : "bg-blue-900/60 text-blue-300 border border-blue-700"
                          }`}
                        >
                          {ticket.priority}
                        </span>
                      </div>

                      <div className="text-base font-bold text-white pt-1">
                        {ticket.customers?.name}{" "}
                        <span className="text-xs font-normal text-cyan-400">
                          ({ticket.sites?.city} - {ticket.sites?.address})
                        </span>
                      </div>
                      <div className="text-xs text-gray-400">{ticket.description}</div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
                      <div className="flex items-center gap-1.5 bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5">
                        <span className="text-xs text-gray-400">שעה:</span>
                        <input
                          type="time"
                          value={timeValue}
                          onChange={(e) => handleTimeChange(ticket.id, e.target.value)}
                          className="bg-transparent text-sm font-mono text-white outline-none"
                        />
                      </div>

                      <a
                        href={`https://waze.com/ul?q=${encodeURIComponent(fullAddress)}&navigate=yes`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-sky-600 hover:bg-sky-500 text-white px-3 py-2 rounded-lg text-xs font-bold transition"
                      >
                        🚗 נווט ב-Waze
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}