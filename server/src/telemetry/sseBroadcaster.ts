import { Response } from 'express';
import { logger } from '../utils/logger.js';

interface SSEClient {
  id: string;
  res: Response;
  tenantId: string;
}

class SSEBroadcaster {
  private clients: Map<string, SSEClient> = new Map();

  addClient(id: string, tenantId: string, res: Response) {
    this.clients.set(id, { id, tenantId, res });
    logger.debug(`SSE client connected: ${id} (total: ${this.clients.size})`);

    // Send initial keepalive
    res.write(`:connected\n\n`);

    res.on('close', () => {
      this.clients.delete(id);
      logger.debug(`SSE client disconnected: ${id} (remaining: ${this.clients.size})`);
    });
  }

  broadcast(eventType: string, data: any, tenantId?: string) {
    const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;

    for (const [id, client] of this.clients.entries()) {
      if (!tenantId || client.tenantId === tenantId) {
        try {
          client.res.write(payload);
        } catch (err) {
          logger.warn({ id, err }, 'Failed writing to SSE client, disconnecting');
          this.clients.delete(id);
        }
      }
    }
  }

  getClientCount(): number {
    return this.clients.size;
  }
}

export const sseBroadcaster = new SSEBroadcaster();
