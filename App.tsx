import React, { useState, useEffect, useMemo } from 'react';
import { Sidebar } from './components/Sidebar';
import { ImpactMap } from './components/ImpactMap';
import { AccountDetail } from './components/AccountDetail';
import { BacktestSummary } from './components/BacktestSummary';
import { AccountData, FilterState, SimulationResult, SimulationSlot } from './types';

// --- API Service Layer Simulation ---

// 1. CoinGecko API: For Historical Prices & Market Data
// Endpoint: /coins/{id}/market_chart/range
const fetchCoinGeckoMarketData = async (chain: string, days: number) => {
    // In real implementation: fetch(`https://api.coingecko.com/api/v3/coins/${chain}/market_chart/range...`)
    // Mocking response
    return Array.from({ length: days }, (_, d) => ({
        date: `2025-11-${d + 1}`,
        price: 10 + Math.random() * 5 + (d * 0.1),
    }));
};

// 2. Flipside Crypto SQL: For AII Score & Net Flow
// This would query Flipside's velocity database for aggregated metrics
const fetchFlipsideMetrics = async () => {
    // Mocking aggregations from SQL query
    const volumeScore = Math.floor(Math.random() * 100);
    const timingScore = Math.floor(Math.random() * 100);
    const correlationScore = parseFloat(((Math.random() * 2) - 1).toFixed(2));
    const aii = (volumeScore * 0.4) + (timingScore * 0.3) + (Math.abs(correlationScore * 100) * 0.3);
    
    return { volumeScore, timingScore, correlationScore, aii };
};

// 3. Cosmos LCD / Mintscan: For Chain specific tx data
// Endpoint: /cosmos/tx/v1beta1/txs
const fetchChainLCDData = async (address: string) => {
    // Mocking LCD response
    return {
        txCount: Math.floor(Math.random() * 500),
        activeDays: Math.floor(Math.random() * 30),
        totalVolume: Math.random() * 100000,
    };
};

// 4. Binance API: For Real-time backup price
// Endpoint: /api/v3/ticker/price
const fetchBinanceRealtime = async (symbol: string) => {
    // Mocking real-time ticker
    return { symbol, price: 12.50 };
};


// --- Data Aggregation Layer ---
const generateAggregatedData = async (): Promise<AccountData[]> => {
    const chains = ['ATOM', 'ATOMONE', 'DUAL'] as const;
    const promises = Array.from({ length: 100 }, async (_, i) => {
        const chain = chains[Math.floor(Math.random() * 3)];
        
        // Parallel fetching simulation
        const [marketData, metrics, chainData] = await Promise.all([
            fetchCoinGeckoMarketData(chain.toLowerCase(), 30),
            fetchFlipsideMetrics(),
            fetchChainLCDData(`cosmos1...${i}`)
        ]);

        // Combine Price History with random Net Flow (simulating Flipside+LCD merger)
        const priceHistory = marketData.map(md => ({
            ...md,
            netFlow: Math.random() > 0.5 ? Math.random() * 100 : Math.random() * -100
        }));

        const netFlowRatio = (Math.random() * 2) - 1;
        const roi = (Math.random() * 200) - 50;

        return {
            id: `acc-${i}`,
            name: `Account ${i} (${chain})`,
            address: `cosmos1...${i.toString(16)}`,
            chain,
            aii: metrics.aii,
            roi,
            netFlowRatio,
            totalVolume: chainData.totalVolume,
            avgTradeSize: chainData.totalVolume / (chainData.txCount || 1),
            txCount: chainData.txCount,
            activeDays: chainData.activeDays,
            lastActiveDate: '2025-11-30',
            volumeScore: metrics.volumeScore,
            timingScore: metrics.timingScore,
            correlationScore: metrics.correlationScore,
            atomShare: Math.random() * 100,
            atomOneShare: Math.random() * 100,
            ibcShare: Math.random() * 100,
            priceHistory,
            behavior: [
                { name: 'Swap', value: Math.floor(Math.random() * 60) + 20, color: '#818cf8' },
                { name: 'IBC', value: Math.floor(Math.random() * 30), color: '#f472b6' },
                { name: 'Stake', value: Math.floor(Math.random() * 20), color: '#fb923c' },
            ]
        };
    });

    return Promise.all(promises);
};


const INITIAL_SLOTS: SimulationSlot[] = [
    { id: 'A', account: null, weight: 50 },
    { id: 'B', account: null, weight: 30 },
    { id: 'C', account: null, weight: 20 },
];

const App: React.FC = () => {
  const [allData, setAllData] = useState<AccountData[]>([]);
  const [filteredData, setFilteredData] = useState<AccountData[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [slots, setSlots] = useState<SimulationSlot[]>(INITIAL_SLOTS);
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  // Load Data on Mount
  useEffect(() => {
      const initDashboard = async () => {
          const data = await generateAggregatedData();
          setAllData(data);
          setFilteredData(data);
      };
      initDashboard();
  }, []);

  const selectedAccount = useMemo(() => 
      allData.find(d => d.id === selectedId) || null
  , [allData, selectedId]);

  // Filter Logic
  const handleApplyFilters = (filters: FilterState) => {
      const filtered = allData.filter(d => {
          // Normalizing Mock Logic for Demo
          if (d.aii < filters.impactNetBuyRatio[0] || d.aii > filters.impactNetBuyRatio[1]) return false;
          if (d.correlationScore < filters.correlation[0] || d.correlationScore > filters.correlation[1]) return false;
          if (d.netFlowRatio < filters.netBuyRatio[0] || d.netFlowRatio > filters.netBuyRatio[1]) return false;
          // In real app, all filters would be applied here
          return true;
      });
      setFilteredData(filtered);
      
      // Deselect if filtered out
      if (selectedId && !filtered.find(d => d.id === selectedId)) {
          setSelectedId(null);
      }
  };

  const handleAssignSlot = (slotId: 'A' | 'B' | 'C') => {
      if (!selectedAccount) return;
      setSlots(prev => prev.map(s => 
          s.id === slotId ? { ...s, account: selectedAccount } : s
      ));
  };

  const handleRunSimulation = (capital: number, asset: string) => {
      setIsSimulating(true);
      setTimeout(() => {
          // Mock Simulation Calculation
          // Logic: Aggregate price histories of selected slots weighted by their allocation
          const totalPnL = capital * (Math.random() * 0.5); // Random positive PnL for demo
          const finalValue = capital + totalPnL;
          const roi = (totalPnL / capital) * 100;
          
          const history = Array.from({ length: 30 }, (_, i) => ({
              date: `Day ${i}`,
              value: capital + (totalPnL * (i / 30) * (1 + (Math.random() * 0.2 - 0.1))),
              benchmark: capital // Flat line for simple benchmark
          }));

          setSimulationResult({
              totalPnL,
              finalValue,
              roi,
              history
          });
          setIsSimulating(false);
      }, 1500);
  };

  const handleResetSimulation = () => {
      setSimulationResult(null);
  };

  return (
    <div className="flex h-screen w-screen p-6 gap-6 relative z-10 font-inter text-slate-200 overflow-hidden">
      
      {/* Left Sidebar */}
      <Sidebar onApply={handleApplyFilters} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col gap-6 overflow-hidden min-w-0">
        
        {/* Top Row: Map & Details */}
        <div className="flex-1 flex gap-6 min-h-0 min-w-0">
          {/* Middle Map */}
          <ImpactMap 
            data={filteredData} 
            selectedId={selectedId} 
            onSelect={setSelectedId} 
          />
          
          {/* Right Details */}
          <AccountDetail 
            account={selectedAccount} 
            onAssignSlot={handleAssignSlot} 
          />
        </div>

        {/* Bottom Row: Backtest & Simulation */}
        <BacktestSummary 
            slots={slots}
            setSlots={setSlots}
            onRunSimulation={handleRunSimulation}
            simulationResult={simulationResult}
            isSimulating={isSimulating}
            onResetSimulation={handleResetSimulation}
        />

      </div>
    </div>
  );
};

export default App;