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
export const calculateSimulation = (config: SimulationConfig, marketData: MarketData): SimulationResult => {
  const { initialCapital, mode, slots } = config;
  
  // Validate inputs
  if (slots.every(s => !s.node)) {
    return { timeline: [], finalValue: 0, roi: 0, totalPnL: 0 };
  }

  // Use marketData.history as the base timeline (it has the date range from filters)
  if (!marketData.history || marketData.history.length === 0) {
    return { timeline: [], finalValue: 0, roi: 0, totalPnL: 0 };
  }

  const timelineLength = marketData.history.length;
  const dates = marketData.history.map(h => h.date);

  // 1. Simulate each slot independently
  // Each slot gets initial coins = C0 × weight
  const slotTimelines: { [key: string]: number[] } = {};
  
  slots.forEach(slot => {
    if (slot.node) {
      // QA0 = C0 × wA (initial coins allocated to this slot)
      const slotInitialCoins = initialCapital * (slot.weight / 100);
      
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
            const netFlowMultiplier = nodeEntry.netFlow * 0.1; // Scale down to reasonable trading amounts
            const coinChange = currentCoins * netFlowMultiplier;
            currentCoins += coinChange;
            currentCoins = Math.max(0, currentCoins);
          }
          
          alignedTimeline.push(currentCoins);
        }
      }
      
      slotTimelines[slot.id] = alignedTimeline;
    } else {
      // Empty slot: coins remain unchanged
      const slotInitialCoins = initialCapital * (slot.weight / 100);
      slotTimelines[slot.id] = new Array(timelineLength).fill(slotInitialCoins);
    }
  });

  // 2. Combine results into a final portfolio timeline
  // Qfinal = QA0 × rA + QB0 × rB + QC0 × rC (sum of all slot coin quantities)
  const portfolioTimeline: { date: string; portfolioValue: number; benchmarkValue: number }[] = [];
  
  // Benchmark: simple buy-and-hold (coins remain unchanged - same as initial)
  const benchmarkCoins = initialCapital;

  for (let i = 0; i < timelineLength; i++) {
    let dailyPortfolioCoins = 0;
    
    // Sum coin quantities from all slots
    slots.forEach(slot => {
      if (slotTimelines[slot.id] && slotTimelines[slot.id][i] !== undefined) {
        dailyPortfolioCoins += slotTimelines[slot.id][i];
      }
    });

    // Benchmark is also in coin quantity (buy-and-hold = coins stay the same)
    portfolioTimeline.push({
      date: dates[i] || `${i}`,
      portfolioValue: dailyPortfolioCoins, // Coin quantity
      benchmarkValue: benchmarkCoins // Coin quantity (unchanged in buy-and-hold)
    });
  }
  
  if (portfolioTimeline.length === 0) {
     return { timeline: [], finalValue: 0, roi: 0, totalPnL: 0 };
  }

  // 3. Calculate final metrics (all in coin quantity)
  const finalCoins = portfolioTimeline[portfolioTimeline.length - 1].portfolioValue;
  const totalPnL = finalCoins - initialCapital; // Coin quantity difference
  const roi = (totalPnL / initialCapital) * 100; // Percentage

  return {
    timeline: portfolioTimeline,
    finalValue: finalCoins, // Final coin quantity
    roi,
    totalPnL
  };
};
