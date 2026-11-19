"use client";

import React, { useState } from "react";
import { supabase } from "@/lib/supabase";

interface WarehouseManagerProps {
  inventory: any[];
  onRefresh: () => Promise<void>;
  techId: string;
}

export default function WarehouseManager({
  inventory,
  onRefresh,
  techId,
}: WarehouseManagerProps) {
  const [search, setSearch] = useState("");
  const [onlyLowStock, setOnlyLowStock] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [transferQtyMap, setTransferQtyMap] = useState<Record<string, number>>({});

  // חילוץ אחיד של פריטי המלאי מתוך technician_inventory
  const items = inventory
    .map((row: any) => {
      const inv = Array.isArray(row.inventory_items) ? row.inventory_items[0] : row.inventory_items;
      if (!inv) return null;
      const warehouseQty = Number(inv.warehouse_qty ?? 25);
      const minAlert = Number(inv.min_stock_alert ?? 8);
      const vanQty = Number(row.quantity ?? 0);
      const unitPrice = Number(inv.unit_price ?? 0);

      return {
        id: inv.id,
        sku: inv.sku || "-",
        name: inv.name || "פריט ללא שם",
        category: inv.category || "כללי",
        unitPrice,
        warehouseQty,
        minAlert,
        vanQty,
        lastPo: inv.last_po_number || null,
        isLowStock: warehouseQty <= minAlert,
      };
    })
    .filter(Boolean) as Array<{
      id: string;
      sku: string;
      name: string;
      category: string;
      unitPrice: number;
      warehouseQty: number;
      minAlert: number;
      vanQty: number;
      lastPo: string | null;
      isLowStock: boolean;
    }>;

  const totalWarehouseValue = items.reduce(
    (sum, item) => sum + item.warehouseQty * item.unitPrice,
    0
  );
  const lowStockItems = items.filter((item) => item.isLowStock);
  const totalVanUnits = items.reduce((sum, item) => sum + item.vanQty, 0);

  const filteredItems = items.filter((item) => {
    if (onlyLowStock && !item.isLowStock) return false;
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      item.name.toLowerCase().includes(q) ||
      item.sku.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
    );
  });

  const getTransferAmount = (itemId: string) => transferQtyMap[itemId] || 5;

  const handleTransferToVan = async (item: {
    id: string;
    name: string;
    warehouseQty: number;
    vanQty: number;
  }) => {
    const qty = Math.max(1, getTransferAmount(item.id));
    if (item.warehouseQty < qty) {
      alert(`אין מספיק יתרה במחסן הראשי עבור "${item.name}" (יתרה נוכחית: ${item.warehouseQty}).`);
      return;
    }

    setBusyId(item.id);
    try {
      const { error: whErr } = await supabase
        .from("inventory_items")
        .update({ warehouse_qty: item.warehouseQty - qty })
        .eq("id", item.id);
      if (whErr) throw whErr;

      const { error: vanErr } = await supabase
        .from("technician_inventory")
        .update({ quantity: item.vanQty + qty })
        .eq("technician_id", techId)
        .eq("item_id", item.id);
      if (vanErr) throw vanErr;

      await onRefresh();
    } catch (err: any) {
      alert("שגיאה בהעברת מלאי לרכב: " + err.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleReceivePurchaseOrder = async (item: {
    id: string;
    name: string;
    warehouseQty: number;
    minAlert: number;
  }) => {
    const restockQty = Math.max(15, item.minAlert * 2);
    const poNumber = `PO-${Math.floor(1000 + Math.random() * 9000)}`;

    setBusyId(item.id);
    try {
      const { error } = await supabase
        .from("inventory_items")
        .update({
          warehouse_qty: item.warehouseQty + restockQty,
          last_po_number: poNumber,
        })
        .eq("id", item.id);
      if (error) throw error;

      await onRefresh();
    } catch (err: any) {
      alert("שגיאה בקליטת הזמנת רכש: " + err.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* כרטיסי KPI למחסן ראשי */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <div className="text-xs text-gray-400">שווי מלאי במחסן המרכזי</div>
          <div className="text-2xl font-bold text-cyan-400 mt-1">
            ₪{totalWarehouseValue.toLocaleString()}
          </div>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <div className="text-xs text-gray-400">התראות רכש (מתחת למינימום)</div>
          <div
            className={`text-2xl font-bold mt-1 ${
              lowStockItems.length > 0 ? "text-amber-400" : "text-emerald-400"
            }`}
          >
            {lowStockItems.length} פריטים
          </div>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <div className="text-xs text-gray-400">סה&quot;כ יחידות מוקצות לרכבים</div>
          <div className="text-2xl font-bold text-white mt-1">{totalVanUnits} יח&apos;</div>
        </div>
      </div>

      {/* באנר התראת רכש אם יש פריטים מתחת לסף המינימום */}
      {lowStockItems.length > 0 && (
        <div className="bg-amber-950/40 border border-amber-700/70 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div>
            <div className="text-sm font-bold text-amber-300">
              ⚠️ התראת רכש אוטומטית: {lowStockItems.length} פריטים במחסן הראשי הגיעו לסף מינימום
            </div>
            <div className="text-xs text-amber-200/80 mt-0.5">
              פריטים להזמנה: {lowStockItems.map((i) => i.name).join(", ")}
            </div>
          </div>
          <button
            onClick={() => setOnlyLowStock((prev) => !prev)}
            className="bg-amber-600 hover:bg-amber-500 text-gray-950 font-bold text-xs px-3.5 py-2 rounded-lg transition cursor-pointer"
          >
            {onlyLowStock ? "הצג את כל המחסן" : "הצג רק פריטים להזמנה"}
          </button>
        </div>
      )}

      {/* סרגל חיפוש וסינון */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="חיפוש פריט, מק&quot;ט או קטגוריה במחסן..."
          className="bg-gray-900 border border-gray-700 rounded-lg px-3.5 py-2 text-sm text-white focus:border-cyan-400 outline-none w-full sm:w-72"
        />

        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => setOnlyLowStock(false)}
            className={`px-3 py-1.5 rounded-lg cursor-pointer ${
              !onlyLowStock ? "bg-cyan-600 text-white font-bold" : "bg-gray-900 text-gray-400"
            }`}
          >
            כל הפריטים ({items.length})
          </button>
          <button
            onClick={() => setOnlyLowStock(true)}
            className={`px-3 py-1.5 rounded-lg cursor-pointer ${
              onlyLowStock ? "bg-amber-600 text-white font-bold" : "bg-gray-900 text-gray-400"
            }`}
          >
            דורשים רכש ({lowStockItems.length})
          </button>
        </div>
      </div>

      {/* טבלת ניהול מחסן ראשי והעברות לרכב */}
      <div className="bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-700">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 text-sm bg-gray-700/30">
                <th className="p-4">מק&quot;ט ופריט</th>
                <th className="p-4">יתרה במחסן</th>
                <th className="p-4">סף מינימום</th>
                <th className="p-4">יתרה ברכב</th>
                <th className="p-4">העברה לרכב</th>
                <th className="p-4">רכש וקליטה</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700 text-sm">
              {filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-gray-700/30 transition">
                  <td className="p-4">
                    <div className="font-bold text-white">{item.name}</div>
                    <div className="text-xs text-gray-400 font-mono">
                      {item.sku} • {item.category} • ₪{item.unitPrice}
                    </div>
                    {item.lastPo && (
                      <div className="text-[11px] text-emerald-400 font-mono mt-0.5">
                        PO אחרון: {item.lastPo}
                      </div>
                    )}
                  </td>

                  <td className="p-4">
                    <span
                      className={`px-3 py-1 rounded-full font-bold text-xs ${
                        item.isLowStock
                          ? "bg-red-900/60 text-red-300 border border-red-700"
                          : "bg-emerald-900/50 text-emerald-300 border border-emerald-700/60"
                      }`}
                    >
                      {item.warehouseQty} יח&apos;
                    </span>
                  </td>

                  <td className="p-4 font-mono text-gray-300">{item.minAlert} יח&apos;</td>

                  <td className="p-4 font-mono text-cyan-300 font-bold">{item.vanQty} יח&apos;</td>

                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={Math.max(1, item.warehouseQty)}
                        value={getTransferAmount(item.id)}
                        onChange={(e) =>
                          setTransferQtyMap((prev) => ({
                            ...prev,
                            [item.id]: Math.max(1, Number(e.target.value) || 1),
                          }))
                        }
                        className="w-14 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-center text-xs text-white"
                      />
                      <button
                        disabled={busyId === item.id || item.warehouseQty <= 0}
                        onClick={() => handleTransferToVan(item)}
                        className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer"
                      >
                        העבר לרכב
                      </button>
                    </div>
                  </td>

                  <td className="p-4">
                    <button
                      disabled={busyId === item.id}
                      onClick={() => handleReceivePurchaseOrder(item)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        item.isLowStock
                          ? "bg-amber-500 hover:bg-amber-400 text-gray-950"
                          : "bg-gray-700 hover:bg-gray-600 text-gray-200"
                      }`}
                    >
                      + קלוט הזמנת רכש
                    </button>
                  </td>
                </tr>
              ))}

              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-400">
                    אין פריטים התואמים את הסינון הנוכחי.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}