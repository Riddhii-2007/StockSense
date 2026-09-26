import { 
  Bell, 
  Warehouse,
  Calendar,
  ChevronDown
} from 'lucide-react';

const TopHeader = ({ title, subtitle }) => {
  return (
    <header className="fixed top-0 left-64 right-0 h-16 bg-white/90 backdrop-blur-md border-b border-slate-200 z-40 flex items-center justify-between px-8 select-none">
      <div className="flex flex-col">
        <h1 className="text-xl font-bold text-slate-900 leading-tight">{title}</h1>
        {subtitle && (
          <p className="text-sm text-slate-500 leading-none mt-1">{subtitle}</p>
        )}
      </div>
      
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-50 border border-slate-200 text-sm text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors">
          <Warehouse className="w-4 h-4 text-slate-400" />
          <span className="font-medium">Main Warehouse</span>
          <ChevronDown className="w-4 h-4 text-slate-400" />
        </div>
        
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-50 border border-slate-200 text-sm text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span className="font-medium">Today</span>
          <ChevronDown className="w-4 h-4 text-slate-400" />
        </div>
        
        <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-md bg-indigo-50 border border-indigo-100 font-mono text-xs text-indigo-700">
          <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
          <span className="font-semibold">Engine: Active & Verified</span>
        </div>
        
        <div className="relative flex items-center justify-center w-9 h-9 rounded-md hover:bg-slate-100 cursor-pointer transition-colors text-slate-500">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white"></span>
        </div>
        
        <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
          <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm">
            MV
          </div>
          <div className="hidden sm:flex flex-col text-left">
            <span className="text-sm font-semibold text-slate-900 leading-tight">M. Vance</span>
            <span className="text-xs font-mono text-slate-500 leading-none mt-0.5">Admin</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default TopHeader;
