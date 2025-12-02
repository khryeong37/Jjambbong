import React, { useRef, useState, useCallback, useEffect } from 'react';

interface WeightSliderProps {
    weights: [number, number, number]; // A, B, C percentages, sum to 100
    onChange: (newWeights: [number, number, number]) => void;
    disabled?: boolean;
}

export const WeightSlider: React.FC<WeightSliderProps> = ({ weights, onChange, disabled }) => {
    const trackRef = useRef<HTMLDivElement>(null);
    const [dragging, setDragging] = useState<number | null>(null);

    // H1 represents the split between A and B (value is weight A)
    // H2 represents the split between B and C (value is weight A + weight B)
    const h1 = weights[0];
    const h2 = weights[0] + weights[1];

    const handleMouseDown = (index: number) => (e: React.MouseEvent) => {
        if (disabled) return;
        setDragging(index);
        e.preventDefault();
        e.stopPropagation();
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (dragging === null || !trackRef.current) return;

        const rect = trackRef.current.getBoundingClientRect();
        // Calculate position from bottom (since we want A at bottom)
        const clientY = e.clientY;
        const offsetY = rect.bottom - clientY;
        let percent = (offsetY / rect.height) * 100;
        percent = Math.max(0, Math.min(100, percent));

        const newWeights: [number, number, number] = [...weights];

        if (dragging === 1) {
            // Dragging H1 (Split A/B)
            // Constraints: 0 <= H1 <= H2
            const newH1 = Math.min(Math.max(0, percent), h2);
            newWeights[0] = newH1;
            newWeights[1] = h2 - newH1;
        } else if (dragging === 2) {
            // Dragging H2 (Split B/C)
            // Constraints: H1 <= H2 <= 100
            const newH2 = Math.min(Math.max(h1, percent), 100);
            newWeights[1] = newH2 - h1;
            newWeights[2] = 100 - newH2;
        }

        // Round to integer to keep UI clean
        newWeights[0] = Math.round(newWeights[0]);
        newWeights[1] = Math.round(newWeights[1]);
        newWeights[2] = 100 - newWeights[0] - newWeights[1];

        onChange(newWeights);
    }, [dragging, weights, onChange, h1, h2]);

    const handleMouseUp = useCallback(() => {
        setDragging(null);
    }, []);

    useEffect(() => {
        if (dragging !== null) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [dragging, handleMouseMove, handleMouseUp]);

    return (
        <div className={`relative h-full w-2.5 mx-auto ${disabled ? 'opacity-50' : ''}`}>
            {/* Track Background */}
            <div ref={trackRef} className="absolute inset-0 bg-slate-800 rounded-full w-full border border-white/10 shadow-inner">
                {/* Slot A (Bottom) */}
                <div 
                    className="absolute bottom-0 w-full bg-indigo-500 rounded-b-full transition-all duration-75 shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                    style={{ height: `${h1}%` }}
                />
                {/* Slot B (Middle) */}
                <div 
                    className="absolute w-full bg-pink-500 transition-all duration-75 shadow-[0_0_10px_rgba(236,72,153,0.5)]"
                    style={{ bottom: `${h1}%`, height: `${weights[1]}%` }}
                />
                {/* Slot C (Top) */}
                <div 
                    className="absolute top-0 w-full bg-emerald-500 rounded-t-full transition-all duration-75 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                    style={{ height: `${weights[2]}%` }}
                />
            </div>

            {/* Handle 1 (A/B) */}
            <div 
                className={`absolute w-5 h-5 bg-white border-2 border-slate-900 rounded-full -left-1.5 shadow-[0_0_10px_rgba(255,255,255,0.5)] flex items-center justify-center cursor-row-resize z-10 hover:scale-110 transition-transform ${disabled ? 'cursor-not-allowed hidden' : ''}`}
                style={{ bottom: `${h1}%`, transform: 'translateY(50%)' }}
                onMouseDown={handleMouseDown(1)}
            >
               <div className="w-1 h-1 bg-slate-900 rounded-full"></div>
            </div>
             {/* Handle Label 1 */}
             {!disabled && (
                 <div className="absolute left-5 text-[10px] font-bold text-slate-400 pointer-events-none drop-shadow-md" style={{ bottom: `${h1}%`, transform: 'translateY(50%)' }}>
                     {Math.round(h1)}%
                 </div>
             )}

            {/* Handle 2 (B/C) */}
            <div 
                className={`absolute w-5 h-5 bg-white border-2 border-slate-900 rounded-full -left-1.5 shadow-[0_0_10px_rgba(255,255,255,0.5)] flex items-center justify-center cursor-row-resize z-10 hover:scale-110 transition-transform ${disabled ? 'cursor-not-allowed hidden' : ''}`}
                style={{ bottom: `${h2}%`, transform: 'translateY(50%)' }}
                onMouseDown={handleMouseDown(2)}
            >
                 <div className="w-1 h-1 bg-slate-900 rounded-full"></div>
            </div>
             {/* Handle Label 2 */}
             {!disabled && (
                <div className="absolute left-5 text-[10px] font-bold text-slate-400 pointer-events-none drop-shadow-md" style={{ bottom: `${h2}%`, transform: 'translateY(50%)' }}>
                    {Math.round(h2)}%
                </div>
            )}
        </div>
    );
};