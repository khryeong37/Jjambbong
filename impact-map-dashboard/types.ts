export interface ChartData {
    name: string;
    value: number;
    value2?: number;
}

export interface SidebarSectionProps {
    title: string;
    isOpen: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}

export interface DualSliderProps {
    min: number;
    max: number;
    values: [number, number];
    onChange: (newValues: [number, number]) => void;
    formatLabel?: (val: number) => string;
    step?: number;
    disabled?: boolean;
}

export enum ImpactStatus {
    Leading = 'Leading',
    Sync = 'Sync',
    Lagging = 'Lagging',
    All = 'All'
}

export interface AccountData {
    id: string;
    name: string;
    address: string;
    chain: 'ATOM' | 'ATOMONE' | 'DUAL';
    aii: number; // 0-100
    roi: number; // percentage
    netFlowRatio: number; // -1.0 to 1.0
    totalVolume: number;
    avgTradeSize: number;
    txCount: number;
    activeDays: number;
    lastActiveDate: string;
    
    // Scores
    volumeScore: number;
    timingScore: number;
    correlationScore: number;
    
    // Shares
    atomShare: number;
    atomOneShare: number;
    ibcShare: number;

    // Simulation Data (Mock)
    priceHistory: {date: string, price: number, netFlow: number}[];
    behavior: { name: string; value: number; color: string }[];
}

export interface SimulationSlot {
    id: 'A' | 'B' | 'C';
    account: AccountData | null;
    weight: number; // Percentage 0-100
}

export interface FilterState {
    timeRange: 'Last 3D' | 'Last 7D' | 'Last 30D' | 'All Time';
    
    // Scale
    totalVolume: [number, number];
    avgTradeSize: [number, number];
    
    // Behavior
    netBuyRatio: [number, number];
    txFrequency: [number, number];
    
    // Mobility
    atomShare: [number, number];
    atomOneShare: [number, number];
    ibcShare: [number, number];
    
    // Activity
    activeDays: [number, number];
    recentActivity: 'Last 3D' | 'Last 7D' | 'Last 30D' | 'All Time';
    
    // Impact
    impactNetBuyRatio: [number, number];
    timingProfile: ImpactStatus;
    correlation: [number, number];
}

export interface SimulationResult {
    totalPnL: number;
    roi: number;
    finalValue: number;
    history: {date: string, value: number, benchmark: number}[];
}