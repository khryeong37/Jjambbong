import React, { useRef, useState, useEffect, useCallback } from 'react';

interface GelSliderProps {
  min: number;
  max: number;
  value: number | [number, number];
  onChange: (value: number | [number, number]) => void;
  isDual?: boolean;
}

const GelSlider: React.FC<GelSliderProps> = ({ min, max, value, onChange, isDual = false }) => {
  const sliderRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<'min' | 'max' | 'single' | null>(null);
  const [hoveredHandle, setHoveredHandle] = useState<'min' | 'max' | 'single' | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);

  const getPercentage = useCallback((val: number) => ((val - min) / (max - min)) * 100, [min, max]);

  const handleInteraction = useCallback((clientX: number) => {
    if (!dragging || !sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    if (rect.width === 0) return;
    
    const percent = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const step = (max - min) > 10 ? 1 : 0.1;
    const rawValue = min + (percent / 100) * (max - min);
    const newValue = Math.round(rawValue / step) * step;

    // Throttle updates to 60fps
    const now = performance.now();
    if (now - lastUpdateRef.current < 16) {
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          lastUpdateRef.current = performance.now();
          
          if (isDual && Array.isArray(value)) {
            const [currentMin, currentMax] = value;
            if (dragging === 'min') {
              onChange([Math.min(newValue, currentMax), currentMax]);
            } else {
              onChange([currentMin, Math.max(newValue, currentMin)]);
            }
          } else {
            onChange(newValue);
          }
        });
      }
      return;
    }
    
    lastUpdateRef.current = now;

    if (isDual && Array.isArray(value)) {
      const [currentMin, currentMax] = value;
      if (dragging === 'min') {
        onChange([Math.min(newValue, currentMax), currentMax]);
      } else {
        onChange([currentMin, Math.max(newValue, currentMin)]);
      }
    } else {
      onChange(newValue);
    }
  }, [dragging, min, max, isDual, value, onChange]);
  
  const handleMouseUp = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setDragging(null);
  }, []);
  
  const handleMouseMove = useCallback((e: MouseEvent) => handleInteraction(e.clientX), [handleInteraction]);
  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (e.touches[0]) handleInteraction(e.touches[0].clientX);
  }, [handleInteraction]);
  
  const handleMouseDown = useCallback((type: 'min' | 'max' | 'single', e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(type);
  }, []);
  
  const handleTouchStart = useCallback((type: 'min' | 'max' | 'single', e: React.TouchEvent) => {
    e.preventDefault();
    setDragging(type);
  }, []);

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove, { passive: false });
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [dragging, handleMouseMove, handleMouseUp, handleTouchMove]);


  const rangeStart = isDual && Array.isArray(value) ? getPercentage(value[0]) : 0;
  const rangeEnd = isDual && Array.isArray(value) ? getPercentage(value[1]) : getPercentage(value as number);

  // Clean container style - Modern glass track
  const containerStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    padding: '0',
    height: '6px',
    borderRadius: '99vw',
    background: 'linear-gradient(to bottom, rgba(226, 232, 240, 0.8), rgba(241, 245, 249, 0.6))',
    border: '1px solid rgba(203, 213, 225, 0.6)',
    boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.06)',
    overflow: 'visible'
  } as React.CSSProperties;

  const sliderBaseStyle: React.CSSProperties = {
    position: 'relative',
    height: '100%',
    margin: '0',
    background: 'transparent',
    width: '100%'
  };
  
  // Dynamic border radius: round left if not at start, round right if not at end
  const borderRadiusLeft = rangeStart > 0.1 ? '0.4em' : '0';
  const borderRadiusRight = rangeEnd < 99.9 ? '0.4em' : '0';
  const borderRadius = `${borderRadiusLeft} ${borderRadiusRight} ${borderRadiusRight} ${borderRadiusLeft}`;
  
  const rangeBarStyle: React.CSSProperties = {
    height: '100%',
    borderRadius: borderRadius,
    position: 'absolute',
    left: `${rangeStart}%`,
    width: `${rangeEnd - rangeStart}%`,
    background: dragging 
        ? 'linear-gradient(90deg, #34d399 0%, #6ee7b7 50%, #34d399 100%)'
        : 'linear-gradient(90deg, #34d399 0%, #6ee7b7 100%)',
    backgroundSize: dragging ? '200% 100%' : '100% 100%',
    border: 'none',
    boxShadow: dragging
      ? '0 0 12px rgba(52, 211, 153, 0.5), 0 0 24px rgba(110, 231, 183, 0.3)'
      : '0 1px 4px rgba(16, 185, 129, 0.3)',
    transition: dragging ? 'none' : 'left 0.15s ease-out, width 0.15s ease-out, box-shadow 0.2s ease',
    animation: dragging ? 'shimmer 2s ease-in-out infinite' : 'none',
    willChange: dragging ? 'left, width' : 'auto',
  } as React.CSSProperties;

  const rangeBarBeforeStyle: React.CSSProperties = {
    content: '""', position: 'absolute', inset: '0', zIndex: -2,
    background: 'transparent',
    borderRadius: borderRadius,
    transition: 'all 0.2s'
  };
  
  const rangeBarAfterStyle: React.CSSProperties = {
    content: '""', position: 'absolute', inset: '0em',
    background: 'transparent',
    borderRadius: borderRadius,
  };

  const handleStyle: React.CSSProperties = {
    width: '16px', 
    height: '16px',
    position: 'absolute', 
    top: '50%',
    transform: 'translate(-50%, -50%)',
    cursor: 'grab', 
    zIndex: 10,
    transition: dragging ? 'none' : 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
    willChange: dragging ? 'transform, left' : 'auto',
  };

  // Enhanced knob style with interactive effects
  const isHandleActive = (handleType: 'min' | 'max' | 'single') => {
    return dragging === handleType || hoveredHandle === handleType;
  };
  
  const getNubStyle = (handleType: 'min' | 'max' | 'single'): React.CSSProperties => {
    const isActive = isHandleActive(handleType);
    const baseStyle: React.CSSProperties = {
      width: '100%', 
      height: '100%', 
      borderRadius: '50%',
      background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
      border: isActive
        ? '2px solid #34d399'
        : '2px solid rgba(203, 213, 225, 0.8)',
      boxShadow: isActive
        ? `0 0 0 4px rgba(52, 211, 153, 0.15), 0 2px 8px rgba(0, 0, 0, 0.15)`
        : '0 2px 6px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)',
      transform: isActive ? 'scale(1.15)' : 'scale(1)',
      transition: dragging ? 'none' : 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
      willChange: dragging || isActive ? 'transform' : 'auto',
      cursor: dragging === handleType ? 'grabbing' : 'grab',
    };
    return baseStyle;
  };

  return (
    <>
      <style>{`
        @keyframes shimmer {
          0% { 
            background-position: -200% 0; 
          }
          100% { 
            background-position: 200% 0; 
          }
        }
      `}</style>
      <div style={containerStyle} className="transition-all duration-300">
      <div style={sliderBaseStyle} ref={sliderRef}>
        <div style={rangeBarStyle}>
          <div style={rangeBarBeforeStyle}></div>
          <div style={rangeBarAfterStyle}></div>
        </div>
          
        {isDual && Array.isArray(value) ? (
          <>
              <div 
                style={{ ...handleStyle, left: `${rangeStart}%`, transform: 'translate(-50%, -50%)' }} 
                onMouseDown={(e) => handleMouseDown('min', e)} 
                onTouchStart={(e) => handleTouchStart('min', e)}
                onMouseEnter={() => setHoveredHandle('min')}
                onMouseLeave={() => setHoveredHandle(null)}
                className="group"
              >
                <div style={getNubStyle('min')}></div>
            </div>
              <div 
                style={{ ...handleStyle, left: `${rangeEnd}%`, transform: 'translate(-50%, -50%)' }} 
                onMouseDown={(e) => handleMouseDown('max', e)} 
                onTouchStart={(e) => handleTouchStart('max', e)}
                onMouseEnter={() => setHoveredHandle('max')}
                onMouseLeave={() => setHoveredHandle(null)}
                className="group"
              >
                <div style={getNubStyle('max')}></div>
            </div>
          </>
        ) : (
            <div 
              style={{ ...handleStyle, left: `${rangeEnd}%`, transform: 'translate(-50%, -50%)' }} 
              onMouseDown={(e) => handleMouseDown('single', e)} 
              onTouchStart={(e) => handleTouchStart('single', e)}
              onMouseEnter={() => setHoveredHandle('single')}
              onMouseLeave={() => setHoveredHandle(null)}
              className="group"
            >
              <div style={getNubStyle('single')}></div>
          </div>
        )}
      </div>
    </div>
    </>
  );
};

export default GelSlider;