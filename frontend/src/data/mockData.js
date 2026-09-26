export const products = [
  {
    id: 1,
    name: 'Steel Rods',
    sku: 'STL-001',
    category: 'Raw Materials',
    stock: 140,
    minimum: 50,
    status: 'Healthy',
    locations: {
      'Main Store': 120,
      'Production Rack': 20
    }
  },
  {
    id: 2,
    name: 'Bearing 6204',
    sku: 'BRG-6204',
    category: 'Components',
    stock: 8,
    minimum: 50,
    status: 'Critical',
    locations: {
      'Production Rack': 8
    }
  },
  {
    id: 3,
    name: 'Copper Wire',
    sku: 'CWR-020',
    category: 'Raw Materials',
    stock: 350,
    minimum: 100,
    status: 'Healthy',
    locations: {
      'Main Store': 350
    }
  },
  {
    id: 4,
    name: 'Packaging Frames',
    sku: 'FRM-118',
    category: 'Packaging',
    stock: 24,
    minimum: 40,
    status: 'Warning',
    locations: {
      'Main Store': 24
    }
  },
  {
    id: 5,
    name: 'Steel Bolts',
    sku: 'BLT-005',
    category: 'Hardware',
    stock: 850,
    minimum: 200,
    status: 'Healthy',
    locations: {
      'Main Store': 500,
      'Production Rack': 350
    }
  },
  {
    id: 6,
    name: 'Aluminium Sheets',
    sku: 'ALU-112',
    category: 'Raw Materials',
    stock: 150,
    minimum: 100,
    status: 'Healthy',
    locations: {
      'Warehouse 2': 150
    }
  },
  {
    id: 7,
    name: 'Industrial Valves',
    sku: 'VLV-008',
    category: 'Components',
    stock: 60,
    minimum: 30,
    status: 'Healthy',
    locations: {
      'Warehouse 2': 60
    }
  },
  {
    id: 8,
    name: 'Safety Gloves',
    sku: 'GLV-101',
    category: 'PPE',
    stock: 15,
    minimum: 50,
    status: 'Warning',
    locations: {
      'Main Store': 15
    }
  }
];

export const recentActivity = [
  {
    id: 'TRF-1042',
    time: '11:42 AM',
    operation: 'Internal Transfer',
    product: 'Steel Rods',
    quantity: -30,
    locationFlow: 'Main Store → Production Rack',
    status: 'Completed',
    date: '2023-10-27'
  },
  {
    id: 'REC-0821',
    time: '11:38 AM',
    operation: 'Receipt',
    product: 'Copper Wire',
    quantity: 120,
    locationFlow: 'Inbound → Main Store',
    status: 'Completed',
    date: '2023-10-27'
  },
  {
    id: 'DEL-0298',
    time: '11:21 AM',
    operation: 'Delivery',
    product: 'Packaging Frames',
    quantity: -40,
    locationFlow: 'Main Store → Customer',
    status: 'Completed',
    date: '2023-10-27'
  },
  {
    id: 'ADJ-0107',
    time: '10:56 AM',
    operation: 'Adjustment',
    product: 'Steel Bolts',
    quantity: -3,
    locationFlow: 'Production Rack (Scrap)',
    status: 'Completed',
    date: '2023-10-27'
  },
  {
    id: 'REC-0820',
    time: '10:14 AM',
    operation: 'Receipt',
    product: 'Aluminium Sheets',
    quantity: 85,
    locationFlow: 'Inbound → Warehouse 2',
    status: 'Completed',
    date: '2023-10-27'
  }
];

export const commandActivity = [
  {
    id: 1,
    status: 'Valid',
    command: 'Move 30 Steel Rods from Main Store to Production Rack',
    result: 'Transfer validated',
    time: '12:04 PM'
  },
  {
    id: 2,
    status: 'Valid',
    command: 'Move 10 Frames to Production Rack',
    result: 'Transfer completed',
    time: '11:51 AM'
  },
  {
    id: 3,
    status: 'Blocked',
    command: 'Move 150 Steel Rods from Main Store',
    result: 'Insufficient stock',
    time: '11:43 AM'
  }
];

export const inventoryHealth = {
  healthy: 196,
  lowStock: 31,
  critical: 12,
  outOfStock: 9
};

export const locationsInfo = [
  {
    name: 'Main Store',
    skuCount: 143,
    quantity: 10820,
    capacityUtilized: 86,
    status: 'High Load'
  },
  {
    name: 'Production Rack',
    skuCount: 68,
    quantity: 4320,
    capacityUtilized: 62,
    status: 'Optimal'
  },
  {
    name: 'Warehouse 2 (Aux)',
    skuCount: 37,
    quantity: 3286,
    capacityUtilized: 41,
    status: 'Low Load'
  }
];

export const attentionRequired = [
  {
    id: 1,
    severity: 'Critical',
    product: 'Steel Bearings',
    sku: 'BRG-6204',
    message: '8 units remaining',
    action: 'Reorder'
  },
  {
    id: 2,
    severity: 'Warning',
    product: 'Packaging Frames',
    sku: 'FRM-118',
    message: 'Below minimum stock',
    action: 'View PO'
  },
  {
    id: 3,
    severity: 'Review',
    product: 'Copper Wire',
    sku: 'CWR-020',
    message: 'Unusual stock adjustment',
    action: 'Investigate'
  }
];

export const kpis = {
  totalProducts: 248,
  totalStock: 18426,
  lowStock: 12,
  pendingReceipts: 8,
  pendingDeliveries: 14,
};

export const mockReceipts = [
  { id: 'REC-0822', supplier: 'GlobalTech Industries', items: 3, quantity: 450, destination: 'Main Store', status: 'Ready', date: '2023-10-27' },
  { id: 'REC-0821', supplier: 'MetalWorks Ltd', items: 1, quantity: 120, destination: 'Main Store', status: 'Done', date: '2023-10-27' },
  { id: 'REC-0820', supplier: 'Packaging Co.', items: 2, quantity: 200, destination: 'Warehouse 2', status: 'Waiting', date: '2023-10-26' },
];

export const mockDeliveries = [
  { id: 'DEL-0299', customer: 'Acme Corp', items: 2, quantity: 45, source: 'Main Store', status: 'Draft', date: '2023-10-27' },
  { id: 'DEL-0298', customer: 'BuildIt Fast Inc.', items: 1, quantity: 40, source: 'Main Store', status: 'Completed', date: '2023-10-27' },
  { id: 'DEL-0297', customer: 'TechHardware', items: 4, quantity: 120, source: 'Warehouse 2', status: 'Ready', date: '2023-10-26' },
];

export const mockAdjustments = [
  { id: 'ADJ-1082', product: 'Steel Bolts', sku: 'BLT-005', location: 'Production Rack', systemQty: 87, physicalQty: 84, diff: -3, reason: 'Damaged', status: 'Logged', date: '2023-10-27' },
  { id: 'ADJ-1081', product: 'Copper Wire', sku: 'CWR-020', location: 'Main Store', systemQty: 350, physicalQty: 365, diff: 15, reason: 'Found Inventory', status: 'Review', date: '2023-10-26' },
  { id: 'ADJ-1080', product: 'Safety Gloves', sku: 'GLV-101', location: 'Main Store', systemQty: 20, physicalQty: 15, diff: -5, reason: 'Expired', status: 'Completed', date: '2023-10-25' },
];

export const mockAlerts = [
  { id: 1, severity: 'Critical', product: 'Steel Bearings', message: 'Only 8 units remaining.', timestamp: '10 min ago', resolved: false, action: 'Reorder now' },
  { id: 2, severity: 'Warning', product: 'Packaging Frames', message: 'Below minimum stock threshold.', timestamp: '2 hours ago', resolved: false, action: 'View PO draft' },
  { id: 3, severity: 'Informational', product: 'Steel Rods', message: 'Transfer TRF-1042 completed.', timestamp: '3 hours ago', resolved: true, action: 'View ledger' },
  { id: 4, severity: 'Warning', product: 'Copper Wire', message: 'Unusual adjustment detected.', timestamp: '1 day ago', resolved: false, action: 'Investigate' },
];
