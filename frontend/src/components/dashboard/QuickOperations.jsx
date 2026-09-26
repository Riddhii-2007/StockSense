import { PlusCircle, Truck, ArrowRightLeft, SlidersHorizontal } from 'lucide-react';

const QuickOperations = () => {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between h-full space-y-4">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Standard Workflows</h3>
        <p className="text-sm text-slate-500 mt-0.5">Deterministic manual forms when not using the AI command engine.</p>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3 flex-1">
        <button className="flex items-center justify-between p-3.5 rounded-lg bg-slate-50 border border-slate-200 hover:border-slate-300 hover:bg-slate-100 transition-colors group">
          <div className="flex items-center gap-3">
            <PlusCircle className="w-5 h-5 text-emerald-600 group-hover:scale-110 transition-transform" />
            <span className="font-semibold text-slate-900 text-sm">New Receipt (PO)</span>
          </div>
          <span className="font-mono text-[11px] text-slate-500">Inbound</span>
        </button>

        <button className="flex items-center justify-between p-3.5 rounded-lg bg-slate-50 border border-slate-200 hover:border-slate-300 hover:bg-slate-100 transition-colors group">
          <div className="flex items-center gap-3">
            <Truck className="w-5 h-5 text-indigo-600 group-hover:scale-110 transition-transform" />
            <span className="font-semibold text-slate-900 text-sm">New Delivery (SO)</span>
          </div>
          <span className="font-mono text-[11px] text-slate-500">Outbound</span>
        </button>

        <button className="flex items-center justify-between p-3.5 rounded-lg bg-slate-50 border border-slate-200 hover:border-slate-300 hover:bg-slate-100 transition-colors group">
          <div className="flex items-center gap-3">
            <ArrowRightLeft className="w-5 h-5 text-slate-700 group-hover:scale-110 transition-transform" />
            <span className="font-semibold text-slate-900 text-sm">Internal Transfer</span>
          </div>
          <span className="font-mono text-[11px] text-slate-500">Cross-Node</span>
        </button>

        <button className="flex items-center justify-between p-3.5 rounded-lg bg-slate-50 border border-slate-200 hover:border-slate-300 hover:bg-slate-100 transition-colors group">
          <div className="flex items-center gap-3">
            <SlidersHorizontal className="w-5 h-5 text-slate-500 group-hover:scale-110 transition-transform" />
            <span className="font-semibold text-slate-900 text-sm">Stock Adjustment</span>
          </div>
          <span className="font-mono text-[11px] text-slate-500">Audit Count</span>
        </button>
      </div>

      <div className="pt-3 text-center border-t border-slate-100">
        <span className="font-mono text-[10px] text-slate-400">All methods enforce the immutable Stock Ledger invariant</span>
      </div>
    </div>
  );
};

export default QuickOperations;
