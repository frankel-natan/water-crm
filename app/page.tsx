'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import ServiceSummaryModal from '@/components/ServiceSummaryModal';
import ReceiptViewModal from '@/components/ReceiptViewModal';
import RoutePlanner from '@/components/RoutePlanner';
import BillingManager from '@/components/BillingManager';
import CustomersManager from '@/components/CustomersManager';
import WarehouseManager from '@/components/WarehouseManager';

const DEMO_TECH_ID = '11111111-1111-1111-1111-111111111111';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'dispatcher' | 'routes' | 'technician' | 'inventory' | 'maintenance' | 'customers' | 'shifts' | 'billing' | 'warehouse'>('dispatcher');
  const [tickets, setTickets] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [maintenanceList, setMaintenanceList] = useState<any[]>([]);
  const [activeShift, setActiveShift] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // סינון וחיפוש במוקד
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'completed'>('all');

  // סטייט למודאל פתיחת קריאה
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('normal');

  // סטייט למודאל סגירת קריאה + חתימת לקוח ותעודת שירות
  const [signingTicket, setSigningTicket] = useState<any | null>(null);
  const [viewingReceiptTicket, setViewingReceiptTicket] = useState<any | null>(null);

  async function loadAllData() {
    setLoading(true);
    try {
      const { data: ticketsData } = await supabase
        .from('service_tickets')
        .select(`
          id, customer_id, ticket_type, status, priority, description, scheduled_at,
          customer_signature, technician_notes, completed_at, payment_status, total_amount, payment_method, invoice_number, paid_at,
          customers (name, phone),
          sites (city, address),
          ticket_parts_used (
            quantity_used,
            inventory_items (name, unit_price)
          )
        `)
        .order('created_at', { ascending: false });
      setTickets(ticketsData || []);

      const { data: invData } = await supabase
        .from('technician_inventory')
        .select(`
          quantity,
          inventory_items (id, sku, name, category, unit_price, warehouse_qty, min_stock_alert, last_po_number)
        `)
        .eq('technician_id', DEMO_TECH_ID);
      setInventory(invData || []);

      const { data: maintData } = await supabase
        .from('maintenance_schedules')
        .select('*')
        .order('id', { ascending: true });
      setMaintenanceList(maintData || []);

      const { data: custData } = await supabase
        .from('customers')
        .select(`
          id, name, phone, customer_type,
          sites (id, site_name, city, address),
          service_tickets (id, status)
        `)
        .order('created_at', { ascending: false });
      setCustomers(custData || []);

      const { data: shiftsData } = await supabase
        .from('employee_shifts')
        .select('*')
        .eq('user_id', DEMO_TECH_ID)
        .order('clock_in', { ascending: false })
        .limit(10);
      setShifts(shiftsData || []);

      const currentOpenShift = (shiftsData || []).find((s: any) => !s.clock_out) || null;
      setActiveShift(currentOpenShift);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAllData();
  }, []);

  async function createTicketInDB(params: {
    name: string;
    phone: string;
    city: string;
    address: string;
    priority: string;
    description: string;
    ticketType?: string;
  }) {
    const { data: custData, error: custError } = await supabase
      .from('customers')
      .insert([{ customer_type: 'business', name: params.name, phone: params.phone || '050-0000000' }])
      .select()
      .single();
    if (custError) throw custError;

    const { data: siteData, error: siteError } = await supabase
      .from('sites')
      .insert([{ customer_id: custData.id, site_name: 'אתר ראשי', city: params.city, address: params.address, region_id: 1 }])
      .select()
      .single();
    if (siteError) throw siteError;

    const { error: ticketError } = await supabase
      .from('service_tickets')
      .insert([{
        customer_id: custData.id,
        site_id: siteData.id,
        technician_id: DEMO_TECH_ID,
        ticket_type: params.ticketType || 'repair',
        status: 'scheduled',
        priority: params.priority,
        description: params.description
      }]);
    if (ticketError) throw ticketError;
  }

  async function handleCreateTicket(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createTicketInDB({
        name: customerName,
        phone,
        city,
        address,
        priority,
        description: description || 'קריאת שירות חדשה'
      });

      setIsModalOpen(false);
      setCustomerName('');
      setPhone('');
      setCity('');
      setAddress('');
      setDescription('');
      loadAllData();
    } catch (err: any) {
      alert('שגיאה: ' + err.message);
    }
  }

  async function handleConvertMaintenanceToTicket(item: any) {
    try {
      await createTicketInDB({
        name: item.customer_name,
        phone: item.phone,
        city: item.city,
        address: item.address,
        priority: 'normal',
        description: `[תחזוקה חצי שנתית] ${item.service_needed}`,
        ticketType: 'maintenance'
      });

      const { error: updError } = await supabase
        .from('maintenance_schedules')
        .update({ is_scheduled: true })
        .eq('id', item.id);
      if (updError) throw updError;

      loadAllData();
    } catch (err: any) {
      alert('שגיאה בתזמון תחזוקה: ' + err.message);
    }
  }

  async function handleShiftToggle() {
    try {
      if (!activeShift) {
        await supabase.from('employee_shifts').insert([{ user_id: DEMO_TECH_ID }]);
      } else {
        await supabase
          .from('employee_shifts')
          .update({ clock_out: new Date().toISOString() })
          .eq('id', activeShift.id);
      }
      loadAllData();
    } catch (err: any) {
      alert('שגיאה בעדכון משמרת: ' + err.message);
    }
  }

  async function handleCompleteWithSignature(data: {
    ticketId: string;
    itemId: string;
    qty: number;
    notes: string;
    signature: string;
  }) {
    if (data.itemId) {
      const { error: partError } = await supabase
        .from('ticket_parts_used')
        .insert([{
          ticket_id: data.ticketId,
          item_id: data.itemId,
          quantity_used: data.qty,
          unit_price_charged: 0
        }]);
      if (partError) throw partError;
    }

    const { error: statusError } = await supabase
      .from('service_tickets')
      .update({
        status: 'completed',
        customer_signature: data.signature,
        technician_notes: data.notes,
        completed_at: new Date().toISOString()
      })
      .eq('id', data.ticketId);
    if (statusError) throw statusError;

    await loadAllData();
  }

  async function handleRestockItem(itemId: string, currentQty: number, addAmount: number = 5) {
    try {
      const { error } = await supabase
        .from('technician_inventory')
        .update({ quantity: currentQty + addAmount })
        .eq('technician_id', DEMO_TECH_ID)
        .eq('item_id', itemId);

      if (error) throw error;
      loadAllData();
    } catch (err: any) {
      alert('שגיאה בהעמסת מלאי: ' + err.message);
    }
  }

  const openTicketsCount = tickets.filter(t => t.status !== 'completed').length;
  const urgentTicketsCount = tickets.filter(t => t.status !== 'completed' && t.priority === 'urgent').length;
  const lowStockCount = inventory.filter(i => i.quantity <= 3).length;
  const pendingMaintenanceRevenue = maintenanceList
    .filter(m => !m.is_scheduled)
    .reduce((acc, m) => acc + (m.estimated_revenue || 0), 0);

  const filteredTickets = tickets.filter((ticket) => {
    const matchesStatus =
      statusFilter === 'all' ? true :
      statusFilter === 'open' ? ticket.status !== 'completed' :
      ticket.status === 'completed';

    const q = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !q ||
      (ticket.customers?.name || '').toLowerCase().includes(q) ||
      (ticket.sites?.city || '').toLowerCase().includes(q) ||
      (ticket.description || '').toLowerCase().includes(q) ||
      String(ticket.id).includes(q);

    return matchesStatus && matchesQuery;
  });

  return (
    <main dir="rtl" className="min-h-screen bg-gray-900 text-gray-100 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-6 border-b border-gray-800 pb-5">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-cyan-400">NEXUS FLOW - ניהול שירות ברי מים</h1>
            <p className="text-gray-400 text-xs md:text-sm mt-1">מערכת CRM, תפעול שטח, מלאי נייד ותחזוקה מונעת</p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 bg-gray-800 p-1.5 rounded-xl border border-gray-700">
            <button
              onClick={() => setActiveTab('dispatcher')}
              className={`px-3 py-2 rounded-lg text-xs md:text-sm font-medium transition cursor-pointer ${
                activeTab === 'dispatcher' ? 'bg-cyan-600 text-white shadow' : 'text-gray-300 hover:text-white'
              }`}
            >
              מוקד קריאות
            </button>
            <button
              onClick={() => setActiveTab('routes')}
              className={`px-3 py-2 rounded-lg text-xs md:text-sm font-medium transition cursor-pointer ${activeTab === 'routes' ? 'bg-cyan-600 text-white shadow' : 'text-gray-300 hover:text-white'}`}
            >
              יומן ומסלולים
            </button>
            <button
              onClick={() => setActiveTab('technician')}
              className={`px-3 py-2 rounded-lg text-xs md:text-sm font-medium transition cursor-pointer ${
                activeTab === 'technician' ? 'bg-cyan-600 text-white shadow' : 'text-gray-300 hover:text-white'
              }`}
            >
              אפליקציית טכנאי
            </button>
            <button
              onClick={() => setActiveTab('maintenance')}
              className={`px-3 py-2 rounded-lg text-xs md:text-sm font-medium transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'maintenance' ? 'bg-cyan-600 text-white shadow' : 'text-gray-300 hover:text-white'
              }`}
            >
              <span>תחזוקה מונעת</span>
              {maintenanceList.filter(m => !m.is_scheduled).length > 0 && (
                <span className="bg-amber-500 text-gray-900 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {maintenanceList.filter(m => !m.is_scheduled).length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('inventory')}
              className={`px-3 py-2 rounded-lg text-xs md:text-sm font-medium transition cursor-pointer ${
                activeTab === 'inventory' ? 'bg-cyan-600 text-white shadow' : 'text-gray-300 hover:text-white'
              }`}
            >
              מלאי נייד
            </button>
            <button
              onClick={() => setActiveTab('warehouse')}
              className={`px-3 py-2 rounded-lg text-xs md:text-sm font-medium transition cursor-pointer ${activeTab === 'warehouse' ? 'bg-cyan-600 text-white shadow' : 'text-gray-300 hover:text-white'}`}
            >
              מחסן ראשי
            </button>
            <button
              onClick={() => setActiveTab('customers')}
              className={`px-3 py-2 rounded-lg text-xs md:text-sm font-medium transition cursor-pointer ${
                activeTab === 'customers' ? 'bg-cyan-600 text-white shadow' : 'text-gray-300 hover:text-white'
              }`}
            >
              לקוחות
            </button>
            <button
              onClick={() => setActiveTab('billing')}
              className={`px-3 py-2 rounded-lg text-xs md:text-sm font-medium transition cursor-pointer ${activeTab === 'billing' ? 'bg-cyan-600 text-white shadow' : 'text-gray-300 hover:text-white'}`}
            >
              כספים וגבייה
            </button>
            <button
              onClick={() => setActiveTab('shifts')}
              className={`px-3 py-2 rounded-lg text-xs md:text-sm font-medium transition cursor-pointer ${
                activeTab === 'shifts' ? 'bg-cyan-600 text-white shadow' : 'text-gray-300 hover:text-white'
              }`}
            >
              משמרות
            </button>
            <button
              onClick={loadAllData}
              title="רענן נתונים בזמן אמת"
              className="px-2.5 py-2 rounded-lg text-xs text-cyan-400 hover:bg-gray-700 transition cursor-pointer"
            >
              ↻
            </button>
          </div>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-800/80 border border-gray-700 rounded-xl p-4">
            <div className="text-xs text-gray-400">קריאות פתוחות לטיפול</div>
            <div className="text-2xl font-bold text-white mt-1">{openTicketsCount}</div>
          </div>
          <div className="bg-gray-800/80 border border-gray-700 rounded-xl p-4">
            <div className="text-xs text-gray-400">קריאות דחופות (Urgent)</div>
            <div className={`text-2xl font-bold mt-1 ${urgentTicketsCount > 0 ? 'text-red-400' : 'text-gray-300'}`}>
              {urgentTicketsCount}
            </div>
          </div>
          <div className="bg-gray-800/80 border border-gray-700 rounded-xl p-4">
            <div className="text-xs text-gray-400">התראות מלאי נמוך ברכב</div>
            <div className={`text-2xl font-bold mt-1 ${lowStockCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {lowStockCount}
            </div>
          </div>
          <div className="bg-gray-800/80 border border-gray-700 rounded-xl p-4">
            <div className="text-xs text-gray-400">הכנסה צפויה מהחלפת סננים</div>
            <div className="text-2xl font-bold text-emerald-400 mt-1">₪{pendingMaintenanceRevenue}</div>
          </div>
        </div>

        {activeTab === 'dispatcher' && (
          <div>
            <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 mb-4">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="חיפוש לפי לקוח, עיר או תקלה..."
                  className="bg-gray-800 border border-gray-700 rounded-lg px-3.5 py-2 text-sm text-white focus:border-cyan-400 outline-none w-full sm:w-64"
                />
                <div className="flex bg-gray-800 p-1 rounded-lg border border-gray-700 text-xs">
                  <button
                    onClick={() => setStatusFilter('all')}
                    className={`px-2.5 py-1 rounded cursor-pointer ${statusFilter === 'all' ? 'bg-gray-700 text-white' : 'text-gray-400'}`}
                  >
                    הכל ({tickets.length})
                  </button>
                  <button
                    onClick={() => setStatusFilter('open')}
                    className={`px-2.5 py-1 rounded cursor-pointer ${statusFilter === 'open' ? 'bg-gray-700 text-white' : 'text-gray-400'}`}
                  >
                    פתוחות ({openTicketsCount})
                  </button>
                  <button
                    onClick={() => setStatusFilter('completed')}
                    className={`px-2.5 py-1 rounded cursor-pointer ${statusFilter === 'completed' ? 'bg-gray-700 text-white' : 'text-gray-400'}`}
                  >
                    סגורות ({tickets.length - openTicketsCount})
                  </button>
                </div>
              </div>

              <button
                onClick={() => setIsModalOpen(true)}
                className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg font-medium transition shadow-lg cursor-pointer text-sm"
              >
                + פתח קריאה חדשה
              </button>
            </div>

            <div className="bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-700">
              {loading ? (
                <div className="p-8 text-center text-gray-400">טוען נתונים...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="border-b border-gray-700 text-gray-400 text-sm bg-gray-700/30">
                        <th className="p-4"># מזהה</th>
                        <th className="p-4">לקוח</th>
                        <th className="p-4">כתובת</th>
                        <th className="p-4">תיאור ופירוט חלקים</th>
                        <th className="p-4">עדיפות</th>
                        <th className="p-4">סטטוס ואישור</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700 text-sm">
                      {filteredTickets.map((ticket) => (
                        <tr key={ticket.id} className="hover:bg-gray-700/30 transition">
                          <td className="p-4 font-mono text-cyan-400">#{ticket.id}</td>
                          <td className="p-4">
                            <div className="font-medium text-white">{ticket.customers?.name || 'לא ידוע'}</div>
                            <div className="text-xs text-gray-400 font-mono">{ticket.customers?.phone}</div>
                          </td>
                          <td className="p-4 text-gray-300">{ticket.sites?.city} - {ticket.sites?.address}</td>
                          <td className="p-4">
                            <div className="text-gray-300">{ticket.description}</div>
                            {ticket.technician_notes && (
                              <div className="text-xs text-emerald-300 mt-1">סיכום טכנאי: {ticket.technician_notes}</div>
                            )}
                            {ticket.ticket_parts_used && ticket.ticket_parts_used.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {ticket.ticket_parts_used.map((p: any, i: number) => (
                                  <span key={i} className="text-[11px] bg-cyan-950 text-cyan-300 border border-cyan-800 px-2 py-0.5 rounded">
                                    הוחלף: {p.inventory_items?.name} (x{p.quantity_used})
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="p-4">
                            <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                              ticket.priority === 'urgent' ? 'bg-red-900/50 text-red-300 border border-red-700' :
                              ticket.priority === 'high' ? 'bg-orange-900/50 text-orange-300 border border-orange-700' :
                              'bg-blue-900/50 text-blue-300 border border-blue-700'
                            }`}>
                              {ticket.priority}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-col gap-1 items-start">
                              <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                                ticket.status === 'completed' ? 'bg-gray-700 text-gray-300 border border-gray-600' :
                                'bg-emerald-900/50 text-emerald-300 border border-emerald-700'
                              }`}>
                                {ticket.status === 'completed' ? 'נסגר' : 'מתוזמן'}
                              </span>
                              {ticket.status === 'completed' && (
                                <button
                                  onClick={() => setViewingReceiptTicket(ticket)}
                                  className="mt-1 text-[11px] bg-cyan-950 hover:bg-cyan-800 text-cyan-300 border border-cyan-700 px-2 py-1 rounded transition cursor-pointer"
                                >
                                  📄 צפה בתעודה {ticket.customer_signature ? 'וחתימה' : ''}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredTickets.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-gray-400">
                            לא נמצאו קריאות תואמות לחיפוש.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

                {activeTab === 'routes' && (
          <RoutePlanner tickets={tickets} onRefresh={loadAllData} />
        )}

        {activeTab === 'technician' && (
          <div className="space-y-6">
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div>
                <h2 className="text-lg font-bold text-white">שלום, יוסי הטכנאי</h2>
                <p className="text-sm text-gray-400 mt-1">
                  סטטוס משמרת:{' '}
                  {activeShift ? (
                    <span className="text-emerald-400 font-semibold">
                      במשמרת פעילה (החלה ב-{new Date(activeShift.clock_in).toLocaleTimeString('he-IL')})
                    </span>
                  ) : (
                    <span className="text-gray-400">מחוץ למשמרת</span>
                  )}
                </p>
              </div>
              <button
                onClick={handleShiftToggle}
                className={`px-6 py-3 rounded-xl font-bold transition cursor-pointer ${
                  activeShift
                    ? 'bg-red-600 hover:bg-red-500 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                {activeShift ? 'יציאה ממשמרת (חישוב שעות)' : 'כניסה למשמרת'}
              </button>
            </div>

            <h3 className="text-lg font-semibold text-gray-200">קריאות פתוחות לביצוע בשטח</h3>
            <div className="grid md:grid-cols-2 gap-4">
              {tickets.filter(t => t.status !== 'completed').map((ticket) => (
                <div key={ticket.id} className="bg-gray-800 border border-gray-700 rounded-xl p-5 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-mono text-cyan-400 font-bold">קריאה #{ticket.id}</span>
                      <span className="text-xs bg-gray-700 px-2.5 py-1 rounded">{ticket.priority}</span>
                    </div>
                    <h4 className="text-lg font-bold text-white">{ticket.customers?.name}</h4>
                    <p className="text-sm text-gray-300 mt-1">{ticket.sites?.city}, {ticket.sites?.address}</p>
                    <p className="text-xs text-cyan-400 mt-1">טלפון: {ticket.customers?.phone || '050-0000000'}</p>
                    <p className="text-sm text-gray-400 mt-2 bg-gray-900/60 p-3 rounded-lg">{ticket.description}</p>
                  </div>

                  <div className="border-t border-gray-700 pt-4">
                    <button
                      onClick={() => setSigningTicket({
                        ...ticket,
                        customers: {
                          full_name: ticket.customers?.name,
                          phone: ticket.customers?.phone,
                          address: `${ticket.sites?.city || ''} ${ticket.sites?.address || ''}`.trim()
                        }
                      })}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-bold transition cursor-pointer shadow-lg"
                    >
                      סגור קריאה, החתם לקוח והפק תעודה ✍️
                    </button>
                  </div>
                </div>
              ))}
              {tickets.filter(t => t.status !== 'completed').length === 0 && (
                <div className="col-span-2 bg-gray-800 border border-gray-700 rounded-xl p-8 text-center text-gray-400">
                  כל הקריאות להיום טופלו!
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'maintenance' && (
          <div className="bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-700">
            <div className="p-5 bg-gradient-to-l from-cyan-950/60 to-gray-800 border-b border-gray-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h2 className="text-lg font-bold text-white">מנוע תחזוקה מונעת והכנסות חוזרות</h2>
                <p className="text-xs text-gray-400 mt-0.5">לקוחות שחלפו 6 חודשים ממועד החלפת הסננים האחרונה</p>
              </div>
              <div className="bg-emerald-950/80 border border-emerald-700/60 px-4 py-2 rounded-lg text-sm">
                <span className="text-gray-300">פוטנציאל גבייה מיידי: </span>
                <span className="font-bold text-emerald-400">₪{pendingMaintenanceRevenue}</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-gray-700 text-gray-400 text-sm">
                    <th className="p-4">שם הלקוח</th>
                    <th className="p-4">כתובת אתר</th>
                    <th className="p-4">טיפול נדרש</th>
                    <th className="p-4">טיפול אחרון</th>
                    <th className="p-4">שווי עסקה</th>
                    <th className="p-4">פעולה מהירה</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700 text-sm">
                  {maintenanceList.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-700/30">
                      <td className="p-4">
                        <div className="font-bold text-white">{item.customer_name}</div>
                        <div className="text-xs text-gray-400 font-mono">{item.phone}</div>
                      </td>
                      <td className="p-4 text-gray-300">{item.city} - {item.address}</td>
                      <td className="p-4 text-cyan-300">{item.service_needed}</td>
                      <td className="p-4 font-mono text-gray-400">{item.last_service_date}</td>
                      <td className="p-4 font-bold text-emerald-400">₪{item.estimated_revenue}</td>
                      <td className="p-4">
                        {item.is_scheduled ? (
                          <span className="text-xs bg-emerald-900/50 text-emerald-300 border border-emerald-700 px-3 py-1.5 rounded-lg font-medium">
                            ✓ נפתחה קריאה ליוסי
                          </span>
                        ) : (
                          <button
                            onClick={() => handleConvertMaintenanceToTicket(item)}
                            className="bg-cyan-600 hover:bg-cyan-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer"
                          >
                            + תזמן קריאה לטכנאי
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'inventory' && (
          <div className="bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-700">
            <div className="p-4 bg-gray-700/50 border-b border-gray-700 flex justify-between items-center">
              <span className="font-semibold text-gray-200">מלאי נוכחי ברכב של יוסי הטכנאי ({inventory.length} פריטים)</span>
              <span className="text-xs text-cyan-400">מתעדכן אוטומטית בכל סגירת קריאה</span>
            </div>
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-gray-700 text-gray-400 text-sm">
                  <th className="p-4">מק&quot;ט</th>
                  <th className="p-4">שם הפריט</th>
                  <th className="p-4">קטגוריה</th>
                  <th className="p-4">יתרה ברכב</th>
                  <th className="p-4">פעולת מחסן</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700 text-sm">
                {inventory.map((item: any, idx: number) => {
                  const invItem = Array.isArray(item.inventory_items) ? item.inventory_items[0] : item.inventory_items;
                  return (
                    <tr key={idx} className="hover:bg-gray-700/30">
                      <td className="p-4 font-mono text-gray-400">{invItem?.sku}</td>
                      <td className="p-4 font-medium text-white">{invItem?.name}</td>
                      <td className="p-4 text-gray-300">{invItem?.category}</td>
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-full font-bold ${
                          item.quantity <= 3 ? 'bg-red-900/50 text-red-300 border border-red-700' : 'bg-emerald-900/50 text-emerald-300'
                        }`}>
                          {item.quantity} יח&apos;
                        </span>
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => handleRestockItem(invItem?.id, item.quantity, 5)}
                          className="bg-gray-700 hover:bg-cyan-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer"
                        >
                          + העמס 5 יח&apos; מהמחסן
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'customers' && (
          <CustomersManager
            customers={customers}
            tickets={tickets}
            onRefresh={loadAllData}
            onViewReceipt={(ticket) => setViewingReceiptTicket(ticket)}
          />
        )}

        {activeTab === 'billing' && (
          <BillingManager tickets={tickets} onRefresh={loadAllData} />
        )}

        {activeTab === 'shifts' && (
          <div className="bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-700">
            <div className="p-4 bg-gray-700/50 border-b border-gray-700">
              <span className="font-semibold text-gray-200">דוח נוכחות ומשמרות - יוסי הטכנאי</span>
            </div>
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-gray-700 text-gray-400 text-sm">
                  <th className="p-4">כניסה למשמרת</th>
                  <th className="p-4">יציאה ממשמרת</th>
                  <th className="p-4">סטטוס</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700 text-sm">
                {shifts.map((shift) => (
                  <tr key={shift.id} className="hover:bg-gray-700/30">
                    <td className="p-4 font-mono text-gray-200">{new Date(shift.clock_in).toLocaleString('he-IL')}</td>
                    <td className="p-4 font-mono text-gray-300">
                      {shift.clock_out ? new Date(shift.clock_out).toLocaleString('he-IL') : 'פעיל כעת'}
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded text-xs font-semibold ${
                        shift.clock_out ? 'bg-gray-700 text-gray-300' : 'bg-emerald-900/60 text-emerald-300 border border-emerald-700'
                      }`}>
                        {shift.clock_out ? 'הושלם' : 'במשמרת'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* מודאל פתיחת קריאה חדשה */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-cyan-400 mb-4">פתיחת קריאת שירות חדשה</h2>
            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">שם הלקוח / חברה *</label>
                <input
                  required
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-white text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">טלפון</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="050-0000000"
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">עיר *</label>
                  <input
                    required
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-white text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">כתובת מלאה *</label>
                <input
                  required
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">דחיפות</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-white text-sm"
                >
                  <option value="normal">רגילה (Normal)</option>
                  <option value="high">גבוהה (High)</option>
                  <option value="urgent">דחופה (Urgent)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">תיאור התקלה</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-white text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-gray-600 text-gray-300 text-sm cursor-pointer"
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-sm cursor-pointer"
                >
                  צור קריאה
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* מודאל חתימת לקוח והפקת תעודת שירות */}
      {signingTicket && (
        <ServiceSummaryModal
          ticket={signingTicket}
          inventory={inventory}
          onClose={() => setSigningTicket(null)}
          onConfirmComplete={handleCompleteWithSignature}
        />
      )}
          {viewingReceiptTicket && (
        <ReceiptViewModal
          ticket={viewingReceiptTicket}
          onClose={() => setViewingReceiptTicket(null)}
        />
      )}
    </main>
  );
}