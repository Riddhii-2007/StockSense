import { useState, useEffect } from 'react';
import PageShell from '../components/layout/PageShell';
import { Search, Plus, Loader2, MapPin, Package, Calendar } from 'lucide-react';
import StatusBadge from '../components/common/StatusBadge';
import DetailDrawer from '../components/common/DetailDrawer';
import AddAdjustmentModal from '../components/adjustments/AddAdjustmentModal';
import { api } from '../services/api';
import toast from 'react-hot-toast';

const Adjustments = () => {
  const [selectedAdj, setSelectedAdj] = useState(null);
  const [adjustments, setAdjustments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const fetchAdjustments = async () => {
    try {
      setIsLoading(true);
      const data = await api.getAdjustments();
      setAdjustments(data);
    } catch (e) {
      console.error('Failed to fetch adjustments:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdjustments();
  }, []);

  const filteredAdjustments = adjustments.filter(item => {
    const query = searchTerm.toLowerCase();
    return (
      item.id.toLowerCase().includes(query) ||
      (item.fullId && item.fullId.toLowerCase().includes(query)) ||
      item.product.toLowerCase().includes(query) ||
      item.location.toLowerCase().includes(query) ||
      item.reason.toLowerCase().includes(query)
    );
  });

  const handlePostAdjustment = async (fullId) => {
    if (!fullId) return;
    try {
      setIsActionLoading(true);
      await api.postOperation(fullId);
      await fetchAdjustments();
      setSelectedAdj(null);
      toast.success('Adjustment posted successfully');
    } catch (err) {
      console.error('Failed to post adjustment:', err);
      toast.error('Failed to approve adjustment: ' + err.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredAdjustments.length / itemsPerPage));
  const paginatedAdjustments = filteredAdjustments.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <PageShell title="Inventory Adjustments" subtitle="Reconcile recorded inventory with physical counts">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Search adjustments..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-64 transition-all"
              />
            </div>
          </div>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 shadow-sm transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            New Adjustment
          </button>
        </div>
        
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap table-fixed">
            <colgroup>
              <col className="w-[15%]" />
              <col className="w-[20%]" />
              <col className="w-[15%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
            </colgroup>
            <thead className="bg-white text-slate-400 font-sans text-[10px] uppercase tracking-[0.1em] border-b border-slate-200 select-none sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="py-3 px-6 font-bold">Reference</th>
                <th className="py-3 px-4 font-bold">Product</th>
                <th className="py-3 px-4 font-bold">Location</th>
                <th className="py-3 px-4 font-bold text-right">System</th>
                <th className="py-3 px-4 font-bold text-right">Physical</th>
                <th className="py-3 px-4 font-bold text-right">Difference</th>
                <th className="py-3 px-4 font-bold">Reason</th>
                <th className="py-3 px-4 font-bold text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 cursor-pointer">
              {isLoading ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-slate-500">Loading adjustments...</td>
                </tr>
              ) : paginatedAdjustments.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-slate-500">No adjustments found matching criteria.</td>
                </tr>
              ) : paginatedAdjustments.map((item, idx) => (
                <tr 
                  key={item.fullId || idx} 
                  onClick={() => setSelectedAdj(item)}
                  className="hover:bg-slate-50 transition-all duration-200 group relative"
                >
                  <td className="py-4 px-6 font-mono text-[11px] text-slate-500 font-semibold group-hover:text-indigo-600 transition-colors">
                    {item.id}
                  </td>
                  <td className="py-4 px-4 font-semibold text-slate-900 truncate">{item.product}</td>
                  <td className="py-4 px-4 text-slate-600 truncate">{item.location}</td>
                  <td className="py-4 px-4 text-right font-mono text-slate-500 tabular-nums">{item.systemQty}</td>
                  <td className="py-4 px-4 text-right font-mono text-slate-900 font-bold tabular-nums">{item.physicalQty}</td>
                  <td className={`py-4 px-4 text-right font-mono font-bold tabular-nums ${item.diff < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {item.diff > 0 ? `+${item.diff}` : item.diff}
                  </td>
                  <td className="py-4 px-4 text-slate-600 truncate">{item.reason}</td>
                  <td className="py-4 px-4 text-right"><StatusBadge status={item.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
              Showing {paginatedAdjustments.length} of {filteredAdjustments.length} adjustments
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
        isOpen={!!selectedAdj}
        onClose={() => setSelectedAdj(null)}
        title="Adjustment Details"
      >
        {selectedAdj && (
          <div className="flex flex-col space-y-6">
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Reference</span>
                <span className="font-mono text-lg font-bold text-indigo-600 mt-1">{selectedAdj.id}</span>
                <span className="font-mono text-[11px] text-slate-400">{selectedAdj.fullId}</span>
              </div>
              <StatusBadge status={selectedAdj.status} />
            </div>

            <div className="flex flex-col p-4 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Product & Location</span>
              <span className="font-semibold text-slate-900 mt-1 text-lg flex items-center gap-1.5">
                <Package className="w-5 h-5 text-indigo-500" />
                {selectedAdj.product}
              </span>
              <span className="font-mono text-sm text-slate-500 mt-1 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                {selectedAdj.sku} • {selectedAdj.location}
              </span>
            </div>

            <div className="flex flex-col p-6 bg-white border border-slate-200 rounded-xl shadow-sm">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 text-center">Discrepancy</span>
              
              <div className="flex items-center justify-between">
                <div className="flex flex-col items-center">
                  <span className="text-xs text-slate-500">System</span>
                  <span className="font-mono text-2xl font-semibold text-slate-400 mt-1">{selectedAdj.systemQty}</span>
                </div>
                
                <div className="flex flex-col items-center mx-4">
                  <span className={`font-mono text-xl font-bold px-3 py-1 rounded-lg ${selectedAdj.diff < 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {selectedAdj.diff > 0 ? `+${selectedAdj.diff}` : selectedAdj.diff}
                  </span>
                  <span className="text-xs font-semibold text-slate-500 mt-2 uppercase">Difference</span>
                </div>

                <div className="flex flex-col items-center">
                  <span className="text-xs text-slate-900 font-bold">Physical</span>
                  <span className="font-mono text-2xl font-bold text-slate-900 mt-1">{selectedAdj.physicalQty}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col p-4 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Reason Code</span>
              <span className="font-semibold text-slate-900 mt-1">{selectedAdj.reason}</span>
            </div>

            <div className="flex flex-col gap-3 pt-6 border-t border-slate-200">
              {selectedAdj.status !== 'Done' && selectedAdj.status !== 'Completed' && (
                <button 
                  onClick={() => handlePostAdjustment(selectedAdj.fullId)}
                  disabled={isActionLoading}
                  className="w-full py-2.5 bg-slate-900 text-white rounded-lg text-sm font-semibold shadow-sm hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Approve & Apply Adjustment'}
                </button>
              )}
            </div>
          </div>
        )}
      </DetailDrawer>

      <AddAdjustmentModal 
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={fetchAdjustments}
      />
    </PageShell>
  );
};

export default Adjustments;
