'use client';

import React from 'react';
import { useTelemetryStore } from '../stores/useTelemetryStore';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useTelemetryStore();

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => {
          const isSuccess = toast.type === 'success';
          const isError = toast.type === 'error';
          const isWarning = toast.type === 'warning';

          const borderClass = isSuccess
            ? 'border-emerald-800/80 text-emerald-300'
            : isError
            ? 'border-rose-800/80 text-rose-300'
            : isWarning
            ? 'border-amber-800/80 text-amber-300'
            : 'border-zinc-700 text-zinc-300';

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.15 } }}
              exit={{ opacity: 0, y: 5, transition: { duration: 0.1 } }}
              className={`pointer-events-auto flex items-start gap-2.5 p-3 rounded bg-zinc-900 border ${borderClass} shadow-xl text-[11px] font-mono`}
            >
              <div className="mt-0.5 flex-shrink-0">
                {isSuccess && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                {isError && <AlertCircle className="w-3.5 h-3.5 text-rose-400" />}
                {isWarning && <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
                {!isSuccess && !isError && !isWarning && <Info className="w-3.5 h-3.5 text-zinc-400" />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="font-semibold text-zinc-100 tracking-tight">{toast.title}</div>
                <div className="text-zinc-400 mt-0.5 leading-snug">{toast.message}</div>
              </div>

              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => removeToast(toast.id)}
                className="text-zinc-500 hover:text-zinc-300 p-0.5 rounded transition-colors flex-shrink-0"
              >
                <X className="w-3 h-3" />
              </motion.button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
