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
  roi?: number; // percent
  
  // Advanced Impact Metrics
  timing: 'LEADING' | 'SYNC' | 'LAGGING';
  correlationScore: number; // -1 to 1
  scaleScore: number; // 0-100
  timingScore: number;
  shareScore?: number;
  flowCorrelationScore?: number;
  crossVolume?: number;
  marketSharePct?: number;

  // Detailed Analysis Data
  composition: {
    swap: number;
    ibc: number;
    stake: number;
  };
  swapProfile?: {
    cross: SwapProfileBucket;
    atom: SwapProfileBucket;
    atone: SwapProfileBucket;
    other: SwapProfileBucket;
  };
  timingDetail?: TimingDetail;
  
  history?: {
    date: string;
    price?: number;
    priceUnified?: number | null;
    priceAtom?: number | null;
    priceAtone?: number | null;
    netFlow: number; // Positive = Buy, Negative = Sell
    netFlowAtom?: number | null;
    netFlowAtone?: number | null;
    txCount?: number;
  }[];
  
  description?: string;
}

export interface SwapProfileBucket {
  share: number;
  count: number;
  volume: number;
  samples: string[];
}

export interface TimingDetail {
  bestLagUnified: number | null;
  bestLagAtom: number | null;
  bestLagAtone: number | null;
  weightAtom: number;
  weightAtone: number;
  correlationAtom: number | null;
  correlationAtone: number | null;
  unifiedCorrelation: number | null;
  sampleSizeAtom: number;
  sampleSizeAtone: number;
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
  totalVolume: [number, number];
  avgTradeSize: [number, number];
  netBuyRatio: [number, number];
  txCount: [number, number];
  atomShare: [number, number];
  oneShare: [number, number];
  ibcShare: [number, number];
  activeDays: [number, number];
  recentActivity: '3D' | '7D' | '30D' | 'ALL';
  aiiScore: [number, number];
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
    portfolioCoins: number;
    portfolioValue: number;
    price: number;
    benchmarkCoins: number;
    benchmarkValue: number; // Buy-and-hold baseline
    slots: Record<string, number>;
  }[];
  finalCoins: number;
  finalValue: number;
  roi: number; // Percentage
  totalPnL: number; // Value-based PnL
  coinPnL: number; // Coin-based PnL
  slotSummaries: {
    id: string;
    initialValue: number;
    finalValue: number;
    contribution: number;
    label?: string;
    address?: string;
  }[];
}
