import { useState } from 'react';
import PageShell from '../components/layout/PageShell';
import { AlertTriangle, Info, AlertOctagon } from 'lucide-react';
import DetailDrawer from '../components/common/DetailDrawer';
import { mockAlerts } from '../data/mockData';

const tabs = ['All', 'Critical', 'Warning', 'Resolved'];

const Alerts = () => {
  const [activeTab, setActiveTab] = useState('All');
  const [selectedAlert, setSelectedAlert] = useState(null);

  const filteredAlerts = mockAlerts.filter(alert => {
    if (activeTab === 'All') return true;
    if (activeTab === 'Resolved') return alert.resolved;
    return alert.severity === activeTab && !alert.resolved;
  });

  const getIcon = (severity) => {
    switch (severity) {
      case 'Critical': return <AlertOctagon className="w-5 h-5 text-red-600" />;
      case 'Warning': return <AlertTriangle className="w-5 h-5 text-amber-600" />;
      case 'Informational': return <Info className="w-5 h-5 text-indigo-600" />;
      default: return <Info className="w-5 h-5 text-slate-600" />;
    }
  };

  const getCardStyle = (severity, resolved) => {
    if (resolved) return 'bg-slate-50 border-slate-200 opacity-70';
    switch (severity) {
      case 'Critical': return 'bg-red-50 border-red-100 hover:border-red-200';
      case 'Warning': return 'bg-amber-50 border-amber-100 hover:border-amber-200';
      case 'Informational': return 'bg-indigo-50 border-indigo-100 hover:border-indigo-200';
      default: return 'bg-white border-slate-200 hover:border-slate-300';
    }
  };

  const getButtonStyle = (severity, resolved) => {
    if (resolved) return 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50';
    switch (severity) {
      case 'Critical': return 'bg-slate-900 text-white hover:bg-slate-800';
      case 'Warning': return 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50';
      default: return 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50';
    }
  };

  return (
    <PageShell title="Alerts" subtitle="Review inventory conditions that require attention">
      
      <div className="flex items-center gap-2 mb-6 border-b border-slate-200 pb-px">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-semibold transition-colors border-b-2 -mb-[2px] ${
              activeTab === tab 
                ? 'text-indigo-600 border-indigo-600' 
                : 'text-slate-500 border-transparent hover:text-slate-900'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex flex-col space-y-3 cursor-pointer">
        {filteredAlerts.length === 0 ? (
          <div className="p-12 text-center text-slate-500 bg-white rounded-xl border border-slate-200 border-dashed">
            No alerts found in this category.
          </div>
        ) : (
          filteredAlerts.map(alert => (
            <div 
              key={alert.id}
              onClick={() => setSelectedAlert(alert)}
              className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm ${getCardStyle(alert.severity, alert.resolved)}`}
            >
              <div className="flex items-start gap-4">
                <div className="mt-0.5 bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
                  {getIcon(alert.severity)}
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-base">{alert.product}</span>
                    {alert.resolved && <span className="px-2 py-0.5 rounded font-mono text-[10px] uppercase font-bold bg-slate-200 text-slate-600">Resolved</span>}
                  </div>
                  <p className="text-sm text-slate-700 mt-1">{alert.message}</p>
                  <span className="text-xs text-slate-500 mt-2 font-mono">{alert.timestamp}</span>
                </div>
              </div>
              
              <button 
                className={`self-end sm:self-center px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition-colors whitespace-nowrap ${getButtonStyle(alert.severity, alert.resolved)}`}
              >
                {alert.action}
              </button>
            </div>
          ))
        )}
      </div>

      <DetailDrawer
        isOpen={!!selectedAlert}
        onClose={() => setSelectedAlert(null)}
        title="Alert Details"
      >
        {selectedAlert && (
          <div className="flex flex-col space-y-6">
            <div className={`flex items-start gap-4 p-4 rounded-xl border ${getCardStyle(selectedAlert.severity, selectedAlert.resolved)}`}>
               <div className="bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
                  {getIcon(selectedAlert.severity)}
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{selectedAlert.severity}</span>
                  <span className="font-bold text-slate-900 mt-1">{selectedAlert.product}</span>
                </div>
            </div>

            <div className="flex flex-col p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Message</span>
              <p className="text-sm text-slate-900">{selectedAlert.message}</p>
            </div>

            <div className="flex flex-col gap-3 pt-6 border-t border-slate-200">
              {!selectedAlert.resolved && (
                <button className={`w-full py-2 rounded-lg text-sm font-semibold shadow-sm transition-colors ${
                  selectedAlert.severity === 'Critical' ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}>
                  Take Action
                </button>
              )}
              {!selectedAlert.resolved && (
                <button className="w-full py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors">
                  Mark as Resolved
                </button>
              )}
            </div>
          </div>
        )}
      </DetailDrawer>
    </PageShell>
  );
};

export default Alerts;
