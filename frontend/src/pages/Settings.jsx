import PageShell from '../components/layout/PageShell';

const Settings = () => {
  return (
    <PageShell title="Settings" subtitle="System configuration and preferences">
      <div className="flex flex-col lg:flex-row gap-8">
        
        {/* Settings Navigation */}
        <div className="w-full lg:w-64 flex-shrink-0">
          <nav className="flex flex-col space-y-1">
            {['General', 'Warehouse', 'Inventory', 'Notifications', 'Appearance'].map((item, idx) => (
              <button 
                key={item}
                className={`flex items-center px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                  idx === 0 
                    ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' 
                    : 'text-slate-600 hover:bg-white hover:text-slate-900 border border-transparent'
                }`}
              >
                {item}
              </button>
            ))}
          </nav>
        </div>

        {/* Settings Content */}
        <div className="flex-1 flex flex-col space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900">General Preferences</h3>
              <p className="text-sm text-slate-500 mt-1">Manage global system behavior.</p>
            </div>
            
            <div className="p-6 flex flex-col space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex flex-col max-w-sm">
                  <span className="text-sm font-semibold text-slate-900">Default Warehouse</span>
                  <span className="text-sm text-slate-500 mt-1">The primary location selected when creating new transfers or receipts.</span>
                </div>
                <select className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 font-medium w-full sm:w-48 outline-none hover:bg-slate-100 transition-colors focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500">
                  <option>Main Store</option>
                  <option>Production Rack</option>
                  <option>Warehouse 2</option>
                </select>
              </div>

              <hr className="border-slate-100" />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex flex-col max-w-sm">
                  <span className="text-sm font-semibold text-slate-900">Date Format</span>
                  <span className="text-sm text-slate-500 mt-1">Format used across ledgers and reports.</span>
                </div>
                <select className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 font-medium w-full sm:w-48 outline-none hover:bg-slate-100 transition-colors focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500">
                  <option>DD/MM/YYYY</option>
                  <option>MM/DD/YYYY</option>
                  <option>YYYY-MM-DD</option>
                </select>
              </div>

              <hr className="border-slate-100" />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex flex-col max-w-sm">
                  <span className="text-sm font-semibold text-slate-900">Low Stock Notifications</span>
                  <span className="text-sm text-slate-500 mt-1">Receive alerts when inventory drops below the minimum buffer.</span>
                </div>
                <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-emerald-500 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2">
                  <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform translate-x-6" />
                </button>
              </div>

              <hr className="border-slate-100" />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex flex-col max-w-sm">
                  <span className="text-sm font-semibold text-slate-900">Theme</span>
                  <span className="text-sm text-slate-500 mt-1">Current visual mode of the interface.</span>
                </div>
                <select className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 font-medium w-full sm:w-48 outline-none hover:bg-slate-100 transition-colors focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500">
                  <option>Light</option>
                  <option>Dark</option>
                  <option>System</option>
                </select>
              </div>
            </div>
            
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
              <button className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-semibold shadow-sm hover:bg-slate-800 transition-colors">
                Save Preferences
              </button>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
};

export default Settings;
