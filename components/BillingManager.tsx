"use client";

import React, { useState } from "react";
import { supabase } from "@/lib/supabase";

interface BillingManagerProps {
  tickets: any[];
  onRefresh: () => Promise<void>;
}

const PAYMENT_METHODS = ["אשראי", "ביט", "העברה בנקאית", "מזומן", "המחאה"];

export default function BillingManager({ tickets, onRefresh }: BillingManagerProps) {
  const [filterMode, setFilterMode] = useState<"all" | "pending" | "paid">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [payingTicketId, setPayingTicketId] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>("אשראי");
  const [invoiceNumber, setInvoiceNumber] = useState<string>("");
  const [customAmount, setCustomAmount] = useState<string>("");
  const [savingId, setSavingId] = useState<number | null>(null);

  // חישוב סכום קריאה: אם נשמר total_amount ב-DB נשתמש בו, אחרת מחשבים מהחלקים שהותקנו
  const getTicketAmount = (ticket: any): number => {
    if (ticket.total_amount !== null && ticket.total_amount !== undefined && Number(ticket.total_amount) > 0) {
      return Number(ticket.total_amount);
    }
    const parts = ticket.ticket_parts_used || [];
    return parts.reduce((sum: number, p: any) => {
      const unitPrice = Number(p.inventory_items?.unit_price || 0);
      const qty = Number(p.quantity_used || 1);
      return sum + unitPrice * qty;
    }, 0);
  };

  // קריאות רלוונטיות לחיוב/גבייה (קריאות שנסגרו או שיש להן חיוב)
  const billableTickets = tickets.filter(
    (t) => t.status === "completed" || getTicketAmount(t) > 0 || t.payment_status === "paid"
  );

  const totalBilled = billableTickets.reduce((acc, t) => acc + getTicketAmount(t), 0);
  const totalPaid = billableTickets
    .filter((t) => t.payment_status === "paid")
    .reduce((acc, t) => acc + getTicketAmount(t), 0);
  const totalPending = Math.max(0, totalBilled - totalPaid);

  const currentMonthPrefix = new Date().toISOString().slice(0, 7); // YYYY-MM
  const monthlyPaid = billableTickets
    .filter((t) => {
      if (t.payment_status !== "paid") return false;
      const dateRef = t.paid_at || t.completed_at || t.scheduled_at || "";
      return String(dateRef).startsWith(currentMonthPrefix);
    })
    .reduce((acc, t) => acc + getTicketAmount(t), 0);

  const filteredList = billableTickets.filter((t) => {
    const isPaid = t.payment_status === "paid";
    if (filterMode === "paid" && !isPaid) return false;
    if (filterMode === "pending" && isPaid) return false;

    const q = searchTerm.toLowerCase().trim();
    if (!q) return true;
    return (
      (t.customers?.name || "").toLowerCase().includes(q) ||
      (t.invoice_number || "").toLowerCase().includes(q) ||
      String(t.id).includes(q)
    );
  });

  const openPaymentModal = (ticket: any) => {
    const amt = getTicketAmount(ticket);
    setPayingTicketId(ticket.id);
    setPaymentMethod(ticket.payment_method || "אשראי");
    setInvoiceNumber(ticket.invoice_number || `INV-${ticket.id}`);
    setCustomAmount(String(amt));
  };

  const handleMarkPaid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (payingTicketId === null) return;
    setSavingId(payingTicketId);

    try {
      const numericAmount = Number(customAmount) || 0;
      const { error } = await supabase
        .from("service_tickets")
        .update({
          payment_status: "paid",
          total_amount: numericAmount,
          payment_method: paymentMethod,
          invoice_number: invoiceNumber.trim() || `INV-${payingTicketId}`,
          paid_at: new Date().toISOString(),
        })
        .eq("id", payingTicketId);

      if (error) throw error;
      setPayingTicketId(null);
      await onRefresh();
    } catch (err: any) {
      alert("שגיאה בעדכון תשלום: " + err.message);
    } finally {
      setSavingId(null);
    }
  };

  const handleReopenPayment = async (ticketId: number) => {
    setSavingId(ticketId);
    try {
      const { error } = await supabase
        .from("service_tickets")
        .update({
          payment_status: "pending",
          paid_at: null,
        })
        .eq("id", ticketId);
      if (error) throw error;
      await onRefresh();
    } catch (err: any) {
      alert("שגיאה בהחזרה לממתין לתשלום: " + err.message);
    } finally {
      setSavingId(null);
    }
  };

  const handleExportCSV = () => {
    const headers = ["מספר קריאה", "לקוח", "טלפון", "סכום (שח)", "סטטוס תשלום", "אמצעי תשלום", "מספר חשבונית"];
    const rows = filteredList.map((t) => [
      t.id,
      `"${(t.customers?.name || "").replace(/"/g, '""')}"`,
      `"${t.customers?.phone || ""}"`,
      getTicketAmount(t),
      t.payment_status === "paid" ? "שולם" : "ממתין לתשלום",
      `"${t.payment_method || "-"}"`,
      `"${t.invoice_number || "-"}"`,
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `nexus-flow-billing-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* כרטיסי KPI פיננסיים */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <div className="text-xs text-gray-400">סה&quot;כ חיובי שירות</div>
          <div className="text-2xl font-bold text-white mt-1">₪{totalBilled.toLocaleString()}</div>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <div className="text-xs text-gray-400">נגבה בפועל (שולם)</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">₪{totalPaid.toLocaleString()}</div>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <div className="text-xs text-gray-400">יתרה פתוחה לגבייה</div>
          <div className={`text-2xl font-bold mt-1 ${totalPending > 0 ? "text-amber-400" : "text-emerald-400"}`}>
            ₪{totalPending.toLocaleString()}
          </div>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <div className="text-xs text-gray-400">גבייה החודש ({currentMonthPrefix})</div>
          <div className="text-2xl font-bold text-cyan-400 mt-1">₪{monthlyPaid.toLocaleString()}</div>
        </div>
      </div>

      {/* סרגל סינון וייצוא */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="חיפוש לקוח, קריאה או מס' חשבונית..."
            className="bg-gray-900 border border-gray-700 rounded-lg px-3.5 py-2 text-sm text-white focus:border-cyan-400 outline-none w-full sm:w-64"
          />

          <div className="flex bg-gray-900 p-1 rounded-lg border border-gray-700 text-xs">
            <button
              onClick={() => setFilterMode("all")}
              className={`px-3 py-1.5 rounded cursor-pointer ${
                filterMode === "all" ? "bg-cyan-600 text-white font-semibold" : "text-gray-400"
              }`}
            >
              הכל ({billableTickets.length})
            </button>
            <button
              onClick={() => setFilterMode("pending")}
              className={`px-3 py-1.5 rounded cursor-pointer ${
                filterMode === "pending" ? "bg-amber-600 text-white font-semibold" : "text-gray-400"
              }`}
            >
              ממתין לגבייה
            </button>
            <button
              onClick={() => setFilterMode("paid")}
              className={`px-3 py-1.5 rounded cursor-pointer ${
                filterMode === "paid" ? "bg-emerald-600 text-white font-semibold" : "text-gray-400"
              }`}
            >
              שולם
            </button>
          </div>
        </div>

        <button
          onClick={handleExportCSV}
          className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer"
        >
          📊 ייצא דוח גבייה (CSV / Excel)
        </button>
      </div>

      {/* טבלת חיובים וגבייה */}
      <div className="bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-700">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 text-sm bg-gray-700/30">
                <th className="p-4"># קריאה</th>
                <th className="p-4">לקוח</th>
                <th className="p-4">סכום חיוב</th>
                <th className="p-4">סטטוס תשלום</th>
                <th className="p-4">פרטי מסמך ותשלום</th>
                <th className="p-4">פעולה</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700 text-sm">
              {filteredList.map((ticket) => {
                const amount = getTicketAmount(ticket);
                const isPaid = ticket.payment_status === "paid";

                return (
                  <tr key={ticket.id} className="hover:bg-gray-700/30 transition">
                    <td className="p-4 font-mono text-cyan-400">#{ticket.id}</td>
                    <td className="p-4">
                      <div className="font-bold text-white">{ticket.customers?.name || "לקוח"}</div>
                      <div className="text-xs text-gray-400 font-mono">{ticket.customers?.phone}</div>
                    </td>
                    <td className="p-4 font-bold text-white">₪{amount.toLocaleString()}</td>
                    <td className="p-4">
                      {isPaid ? (
                        <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-900/60 text-emerald-300 border border-emerald-700">
                          ✓ שולם
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-amber-900/60 text-amber-300 border border-amber-700">
                          ממתין לתשלום
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-xs text-gray-300">
                      {isPaid ? (
                        <div className="space-y-0.5">
                          <div>אמצעי: <strong className="text-white">{ticket.payment_method || "אשראי"}</strong></div>
                          <div className="font-mono text-cyan-300">מסמך: {ticket.invoice_number || "-"}</div>
                        </div>
                      ) : (
                        <span className="text-gray-500">טרם הוזן תשלום</span>
                      )}
                    </td>
                    <td className="p-4">
                      {isPaid ? (
                        <button
                          disabled={savingId === ticket.id}
                          onClick={() => handleReopenPayment(ticket.id)}
                          className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 px-3 py-1.5 rounded-lg transition cursor-pointer"
                        >
                          בטל סימון תשלום
                        </button>
                      ) : (
                        <button
                          onClick={() => openPaymentModal(ticket)}
                          className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3.5 py-1.5 rounded-lg transition cursor-pointer"
                        >
                          💳 רשום תשלום / חשבונית
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filteredList.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-400">
                    אין רשומות חיוב תואמות לסינון הנוכחי.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* מודאל רישום תשלום והפקת מספר חשבונית/קבלה */}
      {payingTicketId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900 p-6 text-gray-100 shadow-2xl">
            <h3 className="text-lg font-bold text-emerald-400 mb-4">
              רישום תשלום וחשבונית - קריאה #{payingTicketId}
            </h3>
            <form onSubmit={handleMarkPaid} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">סכום ששולם (₪)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-white text-sm"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">אמצעי תשלום</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-white text-sm"
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">מספר חשבונית / קבלה</label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="למשל INV-1042"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-white text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPayingTicketId(null)}
                  className="px-4 py-2 rounded-lg border border-gray-700 text-gray-300 text-sm cursor-pointer"
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  disabled={savingId === payingTicketId}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm cursor-pointer"
                >
                  {savingId === payingTicketId ? "שומר..." : "אשר תשלום ✓"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}