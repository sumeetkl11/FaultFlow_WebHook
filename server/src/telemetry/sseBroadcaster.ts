import { Response } from 'express';
import { logger } from '../utils/logger.js';

interface SSEClient {
  id: string;
  res: Response;
  tenantId: string;
}

const clients: Map<string, SSEClient> = new Map();

export function addClient(id: string, tenantId: string, res: Response) {
  clients.set(id, { id, tenantId, res });
  logger.debug(`SSE client connected: ${id} (total: ${clients.size})`);

  // Send initial keepalive
  res.write(`:connected\n\n`);

  res.on('close', () => {
    clients.delete(id);
    logger.debug(`SSE client disconnected: ${id} (remaining: ${clients.size})`);
  });
}

export function broadcast(eventType: string, data: Record<string, unknown>, tenantId?: string) {
  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;

  for (const [id, client] of clients.entries()) {
    if (!tenantId || client.tenantId === tenantId) {
      try {
        client.res.write(payload);
      } catch (err) {
        logger.warn({ id, err }, 'Failed writing to SSE client, disconnecting');
        clients.delete(id);
      }
    }
  }
}
