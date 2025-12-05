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
      setIsDark(document.documentElement.classList.contains('dark') || 
                window.matchMedia('(prefers-color-scheme: dark)').matches);
    };
    checkDarkMode();
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', checkDarkMode);
    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener('change', checkDarkMode);
    };
  }, []);

  const rangeStart = isDual && Array.isArray(value) ? getPercentage(value[0]) : 0;
  const rangeEnd = isDual && Array.isArray(value) ? getPercentage(value[1]) : getPercentage(value as number);

  // Removed hardcoded background for container style, moved to className
  const containerStyle: React.CSSProperties = {
    '--range-handle-border': 'oklch(0.3 0.01 212 / 0.5)',
    position: 'relative',
    width: '100%',
    padding: '0.15em',
    borderRadius: '99vw',
  } as React.CSSProperties;

  const sliderBaseStyle: React.CSSProperties = {
    position: 'relative',
    height: '0.5em',
    margin: '0',
    background: 'transparent',
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
    boxShadow: 'inset 0 0px 0px 0.3px oklch(0 0 0 / 0.2), 0px 0.2em 0.3em -0.15em oklch(0.3 0.01 212 / 0.05), 0px 0.15em 0.2em -0.1em oklch(0.3 0.01 212 / 0.05)',
    background: 'transparent'
  } as React.CSSProperties;

  const rangeBarBeforeStyle: React.CSSProperties = {
    content: '""', position: 'absolute', inset: '0.2em', zIndex: -2,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderRadius: borderRadius,
    opacity: 'calc((var(--range-size) / 100 + 0.4) * 0.6)',
    transition: 'all 0.2s'
  };
  
  const rangeBarAfterStyle: React.CSSProperties = {
    content: '""', position: 'absolute', inset: '0em',
    backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.45) 0% 100%)',
    boxShadow: 'inset 0 0 0.4em rgba(255, 255, 255, 0.2), inset 0.5px 0px 0px 0px oklch(0 0 0 / 0.2), inset -0.5px 0px 0px 0px oklch(0 0 0 / 0.2), inset 0 0.5px 0px 0px oklch(1 0 0 / 0.6), inset 0 -0.5px 0px 0px oklch(1 0 0 / 0.6)',
    borderRadius: borderRadius,
  };

  const handleStyle: React.CSSProperties = {
    width: '1.1em', height: '1.1em',
    position: 'absolute', top: '50%',
    transform: 'translateY(-50%)',
    cursor: 'pointer', zIndex: 10,
  };

  const nubStyle: React.CSSProperties = isDark ? {
    width: '100%', height: '100%', borderRadius: '50%',
    backgroundImage: 'linear-gradient(to bottom, oklch(0.85 0.01 40), oklch(0.7 0.005 40))',
    boxShadow: 'inset 0 0 1em oklch(0.7 0.01 212), inset 0 0 0.2em oklch(0.7 0.01 212), oklch(0.7 0.01 212 / 0.3) 0px 0.15em 0.2em -0.5px, oklch(0.7 0.01 212 / 0.2) 0px 0.08em 0.15em -0.5px',
    border: 'solid 0.15em oklch(0.75 0.005 212)',
  } : {
    width: '100%', height: '100%', borderRadius: '50%',
    backgroundImage: 'linear-gradient(to bottom, oklch(0.3 0.01 40), oklch(0.6 0.005 40))',
    boxShadow: 'inset 0 0 1em oklch(0.3 0.01 212), inset 0 0 0.2em oklch(0.3 0.01 212), oklch(0.3 0.01 212 / 0.2) 0px 0.15em 0.2em -0.5px, oklch(0.3 0.01 212 / 0.12) 0px 0.08em 0.15em -0.5px',
    border: 'solid 0.15em oklch(0.3 0.005 212)',
  };

  return (
    <div style={containerStyle} className="bg-[hsl(212,22%,92%)] dark:bg-black/40 transition-colors duration-300">
      <div style={sliderBaseStyle} ref={sliderRef}>
        <div style={rangeBarStyle}>
          <div style={rangeBarBeforeStyle}></div>
          <div style={rangeBarAfterStyle}></div>
        </div>
        {isDual && Array.isArray(value) ? (
          <>
            <div style={{ ...handleStyle, left: `${rangeStart}%`, transform: 'translate(-50%, -50%)' }} onMouseDown={() => setDragging('min')} onTouchStart={() => setDragging('min')}>
              <div style={nubStyle}></div>
            </div>
            <div style={{ ...handleStyle, left: `${rangeEnd}%`, transform: 'translate(-50%, -50%)' }} onMouseDown={() => setDragging('max')} onTouchStart={() => setDragging('max')}>
              <div style={nubStyle}></div>
            </div>
          </>
        ) : (
          <div style={{ ...handleStyle, left: `${rangeEnd}%`, transform: 'translate(-50%, -50%)' }} onMouseDown={() => setDragging('single')} onTouchStart={() => setDragging('single')}>
            <div style={nubStyle}></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GelSlider;