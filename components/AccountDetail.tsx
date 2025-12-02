import React from 'react';
import { 
    BarChart, Bar, Line, ComposedChart, ResponsiveContainer, Cell, 
    PieChart, Pie, Tooltip as RechartsTooltip
} from 'recharts';
import { GlassCard } from './GlassCard';
import { AccountData, SimulationSlot } from '../types';
import { Info, HelpCircle } from 'lucide-react';

interface AccountDetailProps {
    account: AccountData | null;
    onAssignSlot: (slotId: 'A' | 'B' | 'C') => void;
}

export const AccountDetail: React.FC<AccountDetailProps> = ({ account, onAssignSlot }) => {
    if (!account) {
        return (
            <GlassCard className="w-80 shrink-0 flex flex-col items-center justify-center text-slate-400 gap-4" padding="p-5">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center border border-white/10 animate-pulse">
                    <Info size={32} className="text-white/20" />
                </div>
                <p className="text-sm font-light tracking-wide">Select a node to analyze</p>
            </GlassCard>
        );
    }

    const priceData = account.priceHistory;
    const behaviorData = account.behavior;

    const getChainColor = (chain: string) => {
        if (chain === 'ATOM') return 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.4)]';
        if (chain === 'ATOMONE') return 'bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.4)]';
        return 'bg-purple-500 shadow-[0_0_12px_rgba(168,85,247,0.4)]';
    };

    return (
        <GlassCard className="w-80 shrink-0 flex flex-col gap-4 overflow-y-auto custom-scrollbar h-full border-l border-white/5" padding="p-5">
            {/* Header */}
            <div className="text-center mb-1">
                <p className="text-[10px] text-slate-400 font-bold tracking-[0.2em] mb-2 uppercase" style={{ fontFamily: 'Space Grotesk' }}>Selected Account</p>
                <div className="flex flex-col items-center">
                    <div className="flex items-center gap-2 mb-2">
                        <h2 className="text-xl font-bold text-white truncate max-w-[200px]" style={{ textShadow: '0 0 20px rgba(255,255,255,0.3)' }}>{account.name}</h2>
                        <span className={`${getChainColor(account.chain)} text-white text-[9px] px-2 py-0.5 rounded-full font-bold tracking-wider`}>
                            {account.chain}
                        </span>
                    </div>
                    <div className="flex gap-2 text-[10px]">
                        <span className="bg-white/10 border border-white/5 px-2 py-1 rounded text-slate-300">AII: {Math.round(account.aii)}</span>
                        <span className={`px-2 py-1 rounded font-bold border ${account.roi >= 0 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
                            ROI: {account.roi >= 0 ? '+' : ''}{account.roi.toFixed(1)}%
                        </span>
                    </div>
                </div>
            </div>

            {/* Price vs Net Flow Chart */}
            <div className="bg-[#0f172a]/50 rounded-2xl p-4 border border-white/5">
                <div className="flex justify-between items-center mb-3">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Price VS Net Flow</h4>
                    <HelpCircle size={10} className="text-slate-600" />
                </div>
                <div className="h-24 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={priceData}>
                            <Bar dataKey="netFlow" barSize={3}>
                                {priceData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.netFlow > 0 ? '#ef4444' : '#3b82f6'} fillOpacity={0.8} />
                                ))}
                            </Bar>
                            <Line type="monotone" dataKey="price" stroke="#fb923c" dot={false} strokeWidth={2} strokeOpacity={0.8} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* On-Chain Behavior Chart */}
            <div className="bg-[#0f172a]/50 rounded-2xl p-4 border border-white/5 flex items-center justify-between">
                <div className="relative h-20 w-20 shrink-0">
                     <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={behaviorData}
                                cx="50%"
                                cy="50%"
                                innerRadius={22}
                                outerRadius={34}
                                paddingAngle={4}
                                dataKey="value"
                                stroke="none"
                            >
                                {behaviorData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none flex-col">
                        <span className="text-[8px] text-slate-500">Main</span>
                        <span className="text-[10px] font-bold text-slate-200">{behaviorData[0].name}</span>
                    </div>
                </div>
                <div className="flex-1 pl-4 min-w-0">
                    <div className="flex justify-between items-center mb-2">
                         <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">On-Chain</h4>
                    </div>
                    <ul className="text-[9px] space-y-1.5 text-slate-300 font-medium">
                        {behaviorData.map((item) => (
                            <li key={item.name} className="flex items-center justify-between">
                                <span className="flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full shrink-0 shadow-[0_0_5px_currentColor]" style={{ backgroundColor: item.color, color: item.color }}></span>
                                    {item.name}
                                </span>
                                <span className="text-white/80">{item.value}%</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            {/* AI Impact Analysis */}
            <div className="bg-[#0f172a]/50 rounded-2xl p-4 border border-white/5">
                <div className="flex justify-between items-center mb-3">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">AI Impact Score</h4>
                </div>
                <div className="flex justify-between gap-2 mb-3">
                    <div className="flex-1 bg-white/5 border border-white/5 rounded-lg p-2 text-center hover:bg-white/10 transition-colors">
                        <p className="text-[8px] text-slate-500 mb-1 uppercase">Volume</p>
                        <p className="text-sm font-bold text-indigo-300 leading-none">{account.volumeScore}</p>
                    </div>
                    <div className="flex-1 bg-white/5 border border-white/5 rounded-lg p-2 text-center hover:bg-white/10 transition-colors">
                        <p className="text-[8px] text-slate-500 mb-1 uppercase">Timing</p>
                        <p className="text-sm font-bold text-indigo-300 leading-none">{account.timingScore}</p>
                    </div>
                     <div className="flex-1 bg-white/5 border border-white/5 rounded-lg p-2 text-center hover:bg-white/10 transition-colors">
                        <p className="text-[8px] text-slate-500 mb-1 uppercase">Corr.</p>
                        <p className="text-sm font-bold text-indigo-300 leading-none">{account.correlationScore > 0 ? '+' : ''}{account.correlationScore}</p>
                    </div>
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed bg-white/5 p-3 rounded-xl border border-white/5 italic">
                    "This account shows strong <span className="text-indigo-300 font-medium">{account.volumeScore > 70 ? 'volume' : 'timing'}</span> with {account.behavior[0].name.toLowerCase()} preference. 
                    Correlation of {account.correlationScore} suggests {account.correlationScore > 0 ? 'market alignment' : 'contrarian moves'}."
                </p>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-3 gap-2 mt-auto">
                {(['A', 'B', 'C'] as const).map((slot) => (
                    <button 
                        key={slot} 
                        onClick={() => onAssignSlot(slot)}
                        className="bg-white/5 hover:bg-indigo-500/20 border border-white/10 hover:border-indigo-500/50 rounded-xl py-2.5 flex flex-col items-center justify-center transition-all group active:scale-95"
                    >
                        <span className="text-[8px] text-slate-500 group-hover:text-indigo-300 mb-0.5 uppercase tracking-wide">add to</span>
                        <span className="text-sm font-bold text-slate-300 group-hover:text-white">Slot {slot}</span>
                    </button>
                ))}
            </div>

        </GlassCard>
    );
};