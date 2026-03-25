export const SOCKET_EVENTS = {
  // Client → Server
  JOIN_ROOM: 'join_room',
  START_AUCTION: 'start_auction',
  PLACE_BID: 'place_bid',
  WITHDRAW: 'withdraw',
  SKIP: 'skip',
  NEXT_PLAYER: 'next_player',

  // Server → Client
  ROOM_UPDATE: 'room_update',
  AUCTION_STATE: 'auction_state',
  BID_PLACED: 'bid_placed',
  PLAYER_SOLD: 'player_sold',
  PLAYER_UNSOLD: 'player_unsold',
  AUCTION_END: 'auction_end',
  TIMER_UPDATE: 'timer_update',
  ERROR: 'auction_error',
} as const;

export interface JoinRoomPayload {
  roomCode: string;
  token: string;
}

export interface PlaceBidPayload {
  roomId: string;
  amount: number;
}

export interface StartAuctionPayload {
  roomId: string;
}

export interface WithdrawPayload {
  roomId: string;
}

export interface SkipPayload {
  roomId: string;
}
