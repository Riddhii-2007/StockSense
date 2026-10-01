import { useState, useEffect } from 'react';
import { X, Loader2, ArrowUpRight } from 'lucide-react';
import { api } from '../../services/api';

const AddDeliveryModal = ({ isOpen, onClose, onSuccess }) => {
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [formData, setFormData] = useState({
    productId: '',
    sourceLocationId: '',
    quantity: 1,
    customer: '',
    notes: '',
    autoPost: true
  });
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    async function loadData() {
      try {
        setFetchingData(true);
        const [prodList, locList] = await Promise.all([
          api.getProducts(),
          api.getLocations()
        ]);
        if (mounted) {
          setProducts(prodList);
          setLocations(locList);
          setFormData(prev => ({
            ...prev,
            productId: prodList[0]?.id || '',
            sourceLocationId: locList.find(l => l.type === 'STORAGE')?.id || locList[0]?.id || ''
          }));
        }
      } catch (err) {
        console.error('Failed to load modal data:', err);
        if (mounted) setError('Failed to load products and locations');
      } finally {
        if (mounted) setFetchingData(false);
      }
    }

    loadData();
    return () => { mounted = false; };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.productId || !formData.sourceLocationId || formData.quantity <= 0) {
      setError('Please select a product, source location, and valid quantity.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const payload = {
        type: 'delivery',
        sourceLocationId: formData.sourceLocationId,
        reference: formData.customer || 'Customer Delivery',
        notes: formData.notes || '',
        lines: [
          {
            productId: formData.productId,
            quantity: Number(formData.quantity)
          }
        ]
      };

      const res = await api.createOperation(payload);
      if (!res.success) {
        throw new Error(res.message || 'Failed to create delivery');
      }

      if (formData.autoPost && res.operation?.id) {
        await api.postOperation(res.operation.id);
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  const selectedProd = products.find(p => p.id === formData.productId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
              <ArrowUpRight className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">New Outgoing Delivery</h2>
              <p className="text-sm text-slate-500">Dispatch stock for a customer or shipping order.</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-sm font-semibold rounded-lg border border-red-100">
              {error}
            </div>
          )}

          {fetchingData ? (
            <div className="py-8 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
              <span className="text-sm">Loading catalogue & locations...</span>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-slate-700">Product</label>
                <select
                  value={formData.productId}
                  onChange={e => setFormData({ ...formData, productId: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku}) — Available: {p.total_quantity ?? p.current_stock ?? 0} {p.unit_of_measure || 'pcs'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-slate-700">Quantity</label>
                  <input
                    type="number"
                    required
                    min="1"
                    max={selectedProd ? (selectedProd.total_quantity ?? selectedProd.current_stock ?? 9999) : 9999}
                    value={formData.quantity}
                    onChange={e => setFormData({ ...formData, quantity: parseInt(e.target.value) || '' })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all tabular-nums font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-slate-700">Source Location</label>
                  <select
                    value={formData.sourceLocationId}
                    onChange={e => setFormData({ ...formData, sourceLocationId: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                  >
                    {locations.map(loc => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name} ({loc.type})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-bold text-slate-700">Customer / Reference</label>
                <input
                  type="text"
                  value={formData.customer}
                  onChange={e => setFormData({ ...formData, customer: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  placeholder="e.g. Acme Corp / SO-4401"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-bold text-slate-700">Notes (Optional)</label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  placeholder="e.g. Urgent courier dispatch"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3">
                <input
                  type="checkbox"
                  id="autoPostDeliv"
                  checked={formData.autoPost}
                  onChange={e => setFormData({ ...formData, autoPost: e.target.checked })}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                />
                <label htmlFor="autoPostDeliv" className="text-xs font-semibold text-slate-700 select-none cursor-pointer">
                  Immediately validate and deduct from inventory (moves stock)
                </label>
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
                  className="flex-1 py-2.5 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 shadow-sm transition-all disabled:opacity-70 flex items-center justify-center"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (formData.autoPost ? 'Dispatch & Move Stock' : 'Create Delivery Order')}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
};

export default AddDeliveryModal;
