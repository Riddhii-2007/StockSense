import { useState, useEffect } from 'react';
import PageShell from '../components/layout/PageShell';
import CommandBar from '../components/dashboard/CommandBar';
import KpiSection from '../components/dashboard/KpiSection';
import InventoryHealth from '../components/dashboard/InventoryHealth';
import StockByLocation from '../components/dashboard/StockByLocation';
import AttentionRequired from '../components/dashboard/AttentionRequired';
import RecentActivity from '../components/dashboard/RecentActivity';
import CommandActivity from '../components/dashboard/CommandActivity';
import QuickOperations from '../components/dashboard/QuickOperations';
import { api } from '../services/api';

const Dashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const result = await api.getDashboard();
      setData(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <PageShell title="Dashboard" subtitle="Real-time inventory overview and warehouse activity">
        <div className="flex items-center justify-center min-h-[500px]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full border-4 border-indigo-500/30 border-t-indigo-600 animate-spin"></div>
            <span className="text-slate-500 font-semibold text-sm animate-pulse">Loading Operations Control...</span>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title="Dashboard" subtitle="Real-time inventory overview and warehouse activity">
      {/* 1. Command Bar Master Card */}
      <CommandBar onRefresh={fetchData} />

      {/* 2. Operational KPI Overview */}
      <KpiSection kpis={data?.kpis} />

      {/* 3. Inventory Health & Location Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7">
          <InventoryHealth health={data?.inventoryHealth} />
        </div>
        <div className="lg:col-span-5">
          <StockByLocation locations={data?.locationsInfo} />
        </div>
      </div>

      {/* 4. Attention Required & Quick Operations */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8">
          <AttentionRequired items={data?.attentionRequired} />
        </div>
        <div className="lg:col-span-4">
          <QuickOperations />
        </div>
      </div>

      {/* 5. Recent Activity & AI Audit Log */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8">
          <RecentActivity activities={data?.recentActivity} />
        </div>
        <div className="lg:col-span-4">
          <CommandActivity activities={data?.commandActivity} />
        </div>
      </div>
    </PageShell>
  );
};

export default Dashboard;
