import { SimulationResult, MarketData, SimulationConfig, NodeData } from '../types';

/**
 * Calculates the backtest simulation result based on coin quantity (not price).
 * Follows the specification document:
 * - Initial coin quantity C0 is divided by weights wA, wB, wC
 * - Each node's trading history is followed to calculate coin quantity changes
 * - Final coin quantity = sum of all slot final quantities
 * - Total PnL = Final coins - Initial coins
 * - ROI = (Total PnL / Initial coins) × 100
 */
export const calculateSimulation = (
  config: SimulationConfig,
  marketData: MarketData,
  baseDenom: 'ATOM' | 'ATOMONE'
): SimulationResult => {
  const { initialCapital, mode, slots } = config;
  
  // Validate inputs
  if (slots.every(s => !s.node)) {
    return { timeline: [], finalValue: 0, roi: 0, totalPnL: 0, slotSummaries: [] };
  }

  // Use marketData.history as the base timeline (it has the date range from filters)
  if (!marketData.history || marketData.history.length === 0) {
    return { timeline: [], finalValue: 0, roi: 0, totalPnL: 0, slotSummaries: [] };
  }

  const timelineLength = marketData.history.length;
  const dates = marketData.history.map(h => h.date);
  const firstPrice = marketData.history[0]?.price ?? 1;
  const lastPrice = marketData.history[timelineLength - 1]?.price ?? firstPrice;

  // 1. Simulate each slot independently
  // Each slot gets initial coins = C0 × weight
  const slotTimelines: { [key: string]: number[] } = {};
  
  const slotInitials: Record<string, number> = {};

  slots.forEach(slot => {
    if (slot.node) {
      const slotInitialCoins = initialCapital * (slot.weight / 100);
      slotInitials[slot.id] = slotInitialCoins;
      
      // Get node's history and align it with marketData.history dates
      const nodeHistory = slot.node.history || [];
      const nodeHistoryMap = new Map(nodeHistory.map(h => [h.date, h]));
      
      // Create aligned timeline based on marketData dates
      const alignedTimeline: number[] = [];
      let currentCoins = slotInitialCoins;
      
      if (mode === 'LONG_ONLY') {
        // Just hold coins
        alignedTimeline.push(...new Array(timelineLength).fill(slotInitialCoins));
      } else {
        // COPY_TRADING: follow the node's trading pattern
        for (let i = 0; i < timelineLength; i++) {
          const date = dates[i];
          const nodeEntry = nodeHistoryMap.get(date);
          
          if (nodeEntry) {
            // Apply netFlow to change coin quantity
            const netFlowStrength = Math.max(-0.4, Math.min(0.4, nodeEntry.netFlow ?? 0));
            const coinChange = currentCoins * netFlowStrength;
            currentCoins += coinChange;
            currentCoins = Math.max(0, currentCoins);
          }
          
          alignedTimeline.push(currentCoins);
        }
      }
      
      slotTimelines[slot.id] = alignedTimeline;
    } else {
      const slotInitialCoins = initialCapital * (slot.weight / 100);
      slotInitials[slot.id] = slotInitialCoins;
      slotTimelines[slot.id] = new Array(timelineLength).fill(slotInitialCoins);
    }
  });

  // 2. Combine results into a final portfolio timeline
  // Qfinal = QA0 × rA + QB0 × rB + QC0 × rC (sum of all slot coin quantities)
  const portfolioTimeline: {
    date: string;
    portfolioValue: number;
    benchmarkValue: number;
    slots: Record<string, number>;
  }[] = [];
  
  // Benchmark: simple buy-and-hold (coins remain unchanged - same as initial)
  const benchmarkCoins = initialCapital;

  for (let i = 0; i < timelineLength; i++) {
    const price = marketData.history[i]?.price ?? firstPrice;
    let dailyPortfolioCoins = 0;
    const slotSnapshot: Record<string, number> = {};
    
    // Sum coin quantities from all slots
    slots.forEach(slot => {
      if (slotTimelines[slot.id] && slotTimelines[slot.id][i] !== undefined) {
        const slotValue = slotTimelines[slot.id][i];
        dailyPortfolioCoins += slotValue;
        slotSnapshot[slot.id] = slotValue;
      } else {
        slotSnapshot[slot.id] = slotInitials[slot.id] || 0;
      }
    });

    // Benchmark tracks hold value using market price
    portfolioTimeline.push({
      date: dates[i] || `${i}`,
    portfolioCoins: dailyPortfolioCoins,
    portfolioValue: dailyPortfolioCoins * price,
    price,
    benchmarkCoins: benchmarkCoins,
      benchmarkValue: benchmarkCoins * price,
      slots: slotSnapshot
    });
  }
  
  if (portfolioTimeline.length === 0) {
     return { timeline: [], finalValue: 0, roi: 0, totalPnL: 0, slotSummaries: [] };
  }

  // 3. Calculate final metrics (all in coin quantity)
  const initialValue = initialCapital * firstPrice;
  const finalCoins = portfolioTimeline[portfolioTimeline.length - 1].portfolioCoins;
  const finalValue = portfolioTimeline[portfolioTimeline.length - 1].portfolioValue;
  const totalPnL = finalValue - initialValue;
  const coinPnL = finalCoins - initialCapital;
  const roi = initialValue === 0 ? 0 : (totalPnL / initialValue) * 100;

  const slotSummaries = slots.map(slot => {
    const slotTimeline = slotTimelines[slot.id] || [];
    const finalValue =
      slotTimeline.length > 0
        ? slotTimeline[slotTimeline.length - 1] * lastPrice
        : (slotInitials[slot.id] || 0) * lastPrice;
    const initialValueSlot = (slotInitials[slot.id] || 0) * firstPrice;
    return {
      id: slot.id,
      initialValue: initialValueSlot,
      finalValue,
      contribution: finalValue - initialValueSlot,
      label: slot.node?.name,
      address: slot.node?.address
    };
  });

  if (portfolioTimeline.length > 0) {
    const firstEntry = portfolioTimeline[0];
    const lastEntry = portfolioTimeline[portfolioTimeline.length - 1];
    console.debug(`[Simulation][${baseDenom}] Portfolio timeline`, {
      first: {
        date: firstEntry.date,
        coins: firstEntry.portfolioCoins,
        value: firstEntry.portfolioValue,
        price: firstEntry.price,
        slots: firstEntry.slots,
      },
      last: {
        date: lastEntry.date,
        coins: lastEntry.portfolioCoins,
        value: lastEntry.portfolioValue,
        price: lastEntry.price,
        slots: lastEntry.slots,
      },
    });
  }

  return {
    timeline: portfolioTimeline,
    finalCoins,
    finalValue,
    roi,
    coinPnL,
    totalPnL,
    slotSummaries
  };
};
