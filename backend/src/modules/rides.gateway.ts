import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Server } from 'socket.io';

@WebSocketGateway({ cors: { origin: '*' } })
export class RidesGateway {
  @WebSocketServer()
  server!: Server;

  broadcastRideUpdate(payload: unknown) {
    this.server?.emit('ride:update', payload);
  }
}
