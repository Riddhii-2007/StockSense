import { Package, Warehouse, AlertTriangle, Inbox, Truck, ArrowRightLeft } from 'lucide-react';

const KpiCard = ({ title, value, subtitle, icon: Icon, iconColor, trend, isAlert }) => (
  <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 flex flex-col justify-between">
    <div className="flex items-center justify-between text-slate-500 mb-2">
      <span className="text-xs font-bold uppercase tracking-wider">{title}</span>
      <Icon className={`w-5 h-5 ${iconColor}`} />
    </div>
    <div className="my-1 flex items-baseline gap-2">
      <div className="text-3xl font-extrabold text-slate-900 tracking-tight tabular-nums">{value}</div>
    </div>
    <div className="flex items-center justify-between mt-2">
      <span className={`text-sm font-semibold ${isAlert ? 'text-red-600' : 'text-slate-600'}`}>
        {subtitle}
      </span>
      {trend === 'up' && (
        <svg className="w-12 h-3 text-emerald-500" fill="none" viewBox="0 0 60 16">
          <path d="M1 12L12 9L24 13L36 7L48 9L59 2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
        </svg>
      )}
      {trend === 'down' && (
        <svg className="w-12 h-3 text-red-500" fill="none" viewBox="0 0 60 16">
          <path d="M1 4L16 6L30 3L44 10L59 13" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
        </svg>
      )}
      {trend === 'neutral' && (
        <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
      )}
    </div>
  </div>
);

const KpiSection = ({ kpis }) => {
  if (!kpis) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      <KpiCard 
        title="Total Products" 
        value={kpis.totalProducts} 
        subtitle="+12 this month" 
        icon={Package} 
        iconColor="text-slate-400"
        trend="up"
      />
      <KpiCard 
        title="Total Stock" 
        value={kpis.totalStock.toLocaleString()} 
        subtitle="3 active facilities" 
        icon={Warehouse} 
        iconColor="text-slate-400"
        trend="neutral"
      />
      <KpiCard 
        title="Low Stock" 
        value={String(kpis.lowStock).padStart(2, '0')} 
        subtitle="Needs attention" 
        icon={AlertTriangle} 
        iconColor="text-red-500"
        isAlert={true}
        trend="down"
      />
      <KpiCard 
        title="Pending Receipts" 
        value={String(kpis.pendingReceipts).padStart(2, '0')} 
        subtitle="3 due today" 
        icon={Inbox} 
        iconColor="text-slate-400"
        trend="neutral"
      />
      <KpiCard 
        title="Pending Deliveries" 
        value={String(kpis.pendingDeliveries).padStart(2, '0')} 
        subtitle="5 due today" 
        icon={Truck} 
        iconColor="text-slate-400"
        trend="neutral"
      />
    </div>
  );
};

export default KpiSection;
