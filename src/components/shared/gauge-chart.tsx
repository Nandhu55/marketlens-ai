'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface GaugeChartProps {
  value: number; // 0-100
  label: string;
  size?: number;
  strokeWidth?: number;
  color?: string;
  showValue?: boolean;
  segments?: { from: number; to: number; color: string; label: string }[];
}

export function GaugeChart({
  value,
  label,
  size = 140,
  strokeWidth = 10,
  color,
  showValue = true,
  segments,
}: GaugeChartProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = Math.PI * radius; // half circle
  const clampedValue = Math.max(0, Math.min(100, value));
  const offset = circumference - (clampedValue / 100) * circumference;

  const getColor = () => {
    if (color) return color;
    if (segments) {
      const seg = segments.find((s) => clampedValue >= s.from && clampedValue <= s.to);
      return seg?.color || '#6366f1';
    }
    if (clampedValue >= 70) return '#10b981';
    if (clampedValue >= 40) return '#f59e0b';
    return '#ef4444';
  };

  const getLabel = () => {
    if (segments) {
      const seg = segments.find((s) => clampedValue >= s.from && clampedValue <= s.to);
      return seg?.label || '';
    }
    if (clampedValue >= 70) return 'Bullish';
    if (clampedValue >= 40) return 'Neutral';
    return 'Bearish';
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size / 2 + 10 }}>
        <svg
          width={size}
          height={size / 2 + 10}
          viewBox={`0 0 ${size} ${size / 2 + 10}`}
          className="transform -rotate-0"
        >
          {/* Background arc */}
          <path
            d={`M ${strokeWidth / 2} ${size / 2 + 5} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2 + 5}`}
            fill="none"
            stroke="rgba(148, 163, 184, 0.1)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          {/* Value arc */}
          <motion.path
            d={`M ${strokeWidth / 2} ${size / 2 + 5} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2 + 5}`}
            fill="none"
            stroke={getColor()}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
            style={{
              filter: `drop-shadow(0 0 6px ${getColor()}40)`,
            }}
          />
        </svg>
        {showValue && (
          <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
            <span className="text-xl font-bold text-white">{Math.round(clampedValue)}</span>
            <span className={cn('text-[10px] font-medium', getColor())}>
              {getLabel()}
            </span>
          </div>
        )}
      </div>
      <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</span>
    </div>
  );
}

interface CircularProgressProps {
  value: number;
  label: string;
  size?: number;
  strokeWidth?: number;
  color?: string;
}

export function CircularProgress({
  value,
  label,
  size = 120,
  strokeWidth = 8,
  color = '#6366f1',
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedValue = Math.max(0, Math.min(100, value));
  const offset = circumference - (clampedValue / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(148, 163, 184, 0.1)"
            strokeWidth={strokeWidth}
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
            style={{
              filter: `drop-shadow(0 0 6px ${color}40)`,
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold text-white">{Math.round(clampedValue)}%</span>
        </div>
      </div>
      <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</span>
    </div>
  );
}