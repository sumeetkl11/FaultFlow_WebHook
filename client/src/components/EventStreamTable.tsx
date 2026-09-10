'use client';

import React from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { EventItem } from '../types';
import { useTelemetryStore } from '../stores/useTelemetryStore';
import {
  Search,
  Eye,
  ArrowRight,
  ArrowLeft,
  RotateCw,
  CheckCircle2,
  AlertOctagon,
  Layers,
} from 'lucide-react';

/* ── Status badge (sharp 4px rect, transitions on status change) ─────────── */
function StatusBadge({ status, attempts, maxRetries, latencyMs, onReplay }: {
  status: string;
  attempts?: number;
  maxRetries?: number;
  latencyMs?: number | null;
  onReplay?: () => void;
}) {
  const { audienceMode } = useTelemetryStore();
  const isBusiness = audienceMode === 'business';

  const map: Record<string, string> = {
    QUEUED:       'badge badge-queued',
    PROCESSING:   'badge badge-processing',
    RETRYING:     'badge badge-retrying',
    DELIVERED:    'badge badge-delivered',
    DEAD_LETTERED:'badge badge-dead',
    CIRCUIT_HOLD: 'badge badge-circuit',
  };

  const labelMap: Record<string, string> = {
    QUEUED:       isBusiness ? 'Queued' : 'QUEUED',
    PROCESSING:   isBusiness ? 'Sending…' : 'PROCESSING',
    RETRYING:     isBusiness ? `Auto-Retry (${attempts}/${maxRetries})` : `RETRY ${attempts}/${maxRetries}`,
    DELIVERED:    isBusiness ? 'Delivered' : `DELIVERED${latencyMs != null ? ` · ${latencyMs}ms` : ''}`,
    DEAD_LETTERED:isBusiness ? 'Action Needed' : 'DLQ',
    CIRCUIT_HOLD: isBusiness ? 'Paused' : 'CIRCUIT_HOLD',
  };

  const cls   = map[status] ?? 'badge bg-zinc-800 text-zinc-400 border-zinc-700';
  const label = labelMap[status] ?? status;

  return (
    <span className={`${cls} transition-colors duration-150 ease-in-out`}>
      {label}
      {status === 'DEAD_LETTERED' && onReplay && (
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={(e) => { e.stopPropagation(); onReplay(); }}
          className="ml-1 px-1 py-0.5 rounded bg-rose-900/80 hover:bg-rose-800/80 text-rose-200 text-[10px] font-mono border border-rose-700/50 transition-colors"
        >
          ↺
        </motion.button>
      )}
    </span>
  );
}

/* ── Filter chip button ──────────────────────────────────────────────────── */
function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
        active
          ? 'bg-zinc-700 text-zinc-100 border border-zinc-600'
          : 'bg-zinc-900 text-zinc-500 border border-zinc-800 hover:text-zinc-300 hover:border-zinc-700'
      }`}
    >
      {children}
    </motion.button>
  );
}

/* ── Row enter animation config ─────────────────────────────────────────── */
const rowVariants: Variants = {
  hidden:  { opacity: 0, y: -10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' as const } },
  exit:    { opacity: 0, transition: { duration: 0.1 } },
};

/* ── Props ───────────────────────────────────────────────────────────────── */
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

/* ── Component ───────────────────────────────────────────────────────────── */
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

  // 4.4 Search Debounce (200ms) to avoid re-renders on each keystroke
  const [localSearch, setLocalSearch] = React.useState(searchQuery);

  React.useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== searchQuery) {
        onSearchQueryChange(localSearch);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [localSearch, searchQuery, onSearchQueryChange]);

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
    optimisticReplay([eventId]);
    addToast({
      type: 'info',
      title: isBusiness ? 'Resending Order' : 'Optimistic Replay Triggered',
      message: `Event ${eventId.slice(0, 8)} transitioned to QUEUED.`,
    });
    onSingleReplay(eventId);
  };

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-md overflow-hidden flex flex-col h-full">

      {/* ── Header bar ──────────────────────────────────────────────────── */}
      <div className="h-9 px-3 border-b border-zinc-800 bg-zinc-900 flex items-center justify-between gap-3 flex-shrink-0">
        {/* Left: title + total count */}
        <div className="flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-zinc-500" />
          <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
            {isBusiness ? 'Live Transaction Stream' : 'Webhook Event Stream'}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono tabular-nums border border-zinc-700">
            {totalCount}
          </span>
        </div>

        {/* Right: search + filter controls */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
            <input
              type="text"
              placeholder="Search…"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="pl-6 pr-2 py-1 bg-zinc-950 border border-zinc-800 rounded text-[11px] text-zinc-200 placeholder-zinc-600 font-mono focus:outline-none focus:border-zinc-600 w-36 transition-colors"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[11px] text-zinc-400 font-mono focus:outline-none focus:border-zinc-600 cursor-pointer appearance-none transition-colors"
          >
            <option value="">All</option>
            <option value="QUEUED">QUEUED</option>
            <option value="PROCESSING">PROCESSING</option>
            <option value="RETRYING">RETRYING</option>
            <option value="DELIVERED">DELIVERED</option>
            <option value="DEAD_LETTERED">DLQ</option>
            <option value="CIRCUIT_HOLD">CIRCUIT_HOLD</option>
          </select>
        </div>
      </div>

      {/* ── Quick filter chips ────────────────────────────────────────── */}
      <div className="px-3 py-1.5 border-b border-zinc-800/60 bg-zinc-950 flex items-center gap-1.5 overflow-x-auto flex-shrink-0">
        <FilterChip active={statusFilter === ''} onClick={() => onStatusFilterChange('')}>
          All ({totalCount})
        </FilterChip>
        <FilterChip active={statusFilter === 'DEAD_LETTERED'} onClick={() => onStatusFilterChange('DEAD_LETTERED')}>
          <span className="flex items-center gap-1">
            <AlertOctagon className="w-2.5 h-2.5" />
            {isBusiness ? 'Action Needed' : 'DLQ'}
          </span>
        </FilterChip>
        <FilterChip active={statusFilter === 'RETRYING'} onClick={() => onStatusFilterChange('RETRYING')}>
          <span className="flex items-center gap-1">
            <RotateCw className="w-2.5 h-2.5" />
            Retrying
          </span>
        </FilterChip>
        <FilterChip active={statusFilter === 'DELIVERED'} onClick={() => onStatusFilterChange('DELIVERED')}>
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-2.5 h-2.5" />
            Delivered
          </span>
        </FilterChip>
      </div>

      {/* ── Table ────────────────────────────────────────────────────── */}
      <div className="overflow-auto flex-1">
        <table className="w-full text-left border-collapse table-fixed">
          <colgroup>
            <col className="w-8" />
            <col className="w-36" />
            <col className="w-32" />
            <col />
            <col className="w-16" />
            <col className="w-36" />
            <col className="w-20" />
          </colgroup>
          <thead className="sticky top-0 z-10">
            <tr className="bg-zinc-900 border-b border-zinc-800 text-[11px] font-mono uppercase tracking-wider text-zinc-500">
              <th className="py-1.5 px-3">#</th>
              <th className="py-1.5 px-3">{isBusiness ? 'Transaction ID' : 'Event ID'}</th>
              <th className="py-1.5 px-3">Type</th>
              <th className="py-1.5 px-3">Target</th>
              <th className="py-1.5 px-3 text-center">Tries</th>
              <th className="py-1.5 px-3">Status</th>
              <th className="py-1.5 px-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredEvents.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-zinc-600 text-[13px] font-mono">
                  No events match your filter criteria.
                </td>
              </tr>
            ) : (
              <AnimatePresence initial={false}>
                {filteredEvents.map((evt, idx) => (
                  <motion.tr
                    key={evt.event_id}
                    variants={rowVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    onClick={() => onSelectEvent(evt.event_id)}
                    whileTap={{ scale: 0.995 }}
                    className="event-row border-b border-zinc-800/40 cursor-pointer group text-[13px]"
                  >
                    {/* Row # */}
                    <td className="py-1.5 px-3 text-zinc-600 font-mono tabular-nums text-[11px]">
                      {(page - 1) * pageSize + idx + 1}
                    </td>

                    {/* Event ID */}
                    <td className="py-1.5 px-3">
                      <span className="font-mono text-[11px] text-zinc-300 tabular-nums" title={evt.event_id}>
                        {evt.event_id.slice(0, 13)}…
                      </span>
                    </td>

                    {/* Event Type */}
                    <td className="py-1.5 px-3">
                      <span className="text-[12px] text-zinc-200 font-mono truncate block">
                        {evt.event_type}
                      </span>
                    </td>

                    {/* Target URL */}
                    <td className="py-1.5 px-3">
                      <span className="text-[11px] text-zinc-500 font-mono truncate block" title={evt.target_url}>
                        {evt.target_url}
                      </span>
                    </td>

                    {/* Attempts */}
                    <td className="py-1.5 px-3 text-center">
                      <span className="font-mono text-[11px] tabular-nums text-zinc-400">
                        {evt.attempts}/{evt.max_retries ?? 5}
                      </span>
                    </td>

                    {/* Status badge */}
                    <td className="py-1.5 px-3">
                      <StatusBadge
                        status={evt.status}
                        attempts={evt.attempts}
                        maxRetries={evt.max_retries ?? 5}
                        latencyMs={evt.latency_ms}
                        onReplay={() => handleReplayClick(evt.event_id)}
                      />
                    </td>

                    {/* Inspect action */}
                    <td className="py-1.5 px-3 text-right">
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={(e) => { e.stopPropagation(); onSelectEvent(evt.event_id); }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-mono border border-zinc-700/60 group-hover:border-zinc-600 transition-colors"
                      >
                        <Eye className="w-2.5 h-2.5" />
                        Inspect
                      </motion.button>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination footer ─────────────────────────────────────────── */}
      <div className="h-8 px-3 border-t border-zinc-800 bg-zinc-900 flex items-center justify-between text-[11px] text-zinc-500 font-mono flex-shrink-0">
        <span className="tabular-nums">
          {filteredEvents.length} of {totalCount}
        </span>
        <div className="flex items-center gap-1.5">
          <motion.button
            whileTap={{ scale: 0.97 }}
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="p-1 rounded border border-zinc-800 bg-zinc-950 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
          </motion.button>
          <span className="tabular-nums px-1">
            {page} / {totalPages}
          </span>
          <motion.button
            whileTap={{ scale: 0.97 }}
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="p-1 rounded border border-zinc-800 bg-zinc-950 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowRight className="w-3 h-3" />
          </motion.button>
        </div>
      </div>
    </div>
  );
};
