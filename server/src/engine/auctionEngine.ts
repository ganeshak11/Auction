import { Server } from 'socket.io';
import { Player, Room, RoomParticipant } from '@prisma/client';
import { prisma } from '../index';
import { SOCKET_EVENTS } from '../socket/events';
import { validateBid } from './bidValidator';
import { calculateLeaderboard } from './leaderboard';

interface RoomWithParticipants extends Room {
  participants: (RoomParticipant & { user?: any })[];
}

interface AuctionStateLocal {
  currentPlayerIdx: number;
  currentPrice: number;
  currentTeam: string | null;
  currentUserId: string | null;
  status: 'WAITING' | 'BIDDING' | 'SOLD' | 'UNSOLD' | 'COMPLETED';
  withdrawnTeams: string[];
  skippedTeams: string[];
  timerExpiry: Date | null;
  soldPlayers: Map<string, { teamName: string; price: number }>;
  unsoldPlayers: Set<string>;
}

export class AuctionEngine {
  private room: RoomWithParticipants;
  private players: Player[];
  private io: Server;
  private state: AuctionStateLocal;
  private timer: NodeJS.Timeout | null = null;
  private teamPurses: Map<string, number> = new Map();

  constructor(room: RoomWithParticipants, players: Player[], io: Server) {
    this.room = room;
    this.players = players;
    this.io = io;

    this.state = {
      currentPlayerIdx: 0,
      currentPrice: 0,
      currentTeam: null,
      currentUserId: null,
      status: 'WAITING',
      withdrawnTeams: [],
      skippedTeams: [],
      timerExpiry: null,
      soldPlayers: new Map(),
      unsoldPlayers: new Set(),
    };

    // Initialize purses
    for (const p of room.participants) {
      if (p.teamName) {
        this.teamPurses.set(p.teamName, room.purse);
      }
    }
  }

  startNextPlayer() {
    if (this.state.currentPlayerIdx >= this.players.length) {
      this.endAuction();
      return;
    }

    const player = this.players[this.state.currentPlayerIdx];

    this.state.status = 'BIDDING';
    this.state.currentPrice = player.basePrice;
    this.state.currentTeam = null;
    this.state.currentUserId = null;
    this.state.withdrawnTeams = [];
    this.state.skippedTeams = [];

    this.startTimer();
    this.broadcastState();
    this.saveState();
  }

  private startTimer() {
    this.clearTimer();

    const durationMs = this.room.timerDuration * 1000;
    this.state.timerExpiry = new Date(Date.now() + durationMs);

    this.timer = setTimeout(() => {
      this.onTimerExpiry();
    }, durationMs);

    // Broadcast timer updates every second
    this.broadcastTimerUpdate();
  }

  private clearTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private broadcastTimerUpdate() {
    if (this.state.status !== 'BIDDING') return;

    const remaining = this.state.timerExpiry
      ? Math.max(0, this.state.timerExpiry.getTime() - Date.now())
      : 0;

    this.io.to(this.room.code).emit(SOCKET_EVENTS.TIMER_UPDATE, {
      remaining: Math.ceil(remaining / 1000),
      expiry: this.state.timerExpiry?.toISOString(),
    });

    if (remaining > 0) {
      setTimeout(() => this.broadcastTimerUpdate(), 1000);
    }
  }

  private async onTimerExpiry() {
    const player = this.players[this.state.currentPlayerIdx];

    if (this.state.currentTeam) {
      // Player sold
      this.state.status = 'SOLD';

      // Update purse
      const currentPurse = this.teamPurses.get(this.state.currentTeam) || 0;
      this.teamPurses.set(this.state.currentTeam, currentPurse - this.state.currentPrice);

      // Record in database
      await prisma.teamSquad.create({
        data: {
          roomId: this.room.id,
          teamName: this.state.currentTeam,
          playerId: player.id,
          price: this.state.currentPrice,
        },
      });

      this.state.soldPlayers.set(player.id, {
        teamName: this.state.currentTeam,
        price: this.state.currentPrice,
      });

      this.io.to(this.room.code).emit(SOCKET_EVENTS.PLAYER_SOLD, {
        player,
        teamName: this.state.currentTeam,
        price: this.state.currentPrice,
        purseRemaining: this.teamPurses.get(this.state.currentTeam),
      });
    } else {
      // Player unsold
      this.state.status = 'UNSOLD';
      this.state.unsoldPlayers.add(player.id);

      this.io.to(this.room.code).emit(SOCKET_EVENTS.PLAYER_UNSOLD, {
        player,
      });
    }

    await this.saveState();

    // Move to next player after a short delay
    setTimeout(() => {
      this.state.currentPlayerIdx++;
      this.startNextPlayer();
    }, 2000);
  }

  async placeBid(userId: string, teamName: string, amount: number) {
    if (this.state.status !== 'BIDDING') {
      throw new Error('Auction not in bidding state');
    }

    // Prevent the current highest bidder from bidding again
    if (this.state.currentTeam === teamName) {
      throw new Error('You already hold the highest bid');
    }

    const player = this.players[this.state.currentPlayerIdx];
    const currentPurse = this.teamPurses.get(teamName) || 0;

    // amount=0 means "bid at base price" (first bid)
    const newPrice = amount === 0 ? this.state.currentPrice : this.state.currentPrice + amount;

    // Validate bid
    const validation = await validateBid(
      this.room.id,
      teamName,
      newPrice,
      player.id,
      currentPurse,
      this.state.withdrawnTeams
    );

    if (!validation.valid) {
      throw new Error(validation.reason || 'Invalid bid');
    }

    // Update state
    this.state.currentPrice = newPrice;
    this.state.currentTeam = teamName;
    this.state.currentUserId = userId;

    // Clear all skipped teams so they can bid again
    this.state.skippedTeams = [];

    // Record bid
    await prisma.bid.create({
      data: {
        roomId: this.room.id,
        playerId: player.id,
        userId,
        teamName,
        amount: newPrice,
      },
    });

    // Reset timer
    this.startTimer();

    // Broadcast
    this.io.to(this.room.code).emit(SOCKET_EVENTS.BID_PLACED, {
      teamName,
      amount: newPrice,
      purseRemaining: currentPurse,
      player,
    });

    this.broadcastState();
    this.saveState();
  }

  withdraw(teamName: string) {
    if (this.state.status !== 'BIDDING') {
      throw new Error('Auction not in bidding state');
    }

    if (!this.state.withdrawnTeams.includes(teamName)) {
      this.state.withdrawnTeams.push(teamName);
      // Also remove from skipped if they were skipped before
      this.state.skippedTeams = this.state.skippedTeams.filter(t => t !== teamName);
      this.broadcastState();

      // Check if all teams have withdrawn/skipped
      this.checkAllInactive();
    }
  }

  skip(teamName: string) {
    if (this.state.status !== 'BIDDING') {
      throw new Error('Auction not in bidding state');
    }

    if (!this.state.skippedTeams.includes(teamName) && !this.state.withdrawnTeams.includes(teamName)) {
      this.state.skippedTeams.push(teamName);
      this.broadcastState();

      // Check if all teams have skipped/withdrawn
      this.checkAllInactive();
    }
  }

  private checkAllInactive() {
    const allTeams = this.room.participants
      .map(p => p.teamName)
      .filter(Boolean) as string[];

    // Teams that are still active (not withdrawn, not skipped, and not the current highest bidder)
    const activeTeams = allTeams.filter(team =>
      !this.state.withdrawnTeams.includes(team) &&
      !this.state.skippedTeams.includes(team) &&
      team !== this.state.currentTeam
    );

    if (activeTeams.length === 0) {
      // All teams have withdrawn/skipped — resolve immediately
      this.clearTimer();
      this.onTimerExpiry();
    }
  }

  private async endAuction() {
    this.clearTimer();
    this.state.status = 'COMPLETED';

    await prisma.room.update({
      where: { id: this.room.id },
      data: { status: 'COMPLETED' },
    });

    await prisma.auctionState.update({
      where: { roomId: this.room.id },
      data: { status: 'COMPLETED' },
    });

    // Calculate leaderboard
    const results = await calculateLeaderboard(this.room.id);

    this.io.to(this.room.code).emit(SOCKET_EVENTS.AUCTION_END, {
      results,
    });
  }

  private async saveState() {
    try {
      await prisma.auctionState.update({
        where: { roomId: this.room.id },
        data: {
          currentPlayerIdx: this.state.currentPlayerIdx,
          currentPrice: this.state.currentPrice,
          currentTeam: this.state.currentTeam,
          currentUserId: this.state.currentUserId,
          status: this.state.status,
          withdrawnTeams: this.state.withdrawnTeams,
          timerExpiry: this.state.timerExpiry,
        },
      });
    } catch (error) {
      console.error('Failed to save auction state:', error);
    }
  }

  private broadcastState() {
    const player = this.players[this.state.currentPlayerIdx];
    const purses: Record<string, number> = {};
    this.teamPurses.forEach((v, k) => { purses[k] = v; });

    this.io.to(this.room.code).emit(SOCKET_EVENTS.AUCTION_STATE, {
      currentPlayer: player,
      currentPlayerIdx: this.state.currentPlayerIdx,
      totalPlayers: this.players.length,
      currentPrice: this.state.currentPrice,
      currentTeam: this.state.currentTeam,
      status: this.state.status,
      withdrawnTeams: this.state.withdrawnTeams,
      skippedTeams: this.state.skippedTeams,
      teamPurses: purses,
      timerExpiry: this.state.timerExpiry?.toISOString(),
    });
  }

  getState() {
    const player = this.players[this.state.currentPlayerIdx];
    const purses: Record<string, number> = {};
    this.teamPurses.forEach((v, k) => { purses[k] = v; });

    return {
      currentPlayer: player,
      currentPlayerIdx: this.state.currentPlayerIdx,
      totalPlayers: this.players.length,
      currentPrice: this.state.currentPrice,
      currentTeam: this.state.currentTeam,
      status: this.state.status,
      withdrawnTeams: this.state.withdrawnTeams,
      skippedTeams: this.state.skippedTeams,
      teamPurses: purses,
      timerExpiry: this.state.timerExpiry?.toISOString(),
    };
  }
}
