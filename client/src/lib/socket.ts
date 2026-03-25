import { io, Socket } from 'socket.io-client';

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SERVER_URL, {
      autoConnect: false,
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
}

export function connectSocket(token: string) {
  const s = getSocket();
  if (!s.connected) {
    s.auth = { token };
    s.connect();
  }
  return s;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export const SOCKET_EVENTS = {
  JOIN_ROOM: 'join_room',
  START_AUCTION: 'start_auction',
  PLACE_BID: 'place_bid',
  WITHDRAW: 'withdraw',
  SKIP: 'skip',
  ROOM_UPDATE: 'room_update',
  AUCTION_STATE: 'auction_state',
  BID_PLACED: 'bid_placed',
  PLAYER_SOLD: 'player_sold',
  PLAYER_UNSOLD: 'player_unsold',
  AUCTION_END: 'auction_end',
  TIMER_UPDATE: 'timer_update',
  ERROR: 'auction_error',
} as const;
