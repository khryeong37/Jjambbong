import React, { useRef, useState, useCallback, useEffect } from 'react';
import { DualSliderProps } from '../types';

export const RangeSlider: React.FC<DualSliderProps> = ({ 
    min, 
    max, 
    values, 
    onChange, 
    step = 1 
}) => {
    const trackRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState<'min' | 'max' | null>(null);

    const getPercent = useCallback((value: number) => {
        return Math.round(((value - min) / (max - min)) * 100);
    }, [min, max]);

    const handleMouseDown = (handle: 'min' | 'max') => (e: React.MouseEvent) => {
        setIsDragging(handle);
        e.preventDefault();
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging || !trackRef.current) return;

        const rect = trackRef.current.getBoundingClientRect();
        const clientX = e.clientX;
        
        // Calculate percentage clicked
        let percent = (clientX - rect.left) / rect.width;
        percent = Math.max(0, Math.min(1, percent));
        
        // Calculate value based on step
        const rawValue = min + percent * (max - min);
        const steppedValue = Math.round(rawValue / step) * step;
        
        const newValues: [number, number] = [...values];
        
        if (isDragging === 'min') {
            const newVal = Math.min(steppedValue, values[1] - step);
            newValues[0] = Math.max(min, newVal);
        } else {
            const newVal = Math.max(steppedValue, values[0] + step);
            newValues[1] = Math.min(max, newVal);
        }

        onChange(newValues);
    }, [isDragging, min, max, step, values, onChange]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(null);
    }, []);

    useEffect(() => {
        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        } else {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        }
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, handleMouseMove, handleMouseUp]);

    const minPercent = getPercent(values[0]);
    const maxPercent = getPercent(values[1]);

    return (
        <div className="relative w-full h-8 flex items-center select-none">
            <div ref={trackRef} className="range-slider-track">
                <div 
                    className="range-slider-range"
                    style={{ 
                        left: `${minPercent}%`, 
                        width: `${maxPercent - minPercent}%` 
                    }}
                />
            </div>
            
            {/* Left Handle */}
            <div 
                className="range-handle"
                style={{ left: `${minPercent}%` }}
                onMouseDown={handleMouseDown('min')}
            />

            {/* Right Handle */}
            <div 
                className="range-handle"
                style={{ left: `${maxPercent}%` }}
                onMouseDown={handleMouseDown('max')}
            />
        </div>
    );
};