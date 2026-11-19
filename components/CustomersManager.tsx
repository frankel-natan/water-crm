"use client";

import React, { useState } from "react";
import { supabase } from "@/lib/supabase";

interface CustomersManagerProps {
  customers: any[];
  tickets: any[];
  onRefresh: () => Promise<void>;
  onViewReceipt?: (ticket: any) => void;
}

export default function CustomersManager({
  customers,
  tickets,
  onRefresh,
  onViewReceipt,
}: CustomersManagerProps) {
  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);

  // שדות לקוח חדש
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newType, setNewType] = useState("business");
  const [newCity, setNewCity] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [saving, setSaving] = useState(false);

  const getTicketAmount = (t: any): number => {
    if (t.total_amount !== null && t.total_amount !== undefined && Number(t.total_amount) > 0) {
      return Number(t.total_amount);
    }
    const parts = t.ticket_parts_used || [];
    return parts.reduce((sum: number, p: any) => {
      const unitPrice = Number(p.inventory_items?.unit_price || 0);
      const qty = Number(p.quantity_used || 1);
      return sum + unitPrice * qty;
    }, 0);
  };

  // הצמדת נתוני קריאות וכספים לכל לקוח
  const enrichedCustomers = customers.map((c) => {
    const custTickets = tickets.filter(
      (t) =>
        t.customer_id === c.id ||
        (t.customers?.name && t.customers.name === c.name && t.customers?.phone === c.phone)
    );

    const totalPaid = custTickets
      .filter((t) => t.payment_status === "paid")
      .reduce((sum, t) => sum + getTicketAmount(t), 0);

    const openDebt = custTickets
      .filter((t) => t.status === "completed" && t.payment_status !== "paid")
      .reduce((sum, t) => sum + getTicketAmount(t), 0);

    return {
      ...c,
      custTickets,
      totalPaid,
      openDebt,
    };
  });

  const filteredCustomers = enrichedCustomers.filter((c) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    const siteText = c.sites?.[0] ? `${c.sites[0].city} ${c.sites[0].address}` : "";
    return (
      (c.name || "").toLowerCase().includes(q) ||
      (c.phone || "").toLowerCase().includes(q) ||
      siteText.toLowerCase().includes(q)
    );
  });

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data: custData, error: custError } = await supabase
        .from("customers")
        .insert([{ name: newName, phone: newPhone || "050-0000000", customer_type: newType }])
        .select()
        .single();
      if (custError) throw custError;

      if (newCity.trim() || newAddress.trim()) {
        const { error: siteError } = await supabase.from("sites").insert([
          {
            customer_id: custData.id,
            site_name: "אתר ראשי",
            city: newCity.trim() || "כללי",
            address: newAddress.trim() || "-",
            region_id: 1,
          },
        ]);
        if (siteError) throw siteError;
      }

      setNewName("");
      setNewPhone("");
      setNewCity("");
      setNewAddress("");
      setIsAddOpen(false);
      await onRefresh();
    } catch (err: any) {
      alert("שגיאה בהוספת לקוח: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* סרגל עליון: חיפוש והוספת לקוח */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש לקוח לפי שם, טלפון או עיר..."
            className="bg-gray-900 border border-gray-700 rounded-lg px-3.5 py-2 text-sm text-white focus:border-cyan-400 outline-none w-full sm:w-72"
          />
          <span className="text-xs text-gray-400 hidden md:inline">
            סה&quot;כ {filteredCustomers.length} לקוחות במאגר
          </span>
        </div>

        <button
          onClick={() => setIsAddOpen(true)}
          className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition cursor-pointer"
        >
          + הוסף לקוח חדש
        </button>
      </div>

      {/* טבלת לקוחות מורחבת */}
      <div className="bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-700">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 text-sm bg-gray-700/30">
                <th className="p-4">שם הלקוח</th>
                <th className="p-4">טלפון</th>
                <th className="p-4">כתובת אתר</th>
                <th className="p-4">קריאות</th>
                <th className="p-4">שולם (LTV)</th>
                <th className="p-4">יתרת חוב</th>
                <th className="p-4">כרטיס לקוח</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700 text-sm">
              {filteredCustomers.map((cust) => (
                <tr key={cust.id} className="hover:bg-gray-700/30 transition">
                  <td className="p-4">
                    <div className="font-bold text-white">{cust.name}</div>
                    <div className="text-[11px] text-gray-400">
                      {cust.customer_type === "business" ? "לקוח עסקי" : "לקוח פרטי"}
                    </div>
                  </td>
                  <td className="p-4 font-mono text-cyan-400">{cust.phone}</td>
                  <td className="p-4 text-gray-300">
                    {cust.sites && cust.sites.length > 0
                      ? `${cust.sites[0].city}, ${cust.sites[0].address}`
                      : "—"}
                  </td>
                  <td className="p-4 font-mono text-gray-200">{cust.custTickets.length}</td>
                  <td className="p-4 font-bold text-emerald-400">₪{cust.totalPaid.toLocaleString()}</td>
                  <td className="p-4">
                    {cust.openDebt > 0 ? (
                      <span className="px-2.5 py-1 rounded text-xs font-bold bg-amber-900/50 text-amber-300 border border-amber-700">
                        ₪{cust.openDebt.toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-500">₪0</span>
                    )}
                  </td>
                  <td className="p-4">
                    <button
                      onClick={() => setSelectedCustomer(cust)}
                      className="bg-gray-700 hover:bg-cyan-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer"
                    >
                      תיק לקוח והיסטוריה
                    </button>
                  </td>
                </tr>
              ))}
              {filteredCustomers.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-400">
                    לא נמצאו לקוחות תואמים.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* מודאל תיק לקוח 360 */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-gray-700 bg-gray-900 p-6 text-gray-100 shadow-2xl space-y-5">
            <div className="flex justify-between items-start border-b border-gray-800 pb-4">
              <div>
                <h3 className="text-xl font-bold text-cyan-400">{selectedCustomer.name}</h3>
                <p className="text-xs text-gray-400 mt-1">
                  טלפון: <span className="font-mono text-gray-200">{selectedCustomer.phone}</span> | כתובת:{" "}
                  {selectedCustomer.sites?.[0]
                    ? `${selectedCustomer.sites[0].city}, ${selectedCustomer.sites[0].address}`
                    : "לא הוזנה כתובת"}
                </p>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="text-gray-400 hover:text-white text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* סיכום פיננסי ללקוח */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-3">
                <div className="text-[11px] text-gray-400">סה&quot;כ קריאות</div>
                <div className="text-lg font-bold text-white">{selectedCustomer.custTickets.length}</div>
              </div>
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-3">
                <div className="text-[11px] text-gray-400">שולם בפועל</div>
                <div className="text-lg font-bold text-emerald-400">
                  ₪{selectedCustomer.totalPaid.toLocaleString()}
                </div>
              </div>
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-3">
                <div className="text-[11px] text-gray-400">יתרה לגבייה</div>
                <div className="text-lg font-bold text-amber-400">
                  ₪{selectedCustomer.openDebt.toLocaleString()}
                </div>
              </div>
            </div>

            {/* היסטוריית קריאות של הלקוח */}
            <div>
              <h4 className="text-sm font-bold text-gray-200 mb-2">היסטוריית קריאות שירות וחלפים:</h4>
              {selectedCustomer.custTickets.length === 0 ? (
                <div className="text-xs text-gray-500 bg-gray-800/50 p-4 rounded-xl text-center">
                  עדיין לא נפתחו קריאות שירות עבור לקוח זה.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {selectedCustomer.custTickets.map((t: any) => (
                    <div
                      key={t.id}
                      className="bg-gray-800/80 border border-gray-700 rounded-xl p-3.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-cyan-400 font-bold">#{t.id}</span>
                          <span
                            className={`text-[11px] px-2 py-0.5 rounded font-semibold ${
                              t.status === "completed"
                                ? "bg-gray-700 text-gray-300"
                                : "bg-emerald-900/50 text-emerald-300"
                            }`}
                          >
                            {t.status === "completed" ? "נסגרה" : "פתוחה"}
                          </span>
                          <span
                            className={`text-[11px] px-2 py-0.5 rounded font-semibold ${
                              t.payment_status === "paid"
                                ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                                : "bg-amber-950 text-amber-300 border border-amber-800"
                            }`}
                          >
                            {t.payment_status === "paid" ? "שולם" : "ממתין לתשלום"}
                          </span>
                        </div>
                        <div className="text-sm text-white">{t.description}</div>
                        {t.technician_notes && (
                          <div className="text-xs text-gray-400">סיכום טכנאי: {t.technician_notes}</div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <span className="font-bold text-sm text-white">₪{getTicketAmount(t)}</span>
                        {t.status === "completed" && onViewReceipt && (
                          <button
                            onClick={() => {
                              setSelectedCustomer(null);
                              onViewReceipt(t);
                            }}
                            className="bg-cyan-950 hover:bg-cyan-800 text-cyan-300 border border-cyan-700 px-2.5 py-1 rounded text-xs cursor-pointer"
                          >
                            תעודה
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-gray-800">
              <a
                href={`https://wa.me/${(selectedCustomer.phone || "").replace(/\D/g, "").replace(/^0/, "972")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-xl text-xs font-bold"
              >
                💬 שלח הודעת WhatsApp ללקוח
              </a>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="px-4 py-2 rounded-xl border border-gray-700 text-gray-300 text-xs cursor-pointer"
              >
                סגור
              </button>
            </div>
          </div>
        </div>
      )}

      {/* מודאל הוספת לקוח חדש */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900 p-6 text-gray-100 shadow-2xl">
            <h3 className="text-lg font-bold text-cyan-400 mb-4">הוספת לקוח חדש למאגר</h3>
            <form onSubmit={handleAddCustomer} className="space-y-3.5">
              <div>
                <label className="block text-xs text-gray-400 mb-1">שם הלקוח / חברה *</label>
                <input
                  required
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-sm text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">טלפון</label>
                  <input
                    type="text"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="050-0000000"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">סוג לקוח</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-sm text-white"
                  >
                    <option value="business">עסקי / מוסדי</option>
                    <option value="private">פרטי</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">עיר</label>
                  <input
                    type="text"
                    value={newCity}
                    onChange={(e) => setNewCity(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">כתובת</label>
                  <input
                    type="text"
                    value={newAddress}
                    onChange={(e) => setNewAddress(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-sm text-white"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 rounded-lg border border-gray-700 text-gray-300 text-sm cursor-pointer"
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm cursor-pointer"
                >
                  {saving ? "שומר..." : "שמור לקוח"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}