import { useState, useEffect } from 'react';
import PageShell from '../components/layout/PageShell';
import { Save, User, Bell, Shield, Database } from 'lucide-react';
import toast from 'react-hot-toast';

const Settings = () => {
  const [settings, setSettings] = useState({
    theme: 'system',
    notifications: true,
    autoLogout: '30',
    dataRetention: '90'
  });

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('stocksense_settings');
    if (saved) {
      try { setSettings(JSON.parse(saved)); } catch (e) {}
    }
  }, []);

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      localStorage.setItem('stocksense_settings', JSON.stringify(settings));
      setIsSaving(false);
      toast.success('Settings saved successfully');
    }, 600);
  };

  return (
    <PageShell title="System Settings" subtitle="Configure application behavior and preferences">
      <div className="max-w-4xl flex flex-col space-y-6 pb-12">
        
        {/* Profile & Account */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
            <User className="w-5 h-5 text-indigo-500" />
            <h3 className="text-lg font-bold text-slate-900">Profile & Account</h3>
          </div>
          <div className="p-6 flex flex-col space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">Display Theme</h4>
                <p className="text-xs text-slate-500 mt-1">Select your preferred interface theme.</p>
              </div>
              <select 
                value={settings.theme}
                onChange={(e) => handleChange('theme', e.target.value)}
                className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 font-medium w-full sm:w-48 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
              >
                <option value="light">Light Mode</option>
                <option value="dark">Dark Mode (Beta)</option>
                <option value="system">System Default</option>
              </select>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
            <Bell className="w-5 h-5 text-indigo-500" />
            <h3 className="text-lg font-bold text-slate-900">Notifications</h3>
          </div>
          <div className="p-6 flex flex-col space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">Low Stock Alerts</h4>
                <p className="text-xs text-slate-500 mt-1">Receive alerts when inventory falls below minimum thresholds.</p>
              </div>
              <button 
                onClick={() => handleChange('notifications', !settings.notifications)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.notifications ? 'bg-indigo-600' : 'bg-slate-300'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.notifications ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Security */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
            <Shield className="w-5 h-5 text-indigo-500" />
            <h3 className="text-lg font-bold text-slate-900">Security</h3>
          </div>
          <div className="p-6 flex flex-col space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">Session Timeout</h4>
                <p className="text-xs text-slate-500 mt-1">Automatically log out after period of inactivity.</p>
              </div>
              <select 
                value={settings.autoLogout}
                onChange={(e) => handleChange('autoLogout', e.target.value)}
                className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 font-medium w-full sm:w-48 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
              >
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
                <option value="60">1 hour</option>
                <option value="240">4 hours</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-semibold shadow-sm hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-70"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

      </div>
    </PageShell>
  );
};

export default Settings;
