import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { api } from '../../services/api';

const AddProductModal = ({ isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    category: 'Raw Material',
    unit_of_measure: 'pcs',
    min_stock: 0,
    unit_cost: 0
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/inventory/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(formData)
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to add product');
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Add New Product</h2>
            <p className="text-sm text-slate-500 mt-1">Register a new item in the catalogue.</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-sm font-semibold rounded-lg border border-red-100">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <label className="text-sm font-bold text-slate-700">Product Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                placeholder="e.g. Steel Pipe 50mm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700">SKU</label>
              <input
                type="text"
                required
                value={formData.sku}
                onChange={e => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all uppercase"
                placeholder="STL-050"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700">Category</label>
              <select
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              >
                <option>Raw Material</option>
                <option>Components</option>
                <option>Consumables</option>
                <option>Packaging</option>
                <option>Finished Goods</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700">Unit of Measure</label>
              <select
                value={formData.unit_of_measure}
                onChange={e => setFormData({ ...formData, unit_of_measure: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              >
                <option value="pcs">Pieces (pcs)</option>
                <option value="kg">Kilograms (kg)</option>
                <option value="m">Meters (m)</option>
                <option value="L">Liters (L)</option>
                <option value="box">Boxes (box)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700">Minimum Stock Threshold</label>
              <input
                type="number"
                required
                min="0"
                value={formData.min_stock}
                onChange={e => setFormData({ ...formData, min_stock: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all tabular-nums"
              />
            </div>
            
            <div className="space-y-1.5 col-span-2">
              <label className="text-sm font-bold text-slate-700">Unit Cost ($)</label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.unit_cost}
                onChange={e => setFormData({ ...formData, unit_cost: parseFloat(e.target.value) || 0 })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all tabular-nums"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg font-bold hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 shadow-sm shadow-indigo-500/20 transition-all disabled:opacity-70 flex items-center justify-center"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Add Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddProductModal;
