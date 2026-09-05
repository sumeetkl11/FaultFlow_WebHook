import React, { useState } from 'react';
import { EventItem } from '../types';
import { StatusBadge } from './StatusBadge';
import { Search, Eye, Filter, ArrowRight, ArrowLeft } from 'lucide-react';

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

  return (
    <div className="glass-card rounded-xl border border-slate-800/80 shadow-xl overflow-hidden flex flex-col h-full">
      {/* Table Header & Controls */}
      <div className="p-4 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 bg-slate-900/40">
        <div>
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            Live Webhook Event Stream
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
              {totalCount} total
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Streaming real-time job execution states via SSE
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search ID, type, endpoint..."
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-48 sm:w-60 transition"
            />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(e.target.value)}
              className="bg-slate-950/80 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 appearance-none pr-8 cursor-pointer"
            >
              <option value="">All Statuses</option>
              <option value="QUEUED">QUEUED</option>
              <option value="PROCESSING">PROCESSING</option>
              <option value="RETRYING">RETRYING</option>
              <option value="DELIVERED">DELIVERED</option>
              <option value="DEAD_LETTERED">DEAD_LETTERED</option>
              <option value="CIRCUIT_HOLD">CIRCUIT_HOLD</option>
            </select>
            <Filter className="w-3 h-3 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800/80 bg-slate-950/30 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <th className="py-3 px-4">Event ID</th>
              <th className="py-3 px-4">Type</th>
              <th className="py-3 px-4">Target Endpoint</th>
              <th className="py-3 px-4">Attempts</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/40 text-xs font-mono">
            {filteredEvents.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-500 font-sans">
                  No events found matching your criteria.
                </td>
              </tr>
            ) : (
              filteredEvents.map((evt) => (
                <tr
                  key={evt.event_id}
                  onClick={() => onSelectEvent(evt.event_id)}
                  className="hover:bg-slate-800/30 transition cursor-pointer group"
                >
                  <td className="py-3 px-4 text-indigo-300 font-medium">
                    {evt.event_id.slice(0, 16)}...
                  </td>
                  <td className="py-3 px-4 text-slate-300 font-sans font-medium">
                    {evt.event_type}
                  </td>
                  <td className="py-3 px-4 text-slate-400 max-w-xs truncate font-sans text-xs" title={evt.target_url}>
                    {evt.target_url}
                  </td>
                  <td className="py-3 px-4 text-slate-300">
                    <span className="px-2 py-0.5 rounded bg-slate-800/80 text-slate-300 text-[11px]">
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
                      onReplay={() => onSingleReplay(evt.event_id)}
                    />
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectEvent(evt.event_id);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-sans transition group-hover:border-slate-600"
                    >
                      <Eye className="w-3 h-3 text-indigo-400" />
                      Inspect
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
