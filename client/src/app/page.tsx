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

import {
  Zap,
  RotateCw,
  Send,
  Radio,
  Layers,
  Database,
  ShieldCheck,
} from 'lucide-react';

export default function DashboardPage() {
  // Subscribe to persistent Server-Sent Events (SSE) stream
  useSSEStream();

  const {
    events: liveEvents,
    setEvents,
    prependEvent,
    sseConnected,
    addChaosLog,
  } = useTelemetryStore();

  const [page, setPage] = useState<number>(1);
  const pageSize = 20;
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isDlqModalOpen, setIsDlqModalOpen] = useState<boolean>(false);
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState<boolean>(false);

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
      addChaosLog(`[DLQ] Triggering single-event replay for ${eventId}...`);
      await api.replayDlq('SELECTIVE', [eventId]);
      addChaosLog(`[DLQ] Replay queued for ${eventId}`);
      refetchEvents();
    } catch (err: any) {
      addChaosLog(`[ERROR] Replay failed: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#080c14] text-slate-100">
      {/* 1. Header & Navigation Bar */}
      <header className="h-16 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40 px-6 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-cyan-500 p-0.5 shadow-lg shadow-indigo-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Zap className="w-5 h-5 text-indigo-400 fill-current" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-white font-sans">
                  FaultFlow
                </span>
                <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
                  ENGINE v1.0
                </span>
              </div>
              <p className="text-[11px] text-slate-400 -mt-0.5">
                Multi-Tenant Webhook Broker & Telemetry Gateway
              </p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1 text-xs font-medium text-slate-400 border-l border-slate-800/80 pl-6">
            <span className="px-3 py-1.5 rounded-lg bg-slate-800/60 text-white font-semibold">
              Live Observability
            </span>
            <button
              onClick={() => setIsDlqModalOpen(true)}
              className="px-3 py-1.5 rounded-lg hover:text-white hover:bg-slate-800/30 transition"
            >
              Dead-Letter Queue
            </button>
            <span className="px-3 py-1.5 rounded-lg hover:text-white transition cursor-default opacity-60">
              API Keys
            </span>
          </nav>
        </div>

        {/* Right Action Bar */}
        <div className="flex items-center gap-3">
          {/* Cluster & SSE Status Pills */}
          <div className="hidden sm:flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/50 text-emerald-300">
              <Database className="w-3 h-3 text-emerald-400" />
              <span>Postgres & Redis</span>
            </div>

            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs transition ${
                sseConnected
                  ? 'bg-indigo-950/60 border-indigo-800/60 text-indigo-300'
                  : 'bg-rose-950/60 border-rose-800/60 text-rose-300'
              }`}
            >
              <Radio className={`w-3 h-3 ${sseConnected ? 'text-indigo-400 animate-pulse' : 'text-rose-400'}`} />
              <span>SSE: {sseConnected ? 'CONNECTED' : 'RECONNECTING'}</span>
            </div>
          </div>

          {/* DLQ Replay Trigger */}
          <button
            onClick={() => setIsDlqModalOpen(true)}
            className="px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <RotateCw className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">DLQ Replay</span>
          </button>

          {/* Dispatch Test Webhook Button */}
          <button
            onClick={() => setIsDispatchModalOpen(true)}
            className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-900/30 transition"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send Webhook</span>
          </button>
        </div>
      </header>

      {/* 2. Main Content Viewport (1440px max) */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Top Real-Time Telemetry KPI Bar (4-Card Grid) */}
        <TopMetricBar onOpenDlqModal={() => setIsDlqModalOpen(true)} />

        {/* 3. Interactive Split-Screen Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Live Event Stream & Filters (65% width) */}
          <div className="lg:col-span-8 min-h-[580px]">
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
          </div>

          {/* Right Column: Chaos Sandbox & Failure Injector (35% width) */}
          <div className="lg:col-span-4 min-h-[580px]">
            <ChaosControlPanel />
          </div>
        </div>
      </main>

      {/* 4. Sliding Trace Drawer (Overlay On-Demand) */}
      <EventTraceDrawer
        eventId={selectedEventId}
        onClose={() => setSelectedEventId(null)}
      />

      {/* 5. DLQ Batch Replay Modal */}
      <DLQReplayModal
        isOpen={isDlqModalOpen}
        onClose={() => setIsDlqModalOpen(false)}
        onReplaySuccess={() => refetchEvents()}
      />

      {/* 6. Ingress Webhook Test Dispatcher Modal */}
      <IngressDispatchModal
        isOpen={isDispatchModalOpen}
        onClose={() => setIsDispatchModalOpen(false)}
        onSuccess={() => refetchEvents()}
      />
    </div>
  );
}
