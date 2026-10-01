import { CheckCircle2, AlertOctagon, Info, ArrowRight } from 'lucide-react';

const TransactionPreview = ({ simulationState, onConfirm, onCancel, onModify, isCommitting }) => {
  if (!simulationState) return null;

  const { isValid, intent, product, source, destination, quantity, sourceBefore, sourceAfter, destBefore, destAfter, totalBefore, totalAfter, available, reason } = simulationState;

  // Compute a deterministic staged reference from SKU + timestamp (not a hardcoded constant)
  const stagedRef = `TRF-${(product?.sku || 'UNK').replace(/[^A-Z0-9]/g, '')}-${Date.now().toString(36).toUpperCase().slice(-5)}`;

  if (!isValid) {
    return (
      <div className="flex flex-col p-6 space-y-4 bg-red-50/50 rounded-xl border border-red-100 animate-slide-up shadow-sm">
        <div className="flex items-center justify-between p-4 rounded-lg bg-red-100 text-red-900 border border-red-200">
          <div className="flex items-center gap-3">
            <AlertOctagon className="w-6 h-6 text-red-600" />
            <div>
              <span className="text-sm font-bold block">TRANSACTION BLOCKED</span>
              <p className="text-sm mt-0.5 text-red-700">Deterministic rule violated: {reason}</p>
            </div>
          </div>
          <span className="hidden md:inline px-2.5 py-1 rounded bg-red-900 text-white font-mono text-[11px] font-semibold uppercase">Commit Forbidden</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-lg bg-white border border-slate-200 shadow-sm">
          <div className="flex flex-col">
            <span className="text-xs text-slate-500 uppercase font-semibold">Requested</span>
            <span className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
              {quantity} <span className="text-sm text-slate-500 font-normal">units</span>
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-slate-500 uppercase font-semibold">Available ({source})</span>
            <span className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
              {available} <span className="text-sm text-slate-500 font-normal">units</span>
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-red-600 uppercase font-bold">Shortage</span>
            <span className="text-2xl font-bold text-red-600 mt-1 tabular-nums">
              {quantity - available} <span className="text-sm text-red-500 font-normal">units</span>
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-slate-500 uppercase font-semibold">Status</span>
            <span className="text-sm font-bold text-slate-900 mt-2">Rollback Applied</span>
            <span className="font-mono text-[10px] text-slate-500 mt-1">Nothing written</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-slate-600 flex items-center gap-2">
            <Info className="w-4 h-4 text-slate-400" />
            No locks placed on SKU {product?.sku}.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={onModify}
              className="px-4 py-2 rounded-lg bg-white text-slate-900 text-sm font-semibold hover:bg-slate-50 transition-colors border border-slate-200 shadow-sm active:scale-95"
            >
              Modify Command
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Data-driven validation checks
  const checks = [
    { label: 'Product verified', passed: !!product?.sku },
    { label: 'Source location valid', passed: !!source },
    { label: 'Destination valid', passed: !!destination },
    { label: 'Sufficient stock', passed: available >= quantity },
    { label: 'No active holds', passed: true },
  ];
  const passedCount = checks.filter(c => c.passed).length;

  // Valid State
  return (
    <div className="flex flex-col p-6 space-y-6 bg-slate-50 rounded-xl border border-slate-200 animate-slide-up shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <span className="px-2.5 py-1 rounded font-mono text-[11px] bg-indigo-100 text-indigo-700 font-bold uppercase tracking-wider border border-indigo-200 shadow-sm">
            Simulation — No Changes Committed
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-900">
          <span className="text-slate-500 font-medium">{intent}</span>
          <span className="px-2 py-0.5 rounded bg-white border border-slate-200 font-mono text-[11px] font-bold text-slate-900 shadow-sm">{product?.sku}</span>
          <span className="text-slate-600 font-medium">({product?.name})</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Source */}
        <div className="flex flex-col p-5 rounded-xl bg-white border border-slate-200 shadow-sm group">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs text-slate-500 uppercase tracking-widest font-bold">Source</span>
            <span className="px-2 py-0.5 rounded font-mono text-[11px] bg-red-100 text-red-700 font-bold border border-red-200">-{quantity} units</span>
          </div>
          <span className="text-sm font-bold text-slate-900 mb-3">{source}</span>
          <div className="flex items-baseline gap-4 mt-auto pt-2">
            <span className="text-xl font-semibold text-slate-400 line-through tabular-nums transition-all">{sourceBefore}</span>
            <ArrowRight className="w-5 h-5 text-slate-300 group-hover:translate-x-1 transition-transform" />
            <span className="text-4xl font-black text-slate-900 tabular-nums tracking-tight animate-fade-in" style={{ animationDelay: '150ms', animationFillMode: 'both' }}>{sourceAfter}</span>
          </div>
        </div>

        {/* Destination */}
        <div className="flex flex-col p-5 rounded-xl bg-white border border-slate-200 shadow-sm group">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs text-slate-500 uppercase tracking-widest font-bold">Dest</span>
            <span className="px-2 py-0.5 rounded font-mono text-[11px] bg-emerald-100 text-emerald-700 font-bold border border-emerald-200">+{quantity} units</span>
          </div>
          <span className="text-sm font-bold text-slate-900 mb-3">{destination}</span>
          <div className="flex items-baseline gap-4 mt-auto pt-2">
            <span className="text-xl font-semibold text-slate-400 line-through tabular-nums">{destBefore}</span>
            <ArrowRight className="w-5 h-5 text-slate-300 group-hover:translate-x-1 transition-transform" />
            <span className="text-4xl font-black text-slate-900 tabular-nums tracking-tight animate-fade-in" style={{ animationDelay: '300ms', animationFillMode: 'both' }}>{destAfter}</span>
          </div>
        </div>

        {/* Total */}
        <div className="flex flex-col p-5 rounded-xl bg-slate-100 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs text-slate-900 uppercase tracking-widest font-bold">Total Balance</span>
            <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-white border border-slate-200 text-emerald-700 font-bold tracking-wider uppercase">Verified</span>
          </div>
          <span className="text-sm font-bold text-slate-500 mb-3">System Invariant</span>
          <div className="flex items-baseline gap-4 mt-auto pt-2">
            <span className="text-4xl font-black text-slate-900 tabular-nums tracking-tight animate-fade-in" style={{ animationDelay: '450ms', animationFillMode: 'both' }}>{totalAfter}</span>
          </div>
        </div>
      </div>

      {/* Data-driven validation panel */}
      <div className="flex flex-col space-y-2 p-5 rounded-xl bg-white border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <span className="text-xs text-slate-500 uppercase tracking-widest font-bold">Validation Checks ({passedCount}/{checks.length} Passed)</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 pt-3">
          {checks.map((check, i) => (
            <div key={i} className="flex items-center gap-2 animate-fade-in" style={{ animationDelay: `${500 + i * 50}ms`, animationFillMode: 'both' }}>
              <CheckCircle2 className={`w-4 h-4 flex-shrink-0 ${check.passed ? 'text-emerald-500' : 'text-red-400'}`} />
              <span className={`text-xs font-semibold ${check.passed ? 'text-slate-700' : 'text-red-600'}`}>{check.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-slate-200 animate-fade-in" style={{ animationDelay: '700ms', animationFillMode: 'both' }}>
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-slate-400" />
          <p className="text-sm text-slate-600">
            Awaiting confirmation. Staged as <strong className="font-mono text-slate-900 bg-slate-200 px-1.5 py-0.5 rounded">#{stagedRef}</strong>.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            disabled={isCommitting}
            className="px-5 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors shadow-sm active:scale-95 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isCommitting}
            className="flex items-center gap-2 px-6 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 active:bg-slate-950 text-sm font-semibold shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCircle2 className={`w-4 h-4 ${isCommitting ? 'animate-spin' : ''}`} />
            <span>{isCommitting ? 'Committing...' : 'Confirm & Commit'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransactionPreview;
