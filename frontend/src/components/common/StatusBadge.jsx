const StatusBadge = ({ status }) => {
  const getStyle = (s) => {
    switch (s?.toLowerCase()) {
      case 'healthy':
      case 'completed':
      case 'done':
      case 'ready':
      case 'resolved':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'warning':
      case 'low stock':
      case 'waiting':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'critical':
      case 'out of stock':
      case 'cancelled':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'draft':
      case 'pending':
      case 'review':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'informational':
      case 'logged':
        return 'bg-indigo-100 text-indigo-700 border-indigo-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md font-sans text-[10px] font-bold uppercase tracking-widest border shadow-sm ${getStyle(status)}`}>
      {status}
    </span>
  );
};

export default StatusBadge;
