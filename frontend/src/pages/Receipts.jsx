import { useState, useEffect } from 'react';
import PageShell from '../components/layout/PageShell';
import { Search, Plus, Check, ArrowRight } from 'lucide-react';
import StatusBadge from '../components/common/StatusBadge';
import DetailDrawer from '../components/common/DetailDrawer';
import { api } from '../services/api';

const tabs = ['All', 'Draft', 'Waiting', 'Ready', 'Done', 'Cancelled'];

const Receipts = () => {
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [activeTab, setActiveTab] = useState('All');
  const [receipts, setReceipts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchReceipts() {
      try {
        const data = await api.getReceipts();
        setReceipts(data);
      } catch (e) {
        console.error('Failed to fetch receipts:', e);
      } finally {
        setIsLoading(false);
      }
    }
    fetchReceipts();
  }, []);

  return (
    <PageShell title="Receipts" subtitle="Track incoming inventory and receiving activity">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-200 flex items-center gap-6 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`whitespace-nowrap pb-4 -mb-4 text-sm font-semibold transition-colors border-b-2 ${
                activeTab === tab 
                  ? 'text-indigo-600 border-indigo-600' 
                  : 'text-slate-500 border-transparent hover:text-slate-900'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        
        <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Search receipts..." 
                className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-64 transition-all"
              />
            </div>
            <select className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 outline-none hover:bg-slate-50 transition-colors">
              <option>All Suppliers</option>
              <option>GlobalTech Industries</option>
              <option>MetalWorks Ltd</option>
            </select>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 shadow-sm transition-all active:scale-95">
            <Plus className="w-4 h-4" />
            New Receipt
          </button>
        </div>
        
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap table-fixed">
            <colgroup>
              <col className="w-[15%]" />
              <col className="w-[20%]" />
              <col className="w-[10%]" />
              <col className="w-[15%]" />
              <col className="w-[20%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
            </colgroup>
            <thead className="bg-white text-slate-400 font-sans text-[10px] uppercase tracking-[0.1em] border-b border-slate-200 select-none sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="py-3 px-6 font-bold">Reference</th>
                <th className="py-3 px-4 font-bold">Supplier</th>
                <th className="py-3 px-4 font-bold text-right">Items</th>
                <th className="py-3 px-4 font-bold text-right">Quantity</th>
                <th className="py-3 px-4 font-bold">Destination</th>
                <th className="py-3 px-4 font-bold text-right">Status</th>
                <th className="py-3 px-6 font-bold text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 cursor-pointer">
              {isLoading ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-slate-500">Loading receipts...</td>
                </tr>
              ) : receipts.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-slate-500">No receipts found.</td>
                </tr>
              ) : receipts.map((item, idx) => (
                <tr 
                  key={idx} 
                  onClick={() => setSelectedReceipt(item)}
                  className="hover:bg-slate-50 transition-all duration-200 group relative"
                >
                  <td className="py-4 px-6 font-mono text-[11px] text-slate-500 font-semibold group-hover:text-indigo-600 transition-colors">
                    <div className="flex items-center gap-2">
                      <ArrowRight className="w-3 h-3 text-emerald-500 rotate-90" />
                      {item.id}
                    </div>
                  </td>
                  <td className="py-4 px-4 font-semibold text-slate-900 truncate">{item.supplier}</td>
                  <td className="py-4 px-4 text-right font-mono text-slate-500 tabular-nums">{item.items}</td>
                  <td className="py-4 px-4 text-right font-mono font-bold text-emerald-600 tabular-nums">+{item.quantity}</td>
                  <td className="py-4 px-4 text-slate-700 font-medium truncate">{item.destination}</td>
                  <td className="py-4 px-4 text-right"><StatusBadge status={item.status} /></td>
                  <td className="py-4 px-6 text-right font-mono text-[11px] text-slate-400">{item.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Showing {receipts.length} receipts</span>
            <div className="flex items-center gap-1">
              <button className="px-2 py-1 text-xs font-semibold text-slate-400 hover:text-slate-900 transition-colors">Prev</button>
              <button className="w-6 h-6 rounded-md bg-white border border-slate-200 text-xs font-bold text-slate-900 shadow-sm flex items-center justify-center">1</button>
              <button className="px-2 py-1 text-xs font-semibold text-slate-400 hover:text-slate-900 transition-colors">Next</button>
            </div>
          </div>
        </div>
      </div>

      <DetailDrawer
        isOpen={!!selectedReceipt}
        onClose={() => setSelectedReceipt(null)}
        title="Receipt Details"
      >
        {selectedReceipt && (
          <div className="flex flex-col space-y-6">
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Reference</span>
                <span className="font-mono text-lg font-bold text-indigo-600 mt-1">{selectedReceipt.id}</span>
              </div>
              <StatusBadge status={selectedReceipt.status} />
            </div>

            {/* Progress indicator */}
            <div className="flex items-center justify-between relative mt-4 mb-2">
              <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-200 -translate-y-1/2 z-0"></div>
              {['Draft', 'Waiting', 'Ready', 'Done'].map((step, index) => {
                const steps = ['Draft', 'Waiting', 'Ready', 'Done'];
                const currentIndex = steps.indexOf(selectedReceipt.status);
                const isCompleted = index <= currentIndex;
                const isActive = index === currentIndex;
                
                return (
                  <div key={step} className="flex flex-col items-center relative z-10">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-colors ${
                      isActive ? 'bg-white border-indigo-600 text-indigo-600' :
                      isCompleted ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-300 text-slate-300'
                    }`}>
                      {isCompleted && !isActive ? <Check className="w-3.5 h-3.5" /> : <span className="text-[10px] font-bold">{index + 1}</span>}
                    </div>
                    <span className={`text-[10px] font-bold uppercase mt-2 tracking-wider ${
                      isActive ? 'text-indigo-600' : isCompleted ? 'text-slate-900' : 'text-slate-400'
                    }`}>{step}</span>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col p-4 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Supplier</span>
              <span className="font-semibold text-slate-900 mt-1 text-base">{selectedReceipt.supplier}</span>
            </div>

            <div className="flex flex-col gap-3 pt-6 border-t border-slate-200">
              {selectedReceipt.status === 'Ready' && (
                <button className="w-full py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold shadow-sm hover:bg-emerald-700 transition-colors">
                  Mark as Done
                </button>
              )}
            </div>
          </div>
        )}
      </DetailDrawer>
    </PageShell>
  );
};

export default Receipts;
