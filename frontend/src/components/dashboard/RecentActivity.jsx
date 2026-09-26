import { Link } from 'react-router-dom';

const RecentActivity = ({ activities }) => {
  if (!activities) return null;

  const getQuantityColor = (qty) => {
    if (qty > 0) return 'text-emerald-600';
    if (qty < 0) return 'text-slate-900';
    return 'text-slate-500';
  };

  const formatQuantity = (qty, operation) => {
    return qty > 0 ? `+${qty}` : qty;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
      <div className="p-6 pb-4 flex items-center justify-between border-b border-slate-100">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Recent Ledger Operations</h3>
          <p className="text-sm text-slate-500 mt-0.5">Real-time ledger entries confirmed by operators</p>
        </div>
        <button 
          disabled
          title="Not implemented yet"
          className="px-3 py-1.5 rounded-md bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition-colors opacity-50 cursor-not-allowed"
        >
          Export CSV
        </button>
      </div>

      <div className="w-full overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap table-fixed">
          <colgroup>
            <col className="w-[10%]" />
            <col className="w-[15%]" />
            <col className="w-[20%]" />
            <col className="w-[10%]" />
            <col className="w-[20%]" />
            <col className="w-[15%]" />
            <col className="w-[10%]" />
          </colgroup>
          <thead className="bg-white text-slate-400 font-sans text-[10px] uppercase tracking-[0.1em] border-b border-slate-100 select-none sticky top-0 z-10">
            <tr>
              <th className="py-3 px-6 font-bold">Time</th>
              <th className="py-3 px-4 font-bold">Operation</th>
              <th className="py-3 px-4 font-bold">Product</th>
              <th className="py-3 px-4 font-bold text-right">Delta</th>
              <th className="py-3 px-4 font-bold">Flow</th>
              <th className="py-3 px-4 font-bold">Status</th>
              <th className="py-3 px-6 font-bold text-right">Ref</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 cursor-pointer">
            {activities.map((activity, i) => (
              <tr key={i} className="hover:bg-slate-50/80 transition-all duration-200 group relative">
                <td className="py-4 px-6 font-mono text-[11px] text-slate-400">{activity.time}</td>
                <td className="py-4 px-4 font-semibold text-slate-700 text-xs">{activity.operation}</td>
                <td className="py-4 px-4 font-semibold text-slate-900 truncate">{activity.product}</td>
                <td className={`py-4 px-4 text-right font-mono font-bold tabular-nums ${getQuantityColor(activity.quantity)}`}>
                  {formatQuantity(activity.quantity, activity.operation)}
                </td>
                <td className="py-4 px-4 font-mono text-[11px] text-slate-500 truncate">{activity.locationFlow}</td>
                <td className="py-4 px-4">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md font-sans text-[10px] font-bold uppercase tracking-widest border shadow-sm ${
                    activity.status === 'Completed' 
                      ? 'bg-emerald-100 text-emerald-700 border-emerald-200' 
                      : 'bg-slate-100 text-slate-700 border-slate-200'
                  }`}>
                    {activity.status}
                  </span>
                </td>
                <td className="py-4 px-6 text-right font-mono text-[11px] font-semibold text-slate-400 group-hover:text-indigo-600 transition-colors">
                  {activity.id}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="p-4 bg-slate-50/50 flex items-center justify-between font-mono text-[11px] text-slate-500 border-t border-slate-100 mt-auto">
        <span>Displaying latest 5 of 1,294 ledger postings</span>
        <Link to="/ledger" className="text-slate-900 font-bold hover:underline">View Entire Stock Ledger →</Link>
      </div>
    </div>
  );
};

export default RecentActivity;
