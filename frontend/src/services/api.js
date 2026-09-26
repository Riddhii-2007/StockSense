import { 
  products, 
  recentActivity, 
  commandActivity, 
  inventoryHealth, 
  locationsInfo, 
  attentionRequired, 
  kpis 
} from '../data/mockData';

// Simulated delay to mimic network request
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const api = {
  async getDashboard() {
    await delay(500);
    return {
      kpis,
      inventoryHealth,
      locationsInfo,
      attentionRequired,
      recentActivity,
      commandActivity
    };
  },

  async getProducts() {
    await delay(300);
    return products;
  },

  async getTransfers() {
    await delay(300);
    return recentActivity.filter(activity => activity.operation === 'Internal Transfer');
  },

  async getLedger() {
    await delay(300);
    return recentActivity;
  },

  async analyzeCommand(commandText) {
    await delay(1200); // Simulate AI thinking
    
    const text = commandText.toLowerCase();
    
    if (text.includes('150') || text.includes('blocked') || text.includes('shortage')) {
       return {
         isValid: false,
         intent: 'Internal Transfer',
         product: { name: 'Steel Rods', sku: 'STL-001' },
         source: 'Main Store',
         destination: 'Production Rack',
         quantity: 150,
         available: 120,
         reason: 'Insufficient stock at Main Store.'
       };
    }
    
    return {
      isValid: true,
      intent: 'Internal Transfer',
      product: { name: 'Steel Rods', sku: 'STL-001' },
      source: 'Main Store',
      destination: 'Production Rack',
      quantity: 30,
      sourceBefore: 120,
      sourceAfter: 90,
      destBefore: 20,
      destAfter: 50,
      totalBefore: 140,
      totalAfter: 140
    };
  }
};
