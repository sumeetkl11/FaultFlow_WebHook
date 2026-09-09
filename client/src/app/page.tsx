'use client';

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useTelemetryStore } from '../stores/useTelemetryStore';
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
  Radio,
  Briefcase,
  Code2,
  Database,
  Map,
  ShieldCheck,
  Sparkles,
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
    addToast,
  } = useTelemetryStore();

  const [page, setPage] = useState<number>(1);
  const pageSize = 20;
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isDlqModalOpen, setIsDlqModalOpen] = useState<boolean>(false);
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState<boolean>(false);
  const [isRoadmapOpen, setIsRoadmapOpen] = useState<boolean>(false);

  // Fetch paginated events from REST endpoint
  const {
    data: eventsData,
    refetch: refetchEvents,
    isLoading,
  } = useQuery({
    queryKey: ['events', page, statusFilter, searchQuery],
    queryFn: () =>
      api.getEvents({
        limit: pageSize,
        offset: (page - 1) * pageSize,
        status: statusFilter || undefined,
        event_type: searchQuery || undefined,
      }),
  });

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
      addChaosLog(`[DLQ] Triggering single-event replay for ${eventId}...`);
      await api.replayDlq('SELECTIVE', [eventId]);
      addChaosLog(`[DLQ] Replay queued for ${eventId}`);
      refetchEvents();
    } catch (err: any) {
      addChaosLog(`[ERROR] Replay failed: ${err.message}`);
    }
  };

  const isBusiness = audienceMode === 'business';

  return (
    <div className="min-h-screen flex flex-col bg-[#080c14] text-slate-100 selection:bg-indigo-500 selection:text-white">
      {/* 1. RootLayout & Header Navigation */}
      <header className="h-16 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40 px-4 sm:px-6 flex items-center justify-between gap-4">
        {/* Left: Platform Logo & Subtitle */}
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-cyan-500 p-0.5 shadow-lg shadow-indigo-500/20 flex-shrink-0">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Zap className="w-5 h-5 text-indigo-400 fill-current" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-white font-sans">
                  FaultFlow
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
                  v2.0 DUAL-UI
                </span>
              </div>
              <p className="text-[11px] text-slate-400 -mt-0.5 hidden sm:block">
                {isBusiness
                  ? 'Zero-Loss Asynchronous Task & Webhook Shock-Absorber'
                  : 'Multi-Tenant Webhook Broker & Real-Time Telemetry Gateway'}
              </p>
            </div>
          </div>
        </div>

        {/* Center / Audience Mode Toggle [Simple Business Mode | Engineer Mode] */}
        <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold shadow-inner">
          <button
            onClick={() => setAudienceMode('business')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
              isBusiness
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-950/60'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Non-technical executive view with clear business terminology"
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Simple Business Mode</span>
            <span className="md:hidden">Business</span>
          </button>

          <button
            onClick={() => setAudienceMode('engineering')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
              !isBusiness
                ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-md shadow-cyan-950/60'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Deep engineering metrics, BullMQ queues, HMAC headers & raw latencies"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Engineer Mode</span>
            <span className="md:hidden">Engineer</span>
          </button>
        </div>

        {/* Right Action Bar & Health Status Pill */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Engine Status Pill [HEALTHY | SSE ACTIVE] */}
          <div className="hidden lg:flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/50 text-emerald-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>HEALTHY</span>
            </div>

            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs transition ${
                sseConnected
                  ? 'bg-indigo-950/60 border-indigo-800/60 text-indigo-300'
                  : 'bg-rose-950/60 border-rose-800/60 text-rose-300'
              }`}
            >
              <Radio className={`w-3 h-3 ${sseConnected ? 'text-indigo-400 animate-pulse' : 'text-rose-400'}`} />
              <span>{sseConnected ? 'SSE ACTIVE' : 'RECONNECTING'}</span>
            </div>
          </div>

          {/* Extensibility Roadmap Button */}
          <button
            onClick={() => setIsRoadmapOpen(true)}
            className="px-3 py-1.5 rounded-xl border border-indigo-500/30 bg-indigo-950/40 hover:bg-indigo-900/40 text-indigo-300 text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
          >
            <Map className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Roadmap</span>
          </button>

          {/* DLQ Replay Trigger */}
          <button
            onClick={() => setIsDlqModalOpen(true)}
            className="px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-850 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <RotateCw className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">{isBusiness ? 'Failed Orders' : 'DLQ Replay'}</span>
          </button>

          {/* Dispatch Webhook Button */}
          <button
            onClick={() => setIsDispatchModalOpen(true)}
            className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-900/40 transition"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isBusiness ? 'Send Test Order' : 'Send Webhook'}</span>
          </button>
        </div>
      </header>

      {/* 2. Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Interactive Storytelling Banner (Explainer Banner) */}
        <ExplainerBanner />

        {/* Top KPI Impact Bar (4-Col Grid) wrapped in ErrorBoundary */}
        <ErrorBoundary componentName="TopMetricBar">
          <TopMetricBar onOpenDlqModal={() => setIsDlqModalOpen(true)} />
        </ErrorBoundary>

        {/* 3. Interactive Split-Screen Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Live Event Stream & Filters (65% width) */}
          <div className="lg:col-span-8 min-h-[580px]">
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

          {/* Right Column: Chaos Sandbox & Failure Injector (35% width) */}
          <div className="lg:col-span-4 min-h-[580px]">
            <ErrorBoundary componentName="ChaosControlPanel">
              <ChaosControlPanel />
            </ErrorBoundary>
          </div>
        </div>
      </main>

      {/* 4. Sliding Trace Drawer (On-Demand Inspection) */}
      <EventTraceDrawer
        eventId={selectedEventId}
        onClose={() => setSelectedEventId(null)}
        onReplay={handleSingleReplay}
      />

      {/* 5. DLQ Batch Replay Modal */}
      <DLQReplayModal
        isOpen={isDlqModalOpen}
        onClose={() => setIsDlqModalOpen(false)}
        onReplaySuccess={() => refetchEvents()}
      />

      {/* 6. Ingress Webhook Test Dispatcher Modal (with Zod verification) */}
      <IngressDispatchModal
        isOpen={isDispatchModalOpen}
        onClose={() => setIsDispatchModalOpen(false)}
        onSuccess={() => refetchEvents()}
      />

      {/* 7. Extensibility Roadmap Modal */}
      <ProductionRoadmapModal
        isOpen={isRoadmapOpen}
        onClose={() => setIsRoadmapOpen(false)}
      />

      {/* 8. Toast Notification System */}
      <ToastContainer />
    </div>
  );
}
