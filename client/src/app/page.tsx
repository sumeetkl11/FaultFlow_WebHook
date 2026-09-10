'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import { useTelemetryStore } from '../stores/useTelemetryStore';
import type { EventItem } from '../types';
import { useSSEStream } from '../hooks/useSSEStream';

import { TopMetricBar } from '../components/TopMetricBar';
import { EventStreamTable } from '../components/EventStreamTable';
import { ChaosControlPanel } from '../components/ChaosControlPanel';
import { EventTraceDrawer } from '../components/EventTraceDrawer';
import { DLQReplayModal } from '../components/DLQReplayModal';
import { IngressDispatchModal } from '../components/IngressDispatchModal';
import { ProductionRoadmapModal } from '../components/ProductionRoadmapModal';
import { ExplainerBanner } from '../components/ExplainerBanner';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ToastContainer } from '../components/ToastContainer';

import {
  Zap,
  RotateCw,
  Send,
  Briefcase,
  Code2,
  Map,
} from 'lucide-react';

export default function DashboardPage() {
  // Subscribe to persistent Server-Sent Events (SSE) stream
  useSSEStream();

  const {
    events: liveEvents,
    setEvents,
    sseConnected,
    addChaosLog,
    audienceMode,
    setAudienceMode,
    optimisticReplay,
    dlqCount,
  } = useTelemetryStore();

  const [page, setPage] = useState<number>(1);
  const pageSize = 25;
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isDlqModalOpen, setIsDlqModalOpen] = useState<boolean>(false);
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState<boolean>(false);
  const [isRoadmapOpen, setIsRoadmapOpen] = useState<boolean>(false);

  const [eventsData, setEventsData] = useState<{
    data: EventItem[];
    meta: { total_count: number; limit: number; offset: number };
  } | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      const data = await api.getEvents({
        limit: pageSize,
        offset: (page - 1) * pageSize,
        status: statusFilter || undefined,
        event_type: searchQuery || undefined,
      });
      setEventsData(data);
    } catch {
      // Fetch failure handled silently; UI retains stale data
    }
  }, [page, statusFilter, searchQuery]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const refetchEvents = fetchEvents;

  // Synchronize REST events with live ring-buffer
  useEffect(() => {
    if (eventsData?.data && liveEvents.length === 0) {
      setEvents(eventsData.data);
    }
  }, [eventsData, liveEvents.length, setEvents]);

  // Combine live ring-buffer with query data
  const displayedEvents = liveEvents.length > 0 ? liveEvents : (eventsData?.data || []);
  const totalCount = eventsData?.meta?.total_count || displayedEvents.length;

  const handleSingleReplay = async (eventId: string) => {
    try {
      optimisticReplay([eventId]);
      addChaosLog(`[DLQ] Replaying event ${eventId.slice(0, 8)}…`);
      await api.replayDlq('SELECTIVE', [eventId]);
      addChaosLog(`[DLQ] Replay queued for ${eventId.slice(0, 8)}`);
      refetchEvents();
    } catch (err: unknown) {
      addChaosLog(`[ERROR] Replay failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const isBusiness = audienceMode === 'business';

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-zinc-100 selection:bg-zinc-800 selection:text-zinc-100 font-sans">
      {/* ── 1. Header Navigation ─────────────────────────────────────────── */}
      <header className="h-11 border-b border-zinc-800 bg-zinc-900 px-4 flex items-center justify-between gap-4 flex-shrink-0 z-30">
        {/* Left: Platform Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="p-1 rounded bg-zinc-800 border border-zinc-700 text-amber-400 flex items-center justify-center flex-shrink-0">
            <Zap className="w-4 h-4 fill-current" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold tracking-tight text-zinc-100 font-mono">
              FaultFlow
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-medium bg-zinc-800 border border-zinc-700 text-zinc-300">
              v1.0
            </span>
          </div>
          <span className="text-[11px] text-zinc-500 font-mono hidden lg:inline pl-2 border-l border-zinc-800">
            {isBusiness
              ? 'Zero-Loss Asynchronous Task & Webhook Shock-Absorber'
              : 'Multi-Tenant Webhook Broker & Real-Time Telemetry'}
          </span>
        </div>

        {/* Center: Audience Mode Toggle */}
        <div className="flex items-center p-0.5 rounded bg-zinc-950 border border-zinc-800 text-[11px] font-mono">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setAudienceMode('business')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors ${
              isBusiness
                ? 'bg-zinc-800 text-zinc-100 font-medium'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
            title="Non-technical executive view"
          >
            <Briefcase className="w-3 h-3" />
            <span className="hidden sm:inline">Business</span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setAudienceMode('engineering')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors ${
              !isBusiness
                ? 'bg-zinc-800 text-zinc-100 font-medium'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
            title="Engineering telemetry view"
          >
            <Code2 className="w-3 h-3" />
            <span className="hidden sm:inline">Engineer</span>
          </motion.button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* SSE Pulse Indicator */}
          <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded bg-zinc-950 border border-zinc-800 text-[11px] font-mono text-zinc-400">
            <span
              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                sseConnected ? 'bg-emerald-400 sse-dot' : 'bg-rose-500'
              }`}
            />
            <span>{sseConnected ? 'LIVE' : 'DISCONNECTED'}</span>
          </div>

          {/* Roadmap */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setIsRoadmapOpen(true)}
            className="px-2.5 py-1 rounded border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-mono flex items-center gap-1.5 transition-colors"
            title="Production Roadmap"
          >
            <Map className="w-3 h-3" />
            <span className="hidden md:inline">Roadmap</span>
          </motion.button>

          {/* DLQ Replay Trigger */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setIsDlqModalOpen(true)}
            className={`px-2.5 py-1 rounded border text-[11px] font-mono flex items-center gap-1.5 transition-colors ${
              dlqCount > 0
                ? 'bg-rose-950/60 border-rose-800/80 text-rose-300 hover:bg-rose-900/60'
                : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <RotateCw className="w-3 h-3" />
            <span className="hidden sm:inline">{isBusiness ? 'Failed Orders' : 'DLQ Replay'}</span>
            {dlqCount > 0 && <span className="tabular-nums">({dlqCount})</span>}
          </motion.button>

          {/* Send Webhook Button */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setIsDispatchModalOpen(true)}
            className="px-2.5 py-1 rounded bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-[11px] font-mono flex items-center gap-1.5 border border-zinc-200 transition-colors"
          >
            <Send className="w-3 h-3" />
            <span>{isBusiness ? 'Test Order' : 'Dispatch'}</span>
          </motion.button>
        </div>
      </header>

      {/* ── 2. Top Metric Bar (Pinned 32px Inline Flex Strip) ─────────────── */}
      <ErrorBoundary componentName="TopMetricBar">
        <TopMetricBar onOpenDlqModal={() => setIsDlqModalOpen(true)} />
      </ErrorBoundary>

      {/* ── 3. Main Workspace Viewport ────────────────────────────────────── */}
      <main className="flex-1 p-3 flex flex-col gap-3 w-full max-w-[1720px] mx-auto overflow-hidden">
        {/* Contextual Single-Line Dismissible Banner */}
        <ExplainerBanner />

        {/* Utilitarian Split-Screen Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1 min-h-[620px] items-stretch">
          {/* Left Column: Event Stream Table (65% width) */}
          <div className="lg:col-span-8 flex flex-col h-full">
            <ErrorBoundary componentName="EventStreamTable">
              <EventStreamTable
                events={displayedEvents}
                totalCount={totalCount}
                page={page}
                pageSize={pageSize}
                onPageChange={setPage}
                onSelectEvent={setSelectedEventId}
                onSingleReplay={handleSingleReplay}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                searchQuery={searchQuery}
                onSearchQueryChange={setSearchQuery}
              />
            </ErrorBoundary>
          </div>

          {/* Right Column: Chaos Control Sandbox (35% width) */}
          <div className="lg:col-span-4 flex flex-col h-full">
            <ErrorBoundary componentName="ChaosControlPanel">
              <ChaosControlPanel />
            </ErrorBoundary>
          </div>
        </div>
      </main>

      {/* ── 4. Slide-Over Trace Drawer ────────────────────────────────────── */}
      <EventTraceDrawer
        eventId={selectedEventId}
        onClose={() => setSelectedEventId(null)}
        onReplay={handleSingleReplay}
      />

      {/* ── 5. DLQ Batch Replay Modal ─────────────────────────────────────── */}
      <DLQReplayModal
        isOpen={isDlqModalOpen}
        onClose={() => setIsDlqModalOpen(false)}
        onReplaySuccess={() => refetchEvents()}
      />

      {/* ── 6. Ingress Dispatch Modal ─────────────────────────────────────── */}
      <IngressDispatchModal
        isOpen={isDispatchModalOpen}
        onClose={() => setIsDispatchModalOpen(false)}
        onSuccess={() => refetchEvents()}
      />

      {/* ── 7. Production Roadmap Modal ───────────────────────────────────── */}
      <ProductionRoadmapModal
        isOpen={isRoadmapOpen}
        onClose={() => setIsRoadmapOpen(false)}
      />

      {/* ── 8. Toast Notifications ────────────────────────────────────────── */}
      <ToastContainer />
    </div>
  );
}
