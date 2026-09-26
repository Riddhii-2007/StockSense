import { ArrowRight, AlertTriangle } from 'lucide-react';

const InventoryHealth = ({ health }) => {
  if (!health) return null;
  const total = health.healthy + health.lowStock + health.critical + health.outOfStock;
  
  const getPercent = (val) => Math.round((val / total) * 100) || 0;

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Inventory Health Distribution</h3>
          <p className="text-sm text-slate-500 mt-0.5">Continuous evaluation based on lead-time vs minimum stock buffer</p>
        </div>
        <button className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
          <span>Full Audit</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-col space-y-4 mb-6">
        {/* Progress Bar */}
        <div className="h-4 w-full flex rounded-full overflow-hidden bg-slate-100">
          <div className="bg-emerald-500 h-full" style={{ width: `${getPercent(health.healthy)}%` }}></div>
          <div className="bg-amber-400 h-full" style={{ width: `${getPercent(health.lowStock)}%` }}></div>
          <div className="bg-orange-500 h-full" style={{ width: `${getPercent(health.critical)}%` }}></div>
          <div className="bg-red-600 h-full" style={{ width: `${getPercent(health.outOfStock)}%` }}></div>
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-slate-900">{health.healthy} SKUs ({getPercent(health.healthy)}%)</span>
              <span className="text-xs text-slate-500">Healthy Buffer</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-amber-400"></div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-slate-900">{health.lowStock} SKUs ({getPercent(health.lowStock)}%)</span>
              <span className="text-xs text-slate-500">Low Buffer</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-orange-500"></div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-slate-900">{health.critical} SKUs ({getPercent(health.critical)}%)</span>
              <span className="text-xs text-orange-600">Critical Risk</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-red-600"></div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-slate-900">{health.outOfStock} SKUs ({getPercent(health.outOfStock)}%)</span>
              <span className="text-xs text-red-600">Stocked Out</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between p-3 rounded-lg bg-red-50 border border-red-100">
        <div className="flex items-center gap-3 text-slate-900 text-sm">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <span><strong>12 SKUs</strong> require immediate replenishment to prevent production bottleneck.</span>
        </div>
        <button className="px-3 py-1.5 rounded-md bg-white border border-slate-200 text-slate-700 font-semibold text-xs shadow-sm hover:bg-slate-50">
          Draft Reorders
        </button>
      </div>
    </div>
  );
};

export default InventoryHealth;
