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
  const [ripples, setRipples] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const [hoveredHandle, setHoveredHandle] = useState<'min' | 'max' | 'single' | null>(null);
  const rippleIdRef = useRef(0);

  const getPercentage = useCallback((val: number) => ((val - min) / (max - min)) * 100, [min, max]);

  const createRipple = (x: number, y: number) => {
    const id = rippleIdRef.current++;
    setRipples(prev => [...prev, { id, x, y }]);
    setTimeout(() => {
      setRipples(prev => prev.filter(r => r.id !== id));
    }, 600);
  };

  const handleInteraction = (clientX: number, clientY?: number) => {
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
  const handleMouseMove = (e: MouseEvent) => handleInteraction(e.clientX, e.clientY);
  const handleTouchMove = (e: TouchEvent) => handleInteraction(e.touches[0].clientX, e.touches[0].clientY);
  
  const handleMouseDown = (type: 'min' | 'max' | 'single', e: React.MouseEvent) => {
    if (sliderRef.current) {
      const rect = sliderRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = 50; // Center of slider
      createRipple(x, y);
    }
    setDragging(type);
  };
  
  const handleTouchStart = (type: 'min' | 'max' | 'single', e: React.TouchEvent) => {
    if (sliderRef.current && e.touches[0]) {
      const rect = sliderRef.current.getBoundingClientRect();
      const x = ((e.touches[0].clientX - rect.left) / rect.width) * 100;
      const y = 50;
      createRipple(x, y);
    }
    setDragging(type);
  };

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
    background: dragging 
      ? 'linear-gradient(90deg, #c4b5fd 0%, #a78bfa 50%, #c4b5fd 100%)'
      : '#c4b5fd',
    backgroundSize: dragging ? '200% 100%' : '100% 100%',
    backgroundPosition: dragging ? '0% 0%' : '0% 0%',
    border: 'none',
    boxShadow: dragging 
      ? '0 0 12px rgba(196, 181, 253, 0.6), 0 0 24px rgba(196, 181, 253, 0.3)'
      : 'none',
    transition: dragging ? 'none' : 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    animation: dragging ? 'shimmer 1.5s ease-in-out infinite' : 'none',
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
      background: isActive 
        ? 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)'
        : '#ffffff',
      border: isActive
        ? '2px solid #c4b5fd'
        : isDark 
          ? '1px solid rgba(148, 163, 184, 0.3)'
          : '1px solid rgba(209, 213, 219, 0.8)',
      boxShadow: isActive
        ? '0 0 16px rgba(196, 181, 253, 0.8), 0 4px 12px rgba(0, 0, 0, 0.2), 0 0 0 2px rgba(196, 181, 253, 0.3)'
        : isDark
          ? '0 2px 8px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2)'
          : '0 2px 8px rgba(0, 0, 0, 0.15), 0 1px 2px rgba(0, 0, 0, 0.1)',
      transform: isActive ? 'scale(1.15)' : 'scale(1)',
      transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
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
        @keyframes ripple {
          0% {
            transform: translate(-50%, -50%) scale(0);
            opacity: 0.8;
          }
          100% {
            transform: translate(-50%, -50%) scale(3);
            opacity: 0;
          }
        }
      `}</style>
      <div style={containerStyle} className="transition-all duration-300">
        <div style={sliderBaseStyle} ref={sliderRef}>
          <div style={rangeBarStyle}>
            <div style={rangeBarBeforeStyle}></div>
            <div style={rangeBarAfterStyle}></div>
          </div>
          
          {/* Ripple effects */}
          {ripples.map(ripple => (
            <div
              key={ripple.id}
              style={{
                position: 'absolute',
                left: `${ripple.x}%`,
                top: `${ripple.y}%`,
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(196, 181, 253, 0.7) 0%, rgba(196, 181, 253, 0.3) 50%, transparent 100%)',
                transform: 'translate(-50%, -50%)',
                pointerEvents: 'none',
                zIndex: 20,
                animation: 'ripple 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            />
          ))}
          
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