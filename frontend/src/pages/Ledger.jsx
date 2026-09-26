import { useState, useEffect } from 'react';
import PageShell from '../components/layout/PageShell';
import { Search, Filter, Download, ArrowRight, ArrowRightLeft, Clock, User } from 'lucide-react';
import { api } from '../services/api';
import DetailDrawer from '../components/common/DetailDrawer';
import StatusBadge from '../components/common/StatusBadge';

const Ledger = () => {
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await api.getLedger();
        setLedgerEntries(result);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <PageShell title="Stock Ledger" subtitle="Immutable record of all inventory transactions">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Search reference or product..." 
                className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-64 transition-all"
              />
            </div>
            <select className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 outline-none hover:bg-slate-50 transition-colors">
              <option>All Operations</option>
              <option>Receipt</option>
              <option>Delivery</option>
              <option>Internal Transfer</option>
              <option>Adjustment</option>
            </select>
            <select className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 outline-none hover:bg-slate-50 transition-colors">
              <option>All Locations</option>
              <option>Main Store</option>
              <option>Production Rack</option>
            </select>
            <button className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors">
              <Filter className="w-4 h-4" />
              More Filters
            </button>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-900 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors shadow-sm">
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
        
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap table-fixed">
            <colgroup>
              <col className="w-[12%]" />
              <col className="w-[12%]" />
              <col className="w-[15%]" />
              <col className="w-[20%]" />
              <col className="w-[10%]" />
              <col className="w-[20%]" />
              <col className="w-[11%]" />
            </colgroup>
            <thead className="bg-white text-slate-400 font-sans text-[10px] uppercase tracking-[0.1em] border-b border-slate-200 select-none sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="py-3 px-6 font-bold">Timestamp</th>
                <th className="py-3 px-4 font-bold">Reference</th>
                <th className="py-3 px-4 font-bold">Operation</th>
                <th className="py-3 px-4 font-bold">Product</th>
                <th className="py-3 px-4 font-bold text-right">Qty</th>
                <th className="py-3 px-4 font-bold">Flow</th>
                <th className="py-3 px-4 font-bold text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 cursor-pointer">
              {ledgerEntries.map((item, idx) => (
                <tr 
                  key={idx} 
                  onClick={() => setSelectedEntry(item)}
                  className="hover:bg-slate-50 transition-all duration-200 group relative"
                >
                  <td className="py-4 px-6 font-mono text-[11px] text-slate-400">
                    <div className="flex flex-col">
                      <span>{item.date}</span>
                      <span>{item.time}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 font-mono text-[11px] text-slate-500 font-semibold group-hover:text-indigo-600 transition-colors">
                    {item.id}
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2">
                      {item.operation === 'Internal Transfer' && <ArrowRightLeft className="w-4 h-4 text-slate-400" />}
                      {item.operation === 'Receipt' && <ArrowRight className="w-4 h-4 text-emerald-500 rotate-90" />}
                      {item.operation === 'Delivery' && <ArrowRight className="w-4 h-4 text-slate-500 -rotate-90" />}
                      {item.operation === 'Adjustment' && <Filter className="w-4 h-4 text-amber-500" />}
                      <span className="font-semibold text-slate-700 text-xs">{item.operation}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 font-semibold text-slate-900 truncate">{item.product}</td>
                  <td className={`py-4 px-4 text-right font-mono font-bold tabular-nums ${item.quantity > 0 ? 'text-emerald-600' : (item.quantity < 0 && item.operation !== 'Internal Transfer') ? 'text-red-600' : 'text-slate-700'}`}>
                    {item.operation === 'Internal Transfer' ? Math.abs(item.quantity) : (item.quantity > 0 ? `+${item.quantity}` : item.quantity)}
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-900 font-semibold truncate">{item.locationFlow}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <StatusBadge status={item.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Showing {ledgerEntries.length} records</span>
            <div className="flex items-center gap-1">
              <button className="px-2 py-1 text-xs font-semibold text-slate-400 hover:text-slate-900 transition-colors">Prev</button>
              <button className="w-6 h-6 rounded-md bg-white border border-slate-200 text-xs font-bold text-slate-900 shadow-sm flex items-center justify-center">1</button>
              <button className="px-2 py-1 text-xs font-semibold text-slate-400 hover:text-slate-900 transition-colors">Next</button>
            </div>
          </div>
        </div>
      </div>

      <DetailDrawer
        isOpen={!!selectedEntry}
        onClose={() => setSelectedEntry(null)}
        title="Transaction Details"
      >
        {selectedEntry && (
          <div className="flex flex-col space-y-6">
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Reference</span>
                <span className="font-mono text-lg font-bold text-indigo-600 mt-1">{selectedEntry.id}</span>
              </div>
              <StatusBadge status={selectedEntry.status} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col p-4 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Operation</span>
                <span className="font-semibold text-slate-900 mt-1">{selectedEntry.operation}</span>
              </div>
              <div className="flex flex-col p-4 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Product</span>
                <span className="font-semibold text-slate-900 mt-1">{selectedEntry.product}</span>
              </div>
            </div>

            <div className="flex flex-col p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Location</span>
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm text-slate-900 bg-slate-100 px-3 py-1.5 rounded flex-1 text-center">
                  {selectedEntry.locationFlow}
                </span>
              </div>
            </div>

            <div className="flex flex-col p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Quantity Impact</span>
              <span className={`font-mono text-2xl font-bold tabular-nums ${selectedEntry.quantity > 0 ? 'text-emerald-600' : 'text-slate-900'}`}>
                {selectedEntry.operation === 'Internal Transfer' ? '-30 / +30' : (selectedEntry.quantity > 0 ? `+${selectedEntry.quantity}` : selectedEntry.quantity)} units
              </span>
            </div>

            <div className="flex flex-col space-y-3 pt-4 border-t border-slate-200">
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <Clock className="w-4 h-4 text-slate-400" />
                <span>Created {selectedEntry.time} on {selectedEntry.date}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <User className="w-4 h-4 text-slate-400" />
                <span>Authorized by Warehouse Staff</span>
              </div>
            </div>
          </div>
        )}
      </DetailDrawer>
    </PageShell>
  );
};

export default Ledger;
