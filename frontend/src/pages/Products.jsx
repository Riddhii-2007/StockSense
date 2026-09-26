import { useState, useEffect } from 'react';
import PageShell from '../components/layout/PageShell';
import { Search, Plus, Package } from 'lucide-react';
import { api } from '../services/api';
import DetailDrawer from '../components/common/DetailDrawer';
import StatusBadge from '../components/common/StatusBadge';

const Products = () => {
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productsList, setProductsList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await api.getProducts();
        setProductsList(result);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);
  return (
    <PageShell title="Products" subtitle="Manage inventory catalogue and stock thresholds">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Search products or SKUs..." 
                className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-64 transition-all"
              />
            </div>
            <select className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 outline-none hover:bg-slate-50 transition-colors">
              <option>All Categories</option>
              <option>Raw Materials</option>
              <option>Components</option>
            </select>
            <select className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 outline-none hover:bg-slate-50 transition-colors">
              <option>All Stock Status</option>
              <option>Healthy</option>
              <option>Low Stock</option>
            </select>
          </div>
          <button 
            disabled
            title="Not implemented yet"
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 shadow-sm transition-all active:scale-95 opacity-50 cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            Add Product
          </button>
        </div>
        
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap table-fixed">
            <colgroup>
              <col className="w-[20%]" />
              <col className="w-[15%]" />
              <col className="w-[15%]" />
              <col className="w-[20%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
            </colgroup>
            <thead className="bg-white text-slate-400 font-sans text-[10px] uppercase tracking-[0.1em] border-b border-slate-200 select-none sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="py-3 px-6 font-bold">Product</th>
                <th className="py-3 px-4 font-bold">SKU</th>
                <th className="py-3 px-4 font-bold">Category</th>
                <th className="py-3 px-4 font-bold">Locations</th>
                <th className="py-3 px-4 font-bold text-right">Total Stock</th>
                <th className="py-3 px-4 font-bold text-right">Minimum</th>
                <th className="py-3 px-4 font-bold text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 cursor-pointer">
              {productsList.map((item) => (
                <tr 
                  key={item.id} 
                  onClick={() => setSelectedProduct(item)}
                  className="hover:bg-slate-50 transition-all duration-200 group relative"
                >
                  <td className="py-4 px-6 font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">{item.name}</td>
                  <td className="py-4 px-4 font-mono text-[11px] text-slate-500">{item.sku}</td>
                  <td className="py-4 px-4 text-slate-700">{item.category}</td>
                  <td className="py-4 px-4 text-slate-500 text-xs truncate">
                    {Object.keys(item.locations).join(', ')}
                  </td>
                  <td className="py-4 px-4 text-right font-mono font-bold text-slate-900 tabular-nums">
                    {item.stock}
                  </td>
                  <td className="py-4 px-4 text-right font-mono text-slate-400 tabular-nums">
                    {item.minimum}
                  </td>
                  <td className="py-4 px-4 text-right">
                    <StatusBadge status={item.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Showing {productsList.length} products</span>
            <div className="flex items-center gap-1">
              <button className="px-2 py-1 text-xs font-semibold text-slate-400 hover:text-slate-900 transition-colors">Prev</button>
              <button className="w-6 h-6 rounded-md bg-white border border-slate-200 text-xs font-bold text-slate-900 shadow-sm flex items-center justify-center">1</button>
              <button className="px-2 py-1 text-xs font-semibold text-slate-400 hover:text-slate-900 transition-colors">Next</button>
            </div>
          </div>
        </div>
      </div>

      <DetailDrawer
        isOpen={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
        title="Product Details"
      >
        {selectedProduct && (
          <div className="flex flex-col space-y-6">
            <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div className="w-12 h-12 bg-white rounded-lg border border-slate-200 flex items-center justify-center shadow-sm">
                <Package className="w-6 h-6 text-indigo-600" />
              </div>
              <div className="flex flex-col">
                <h3 className="text-xl font-bold text-slate-900">{selectedProduct.name}</h3>
                <span className="font-mono text-sm text-slate-500 mt-1">{selectedProduct.sku}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Current Stock</span>
                <span className="text-3xl font-bold text-slate-900 mt-1 tabular-nums">{selectedProduct.stock}</span>
                <span className="text-sm text-slate-500 mt-2">Min: {selectedProduct.minimum}</span>
              </div>
              <div className="flex flex-col p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</span>
                <div className="mt-2">
                  <StatusBadge status={selectedProduct.status} />
                </div>
                <span className="text-sm text-slate-500 mt-4">Cat: {selectedProduct.category}</span>
              </div>
            </div>

            <div className="flex flex-col">
              <h4 className="text-sm font-bold text-slate-900 mb-3">Locations</h4>
              <div className="flex flex-col space-y-2">
                {Object.entries(selectedProduct.locations).map(([loc, qty]) => (
                  <div key={loc} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-sm font-medium text-slate-700">{loc}</span>
                    <span className="font-mono font-bold text-slate-900 tabular-nums">{qty}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-6 border-t border-slate-200">
              <button 
                disabled
                title="Not implemented yet"
                className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold shadow-sm hover:bg-indigo-700 transition-colors opacity-50 cursor-not-allowed"
              >
                Edit Product
              </button>
              <button 
                disabled
                title="Not implemented yet"
                className="w-full py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors opacity-50 cursor-not-allowed"
              >
                View Stock History
              </button>
            </div>
          </div>
        )}
      </DetailDrawer>
    </PageShell>
  );
};

export default Products;
