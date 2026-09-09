'use client';

import React, { useState } from 'react';
import { EventItem } from '../types';
import { StatusBadge } from './StatusBadge';
import { useTelemetryStore } from '../stores/useTelemetryStore';
import { Search, Eye, Filter, ArrowRight, ArrowLeft, RotateCw, CheckCircle2, AlertOctagon, Clock, Layers } from 'lucide-react';

interface EventStreamTableProps {
  events: EventItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  onPageChange: (newPage: number) => void;
  onSelectEvent: (eventId: string) => void;
  onSingleReplay: (eventId: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
}

export const EventStreamTable: React.FC<EventStreamTableProps> = ({
  events,
  totalCount,
  page,
  pageSize,
  onPageChange,
  onSelectEvent,
  onSingleReplay,
  statusFilter,
  onStatusFilterChange,
  searchQuery,
  onSearchQueryChange,
}) => {
  const { audienceMode, optimisticReplay, addToast } = useTelemetryStore();
  const isBusiness = audienceMode === 'business';

  const filteredEvents = events.filter((e) => {
    if (statusFilter && e.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        e.event_id.toLowerCase().includes(q) ||
        e.event_type.toLowerCase().includes(q) ||
        e.target_url.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const handleReplayClick = (eventId: string) => {
    // 1. Optimistic status update immediately in UI
    optimisticReplay([eventId]);
    addToast({
      type: 'info',
      title: isBusiness ? 'Resending Order' : 'Optimistic Replay Triggered',
      message: isBusiness
        ? `Order #${eventId.slice(0, 8)} marked for delivery. Duplicate protection active.`
        : `Event ${eventId} transitioned to QUEUED state. Active queue incremented.`,
    });
    // 2. Trigger network replay
    onSingleReplay(eventId);
  };

  return (
    <div className="glass-card rounded-2xl border border-slate-800/80 shadow-xl overflow-hidden flex flex-col h-full">
      {/* Table Header & Quick Controls */}
      <div className="p-4 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 bg-slate-900/40">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2 tracking-tight">
            <Layers className="w-4 h-4 text-indigo-400" />
            <span>{isBusiness ? 'Live Transaction Stream' : 'Live Webhook Event Stream'}</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
              {totalCount} total
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {isBusiness
              ? 'Real-time feed of protected customer orders and webhook relays'
              : 'Streaming real-time job execution states via Server-Sent Events (SSE)'}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder={isBusiness ? 'Search order, email, app...' : 'Search ID, type, endpoint...'}
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-44 sm:w-56 transition"
            />
          </div>

          {/* Status Filter Dropdown */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(e.target.value)}
              className="bg-slate-950/80 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 appearance-none pr-8 cursor-pointer"
            >
              <option value="">{isBusiness ? 'All Transactions' : 'All Statuses'}</option>
              <option value="QUEUED">{isBusiness ? 'Queued' : 'QUEUED'}</option>
              <option value="PROCESSING">{isBusiness ? 'Sending' : 'PROCESSING'}</option>
              <option value="RETRYING">{isBusiness ? 'Auto-Retrying' : 'RETRYING'}</option>
              <option value="DELIVERED">{isBusiness ? 'Delivered' : 'DELIVERED'}</option>
              <option value="DEAD_LETTERED">{isBusiness ? 'Needs Attention' : 'DEAD_LETTERED'}</option>
              <option value="CIRCUIT_HOLD">{isBusiness ? 'Protected Pause' : 'CIRCUIT_HOLD'}</option>
            </select>
            <Filter className="w-3 h-3 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Quick Filter Chips */}
      <div className="px-4 py-2 border-b border-slate-800/50 bg-slate-950/30 flex items-center gap-2 overflow-x-auto text-[11px]">
        <span className="text-slate-500 font-medium mr-1">Quick View:</span>
        <button
          onClick={() => onStatusFilterChange('')}
          className={`px-2.5 py-0.5 rounded-full transition ${
            statusFilter === ''
              ? 'bg-indigo-600 text-white font-medium'
              : 'bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          All ({totalCount})
        </button>
        <button
          onClick={() => onStatusFilterChange('DEAD_LETTERED')}
          className={`px-2.5 py-0.5 rounded-full flex items-center gap-1 transition ${
            statusFilter === 'DEAD_LETTERED'
              ? 'bg-rose-900 text-rose-200 font-medium'
              : 'bg-slate-900 text-rose-400/80 hover:text-rose-300'
          }`}
        >
          <AlertOctagon className="w-3 h-3" />
          <span>{isBusiness ? 'Action Needed' : 'Dead-Lettered'}</span>
        </button>
        <button
          onClick={() => onStatusFilterChange('RETRYING')}
          className={`px-2.5 py-0.5 rounded-full flex items-center gap-1 transition ${
            statusFilter === 'RETRYING'
              ? 'bg-indigo-900 text-indigo-200 font-medium'
              : 'bg-slate-900 text-indigo-400/80 hover:text-indigo-300'
          }`}
        >
          <RotateCw className="w-3 h-3" />
          <span>{isBusiness ? 'Auto-Retrying' : 'Retrying'}</span>
        </button>
        <button
          onClick={() => onStatusFilterChange('DELIVERED')}
          className={`px-2.5 py-0.5 rounded-full flex items-center gap-1 transition ${
            statusFilter === 'DELIVERED'
              ? 'bg-emerald-900 text-emerald-200 font-medium'
              : 'bg-slate-900 text-emerald-400/80 hover:text-emerald-300'
          }`}
        >
          <CheckCircle2 className="w-3 h-3" />
          <span>{isBusiness ? 'Delivered' : 'Delivered'}</span>
        </button>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800/80 bg-slate-950/40 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <th className="py-3 px-4">{isBusiness ? 'Transaction ID' : 'Event ID'}</th>
              <th className="py-3 px-4">{isBusiness ? 'Category' : 'Type'}</th>
              <th className="py-3 px-4">{isBusiness ? 'Target Application' : 'Target Endpoint'}</th>
              <th className="py-3 px-4">{isBusiness ? 'Attempts' : 'Attempts'}</th>
              <th className="py-3 px-4">{isBusiness ? 'Delivery State' : 'Status'}</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/40 text-xs font-mono">
            {filteredEvents.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-14 text-center text-slate-500 font-sans">
                  No events found matching your criteria.
                </td>
              </tr>
            ) : (
              filteredEvents.map((evt) => (
                <tr
                  key={evt.event_id}
                  onClick={() => onSelectEvent(evt.event_id)}
                  className="hover:bg-slate-800/40 transition cursor-pointer group"
                >
                  <td className="py-3 px-4 text-indigo-300 font-medium">
                    {evt.event_id.slice(0, 14)}...
                  </td>
                  <td className="py-3 px-4 text-slate-200 font-sans font-medium">
                    {evt.event_type}
                  </td>
                  <td className="py-3 px-4 text-slate-400 max-w-xs truncate font-sans text-xs" title={evt.target_url}>
                    {evt.target_url}
                  </td>
                  <td className="py-3 px-4 text-slate-300">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px] font-mono">
                      {evt.attempts}/{evt.max_retries || 5}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-sans">
                    <StatusBadge
                      status={evt.status}
                      attempts={evt.attempts}
                      maxRetries={evt.max_retries || 5}
                      latencyMs={evt.latency_ms}
                      nextRetryInMs={evt.next_retry_in_ms}
                      onReplay={() => handleReplayClick(evt.event_id)}
                    />
                  </td>
                  <td className="py-3 px-4 text-right font-sans">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectEvent(evt.event_id);
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition border border-slate-700/60 group-hover:border-indigo-500/50"
                    >
                      <Eye className="w-3 h-3 text-indigo-400" />
                      <span>Inspect</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="p-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 bg-slate-900/30 font-sans">
        <span>
          Showing {filteredEvents.length} of {totalCount} events
        </span>
        <div className="flex items-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
          <span className="font-mono text-slate-300">
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
