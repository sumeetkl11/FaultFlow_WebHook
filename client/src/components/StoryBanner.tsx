'use client';

import React, { useState, useEffect } from 'react';
import { X, Sparkles, ChevronRight } from 'lucide-react';

const BANNER_KEY = 'faultflow_story_banner_dismissed';

interface StoryBannerProps {
  onOpenRoadmap: () => void;
}

export const StoryBanner: React.FC<StoryBannerProps> = ({ onOpenRoadmap }) => {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    // Only show if user hasn't dismissed before
    const dismissed = localStorage.getItem(BANNER_KEY);
    if (!dismissed) {
      setVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    setLeaving(true);
    setTimeout(() => {
      setVisible(false);
      localStorage.setItem(BANNER_KEY, '1');
    }, 260);
  };

  if (!visible) return null;

  return (
    <div
      className={`w-full ${leaving ? 'banner-leave' : 'banner-enter'}`}
      role="banner"
      aria-label="Project story banner"
    >
      <div className="relative overflow-hidden rounded-xl border border-indigo-500/20 bg-gradient-to-r from-indigo-950/60 via-slate-900/70 to-purple-950/50 backdrop-blur-sm shadow-lg shadow-indigo-950/30">
        {/* Left accent bar */}
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-500 via-purple-500 to-cyan-500 rounded-l-xl" />

        <div className="pl-5 pr-4 py-3.5 flex items-center gap-4 flex-wrap md:flex-nowrap">
          {/* Icon */}
          <div className="flex-shrink-0 p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
            <Sparkles className="w-4 h-4 text-indigo-400" />
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white leading-snug">
              What is FaultFlow?{' '}
              <span className="font-normal text-slate-300">
                A background shock-absorber that prevents transaction data loss when
                downstream servers crash. It queues, retries with exponential backoff,
                and guarantees delivery — or safely parks failures in a Dead-Letter Queue
                for manual replay.
              </span>
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Use the{' '}
              <span className="text-amber-400 font-semibold">Live Crash Test Sandbox →</span>{' '}
              on the right to trigger a server failure and watch it recover in real time.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              id="story-banner-roadmap"
              onClick={onOpenRoadmap}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-300 border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 hover:text-indigo-200 transition"
            >
              View Roadmap
              <ChevronRight className="w-3 h-3" />
            </button>
            <button
              id="story-banner-dismiss"
              onClick={handleDismiss}
              className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800/60 transition"
              aria-label="Dismiss banner"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
