import { SimulationResult, MarketData, SimulationConfig, NodeData } from '../types';

// This function simulates a single node's trading strategy.
// It uses the node's properties to create a deterministic "trading signal".
const simulateSingleNodeStrategy = (node: NodeData, initialCapital: number, marketHistory: { date: string; price: number }[], mode: 'LONG_ONLY' | 'COPY_TRADING') => {
  let holdings = initialCapital / marketHistory[0].price; // Start by buying with all capital
  let cash = 0;
  const valueTimeline = [];

  // Create a deterministic "alpha" or signal generator for this node
  const nodeSeed = node.id.charCodeAt(5) || 1; // Use a char from the id as a seed

  for (let i = 0; i < marketHistory.length; i++) {
    const todayPrice = marketHistory[i].price;
    const yesterdayPrice = i > 0 ? marketHistory[i - 1].price : todayPrice;
    const priceChange = (todayPrice - yesterdayPrice) / yesterdayPrice;

    // --- Trading Signal Logic ---
    // A simple deterministic signal based on day index, node's seed, and correlation
    // This creates a unique but repeatable trading pattern for each node.
    const signal = Math.sin(i * 0.5 + nodeSeed + (node.correlationScore * 5));

    if (mode === 'COPY_TRADING') {
      // Buy when signal is strongly positive and price is dipping/stable
      if (signal > 0.7 && priceChange < 0.01 && cash > 1) {
        const investment = cash * 0.5; // Invest 50% of cash
        holdings += investment / todayPrice;
        cash -= investment;
      }
      // Sell when signal is strongly negative and price is rising/stable
      else if (signal < -0.7 && priceChange > -0.01 && holdings > 0.1) {
        const divestment = holdings * 0.5; // Sell 50% of holdings
        cash += divestment * todayPrice;
        holdings -= divestment;
      }
    }
    // In 'LONG_ONLY' mode, we do nothing but hold.

    const portfolioValue = cash + holdings * todayPrice;
    valueTimeline.push(portfolioValue);
  }
  return valueTimeline;
};


export const calculateSimulation = (config: SimulationConfig, marketData: MarketData): SimulationResult => {
  const { initialCapital, mode, slots } = config;
  const history = marketData.history;
  
  if (!history || history.length === 0 || slots.every(s => !s.node)) {
    return { timeline: [], finalValue: 0, roi: 0, totalPnL: 0 };
  }

  // 1. Simulate each slot independently
  const slotTimelines: { [key: string]: number[] } = {};
  slots.forEach(slot => {
    if (slot.node) {
      const slotInitialCapital = initialCapital * (slot.weight / 100);
      slotTimelines[slot.id] = simulateSingleNodeStrategy(slot.node, slotInitialCapital, history, mode);
    }
  });

  // 2. Combine results into a final portfolio timeline
  const portfolioTimeline: { date: string; portfolioValue: number; benchmarkValue: number }[] = [];
  const initialPrice = history[0].price;

  for (let i = 0; i < history.length; i++) {
    let dailyPortfolioValue = 0;
    
    // Sum the weighted values from each active slot's simulation
    slots.forEach(slot => {
      if (slot.node && slotTimelines[slot.id]) {
        dailyPortfolioValue += slotTimelines[slot.id][i];
      } else {
        // For empty slots, the capital just sits there (value doesn't change)
        dailyPortfolioValue += initialCapital * (slot.weight / 100);
      }
    });

    portfolioTimeline.push({
      date: history[i].date,
      portfolioValue: dailyPortfolioValue,
      // Benchmark is a simple buy-and-hold of the initial capital
      benchmarkValue: (initialCapital / initialPrice) * history[i].price
    });
  }
  
  if (portfolioTimeline.length === 0) {
     return { timeline: [], finalValue: 0, roi: 0, totalPnL: 0 };
  }

  // 3. Calculate final metrics
  const finalValue = portfolioTimeline[portfolioTimeline.length - 1].portfolioValue;
  const startValue = portfolioTimeline[0].portfolioValue; // Should be very close to initialCapital
  const totalPnL = finalValue - initialCapital;
  const roi = (totalPnL / initialCapital) * 100;

  return {
    timeline: portfolioTimeline,
    finalValue,
    roi,
    totalPnL
  };
};
