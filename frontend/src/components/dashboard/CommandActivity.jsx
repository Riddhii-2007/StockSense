import { Check, Ban } from 'lucide-react';

const CommandActivity = ({ activities }) => {
  if (!activities) return null;

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between h-full space-y-4">
      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Command Verification Audit</h3>
          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
        </div>
        <p className="text-sm text-slate-500 mt-0.5">Execution provenance demonstrating deterministic rules.</p>
      </div>

      <div className="flex flex-col space-y-3">
        {activities.map((activity) => (
          <div 
            key={activity.id} 
            className={`p-3 rounded-lg border ${
              activity.status === 'Blocked' 
                ? 'bg-red-50/50 border-red-100' 
                : 'bg-slate-50 border-slate-100'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className={`flex items-center gap-1.5 font-mono text-[11px] font-bold ${
                activity.status === 'Blocked' ? 'text-red-600' : 'text-emerald-600'
              }`}>
                {activity.status === 'Blocked' ? <Ban className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                {activity.status === 'Blocked' ? 'Blocked & Refused' : 'Validated & Committed'}
              </span>
              <span className={`font-mono text-[10px] ${
                activity.status === 'Blocked' ? 'text-red-500 font-semibold' : 'text-slate-500'
              }`}>
                {activity.time}
              </span>
            </div>
            <p className={`text-sm ${
              activity.status === 'Blocked' ? 'text-red-900 font-medium' : 'text-slate-900'
            }`}>
              "{activity.command}"
            </p>
            <p className={`font-mono text-[10px] mt-1.5 ${
              activity.status === 'Blocked' ? 'text-red-600' : 'text-slate-500'
            }`}>
              {activity.status === 'Blocked' 
                ? `${activity.result} failure. Zero database writes.` 
                : `Ledger Hash: TRF-104${activity.id} • Approved by Vance, M.`}
            </p>
          </div>
        ))}
      </div>
      
      <div className="pt-2 text-center border-t border-slate-100">
        <span className="font-mono text-[10px] text-slate-400 uppercase tracking-widest font-bold">Immutable Verification Log</span>
      </div>
    </div>
  );
};

export default CommandActivity;
