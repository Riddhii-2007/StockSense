import PageShell from '../components/layout/PageShell';
import InventoryHealthWidget from '../components/dashboard/InventoryHealth';
import { products } from '../data/mockData';
import StatusBadge from '../components/common/StatusBadge';
import { inventoryHealth } from '../data/mockData';

const InventoryHealthPage = () => {
  return (
    <PageShell title="Inventory Health" subtitle="Understand the health and risk state of your inventory">
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 flex flex-col">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Healthy</span>
          <span className="text-3xl font-extrabold text-slate-900 tracking-tight tabular-nums">{inventoryHealth.healthy}</span>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 flex flex-col">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-600 mb-2">Low Stock</span>
          <span className="text-3xl font-extrabold text-slate-900 tracking-tight tabular-nums">{inventoryHealth.lowStock}</span>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 flex flex-col">
          <span className="text-xs font-bold uppercase tracking-wider text-orange-600 mb-2">Critical</span>
          <span className="text-3xl font-extrabold text-slate-900 tracking-tight tabular-nums">{inventoryHealth.critical}</span>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 flex flex-col">
          <span className="text-xs font-bold uppercase tracking-wider text-red-600 mb-2">Out of Stock</span>
          <span className="text-3xl font-extrabold text-slate-900 tracking-tight tabular-nums">{inventoryHealth.outOfStock}</span>
        </div>
      </div>

      <div className="mb-8 h-[300px]">
        <InventoryHealthWidget health={inventoryHealth} />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-900">Product Health</h3>
        </div>
        
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap table-fixed">
            <colgroup>
              <col className="w-[20%]" />
              <col className="w-[15%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
              <col className="w-[15%]" />
              <col className="w-[15%]" />
              <col className="w-[15%]" />
            </colgroup>
            <thead className="bg-white text-slate-400 font-sans text-[10px] uppercase tracking-[0.1em] border-b border-slate-200 select-none sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="py-3 px-6 font-bold">Product</th>
                <th className="py-3 px-4 font-bold">SKU</th>
                <th className="py-3 px-4 font-bold text-right">Stock</th>
                <th className="py-3 px-4 font-bold text-right">Minimum</th>
                <th className="py-3 px-4 font-bold">Coverage</th>
                <th className="py-3 px-4 font-bold">Health</th>
                <th className="py-3 px-6 font-bold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-all duration-200 group relative">
                  <td className="py-4 px-6 font-semibold text-slate-900 truncate group-hover:text-indigo-600 transition-colors">{item.name}</td>
                  <td className="py-4 px-4 font-mono text-[11px] text-slate-500">{item.sku}</td>
                  <td className="py-4 px-4 text-right font-mono font-bold text-slate-900 tabular-nums">
                    {item.stock}
                  </td>
                  <td className="py-4 px-4 text-right font-mono text-slate-500 tabular-nums">
                    {item.minimum}
                  </td>
                  <td className="py-4 px-4">
                    <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          item.stock >= item.minimum * 2 ? 'bg-emerald-500' :
                          item.stock >= item.minimum ? 'bg-amber-400' : 'bg-red-500'
                        }`} 
                        style={{ width: `${Math.min(100, (item.stock / item.minimum) * 50)}%` }}
                      ></div>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="py-4 px-6 text-right">
                    {item.status !== 'Healthy' && (
                      <button className="px-3 py-1 bg-white border border-slate-200 text-indigo-600 font-semibold text-xs rounded shadow-sm hover:bg-slate-50 transition-colors">Reorder</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Showing {products.length} products</span>
            <div className="flex items-center gap-1">
              <button className="px-2 py-1 text-xs font-semibold text-slate-400 hover:text-slate-900 transition-colors">Prev</button>
              <button className="w-6 h-6 rounded-md bg-white border border-slate-200 text-xs font-bold text-slate-900 shadow-sm flex items-center justify-center">1</button>
              <button className="px-2 py-1 text-xs font-semibold text-slate-400 hover:text-slate-900 transition-colors">Next</button>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
};

export default InventoryHealthPage;
