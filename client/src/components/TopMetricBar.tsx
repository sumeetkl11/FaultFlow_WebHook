'use client';

import React from 'react';
import { motion, useSpring, useTransform, useMotionValue } from 'framer-motion';
import { useTelemetryStore } from '../stores/useTelemetryStore';
import { RotateCw } from 'lucide-react';

interface TopMetricBarProps {
  onOpenDlqModal: () => void;
}

/** Animated number that smoothly tweens to its target value with cancelable RAF to prevent memory leaks. */
function AnimatedNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const [current, setCurrent] = React.useState(value);
  const currentRef = React.useRef(value);

  React.useEffect(() => {
    let animFrame: number;
    const start = currentRef.current;
    const target = value;
    const startTime = performance.now();
    const duration = 400; // 400ms smooth tween

    function step(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      const val = start + (target - start) * ease;
      currentRef.current = val;
      setCurrent(val);

      if (progress < 1) {
        animFrame = requestAnimationFrame(step);
      } else {
        currentRef.current = target;
        setCurrent(target);
      }
    }

    animFrame = requestAnimationFrame(step);
    return () => {
      if (animFrame) cancelAnimationFrame(animFrame);
    };
  }, [value]);

  return <span>{current.toFixed(decimals)}</span>;
}

interface MetricProps {
  label: string;
  value: React.ReactNode;
  unit?: string;
  accent?: string;
}

function Metric({ label, value, unit, accent }: MetricProps) {
  return (
    <div className="flex items-center gap-2 px-4">
      <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <span className={`text-xs font-semibold font-mono tabular-nums ${accent ?? 'text-zinc-100'}`}>
        {value}
      </span>
      {unit && (
        <span className="text-[11px] text-zinc-500 font-mono">{unit}</span>
      )}
    </div>
  );
}

function Divider() {
  return <div className="w-px h-4 bg-zinc-800 flex-shrink-0" />;
}

export const TopMetricBar: React.FC<TopMetricBarProps> = ({ onOpenDlqModal }) => {
  const {
    throughputRps,
    p95Ms,
    p50Ms,
    rescuedPayloads,
    deduplications,
    dlqCount,
    activeQueue,
    audienceMode,
    sseConnected,
  } = useTelemetryStore();

  const isBusiness = audienceMode === 'business';

  return (
    <div className="h-8 bg-zinc-950 border-b border-zinc-800 flex items-center w-full overflow-x-auto">
      {/* SSE Status dot */}
      <div className="flex items-center gap-1.5 px-4 flex-shrink-0">
        <span
          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
            sseConnected ? 'bg-emerald-400 sse-dot' : 'bg-rose-500'
          }`}
        />
        <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
          {sseConnected ? 'SSE' : 'DISC'}
        </span>
      </div>

      <Divider />

      {/* Throughput */}
      <Metric
        label={isBusiness ? 'Processed' : 'Throughput'}
        value={<AnimatedNumber value={isBusiness ? throughputRps * 60 : throughputRps} />}
        unit={isBusiness ? 'evt/min' : 'req/s'}
      />

      <Divider />

      {/* Latency (engineering only) */}
      {!isBusiness && (
        <>
          <Metric
            label="p50"
            value={<AnimatedNumber value={p50Ms} />}
            unit="ms"
          />
          <Divider />
          <Metric
            label="p95"
            value={<AnimatedNumber value={p95Ms} />}
            unit="ms"
            accent={p95Ms > 500 ? 'text-amber-400' : 'text-zinc-100'}
          />
          <Divider />
        </>
      )}

      {/* Active Queue */}
      <Metric
        label="Queue"
        value={<AnimatedNumber value={activeQueue} />}
        unit="active"
        accent={activeQueue > 50 ? 'text-amber-400' : 'text-zinc-100'}
      />

      <Divider />

      {/* Rescued Payloads */}
      <Metric
        label={isBusiness ? 'Rescued' : 'Rescued'}
        value={<AnimatedNumber value={rescuedPayloads} />}
        unit={isBusiness ? 'orders' : 'payloads'}
        accent="text-emerald-400"
      />

      <Divider />

      {/* Deduplications */}
      <Metric
        label="Dedup"
        value={<AnimatedNumber value={deduplications} />}
        accent="text-zinc-100"
      />

      <Divider />

      {/* DLQ — with interactive Replay trigger */}
      <div className="flex items-center gap-2 px-4">
        <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">DLQ</span>
        <span className={`text-xs font-semibold font-mono tabular-nums ${dlqCount > 0 ? 'text-rose-400' : 'text-zinc-500'}`}>
          <AnimatedNumber value={dlqCount} />
        </span>
        {dlqCount > 0 && (
          <motion.button
            onClick={onOpenDlqModal}
            whileTap={{ scale: 0.97 }}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-950/60 border border-rose-800/60 text-rose-400 text-[10px] font-mono font-semibold hover:bg-rose-900/60 transition-colors"
          >
            <RotateCw className="w-2.5 h-2.5" />
            Replay
          </motion.button>
        )}
      </div>
    </div>
  );
};
