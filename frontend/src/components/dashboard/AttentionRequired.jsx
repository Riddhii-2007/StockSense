import { AlertOctagon } from 'lucide-react';

const AttentionRequired = ({ items }) => {
  if (!items) return null;

  const getBadgeStyle = (severity) => {
    switch (severity) {
      case 'Critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'Warning': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Review': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getButtonStyle = (severity) => {
    switch (severity) {
      case 'Critical': return 'bg-slate-900 text-white hover:bg-slate-800';
      default: return 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50';
    }
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-bold text-slate-900">Attention Required</h3>
          <span className="px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 font-mono text-[11px] font-bold">
            {items.length} alerts
          </span>
        </div>
        <span className="text-sm text-slate-500">Automated anomaly detection</span>
      </div>

      <div className="flex flex-col space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors">
            <div className="flex items-start gap-4">
              <span className={`px-2.5 py-1 rounded font-mono text-[10px] uppercase font-bold border mt-0.5 flex-shrink-0 ${getBadgeStyle(item.severity)}`}>
                {item.severity}
              </span>
              <div className="flex flex-col">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-bold text-slate-900">{item.product}</span>
                  <span className="font-mono text-[11px] text-slate-500">{item.sku}</span>
                </div>
                <p className="text-sm text-slate-600 mt-0.5">{item.message}</p>
              </div>
            </div>
            <button 
              disabled
              title="Not implemented yet"
              className={`self-end sm:self-center px-4 py-2 rounded-md text-sm font-semibold shadow-sm transition-colors whitespace-nowrap opacity-50 cursor-not-allowed ${getButtonStyle(item.severity)}`}
            >
              {item.action}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AttentionRequired;
