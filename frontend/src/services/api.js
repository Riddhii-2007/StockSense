import { locationsInfo } from '../data/mockData';
const BASE_URL = '/api';

async function fetchJSON(endpoint, options = {}) {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
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
    const data = await fetchJSON('/dashboard');
    
    return {
      kpis: {
        totalProducts: data.stats.totalProducts,
        totalStock: data.stats.inventoryValue, // Displaying value instead since backend provides it
        lowStock: data.stats.lowStockCount,
        pendingReceipts: data.byType.find(t => t.type === 'receipt')?.n || 0,
        pendingDeliveries: data.byType.find(t => t.type === 'delivery')?.n || 0
      },
      inventoryHealth: {
        healthy: data.stats.totalProducts - data.stats.lowStockCount,
        lowStock: data.stats.lowStockCount,
        critical: 0,
        outOfStock: 0
      },
      locationsInfo: locationsInfo,
      attentionRequired: data.lowStock.map(item => ({
        id: item.sku,
        product: item.product_name,
        sku: item.sku,
        issue: 'Low Stock',
        severity: 'Warning',
        details: `Available: ${item.available}, Min: ${item.min_stock}`,
        action: 'Reorder'
      })),
      recentActivity: data.recent.map(r => ({
        id: r.id.substring(0, 8),
        operation: r.document_type === 'transfer' ? 'Internal Transfer' : (r.document_type || 'Unknown'),
        product: r.product_name,
        quantity: r.quantity_change,
        time: new Date(r.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
        locationFlow: r.location_name,
        status: r.document_status === 'done' ? 'Completed' : 'Pending'
      })),
      commandActivity: []
    };
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
        status: stock >= minimum * 2 ? 'Healthy' : (stock >= minimum ? 'Low Stock' : 'Critical'),
        locations: 'N/A', // Not returned by this endpoint directly
        lastUpdated: new Date(p.created_at).toLocaleDateString()
      };
    });
  },

  async getTransfers() {
    // We can use the operations endpoint filtered by type=transfer
    const data = await fetchJSON('/operations?type=transfer');
    // Map operation documents to the activity format
    return data.operations.map(op => ({
      id: op.id.substring(0, 8),
      time: new Date(op.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
      operation: 'Internal Transfer',
      product: op.lines?.[0]?.product_name || 'Multiple',
      quantity: op.lines?.[0]?.quantity || 0,
      locationFlow: `${op.source_location_name} -> ${op.dest_location_name}`,
      status: op.status === 'done' ? 'Completed' : 'Pending'
    }));
  },

  async getLedger() {
    const data = await fetchJSON('/ledger');
    return data.entries.map(r => ({
      id: r.id.substring(0, 8),
      time: new Date(r.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
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
    
    return {
      isValid: validation.ok,
      intent: 'Internal Transfer',
      product: { name: validation.resolved.product?.name, sku: validation.resolved.product?.sku },
      source: validation.resolved.sourceLocation?.name,
      destination: validation.resolved.destLocation?.name,
      quantity: validation.impacts?.[0]?.quantity || 0,
      reason: validation.errors?.[0] || null,
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
  }
};
