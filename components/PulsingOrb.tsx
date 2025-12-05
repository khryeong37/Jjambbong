import React from 'react';

const PulsingOrb: React.FC = () => {
  return (
    <div className="mic w-full h-full">
      <div className="mic-shadow"></div>
      <style>{`
        .mic {
          position: relative;
          color: #fff;
        }
        .mic::before, .mic::after {
          content: "";
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%,-50%);
          border-radius: 100%;
          z-index: 2;
        }
        .mic::before {
          width: 100%;
          height: 100%;
          background-color: #1a084e;
          box-shadow: 0 0 10px 10px #1c084f;
        }
        .mic::after {
          width: 62.5%; /* 250px / 400px */
          height: 62.5%;
          background-color: #2f1e5f;
          animation: circle-size 0.8s linear infinite alternate;
        }
        .mic-shadow {
          width: 100%;
          height: 100%;
          position: absolute;
          top: 50%;
          left: 50%;
          border-radius: 100%;
          z-index: 1;
          box-shadow: 2.5% -13.75% 7.5% 3.75% #823ca6, 6% -2.5% 11.75% 2.5% #aab3d2, 5.25% 6.25% 24.25% 2.5% #5acee3, 12.75% 1.25% 4.25% 2.5% #1b7d8f, 0.75% 0.5% 19.25% 2.5% #f30bf5;
          transform-origin: 50% 50%;
          animation: shadow-rotate 1.5s linear infinite;
        }
        @keyframes circle-size {
          from {
            width: 62.5%;
            height: 62.5%;
          }
          to {
            width: 75%;
            height: 75%;
          }
        }
        @keyframes shadow-rotate {
          from {
            transform: translate(-50%,-50%) rotate(0deg);
          }
          to {
            transform: translate(-50%,-50%) rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
};

export default PulsingOrb;