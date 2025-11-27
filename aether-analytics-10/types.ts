export interface NodeData {
  id: string;
  name: string;
  address: string;
  
  // Core Metrics
  size: number; // Overall AII Score (0-100)
  bias: 'ATOM' | 'ATOMONE' | 'MIXED';
  
  // Filter Data
  totalVolume: number;
  avgTradeSize: number;
  netBuyRatio: number; // -1 to 1
  txCount: number;
  atomVolumeShare: number; // 0-1
  oneVolumeShare: number; // 0-1
  ibcVolumeShare: number; // 0-1
  activeDays: number;
  lastActiveDate: string; // ISO String
  
  // Advanced Impact Metrics
  timing: 'LEADING' | 'SYNC' | 'LAGGING';
  correlationScore: number; // -1 to 1
  scaleScore: number; // 0-100
  timingScore: number;

  // Detailed Analysis Data
  composition: {
    swap: number;
    ibc: number;
    stake: number;
  };
  
  history: {
    date: string;
    price: number;
    netFlow: number; // Positive = Buy, Negative = Sell
  }[];
  
  description?: string;
}

export interface MarketData {
  price: number;
  change24h: number;
  marketCap: number;
  volume24h: number;
  history: { date: string; price: number }[];
}

export interface FilterState {
  dateRange: { start: string; end: string };
  totalVolume: number;
  avgTradeSize: number;
  netBuyRatio: [number, number];
  txCount: number;
  atomShare: number;
  oneShare: number;
  ibcShare: number;
  activeDays: number;
  recentActivity: '3D' | '7D' | '30D' | 'ALL';
  aiiScore: number;
  timingType: 'LEADING' | 'SYNC' | 'LAGGING' | 'ALL';
  correlation: [number, number];
}

export type StrategyMode = 'LONG_ONLY' | 'COPY_TRADING';

export interface SimulationConfig {
  initialCapital: number;
  asset: 'ATOM' | 'ATOMONE';
  mode: StrategyMode;
  slots: {
    id: string; // 'A' | 'B' | 'C'
    node: NodeData | null;
    weight: number; // 0-100
  }[];
}

export interface SimulationResult {
  timeline: {
    date: string;
    portfolioValue: number;
    benchmarkValue: number; // Price of ATOM/ONE itself
  }[];
  finalValue: number;
  roi: number; // Percentage
  totalPnL: number;
}