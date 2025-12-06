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
  const [isDark, setIsDark] = useState(false);

  const getPercentage = useCallback((val: number) => ((val - min) / (max - min)) * 100, [min, max]);

  const handleInteraction = (clientX: number) => {
    if (!dragging || !sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    if (rect.width === 0) return;
    const percent = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const step = (max - min) > 10 ? 1 : 0.1; // Smaller step for ranges like -1 to 1
    const rawValue = min + (percent / 100) * (max - min);
    const newValue = Math.round(rawValue / step) * step;


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
  };
  
  const handleMouseUp = () => setDragging(null);
  const handleMouseMove = (e: MouseEvent) => handleInteraction(e.clientX);
  const handleTouchMove = (e: TouchEvent) => handleInteraction(e.touches[0].clientX);

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging]);

  useEffect(() => {
    const checkDarkMode = () => {
      const isDarkMode = document.documentElement.classList.contains('dark');
      setIsDark(isDarkMode);
    };
    checkDarkMode();
    const observer = new MutationObserver(() => {
      checkDarkMode();
    });
    observer.observe(document.documentElement, { 
      attributes: true, 
      attributeFilter: ['class'],
      subtree: false
    });
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleMediaChange = () => checkDarkMode();
    mediaQuery.addEventListener('change', handleMediaChange);
    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener('change', handleMediaChange);
    };
  }, []);

  const rangeStart = isDual && Array.isArray(value) ? getPercentage(value[0]) : 0;
  const rangeEnd = isDual && Array.isArray(value) ? getPercentage(value[1]) : getPercentage(value as number);

  // Clean container style
  const containerStyle: React.CSSProperties = {
    '--range-handle-border': 'oklch(0.3 0.01 212 / 0.5)',
    position: 'relative',
    width: '100%',
    padding: '0',
    height: '0.5em',
    borderRadius: '99vw',
    background: isDark 
      ? '#1e293b'
      : '#e5e7eb',
    border: isDark 
      ? '1px solid rgba(148, 163, 184, 0.2)'
      : '1px solid rgba(209, 213, 219, 0.5)',
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
    '--range-size': rangeEnd - rangeStart,
    '--slider-length': sliderRef.current?.clientWidth ?? 0,
    height: '100%',
    borderRadius: borderRadius,
    position: 'absolute',
    left: `${rangeStart}%`,
    width: `${rangeEnd - rangeStart}%`,
    background: isDark
      ? '#6ee7b7'
      : '#6ee7b7',
    border: 'none',
    boxShadow: 'none'
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
    width: '1.1em', height: '1.1em',
    position: 'absolute', top: '50%',
    transform: 'translate(-50%, -50%)',
    cursor: 'pointer', zIndex: 10,
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
  };

  // Clean knob style - 하얀색 단순 스타일
  const nubStyle: React.CSSProperties = isDark ? {
    width: '100%', height: '100%', borderRadius: '50%',
    background: '#ffffff',
    border: '1px solid rgba(148, 163, 184, 0.3)',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2)',
  } : {
    width: '100%', height: '100%', borderRadius: '50%',
    background: '#ffffff',
    border: '1px solid rgba(209, 213, 219, 0.8)',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15), 0 1px 2px rgba(0, 0, 0, 0.1)',
  };

  return (
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
              onMouseDown={() => setDragging('min')} 
              onTouchStart={() => setDragging('min')}
              className="group"
            >
              <div style={nubStyle} className="transition-all duration-200 group-hover:scale-110 group-active:scale-95"></div>
            </div>
            <div 
              style={{ ...handleStyle, left: `${rangeEnd}%`, transform: 'translate(-50%, -50%)' }} 
              onMouseDown={() => setDragging('max')} 
              onTouchStart={() => setDragging('max')}
              className="group"
            >
              <div style={nubStyle} className="transition-all duration-200 group-hover:scale-110 group-active:scale-95"></div>
            </div>
          </>
        ) : (
          <div 
            style={{ ...handleStyle, left: `${rangeEnd}%`, transform: 'translate(-50%, -50%)' }} 
            onMouseDown={() => setDragging('single')} 
            onTouchStart={() => setDragging('single')}
            className="group"
          >
            <div style={nubStyle} className="transition-all duration-200 group-hover:scale-110 group-active:scale-95"></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GelSlider;