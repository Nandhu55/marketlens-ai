'use client';

import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KPICardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: LucideIcon;
  iconColor?: string;
  glowColor?: string;
  index?: number;
  subtitle?: string;
}

export function KPICard({
  title,
  value,
  change,
  changeType = 'neutral',
  icon: Icon,
  iconColor = 'text-indigo-400',
  glowColor = 'glow-blue',
  index = 0,
  subtitle,
}: KPICardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: 'easeOut' }}
      className={cn(
        'glass-card p-5 relative overflow-hidden group cursor-default',
        glowColor
      )}
    >
      {/* Subtle gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl" />

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-3">
          <div className={cn('p-2.5 rounded-xl bg-white/5', iconColor)}>
            <Icon className="w-5 h-5" />
          </div>
          {change && (
            <span
              className={cn(
                'text-xs font-medium px-2 py-1 rounded-lg',
                changeType === 'positive' && 'bg-emerald-500/10 text-emerald-400',
                changeType === 'negative' && 'bg-red-500/10 text-red-400',
                changeType === 'neutral' && 'bg-slate-500/10 text-slate-400'
              )}
            >
              {change}
            </span>
          )}
        </div>

        <div className="space-y-1">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
          {subtitle && (
            <p className="text-xs text-slate-500">{subtitle}</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}