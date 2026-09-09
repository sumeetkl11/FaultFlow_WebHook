import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'FaultFlow: Resilient Webhook Orchestration & Telemetry',
  description:
    'High-throughput webhook delivery, BullMQ worker cluster with jitter backoff, DLQ remediation, and real-time SSE observability.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased selection:bg-zinc-800 selection:text-zinc-100 font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
