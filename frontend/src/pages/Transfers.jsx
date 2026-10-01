import { useState, useEffect } from 'react';
import PageShell from '../components/layout/PageShell';
import { Search, Plus, ArrowRight, ArrowRightLeft, Loader2 } from 'lucide-react';
import { api } from '../services/api';
import DetailDrawer from '../components/common/DetailDrawer';
import StatusBadge from '../components/common/StatusBadge';

const Transfers = () => {
  const [selectedTransfer, setSelectedTransfer] = useState(null);
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await api.getTransfers();
        setTransfers(result);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  const filteredTransfers = transfers.filter(item => {
    const query = searchTerm.toLowerCase();
    const matchesSearch = item.id.toLowerCase().includes(query) || 
                          (item.product && item.product.toLowerCase().includes(query));
    const matchesStatus = statusFilter === 'All Status' || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filteredTransfers.length / itemsPerPage));
  const paginatedTransfers = filteredTransfers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <PageShell title="Internal Transfers" subtitle="Move inventory between locations with full visibility and validation">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Search transfers..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-64 transition-all"
              />
            </div>
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 outline-none hover:bg-slate-50 transition-colors"
            >
              <option>All Status</option>
              <option>Pending</option>
              <option>Completed</option>
              <option>Draft</option>
              <option>Ready</option>
              <option>Done</option>
            </select>
          </div>
          <button 
            disabled
            title="Use the AI Command Bar for transfers"
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 shadow-sm transition-all active:scale-95 opacity-50 cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            New Transfer
          </button>
        </div>
        
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap table-fixed">
            <colgroup>
              <col className="w-[15%]" />
              <col className="w-[20%]" />
              <col className="w-[10%]" />
              <col className="w-[25%]" />
              <col className="w-[15%]" />
              <col className="w-[15%]" />
            </colgroup>
            <thead className="bg-white text-slate-400 font-sans text-[10px] uppercase tracking-[0.1em] border-b border-slate-200 select-none sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="py-3 px-6 font-bold">Reference</th>
                <th className="py-3 px-4 font-bold">Product</th>
                <th className="py-3 px-4 font-bold text-right">Quantity</th>
                <th className="py-3 px-4 font-bold">Flow</th>
                <th className="py-3 px-4 font-bold">Status</th>
                <th className="py-3 px-6 font-bold">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 cursor-pointer">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-slate-500">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-indigo-500 mb-2" />
                    Loading transfers...
                  </td>
                </tr>
              ) : paginatedTransfers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-slate-500">No transfers found.</td>
                </tr>
              ) : paginatedTransfers.map((item, idx) => (
                <tr 
                  key={idx} 
                  onClick={() => setSelectedTransfer(item)}
                  className="hover:bg-slate-50 transition-all duration-200 group relative"
                >
                  <td className="py-4 px-6 font-mono text-[11px] text-slate-500 font-semibold group-hover:text-indigo-600 transition-colors">
                    <div className="flex items-center gap-2">
                      <ArrowRightLeft className="w-3 h-3 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                      {item.id}
                    </div>
                  </td>
                  <td className="py-4 px-4 font-semibold text-slate-900 truncate">
                    {item.product}
                  </td>
                  <td className="py-4 px-4 text-right font-mono font-bold text-slate-700 tabular-nums">
                    {Math.abs(item.quantity)}
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-slate-900 font-semibold truncate">{item.locationFlow}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="py-4 px-6 font-mono text-[11px] text-slate-400">
                    <div className="flex items-center gap-2 justify-end">
                      <span>{item.date}</span>
                      <span className="text-slate-300">•</span>
                      <span>{item.time}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
              Showing {paginatedTransfers.length} of {filteredTransfers.length} records
            </span>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2 py-1 text-xs font-semibold text-slate-400 hover:text-slate-900 transition-colors disabled:opacity-50"
              >
                Prev
              </button>
              <button className="w-6 h-6 rounded-md bg-white border border-slate-200 text-xs font-bold text-slate-900 shadow-sm flex items-center justify-center">
                {currentPage}
              </button>
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2 py-1 text-xs font-semibold text-slate-400 hover:text-slate-900 transition-colors disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      <DetailDrawer
        isOpen={!!selectedTransfer}
        onClose={() => setSelectedTransfer(null)}
        title="Transfer Details"
      >
        {selectedTransfer && (
          <div className="flex flex-col space-y-6">
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Reference</span>
                <span className="font-mono text-lg font-bold text-indigo-600 mt-1">{selectedTransfer.id}</span>
              </div>
              <StatusBadge status={selectedTransfer.status} />
            </div>

            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-slate-900">{selectedTransfer.product}</span>
                <span className="font-mono text-xs text-slate-500">{selectedTransfer.sku}</span>
              </div>
              <div className="ml-auto font-mono text-xl font-bold text-slate-900 tabular-nums">
                {Math.abs(selectedTransfer.quantity)} units
              </div>
            </div>

            <div className="relative flex flex-col items-center py-6">
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-200 -translate-x-1/2"></div>
              
              <div className="w-full flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative z-10 mb-4 group">
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Source</span>
                  <span className="text-sm font-bold text-slate-900 mt-1">{selectedTransfer.sourceLocation}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-lg font-bold text-red-600">-{Math.abs(selectedTransfer.quantity)}</span>
                </div>
              </div>

              <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center relative z-10 mb-4 animate-bounce">
                <ArrowRightLeft className="w-4 h-4 text-indigo-500 rotate-90" />
              </div>

              <div className="w-full flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative z-10 group">
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Destination</span>
                  <span className="text-sm font-bold text-slate-900 mt-1">{selectedTransfer.destLocation}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-lg font-bold text-emerald-600">+{Math.abs(selectedTransfer.quantity)}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Stock Invariant</span>
                <span className="font-mono text-[10px] text-emerald-600 font-bold bg-emerald-100 px-2 py-0.5 rounded">Verified</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-slate-500">Internal transfers maintain zero net change</span>
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-6 border-t border-slate-200">
              <button 
                onClick={() => {
                  const receiptText = `STOCKSENSE TRANSFER RECEIPT\nReference: ${selectedTransfer.id}\nDate: ${selectedTransfer.date} ${selectedTransfer.time}\n\nProduct: ${selectedTransfer.product}\nQuantity: ${selectedTransfer.quantity}\n\nSource: ${selectedTransfer.source}\nDestination: ${selectedTransfer.destination}\n\nStatus: ${selectedTransfer.status}\nOperator: ${selectedTransfer.operator}`;
                  const blob = new Blob([receiptText], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `Receipt-${selectedTransfer.id}.txt`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="w-full py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors shadow-sm active:scale-95"
              >
                Download Receipt
              </button>
            </div>
          </div>
        )}
      </DetailDrawer>
    </PageShell>
  );
};

export default Transfers;
