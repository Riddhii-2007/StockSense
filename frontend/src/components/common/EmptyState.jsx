const EmptyState = ({ icon: Icon, title, message, actionLabel, onAction }) => (
  <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-xl border border-slate-200 border-dashed">
    <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-4 text-slate-400">
      {Icon ? <Icon className="w-8 h-8" /> : null}
    </div>
    <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
    <p className="text-sm text-slate-500 max-w-sm mb-6">{message}</p>
    {actionLabel && onAction && (
      <button 
        onClick={onAction}
        className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-semibold shadow-sm hover:bg-slate-800 transition-colors"
      >
        {actionLabel}
      </button>
    )}
  </div>
);

export default EmptyState;
