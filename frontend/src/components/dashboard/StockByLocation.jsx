import { Building2, Factory, Box } from 'lucide-react';

const StockByLocation = ({ locations }) => {
  if (!locations) return null;

  const getIcon = (name) => {
    if (name.includes('Main')) return <Building2 className="w-5 h-5" />;
    if (name.includes('Production')) return <Factory className="w-5 h-5" />;
    return <Box className="w-5 h-5" />;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'High Load': return 'bg-indigo-500';
      case 'Optimal': return 'bg-emerald-500';
      case 'Low Load': return 'bg-slate-300';
      default: return 'bg-slate-300';
    }
  };

  const getStatusTextColor = (status) => {
    switch (status) {
      case 'High Load': return 'text-indigo-600';
      case 'Optimal': return 'text-emerald-600';
      case 'Low Load': return 'text-slate-500';
      default: return 'text-slate-500';
    }
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Stock by Location</h3>
          <p className="text-sm text-slate-500 mt-0.5">Active warehouse capacity & count</p>
        </div>
        <button className="px-3 py-1.5 rounded-md bg-slate-50 border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-100 transition-colors">
          + Location
        </button>
      </div>

      <div className="flex flex-col space-y-3 flex-1">
        {locations.map((loc, idx) => (
          <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-md bg-white border border-slate-200 flex items-center justify-center text-slate-600 shadow-sm">
                {getIcon(loc.name)}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-slate-900">{loc.name}</span>
                <span className="text-xs text-slate-500 font-mono mt-0.5">{loc.skuCount} SKUs • {loc.quantity.toLocaleString()} units</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-end">
                <span className="text-sm font-bold text-slate-900">{loc.capacityUtilized}%</span>
                <span className={`text-[10px] font-bold uppercase ${getStatusTextColor(loc.status)}`}>{loc.status}</span>
              </div>
              <div className={`w-2.5 h-2.5 rounded-full ${getStatusColor(loc.status)}`}></div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between font-mono text-xs text-slate-500 pt-4 mt-2 border-t border-slate-100">
        <span>Total capacity threshold: 24,000 units</span>
        <span className="text-slate-900 font-bold">Overall: 76.7%</span>
      </div>
    </div>
  );
};

export default StockByLocation;
