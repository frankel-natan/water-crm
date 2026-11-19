"use client";

import React, { useState } from "react";
import SignaturePad from "./SignaturePad";

interface ServiceSummaryModalProps {
  ticket: any;
  inventory: any[];
  onClose: () => void;
  onConfirmComplete: (data: {
    ticketId: string;
    itemId: string;
    qty: number;
    notes: string;
    signature: string;
  }) => Promise<void>;
}

export default function ServiceSummaryModal({
  ticket,
  inventory,
  onClose,
  onConfirmComplete,
}: ServiceSummaryModalProps) {
  const firstInv = inventory[0];
  const defaultItemId = firstInv
    ? Array.isArray(firstInv.inventory_items)
      ? firstInv.inventory_items[0]?.id
      : firstInv.inventory_items?.id
    : "";

  const [selectedItemId, setSelectedItemId] = useState<string>(defaultItemId || "");
  const [qty, setQty] = useState<number>(1);
  const [notes, setNotes] = useState<string>("בוצעה בדיקת לחץ מים, ניקוי מערכת והחלפת רכיב.");
  const [signature, setSignature] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  const selectedInvRow = inventory.find((row) => {
    const item = Array.isArray(row.inventory_items)
      ? row.inventory_items[0]
      : row.inventory_items;
    return item?.id === selectedItemId;
  });

  const selectedItemObj = selectedInvRow
    ? Array.isArray(selectedInvRow.inventory_items)
      ? selectedInvRow.inventory_items[0]
      : selectedInvRow.inventory_items
    : null;

  const totalPrice = selectedItemObj ? (selectedItemObj.unit_price || 0) * qty : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signature) {
      alert("נא להחתים את הלקוח לפני סגירת הקריאה.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirmComplete({
        ticketId: ticket.id,
        itemId: selectedItemId,
        qty,
        notes,
        signature,
      });
      setIsCompleted(true);
    } catch (err) {
      console.error(err);
      alert("אירעה שגיאה בסגירת הקריאה.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendWhatsApp = () => {
    const rawPhone = ticket.customers?.phone || "0500000000";
    const cleanPhone = rawPhone.replace(/\D/g, "").replace(/^0/, "972");
    const customerName = ticket.customers?.full_name || "לקוח יקר";
    const itemName = selectedItemObj?.name || "שירות כללי";

    const message =
      `שלום ${customerName},\n` +
      `תעודת שירות דיגיטלית - *NEXUS FLOW* 💧\n\n` +
      `✅ *הטיפול הושלם בהצלחה!*\n` +
      `• *מהות הקריאה:* ${ticket.description || ticket.title}\n` +
      `• *חלקים שהותקנו:* ${itemName} (כמות: ${qty})\n` +
      `• *סיכום טכנאי:* ${notes}\n` +
      `• *סה"כ לתשלום:* ₪${totalPrice}\n\n` +
      `תודה שבחרת בנו!`;

    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, "_blank");
  };

  const handlePrintPDF = () => {
    const printWindow = window.open("", "_blank", "width=800,height=900");
    if (!printWindow) return;

    const customerName = ticket.customers?.full_name || "לקוח";
    const address = ticket.customers?.address || "";
    const phone = ticket.customers?.phone || "";
    const itemName = selectedItemObj?.name || "ללא חלקים";
    const dateStr = new Date().toLocaleDateString("he-IL");

    printWindow.document.write(`
      <html dir="rtl" lang="he">
        <head>
          <title>תעודת שירות - ${customerName}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; color: #1e293b; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0284c7; padding-bottom: 16px; margin-bottom: 24px; }
            .title { font-size: 24px; font-weight: bold; color: #0284c7; }
            .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: right; }
            th { background: #f1f5f9; }
            .sig-box { margin-top: 30px; text-align: left; }
            .sig-img { border: 1px solid #cbd5e1; border-radius: 6px; max-width: 240px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="title">NEXUS FLOW - תעודת שירות ומשלוח</div>
              <div>מערכות מים מתקדמות ושירות טכני</div>
            </div>
            <div>
              <div><strong>תאריך:</strong> ${dateStr}</div>
              <div><strong>מס' קריאה:</strong> #${String(ticket.id).slice(0, 6)}</div>
            </div>
          </div>

          <div class="box">
            <strong>פרטי לקוח:</strong><br/>
            שם: ${customerName} | טלפון: ${phone}<br/>
            כתובת: ${address}
          </div>

          <div class="box">
            <strong>תיאור התקלה / הטיפול:</strong><br/>
            ${ticket.description || ticket.title}<br/><br/>
            <strong>סיכום עבודת הטכנאי:</strong><br/>
            ${notes}
          </div>

          <table>
            <thead>
              <tr>
                <th>פריט / חלק חילוף</th>
                <th>כמות</th>
                <th>מחיר יחידה</th>
                <th>סה"כ</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${itemName}</td>
                <td>${qty}</td>
                <td>₪${selectedItemObj?.unit_price || 0}</td>
                <td><strong>₪${totalPrice}</strong></td>
              </tr>
            </tbody>
          </table>

          <div class="sig-box">
            <div><strong>חתימת הלקוח לאישור:</strong></div>
            <img class="sig-img" src="${signature}" />
          </div>
          <script>window.onload = () => { window.print(); }</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 text-slate-100 shadow-2xl">
        {!isCompleted ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-cyan-400">
                סגירת קריאה והחתמת לקוח
              </h3>
              <button
                type="button"
                onClick={onClose}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="rounded-xl bg-slate-800/70 p-3 text-sm">
              <div className="font-semibold text-white">
                {ticket.customers?.full_name}
              </div>
              <div className="text-slate-400">{ticket.description || ticket.title}</div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="mb-1 block text-xs text-slate-400">
                  חלק חילוף שנצרך מהרכב
                </label>
                <select
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 p-2.5 text-sm text-white"
                >
                  {inventory.map((row) => {
                    const item = Array.isArray(row.inventory_items)
                      ? row.inventory_items[0]
                      : row.inventory_items;
                    if (!item) return null;
                    return (
                      <option key={item.id} value={item.id}>
                        {item.name} (במלאי: {row.quantity}) - ₪{item.unit_price}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs text-slate-400">כמות</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={qty}
                  onChange={(e) => setQty(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 p-2.5 text-sm text-white"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-400">
                פירוט עבודה שבוצעה (יופיע בתעודת השירות)
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 p-2.5 text-sm text-white"
              />
            </div>

            <SignaturePad onSave={setSignature} />

            <div className="flex items-center justify-between pt-2">
              <div className="text-sm text-slate-300">
                סה״כ לחיוב:{" "}
                <span className="text-lg font-bold text-emerald-400">
                  ₪{totalPrice}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {isSubmitting ? "שומר..." : "אשר וסגור קריאה ✓"}
                </button>
              </div>
            </div>
          </form>
        ) : (
          <div className="space-y-5 text-center py-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-3xl text-emerald-400">
              ✓
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">
                הקריאה נסגרה והמלאי עודכן!
              </h3>
              <p className="mt-1 text-sm text-slate-400">
                חתימת הלקוח נשמרה במערכת. ניתן לשלוח כעת תעודת שירות:
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={handleSendWhatsApp}
                className="flex items-center justify-center gap-2 rounded-xl bg-green-600 py-3 px-4 font-bold text-white hover:bg-green-500"
              >
                <span>שלח ב-WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={handlePrintPDF}
                className="flex items-center justify-center gap-2 rounded-xl bg-cyan-600 py-3 px-4 font-bold text-white hover:bg-cyan-500"
              >
                <span>הפק תעודת PDF</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="mt-2 w-full rounded-xl border border-slate-700 py-2.5 text-sm text-slate-300 hover:bg-slate-800"
            >
              חזור לרשימת המשימות
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
