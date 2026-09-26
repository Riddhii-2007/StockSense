import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  ArrowRightLeft, 
  Settings, 
  HelpCircle,
  Truck,
  Activity,
  AlertTriangle,
  ReceiptText,
  SlidersHorizontal,
  ChevronDown
} from 'lucide-react';

const mainNav = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Products', path: '/products', icon: Package },
  { name: 'Receipts', path: '/receipts', icon: ArrowRightLeft },
  { name: 'Deliveries', path: '/deliveries', icon: Truck },
  { name: 'Transfers', path: '/transfers', icon: ArrowRightLeft },
  { name: 'Adjustments', path: '/adjustments', icon: SlidersHorizontal },
  { name: 'Stock Ledger', path: '/ledger', icon: ReceiptText },
];

const insightsNav = [
  { name: 'Inventory Health', path: '/inventory-health', icon: Activity },
  { name: 'Alerts', path: '/alerts', icon: AlertTriangle, badge: '3' },
];

const Sidebar = () => {
  const location = useLocation();

  const isActive = (path) => {
    if (path === '/dashboard' && location.pathname === '/') return true;
    return location.pathname.startsWith(path);
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-white border-r border-slate-200 z-50 flex flex-col justify-between select-none">
      <div className="flex flex-col flex-1 min-h-0">
        <div className="h-16 px-4 flex items-center justify-between border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center gap-2 text-indigo-700">
            <Package className="w-6 h-6" />
            <span className="text-xl font-bold tracking-tight text-slate-900">StockSense</span>
          </div>
          <span className="px-1.5 py-0.5 rounded text-xs bg-slate-100 text-slate-600 font-medium font-mono">v2.4</span>
        </div>
        
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-8">
          <div className="space-y-2">
            <div className="px-3 text-[11px] font-bold text-slate-400 tracking-widest uppercase mb-3">Main</div>
            <nav className="space-y-1">
              {mainNav.map((item) => (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`group flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive(item.path)
                      ? 'bg-slate-900 text-white shadow-sm shadow-slate-900/10'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <item.icon className={`w-4 h-4 transition-transform duration-200 ${isActive(item.path) ? 'scale-110' : 'group-hover:scale-110'}`} />
                  <span>{item.name}</span>
                </Link>
              ))}
            </nav>
          </div>
          
          <div className="space-y-2">
            <div className="px-3 text-[11px] font-bold text-slate-400 tracking-widest uppercase mb-3">Insights</div>
            <nav className="space-y-1">
              {insightsNav.map((item) => (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`group flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive(item.path)
                      ? 'bg-slate-900 text-white shadow-sm shadow-slate-900/10'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <item.icon className={`w-4 h-4 transition-transform duration-200 ${isActive(item.path) ? 'scale-110' : 'group-hover:scale-110'}`} />
                    <span>{item.name}</span>
                  </div>
                  {item.badge && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      isActive(item.path) ? 'bg-white/20 text-white' : 'bg-red-100 text-red-700'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 p-4 flex-shrink-0 bg-white">
        <nav className="space-y-1 mb-4">
          <Link to="/settings" className="group flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all duration-200">
            <Settings className="w-4 h-4 group-hover:rotate-45 transition-transform duration-300" />
            <span>Settings</span>
          </Link>
          <button className="group flex items-center w-full gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all duration-200">
            <HelpCircle className="w-4 h-4 group-hover:scale-110 transition-transform duration-200" />
            <span>Help & Docs</span>
          </button>
        </nav>
        
        <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 border border-slate-100">
          <div className="relative flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm">
              MV
            </div>
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white"></span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-slate-900 truncate">Marcus Vance</div>
            <div className="text-xs text-slate-500 truncate">Ops Director</div>
          </div>
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-700 uppercase font-bold tracking-wider">Live</span>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
