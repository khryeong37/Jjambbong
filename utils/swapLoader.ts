import { NodeData, MarketData } from '../types';

const CSV_URL = '/data/swap.csv';

type Aggregated = {
  sender: string;
  txCount: number;
  totalVolume: number;
  buyVolume: number;
  sellVolume: number;
  netFlowSum: number;
  atomVolume: number;
  oneVolume: number;
  lastActive: number;
  dayFlows: Record<string, number>;
  swapVolume: number;
  ibcVolume: number;
  stakeVolume: number;
};

const parseNumber = (val?: string) => {
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
};

// CSV 파싱: 따옴표 처리 및 빈 값 처리 개선
const parseRow = (row: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    const nextChar = row[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  // Add last field
  result.push(current.trim());
  
  return result;
};

const isAtomDenom = (denom?: string) =>
  denom ? denom.toUpperCase().includes('ATOM') && !denom.toUpperCase().includes('ONE') : false;

const isAtomOneDenom = (denom?: string) =>
  denom ? denom.toUpperCase().includes('ATONE') || denom.toUpperCase().includes('ATOMONE') : false;

export const loadSwapNodes = async (dateRange?: { start: string; end: string }): Promise<NodeData[]> => {
  const res = await fetch(CSV_URL);
  const text = await res.text();
  const lines = text.trim().split(/\r?\n/);
  if (lines.length <= 1) return [];

  const dataLines = lines.slice(1);
  const aggMap = new Map<string, Aggregated>();

  // Date range filtering
  const startDate = dateRange ? new Date(dateRange.start).getTime() : 0;
  const endDate = dateRange ? new Date(dateRange.end).getTime() + 86400000 : Infinity; // +1 day to include end date

  for (const line of dataLines) {
    if (!line.trim()) continue;
    const cols = parseRow(line);
    
    // CSV 컬럼 수 검증 (최소 16개 필요)
    if (cols.length < 16) continue;
    
    const timestamp = parseNumber(cols[1]);
    
    // Filter by date range
    if (timestamp < startDate || timestamp >= endDate) continue;
    
    const sender = cols[2] || 'unknown';
    if (!sender || sender === 'unknown') continue; // 유효한 sender만 처리

    const tokenInAmounts = [
      parseNumber(cols[4] || '0'), 
      parseNumber(cols[6] || '0'), 
      parseNumber(cols[8] || '0')
    ];
    const tokenInDenoms = [
      (cols[5] || '').trim(), 
      (cols[7] || '').trim(), 
      (cols[9] || '').trim()
    ];
    const tokenOutAmounts = [
      parseNumber(cols[10] || '0'), 
      parseNumber(cols[12] || '0'), 
      parseNumber(cols[14] || '0')
    ];
    const tokenOutDenoms = [
      (cols[11] || '').trim(), 
      (cols[13] || '').trim(), 
      (cols[15] || '').trim()
    ];

    let inSum = 0;
    let outSum = 0;
    let atomVol = 0;
    let oneVol = 0;

    tokenInAmounts.forEach((amt, idx) => {
      inSum += Math.abs(amt);
      if (isAtomDenom(tokenInDenoms[idx])) atomVol += Math.abs(amt);
      if (isAtomOneDenom(tokenInDenoms[idx])) oneVol += Math.abs(amt);
    });
    tokenOutAmounts.forEach((amt, idx) => {
      outSum += Math.abs(amt);
      if (isAtomDenom(tokenOutDenoms[idx])) atomVol += Math.abs(amt);
      if (isAtomOneDenom(tokenOutDenoms[idx])) oneVol += Math.abs(amt);
    });

    const netFlow = outSum - inSum;
    const date = new Date(timestamp).toISOString().split('T')[0];

    // Determine transaction type
    const allDenoms = [...tokenInDenoms, ...tokenOutDenoms].filter(Boolean);
    const hasAtom = allDenoms.some(d => isAtomDenom(d));
    const hasAtomOne = allDenoms.some(d => isAtomOneDenom(d));
    const isIBC = hasAtom && hasAtomOne; // Cross-chain movement
    const isStake = inSum === 0 || outSum === 0; // One-way transaction (potential staking/unstaking)
    const txVolume = inSum + outSum;

    const prev = aggMap.get(sender) || {
      sender,
      txCount: 0,
      totalVolume: 0,
      buyVolume: 0,
      sellVolume: 0,
      netFlowSum: 0,
      atomVolume: 0,
      oneVolume: 0,
      lastActive: 0,
      dayFlows: {},
      swapVolume: 0,
      ibcVolume: 0,
      stakeVolume: 0,
    };

    const updated: Aggregated = {
      ...prev,
      txCount: prev.txCount + 1,
      totalVolume: prev.totalVolume + txVolume,
      buyVolume: prev.buyVolume + Math.max(0, netFlow),
      sellVolume: prev.sellVolume + Math.max(0, -netFlow),
      netFlowSum: prev.netFlowSum + netFlow,
      atomVolume: prev.atomVolume + atomVol,
      oneVolume: prev.oneVolume + oneVol,
      lastActive: Math.max(prev.lastActive, timestamp),
      dayFlows: {
        ...prev.dayFlows,
        [date]: (prev.dayFlows[date] || 0) + netFlow,
      },
      swapVolume: prev.swapVolume + (isIBC || isStake ? 0 : txVolume),
      ibcVolume: prev.ibcVolume + (isIBC ? txVolume : 0),
      stakeVolume: prev.stakeVolume + (isStake && !isIBC ? txVolume : 0),
    };

    aggMap.set(sender, updated);
  }

  const aggregates = Array.from(aggMap.values());
  if (aggregates.length === 0) return [];

  const maxVol = Math.max(...aggregates.map((a) => a.totalVolume), 1);
  const maxTx = Math.max(...aggregates.map((a) => a.txCount), 1);

  const nodes: NodeData[] = aggregates.map((a) => {
    const netBuyRatioDenom = a.buyVolume + a.sellVolume || 1;
    const netBuyRatio = (a.buyVolume - a.sellVolume) / netBuyRatioDenom;
    const atomShare = a.totalVolume ? a.atomVolume / a.totalVolume : 0;
    const oneShare = a.totalVolume ? a.oneVolume / a.totalVolume : 0;
    // ATOM: atomShare가 oneShare보다 크고 0.5 이상
    // ATOMONE: oneShare가 atomShare보다 크고 0.5 이상
    // MIXED: 그 외
    const bias =
      atomShare > oneShare && atomShare >= 0.5 ? 'ATOM' 
      : oneShare > atomShare && oneShare >= 0.5 ? 'ATOMONE' 
      : 'MIXED';

    const scaleScore = Math.min(100, (a.totalVolume / maxVol) * 100);
    const timingScore = 50 + netBuyRatio * 40;
    
    // Calculate correlation: Use netBuyRatio variation over time
    // More realistic correlation based on consistency of trading pattern
    const dayFlowValues = Object.values(a.dayFlows);
    const flowMean = dayFlowValues.length > 0 
      ? dayFlowValues.reduce((sum, v) => sum + v, 0) / dayFlowValues.length 
      : 0;
    const flowVariance = dayFlowValues.length > 0
      ? dayFlowValues.reduce((sum, v) => sum + Math.pow(v - flowMean, 2), 0) / dayFlowValues.length
      : 0;
    const flowStdDev = Math.sqrt(flowVariance);
    // Correlation: -1 to 1, based on consistency (lower variance = higher correlation)
    // Also factor in netBuyRatio direction
    const consistency = flowStdDev > 0 ? Math.max(0, 1 - (flowStdDev / (Math.abs(flowMean) + 1))) : 0.5;
    const correlationScore = Math.max(-1, Math.min(1, netBuyRatio * consistency));
    
    const size = Math.min(
      100,
      Math.max(10, scaleScore * 0.5 + (a.txCount / maxTx) * 40 + Math.abs(correlationScore) * 10)
    );
    const roi = ((a.netFlowSum / 100) * 100); // 초기 100 코인 가정

    const history = Object.entries(a.dayFlows)
      .sort(([d1], [d2]) => (d1 < d2 ? -1 : 1))
      .map(([date, flow], i) => ({
        date,
        price: 1 + i * 0.02 + Math.abs(flow) * 0.0001,
        netFlow: flow,
      }));

    // Calculate composition percentages
    const totalComposition = a.swapVolume + a.ibcVolume + a.stakeVolume || a.totalVolume;
    const swapPct = totalComposition > 0 ? (a.swapVolume / totalComposition) * 100 : 100;
    const ibcPct = totalComposition > 0 ? (a.ibcVolume / totalComposition) * 100 : 0;
    const stakePct = totalComposition > 0 ? (a.stakeVolume / totalComposition) * 100 : 0;

    return {
      id: a.sender,
      name: a.sender,
      address: a.sender,
      size,
      bias,
      totalVolume: a.totalVolume,
      avgTradeSize: a.totalVolume / a.txCount,
      netBuyRatio,
      txCount: a.txCount,
      atomVolumeShare: atomShare,
      oneVolumeShare: oneShare,
      ibcVolumeShare: totalComposition > 0 ? a.ibcVolume / totalComposition : 0,
      activeDays: Object.keys(a.dayFlows).length,
      lastActiveDate: new Date(a.lastActive).toISOString(),
      timing: netBuyRatio > 0.1 ? 'LEADING' : netBuyRatio < -0.1 ? 'LAGGING' : 'SYNC',
      timingScore,
      correlationScore,
      scaleScore,
      roi,
      composition: {
        swap: Math.round(swapPct),
        ibc: Math.round(ibcPct),
        stake: Math.round(stakePct),
      },
      history,
      description: 'Derived from local swap CSV (no external API).',
    };
  });

  return nodes;
};

export const loadLocalMarket = (): { atom: MarketData; one: MarketData } => {
  const today = new Date();
  const history = Array.from({ length: 30 }).map((_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (29 - i));
    return { date: d.toISOString().split('T')[0], price: 1 + i * 0.01 };
  });
  const base: MarketData = {
    price: 1,
    change24h: 0,
    marketCap: 0,
    volume24h: 0,
    history,
  };
  return { atom: base, one: { ...base, price: 0.5, history: history.map((h) => ({ ...h, price: h.price * 0.5 })) } };
};

