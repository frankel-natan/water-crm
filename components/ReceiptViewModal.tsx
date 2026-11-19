"use client";

import React from "react";

interface ReceiptViewModalProps {
  ticket: any;
  onClose: () => void;
}

export default function ReceiptViewModal({ ticket, onClose }: ReceiptViewModalProps) {
  const customerName = ticket.customers?.name || "לקוח";
  const phone = ticket.customers?.phone || "050-0000000";
  const address = `${ticket.sites?.city || ""} - ${ticket.sites?.address || ""}`.trim();
  const completedDate = ticket.completed_at
    ? new Date(ticket.completed_at).toLocaleString("he-IL")
    : new Date().toLocaleDateString("he-IL");

  const parts = ticket.ticket_parts_used || [];
  const totalAmount = parts.reduce((sum: number, p: any) => {
    const unitPrice = p.inventory_items?.unit_price || 0;
    return sum + unitPrice * (p.quantity_used || 1);
  }, 0);

  const handleSendWhatsApp = () => {
    const cleanPhone = phone.replace(/\D/g, "").replace(/^0/, "972");
    const partsText =
      parts.length > 0
        ? parts.map((p: any) => `${p.inventory_items?.name} (x${p.quantity_used})`).join(", ")
        : "ללא חלקים";

    const message =
      `שלום ${customerName},\n` +
      `עותק תעודת שירות דיגיטלית - *NEXUS FLOW* 💧\n\n` +
      `• *מספר קריאה:* #${ticket.id}\n` +
      `• *מהות הטיפול:* ${ticket.description}\n` +
      `• *חלקים שהותקנו:* ${partsText}\n` +
      `• *סיכום טכנאי:* ${ticket.technician_notes || "בוצע בהצלחה"}\n` +
      `• *סה"כ:* ₪${totalAmount}\n\n` +
      `תודה שבחרת בנו!`;

    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, "_blank");
  };

  const handlePrintPDF = () => {
    const printWindow = window.open("", "_blank", "width=800,height=900");
    if (!printWindow) return;

    const partsRowsHtml =
      parts.length > 0
        ? parts
            .map((p: any) => {
              const name = p.inventory_items?.name || "פריט";
              const qty = p.quantity_used || 1;
              const price = p.inventory_items?.unit_price || 0;
              return `<tr><td>${name}</td><td>${qty}</td><td>₪${price}</td><td><strong>₪${price * qty}</strong></td></tr>`;
            })
            .join("")
        : `<tr><td colspan="4">שירות טכני ללא החלפת חלפים</td></tr>`;

    printWindow.document.write(`
      <html dir="rtl" lang="he">
        <head>
          <title>תעודת שירות #${ticket.id} - ${customerName}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; color: #1e293b; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0284c7; padding-bottom: 16px; margin-bottom: 24px; }
            .title { font-size: 24px; font-weight: bold; color: #0284c7; }
            .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: right; }
            th { background: #f1f5f9; }
            .sig-box { margin-top: 30px; text-align: left; }
            .sig-img { border: 1px solid #cbd5e1; border-radius: 6px; max-width: 240px; background: #fff; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="title">NEXUS FLOW - העתק תעודת שירות</div>
              <div>מערכות מים מתקדמות ושירות טכני</div>
            </div>
            <div>
              <div><strong>תאריך סגירה:</strong> ${completedDate}</div>
              <div><strong>מס' קריאה:</strong> #${ticket.id}</div>
            </div>
          </div>

          <div class="box">
            <strong>פרטי לקוח:</strong><br/>
            שם: ${customerName} | טלפון: ${phone}<br/>
            כתובת: ${address}
          </div>

          <div class="box">
            <strong>תיאור הקריאה:</strong><br/>
            ${ticket.description}<br/><br/>
            <strong>סיכום עבודת הטכנאי:</strong><br/>
            ${ticket.technician_notes || "בוצע טיפול מלא"}
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
              ${partsRowsHtml}
            </tbody>
          </table>

          ${
            ticket.customer_signature
              ? `<div class="sig-box">
                  <div><strong>חתימת הלקוח השמורה במערכת:</strong></div>
                  <img class="sig-img" src="${ticket.customer_signature}" />
                </div>`
              : ""
          }
          <script>window.onload = () => { window.print(); }</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 text-slate-100 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-lg font-bold text-cyan-400">תעודת שירות #{ticket.id}</h3>
            <span className="text-xs text-slate-400">נסגר ב-{completedDate}</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
        </div>

        <div className="rounded-xl bg-slate-800/70 p-3.5 text-sm space-y-1">
          <div className="font-bold text-white">{customerName} <span className="font-mono text-xs text-cyan-400">({phone})</span></div>
          <div className="text-slate-300 text-xs">{address}</div>
          <div className="text-slate-400 pt-1 border-t border-slate-700/60">{ticket.description}</div>
        </div>

        {ticket.technician_notes && (
          <div className="rounded-xl bg-emerald-950/30 border border-emerald-800/50 p-3 text-sm">
            <div className="text-xs text-emerald-400 font-semibold mb-1">סיכום עבודת הטכנאי:</div>
            <div className="text-slate-200">{ticket.technician_notes}</div>
          </div>
        )}

        <div>
          <div className="text-xs text-slate-400 mb-1.5">חלקים שהותקנו:</div>
          {parts.length > 0 ? (
            <div className="space-y-1">
              {parts.map((p: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center bg-slate-800 px-3 py-2 rounded-lg text-sm">
                  <span>{p.inventory_items?.name} (x{p.quantity_used})</span>
                  <span className="font-bold text-emerald-400">₪{(p.inventory_items?.unit_price || 0) * (p.quantity_used || 1)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-slate-500">לא נרשמו חלקים בקריאה זו</div>
          )}
        </div>

        {ticket.customer_signature ? (
          <div>
            <div className="text-xs text-slate-400 mb-1.5">חתימת הלקוח השמורה בבסיס הנתונים:</div>
            <div className="bg-white rounded-xl p-2 flex justify-center border border-slate-600">
              <img src={ticket.customer_signature} alt="חתימת לקוח" className="max-h-28 object-contain" />
            </div>
          </div>
        ) : (
          <div className="text-xs text-amber-400 bg-amber-950/40 border border-amber-800/50 p-2.5 rounded-lg">
            קריאה זו נסגרה ללא חתימה דיגיטלית.
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            onClick={handleSendWhatsApp}
            className="rounded-xl bg-green-600 py-2.5 px-4 text-sm font-bold text-white hover:bg-green-500 cursor-pointer"
          >
            שלח שוב ב-WhatsApp
          </button>
          <button
            type="button"
            onClick={handlePrintPDF}
            className="rounded-xl bg-cyan-600 py-2.5 px-4 text-sm font-bold text-white hover:bg-cyan-500 cursor-pointer"
          >
            הדפס / שמור PDF
          </button>
        </div>
      </div>
    </div>
  );
}