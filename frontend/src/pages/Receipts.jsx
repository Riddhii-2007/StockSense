import { useState, useEffect } from 'react';
import PageShell from '../components/layout/PageShell';
import { Search, Plus, Check, ArrowRight, Loader2, ArrowDownLeft, MapPin, Package, Calendar } from 'lucide-react';
import StatusBadge from '../components/common/StatusBadge';
import DetailDrawer from '../components/common/DetailDrawer';
import AddReceiptModal from '../components/receipts/AddReceiptModal';
import { api } from '../services/api';
import toast from 'react-hot-toast';

const tabs = ['All', 'Draft', 'Waiting', 'Ready', 'Done', 'Cancelled'];

const Receipts = () => {
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [activeTab, setActiveTab] = useState('All');
  const [receipts, setReceipts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('All');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const fetchReceipts = async () => {
    try {
      setIsLoading(true);
      const data = await api.getReceipts();
      setReceipts(data);
    } catch (e) {
      console.error('Failed to fetch receipts:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReceipts();
  }, []);

  const suppliers = ['All', ...new Set(receipts.map(r => r.supplier).filter(Boolean))];

  const filteredReceipts = receipts.filter(item => {
    const matchesTab = activeTab === 'All' || item.status.toLowerCase() === activeTab.toLowerCase();
    const query = searchTerm.toLowerCase();
    const matchesSearch = 
      item.id.toLowerCase().includes(query) ||
      (item.fullId && item.fullId.toLowerCase().includes(query)) ||
      item.supplier.toLowerCase().includes(query) ||
      item.destination.toLowerCase().includes(query) ||
      (item.product && item.product.toLowerCase().includes(query));
    const matchesSupplier = supplierFilter === 'All' || item.supplier === supplierFilter;
    return matchesTab && matchesSearch && matchesSupplier;
  });

  const handlePostReceipt = async (fullId) => {
    if (!fullId) return;
    try {
      setIsActionLoading(true);
      await api.postOperation(fullId);
      await fetchReceipts();
      setSelectedReceipt(null);
      toast.success('Receipt posted successfully');
    } catch (err) {
      console.error('Failed to post receipt:', err);
      toast.error('Failed to complete receipt: ' + err.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleSetReady = async (fullId) => {
    if (!fullId) return;
    try {
      setIsActionLoading(true);
      await api.updateOperationStatus(fullId, 'ready');
      await fetchReceipts();
      setSelectedReceipt(null);
      toast.success('Receipt marked as Ready');
    } catch (err) {
      console.error('Failed to update receipt status:', err);
      toast.error('Failed to set ready: ' + err.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, supplierFilter, activeTab]);

  const totalPages = Math.max(1, Math.ceil(filteredReceipts.length / itemsPerPage));
  const paginatedReceipts = filteredReceipts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <PageShell title="Receipts" subtitle="Track incoming inventory and receiving activity">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        {/* Status Tabs */}
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
        
        {/* Filter and Action Bar */}
        <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Search receipts, items..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-64 transition-all"
              />
            </div>
            <select 
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 outline-none hover:bg-slate-50 transition-colors"
            >
              {suppliers.map(sup => (
                <option key={sup} value={sup}>{sup === 'All' ? 'All Suppliers' : sup}</option>
              ))}
            </select>
          </div>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 shadow-sm transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            New Receipt
          </button>
        </div>
        
        {/* Table View */}
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
              ) : paginatedReceipts.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-slate-500">No receipts found matching criteria.</td>
                </tr>
              ) : paginatedReceipts.map((item, idx) => (
                <tr 
                  key={item.fullId || idx} 
                  onClick={() => setSelectedReceipt(item)}
                  className="hover:bg-slate-50 transition-all duration-200 group relative"
                >
                  <td className="py-4 px-6 font-mono text-[11px] text-slate-500 font-semibold group-hover:text-indigo-600 transition-colors">
                    <div className="flex items-center gap-2">
                      <ArrowRight className="w-3 h-3 text-emerald-500 rotate-90" />
                      {item.id}
                    </div>
                  </td>
                  <td className="py-4 px-4 font-semibold text-slate-900 truncate">
                    <div>{item.supplier}</div>
                    {item.product && item.product !== 'Multiple Items' && (
                      <div className="text-xs font-normal text-slate-500 truncate">{item.product}</div>
                    )}
                  </td>
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
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
              Showing {paginatedReceipts.length} of {filteredReceipts.length} receipts
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
                <span className="font-mono text-[11px] text-slate-400">{selectedReceipt.fullId}</span>
              </div>
              <StatusBadge status={selectedReceipt.status} />
            </div>

            {/* Progress indicator */}
            <div className="flex items-center justify-between relative mt-4 mb-2">
              <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-200 -translate-y-1/2 z-0"></div>
              {['Draft', 'Waiting', 'Ready', 'Done'].map((step, index) => {
                const steps = ['Draft', 'Waiting', 'Ready', 'Done'];
                const currentIndex = steps.indexOf(selectedReceipt.status);
                const isCompleted = currentIndex >= 0 && index <= currentIndex;
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

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col p-4 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Supplier</span>
                <span className="font-semibold text-slate-900 mt-1 text-base">{selectedReceipt.supplier}</span>
              </div>

              <div className="flex flex-col p-4 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Destination</span>
                <span className="font-semibold text-slate-900 mt-1 text-base flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  {selectedReceipt.destination}
                </span>
              </div>

              <div className="flex flex-col p-4 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Product / Item</span>
                <span className="font-semibold text-slate-900 mt-1 text-base flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-slate-400" />
                  {selectedReceipt.product || 'Multiple Items'}
                </span>
              </div>

              <div className="flex flex-col p-4 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Quantity</span>
                <span className="font-bold text-emerald-600 mt-1 text-xl font-mono">
                  +{selectedReceipt.quantity}
                </span>
              </div>
            </div>

            {selectedReceipt.notes && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Notes</span>
                <p className="text-sm text-slate-700 mt-1">{selectedReceipt.notes}</p>
              </div>
            )}

            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Calendar className="w-4 h-4" />
              <span>Created on {selectedReceipt.date}</span>
            </div>

            <div className="flex flex-col gap-3 pt-6 border-t border-slate-200">
              {selectedReceipt.status === 'Ready' && (
                <button 
                  onClick={() => handlePostReceipt(selectedReceipt.fullId)}
                  disabled={isActionLoading}
                  className="w-full py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold shadow-sm hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Validate & Mark as Done'}
                </button>
              )}

              {(selectedReceipt.status === 'Draft' || selectedReceipt.status === 'Waiting') && (
                <button 
                  onClick={() => handleSetReady(selectedReceipt.fullId)}
                  disabled={isActionLoading}
                  className="w-full py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold shadow-sm hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Set Status to Ready'}
                </button>
              )}
            </div>
          </div>
        )}
      </DetailDrawer>

      <AddReceiptModal 
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={fetchReceipts}
      />
    </PageShell>
  );
};

export default Receipts;
