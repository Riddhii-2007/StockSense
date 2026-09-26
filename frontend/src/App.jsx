import { useState, useEffect } from 'react';
import { Package, Activity, BarChart3, TrendingUp } from 'lucide-react';

function App() {
  const [healthStatus, setHealthStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('http://localhost:5000/api/health')
      .then((res) => res.json())
      .then((data) => {
        setHealthStatus(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Backend connection failed:', err);
        setHealthStatus({ success: false, message: 'Cannot reach backend' });
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Header */}
      <header className="border-b border-slate-800/60">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg shadow-emerald-500/20">
              <Package className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              Stock<span className="text-emerald-400">Sense</span>
            </h1>
          </div>

          {/* Backend Status Indicator */}
          <div className="flex items-center gap-2 text-sm">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                loading
                  ? 'bg-yellow-400 animate-pulse'
                  : healthStatus?.success
                  ? 'bg-emerald-400 shadow-lg shadow-emerald-400/50'
                  : 'bg-red-400'
              }`}
            />
            <span className="text-slate-400">
              {loading
                ? 'Connecting...'
                : healthStatus?.success
                ? 'Backend Connected'
                : 'Backend Offline'}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-sm font-medium mb-6">
            <Activity className="w-4 h-4" />
            AI-Assisted Inventory Management
          </div>
          <h2 className="text-5xl font-extrabold tracking-tight mb-4">
            Stock<span className="text-emerald-400">Sense</span>
          </h2>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Inventory Management
          </p>
        </div>

        {/* Placeholder Dashboard Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {[
            {
              icon: Package,
              title: 'Total Products',
              value: '—',
              color: 'from-emerald-500 to-teal-600',
              shadow: 'shadow-emerald-500/10',
            },
            {
              icon: BarChart3,
              title: 'Stock Movements',
              value: '—',
              color: 'from-blue-500 to-indigo-600',
              shadow: 'shadow-blue-500/10',
            },
            {
              icon: TrendingUp,
              title: 'AI Insights',
              value: '—',
              color: 'from-purple-500 to-violet-600',
              shadow: 'shadow-purple-500/10',
            },
          ].map((card, index) => (
            <div
              key={index}
              className={`bg-slate-900/50 backdrop-blur-sm border border-slate-800/60 rounded-2xl p-6 hover:border-slate-700/60 transition-all duration-300 ${card.shadow} shadow-xl`}
            >
              <div className="flex items-center justify-between mb-4">
                <div
                  className={`p-2.5 bg-gradient-to-br ${card.color} rounded-xl`}
                >
                  <card.icon className="w-5 h-5 text-white" />
                </div>
              </div>
              <p className="text-sm text-slate-400 mb-1">{card.title}</p>
              <p className="text-3xl font-bold">{card.value}</p>
            </div>
          ))}
        </div>

        {/* Backend Health Card */}
        <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800/60 rounded-2xl p-6">
          <h3 className="text-lg font-semibold mb-4 text-slate-200">
            System Status
          </h3>
          {loading ? (
            <p className="text-slate-400">Checking backend connection...</p>
          ) : healthStatus?.success ? (
            <div className="flex items-center gap-3 text-emerald-400">
              <div className="w-3 h-3 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/50" />
              <span>{healthStatus.message}</span>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-red-400">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <span>{healthStatus?.message || 'Backend not available'}</span>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
