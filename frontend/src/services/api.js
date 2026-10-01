
const BASE_URL = '/api';

async function fetchJSON(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch (e) {
      throw new Error(`Request failed with status ${response.status}`);
    }
    throw new Error(errorData.message || `Request failed with status ${response.status}`);
  }
  
  return response.json();
}

export const api = {
  async getDashboard() {
    const [data, locData, invData] = await Promise.all([
      fetchJSON('/dashboard'),
      fetchJSON('/inventory/locations'),
      fetchJSON('/inventory')
    ]);
    
    const locationsInfo = locData.locations.map(loc => {
      const invItems = invData.inventory.filter(i => i.location_id === loc.id);
      const skuCount = new Set(invItems.map(i => i.product_id)).size;
      const quantity = loc.total_quantity || 0;
      const maxCap = 10000;
      const capacityUtilized = Math.min(100, Math.round((quantity / maxCap) * 100));
      return {
        name: loc.name,
        skuCount,
        quantity,
        capacityUtilized,
        status: capacityUtilized > 80 ? 'High Load' : (capacityUtilized > 40 ? 'Optimal' : 'Low Load')
      };
    });

    return {
      kpis: {
        totalProducts: data.stats.totalProducts,
        totalStock: data.stats.inventoryValue,
        lowStock: data.stats.lowStockCount,
        // BUG-004 fixed: use pendingByType for truly-pending counts per operation type
        pendingReceipts: (data.pendingByType || []).find(t => t.type === 'receipt')?.n || 0,
        pendingDeliveries: (data.pendingByType || []).find(t => t.type === 'delivery')?.n || 0
      },
      inventoryHealth: {
        healthy: data.stats.totalProducts - data.stats.lowStockCount,
        lowStock: data.stats.lowStockCount,
        critical: 0,
        outOfStock: 0
      },
      locationsInfo: locationsInfo,
      attentionRequired: data.lowStock.map(item => ({
        id: item.product_id || item.sku,
        product: item.product_name,
        sku: item.sku,
        issue: item.available === 0 ? 'Out of Stock' : 'Low Stock',
        severity: item.available === 0 ? 'Critical' : 'Warning',
        details: `Available: ${item.available}, Min: ${item.min_stock}`,
        action: 'Reorder'
      })),
      recentActivity: data.recent.map(r => ({
        id: r.id.substring(0, 8),
        operation: r.document_type === 'transfer' ? 'Internal Transfer'
          : r.document_type === 'receipt' ? 'Receipt'
          : r.document_type === 'delivery' ? 'Delivery'
          : r.document_type === 'adjustment' ? 'Adjustment'
          : (r.document_type || 'Unknown'),
        product: r.product_name,
        quantity: r.quantity_change,
        time: new Date(r.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
        locationFlow: r.location_name,
        status: r.document_status === 'done' ? 'Completed' : 'Pending'
      })),
      commandActivity: []
    };
  },

  async getAlerts() {
    const data = await fetchJSON('/inventory/low-stock');
    return data.lowStock.map((item, idx) => ({
      id: `alert-${idx}`,
      // BUG-007 fixed: use real timestamp from the data, fallback to now
      severity: item.available === 0 ? 'Critical' : (item.available <= item.min_stock / 2 ? 'Critical' : 'Warning'),
      product: item.product_name,
      message: item.available === 0
        ? `Out of stock. Minimum required: ${item.min_stock} units.`
        : `Only ${item.available} units remaining at ${item.location_name}. Minimum: ${item.min_stock}.`,
      timestamp: new Date().toLocaleString(),
      resolved: false,
      action: item.available === 0 ? 'Urgent Reorder' : 'Reorder'
    }));
  },

  async getProducts() {
    const data = await fetchJSON('/inventory/products');
    return data.products.map(p => {
      const stock = p.total_quantity;
      const minimum = p.min_stock;
      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        category: p.category || 'Uncategorized',
        stock: stock,
        minimum: minimum,
        // BUG-001 fix: locations populated lazily via getProductLocations()
        // kept as {} here; Products drawer now calls getProductLocations separately
        status: stock === 0 ? 'Out of Stock' : (stock >= minimum * 2 ? 'Healthy' : (stock >= minimum ? 'Low Stock' : 'Critical')),
        locations: {},
        lastUpdated: new Date(p.created_at).toLocaleDateString()
      };
    });
  },

  async getProductLocations(productId) {
    // BUG-001 fix: fetch per-location breakdown from the new endpoint
    const data = await fetchJSON(`/inventory/products/${productId}/locations`);
    const out = {};
    for (const loc of data.locations) {
      out[loc.name] = loc.quantity;
    }
    return out;
  },

  async getTransfers() {
    // We can use the operations endpoint filtered by type=transfer
    const data = await fetchJSON('/operations?type=transfer');
    // Map operation documents to the activity format
    return data.operations.map(op => ({
      id: op.id.substring(0, 8),
      fullId: op.id,
      time: new Date(op.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
      operation: 'Internal Transfer',
      product: op.product_name || op.lines?.[0]?.product_name || 'Multiple Items',
      sku: op.product_sku || op.lines?.[0]?.product_sku || 'N/A',
      quantity: op.total_qty ?? (op.lines?.[0]?.quantity || op.quantity || 0),
      sourceLocation: op.source_location_name || 'Unknown',
      destLocation: op.dest_location_name || 'Unknown',
      locationFlow: `${op.source_location_name || 'Unknown'} -> ${op.dest_location_name || 'Unknown'}`,
      status: op.status === 'done' ? 'Done' : (op.status === 'ready' ? 'Ready' : (op.status === 'waiting' ? 'Waiting' : (op.status === 'canceled' ? 'Cancelled' : 'Draft'))),
      date: new Date(op.created_at).toLocaleDateString()
    }));
  },

  async getReceipts() {
    const data = await fetchJSON('/operations?type=receipt');
    return data.operations.map(op => ({
      id: op.id.substring(0, 8),
      fullId: op.id,
      supplier: op.reference || 'System Generated',
      items: op.line_count ?? (op.lines?.length || (op.product_id ? 1 : 0)),
      quantity: op.total_qty ?? (op.lines?.reduce((sum, line) => sum + line.quantity, 0) || op.quantity || 0),
      destination: op.dest_location_name || 'Unknown',
      status: op.status === 'done' ? 'Done' : (op.status === 'ready' ? 'Ready' : (op.status === 'waiting' ? 'Waiting' : (op.status === 'canceled' ? 'Cancelled' : 'Draft'))),
      date: new Date(op.created_at).toLocaleDateString(),
      notes: op.notes || '',
      product: op.product_name || 'Multiple Items'
    }));
  },

  async getDeliveries() {
    const data = await fetchJSON('/operations?type=delivery');
    return data.operations.map(op => ({
      id: op.id.substring(0, 8),
      fullId: op.id,
      customer: op.reference || 'System Generated',
      items: op.line_count ?? (op.lines?.length || (op.product_id ? 1 : 0)),
      quantity: op.total_qty ?? (op.lines?.reduce((sum, line) => sum + line.quantity, 0) || op.quantity || 0),
      source: op.source_location_name || 'Unknown',
      status: op.status === 'done' ? 'Done' : (op.status === 'ready' ? 'Ready' : (op.status === 'waiting' ? 'Waiting' : (op.status === 'canceled' ? 'Cancelled' : 'Draft'))),
      date: new Date(op.created_at).toLocaleDateString(),
      notes: op.notes || '',
      product: op.product_name || 'Multiple Items'
    }));
  },

  async getAdjustments() {
    const data = await fetchJSON('/operations?type=adjustment');
    let ledger = { entries: [] };
    let inv = { inventory: [] };
    try {
      ledger = await fetchJSON('/ledger');
      inv = await fetchJSON('/inventory');
    } catch (e) {
      console.error("Failed to fetch auxiliary data for adjustments", e);
    }

    return data.operations.map(op => {
      const line = op.lines?.[0];
      const isDone = op.status === 'done';
      const ledgerEntry = ledger.entries?.find(e => e.operation_id === op.id);
      
      let systemQty = 0;
      let diff = 0;
      
      if (isDone && ledgerEntry) {
         systemQty = ledgerEntry.stock_before;
         diff = ledgerEntry.quantity_change;
      } else {
         const productId = op.product_id || line?.product_id;
         const locationId = op.from_location_id || op.source_location_id;
         const invItem = inv.inventory?.find(i => i.product_id === productId && i.location_id === locationId);
         systemQty = invItem ? invItem.quantity : 0;
         diff = op.total_qty ?? (line?.quantity || op.quantity || 0);
      }
      
      return {
        id: op.id.substring(0, 8),
        fullId: op.id,
        product: op.product_name || line?.product_name || 'Multiple Items',
        sku: op.product_sku || line?.sku || 'Unknown',
        location: op.source_location_name || op.dest_location_name || 'Unknown',
        systemQty: systemQty,
        physicalQty: systemQty + diff,
        diff: diff,
        reason: op.notes || op.reference || 'Manual entry',
        status: op.status === 'done' ? 'Done' : (op.status === 'ready' ? 'Ready' : (op.status === 'waiting' ? 'Waiting' : (op.status === 'canceled' ? 'Cancelled' : 'Draft'))),
        date: new Date(op.created_at).toLocaleDateString()
      };
    });
  },

  async getLedger() {
    const data = await fetchJSON('/ledger');
    return data.entries.map(r => ({
      id: r.id.substring(0, 8),
      time: new Date(r.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
      date: new Date(r.created_at).toLocaleDateString(),
      operation: r.document_type === 'transfer' ? 'Internal Transfer' : (r.document_type || 'Unknown'),
      product: r.product_name,
      quantity: r.quantity_change,
      locationFlow: r.location_name,
      status: r.document_status === 'done' ? 'Completed' : 'Pending'
    }));
  },
  
  async getLocations() {
    const data = await fetchJSON('/inventory/locations');
    return data.locations;
  },
  
  async getInventory() {
    const data = await fetchJSON('/inventory');
    return data.inventory;
  },

  async analyzeCommand(commandText) {
    // Send natural language to the backend parser
    const result = await fetchJSON('/parse', {
      method: 'POST',
      body: JSON.stringify({ text: commandText })
    });
    
    // Adapt the backend response to what the frontend expects
    const validation = result.validation;
    if (!validation) {
      throw new Error("Could not parse command");
    }
    
    const sourceImpact = validation.impacts?.[0]?.locations?.find(l => l.delta < 0) || {};
    const destImpact = validation.impacts?.[0]?.locations?.find(l => l.delta > 0) || {};

    // BUG-009 fix: derive intent from the parsed type rather than hard-coding it
    const typeLabels = {
      transfer: 'Internal Transfer',
      receipt: 'Receipt',
      delivery: 'Delivery',
      adjustment: 'Adjustment'
    };
    const parsedType = result.intent?.type || 'transfer';
    return {
      isValid: validation.ok,
      intent: typeLabels[parsedType] || 'Operation',
      product: { name: validation.resolved.product?.name, sku: validation.resolved.product?.sku },
      source: validation.resolved.sourceLocation?.name,
      destination: validation.resolved.destLocation?.name,
      quantity: validation.impacts?.[0]?.quantity || 0,
      reason: validation.errors?.[0] || null,

      sourceBefore: sourceImpact.before || 0,
      sourceAfter: sourceImpact.after || 0,
      destBefore: destImpact.before || 0,
      destAfter: destImpact.after || 0,
      totalBefore: (sourceImpact.before || 0) + (destImpact.before || 0),
      totalAfter: (sourceImpact.after || 0) + (destImpact.after || 0),
      available: sourceImpact.before || 0,

      impacts: validation.impacts?.[0]?.locations || [],
      normalizedPayload: validation.normalized
    };
  },
  
  async executeTransfer(payload) {
    // Create the operation
    const opResult = await fetchJSON('/operations', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    
    // Commit the operation
    const commitResult = await fetchJSON(`/operations/${opResult.operation.id}/post`, {
      method: 'POST'
    });
    
    return commitResult;
  },

  async postOperation(id) {
    return fetchJSON(`/operations/${id}/post`, {
      method: 'POST'
    });
  },

  async updateOperationStatus(id, status) {
    return fetchJSON(`/operations/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status })
    });
  },

  async createOperation(payload) {
    return fetchJSON('/operations', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }
};
