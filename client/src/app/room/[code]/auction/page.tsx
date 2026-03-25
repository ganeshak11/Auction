'use client';

import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useRouter, useParams } from 'next/navigation';
import { useState, useEffect, useCallback, useRef } from 'react';
import { connectSocket, SOCKET_EVENTS } from '@/lib/socket';

const TEAM_LOGOS: Record<string, string> = {
  CSK: '💛', RCB: '❤️', MI: '💙', KKR: '💜',
  SRH: '🧡', RR: '💗', DC: '🩵', PBKS: '🔴',
  GT: '🖤', LSG: '💕',
};

const ROLE_COLORS: Record<string, string> = {
  BAT: '#3b82f6', BOWL: '#10b981', AR: '#8b5cf6', WK: '#f59e0b',
};

const ROLE_LABELS: Record<string, string> = {
  BAT: 'Batter', BOWL: 'Bowler', AR: 'All-Rounder', WK: 'Wicket-Keeper',
};

interface AuctionState {
  currentPlayer: any;
  currentPlayerIdx: number;
  totalPlayers: number;
  currentPrice: number;
  currentTeam: string | null;
  status: string;
  withdrawnTeams: string[];
  teamPurses: Record<string, number>;
  timerExpiry?: string;
}

interface BidEntry {
  teamName: string;
  amount: number;
  timestamp: Date;
}

export default function AuctionPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const code = (params.code as string).toUpperCase();

  const [room, setRoom] = useState<any>(null);
  const [auctionState, setAuctionState] = useState<AuctionState | null>(null);
  const [bidHistory, setBidHistory] = useState<BidEntry[]>([]);
  const [timer, setTimer] = useState<number>(15);
  const [myTeam, setMyTeam] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [soldNotification, setSoldNotification] = useState<any>(null);
  const [unsoldNotification, setUnsoldNotification] = useState<any>(null);
  const [squads, setSquads] = useState<Record<string, any[]>>({});

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const bidHistoryRef = useRef<HTMLDivElement>(null);

  // Fetch initial state
  const fetchState = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.getRoom(token, code);
      setRoom(data.room);

      const participant = data.room.participants.find((p: any) => p.userId === user?.id);
      if (participant) setMyTeam(participant.teamName);

      // Build squads from existing data
      const squadMap: Record<string, any[]> = {};
      for (const s of (data.room.squads || [])) {
        if (!squadMap[s.teamName]) squadMap[s.teamName] = [];
        squadMap[s.teamName].push(s);
      }
      setSquads(squadMap);
    } catch (err: any) {
      setError(err.message);
    }
  }, [token, code, user]);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  // Timer countdown
  useEffect(() => {
    if (auctionState?.timerExpiry) {
      const updateTimer = () => {
        const remaining = Math.max(0, new Date(auctionState.timerExpiry!).getTime() - Date.now());
        setTimer(Math.ceil(remaining / 1000));

        if (remaining > 0) {
          timerRef.current = setTimeout(updateTimer, 100);
        }
      };
      updateTimer();
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [auctionState?.timerExpiry]);

  // Socket connection
  useEffect(() => {
    if (!token || !room) return;

    const socket = connectSocket(token);
    socket.emit(SOCKET_EVENTS.JOIN_ROOM, { roomCode: code, token });

    socket.on(SOCKET_EVENTS.AUCTION_STATE, (data: AuctionState) => {
      setAuctionState(data);
      setSoldNotification(null);
      setUnsoldNotification(null);
    });

    socket.on(SOCKET_EVENTS.BID_PLACED, (data: any) => {
      setBidHistory(prev => [{
        teamName: data.teamName,
        amount: data.amount,
        timestamp: new Date(),
      }, ...prev]);
    });

    socket.on(SOCKET_EVENTS.PLAYER_SOLD, (data: any) => {
      setSoldNotification(data);
      // Update squads (deduplicate)
      setSquads(prev => {
        const updated = { ...prev };
        if (!updated[data.teamName]) updated[data.teamName] = [];
        const alreadyExists = updated[data.teamName].some(
          (s: any) => s.player?.id === data.player?.id
        );
        if (!alreadyExists) {
          updated[data.teamName] = [...updated[data.teamName], { player: data.player, price: data.price }];
        }
        return updated;
      });
      // Clear bid history for next player
      setTimeout(() => setBidHistory([]), 2000);
    });

    socket.on(SOCKET_EVENTS.PLAYER_UNSOLD, (data: any) => {
      setUnsoldNotification(data);
      setTimeout(() => setBidHistory([]), 2000);
    });

    socket.on(SOCKET_EVENTS.TIMER_UPDATE, (data: any) => {
      setTimer(data.remaining);
    });

    socket.on(SOCKET_EVENTS.AUCTION_END, () => {
      router.push(`/room/${code}/results`);
    });

    socket.on(SOCKET_EVENTS.ERROR, (data: any) => {
      setError(data.message);
      setTimeout(() => setError(''), 3000);
    });

    return () => {
      socket.off(SOCKET_EVENTS.AUCTION_STATE);
      socket.off(SOCKET_EVENTS.BID_PLACED);
      socket.off(SOCKET_EVENTS.PLAYER_SOLD);
      socket.off(SOCKET_EVENTS.PLAYER_UNSOLD);
      socket.off(SOCKET_EVENTS.TIMER_UPDATE);
      socket.off(SOCKET_EVENTS.AUCTION_END);
      socket.off(SOCKET_EVENTS.ERROR);
    };
  }, [token, room, code, router]);

  const handleBid = (amount: number) => {
    if (!token || !room) return;
    const socket = connectSocket(token);
    socket.emit(SOCKET_EVENTS.PLACE_BID, { roomId: room.id, amount });
  };

  const handleWithdraw = () => {
    if (!token || !room) return;
    const socket = connectSocket(token);
    socket.emit(SOCKET_EVENTS.WITHDRAW, { roomId: room.id });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-bg">
        <div className="spinner" />
      </div>
    );
  }

  if (!user || !token) {
    router.push('/');
    return null;
  }

  const currentPlayer = auctionState?.currentPlayer;
  const isWithdrawn = myTeam ? auctionState?.withdrawnTeams?.includes(myTeam) : false;
  const myPurse = myTeam ? (auctionState?.teamPurses?.[myTeam] || 0) : 0;
  const isMyBid = auctionState?.currentTeam === myTeam;

  const formatPrice = (price: number) => {
    if (price >= 1) return `₹${price.toFixed(2)} Cr`;
    return `₹${(price * 100).toFixed(0)} L`;
  };

  return (
    <div className="min-h-screen gradient-bg">
      {/* Top Bar */}
      <header className="border-b border-surface-lighter/50 backdrop-blur-md bg-bg/80 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-xl">🏏</span>
            <div>
              <h1 className="text-sm font-bold text-primary-light">LIVE AUCTION</h1>
              <p className="text-xs text-text-muted font-mono">{code}</p>
            </div>
          </div>

          {myTeam && (
            <div className="flex items-center gap-3">
              <span className="text-lg">{TEAM_LOGOS[myTeam]}</span>
              <div className="text-right">
                <p className="text-sm font-bold">{myTeam}</p>
                <p className="text-xs text-accent font-mono">{formatPrice(myPurse)}</p>
              </div>
            </div>
          )}

          <div className="text-right text-xs text-text-muted">
            Player {(auctionState?.currentPlayerIdx || 0) + 1}/{auctionState?.totalPlayers || '?'}
          </div>
        </div>
      </header>

      {/* Error toast */}
      {error && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-danger text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-lg fade-in">
          {error}
        </div>
      )}

      {/* Sold notification overlay */}
      {soldNotification && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm fade-in">
          <div className="glass-card text-center max-w-sm sold-animation">
            <div className="text-6xl mb-4">🔨</div>
            <h2 className="text-2xl font-black text-success mb-2">SOLD!</h2>
            <p className="text-xl font-bold mb-1">{soldNotification.player?.name}</p>
            <p className="text-lg">
              <span className="text-text-muted">to</span>{' '}
              <span className="font-bold">{TEAM_LOGOS[soldNotification.teamName]} {soldNotification.teamName}</span>
            </p>
            <p className="text-2xl font-black text-accent mt-2">{formatPrice(soldNotification.price)}</p>
          </div>
        </div>
      )}

      {/* Unsold notification overlay */}
      {unsoldNotification && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm fade-in">
          <div className="glass-card text-center max-w-sm">
            <div className="text-6xl mb-4">❌</div>
            <h2 className="text-2xl font-black text-danger mb-2">UNSOLD</h2>
            <p className="text-xl font-bold">{unsoldNotification.player?.name}</p>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-[1fr_320px] gap-6">
          {/* Main auction area */}
          <div className="space-y-6">
            {/* Player Card + Timer */}
            {currentPlayer && (
              <div className="glass-card fade-in">
                <div className="flex flex-col md:flex-row gap-6">
                  {/* Player info */}
                  <div className="flex-1">
                    <div className="flex items-start gap-4 mb-4">
                      <div className="w-20 h-20 rounded-2xl bg-surface-lighter flex items-center justify-center overflow-hidden">
                        {currentPlayer.photo ? (
                          <img src={currentPlayer.photo} alt={currentPlayer.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-3xl font-bold text-text-muted">
                            {currentPlayer.name?.[0]}
                          </span>
                        )}
                      </div>
                      <div className="flex-1">
                        <h2 className="text-2xl font-black">{currentPlayer.name}</h2>
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className="text-xs font-bold px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: `${ROLE_COLORS[currentPlayer.role]}30`, color: ROLE_COLORS[currentPlayer.role] }}
                          >
                            {ROLE_LABELS[currentPlayer.role] || currentPlayer.role}
                          </span>
                          <span className="text-sm">
                            {currentPlayer.isOverseas ? '🌍' : '🇮🇳'} {currentPlayer.country}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="bg-bg-light rounded-xl p-3">
                        <p className="text-text-muted text-xs mb-0.5">Batting</p>
                        <p className="font-semibold">{currentPlayer.battingStyle}</p>
                      </div>
                      <div className="bg-bg-light rounded-xl p-3">
                        <p className="text-text-muted text-xs mb-0.5">Bowling</p>
                        <p className="font-semibold">{currentPlayer.bowlingStyle}</p>
                      </div>
                      <div className="bg-bg-light rounded-xl p-3">
                        <p className="text-text-muted text-xs mb-0.5">Base Price</p>
                        <p className="font-semibold text-accent">{formatPrice(currentPlayer.basePrice)}</p>
                      </div>
                      <div className="bg-bg-light rounded-xl p-3">
                        <p className="text-text-muted text-xs mb-0.5">Current Price</p>
                        <p className="font-black text-lg text-success">{formatPrice(auctionState?.currentPrice || 0)}</p>
                      </div>
                    </div>

                    {/* Current highest bidder */}
                    {auctionState?.currentTeam && (
                      <div className="mt-4 bg-success/10 border border-success/30 rounded-xl p-3 flex items-center gap-3">
                        <span className="text-xl">{TEAM_LOGOS[auctionState.currentTeam]}</span>
                        <div>
                          <p className="text-xs text-text-muted">Highest Bid</p>
                          <p className="font-bold">{auctionState.currentTeam} — {formatPrice(auctionState.currentPrice)}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Timer */}
                  <div className="flex flex-col items-center justify-center">
                    <div
                      className={`w-28 h-28 rounded-full flex items-center justify-center border-4 ${
                        timer <= 3 ? 'border-danger timer-urgent' : timer <= 5 ? 'border-accent timer-ring' : 'border-primary/50'
                      }`}
                    >
                      <span className={`text-4xl font-black ${timer <= 3 ? 'text-danger' : timer <= 5 ? 'text-accent' : 'text-text'}`}>
                        {timer}
                      </span>
                    </div>
                    <p className="text-text-muted text-xs mt-2">seconds</p>
                  </div>
                </div>
              </div>
            )}

            {/* Bid Controls */}
            {auctionState?.status === 'BIDDING' && myTeam && (() => {
              const isFirstBid = !auctionState?.currentTeam; // No one has bid yet
              const canBid = !isMyBid && !isWithdrawn;

              return (
                <div className="glass-card fade-in">
                  <div className="flex flex-wrap items-center gap-3">
                    {isFirstBid ? (
                      <>
                        {/* First bid: single button at base price */}
                        <button
                          onClick={() => handleBid(0)}
                          disabled={!canBid || myPurse < (currentPlayer?.basePrice || 0)}
                          className="bid-btn bid-btn-25 px-8"
                        >
                          🏏 Bid {formatPrice(currentPlayer?.basePrice || 0)}
                        </button>

                        <div className="h-8 w-px bg-surface-lighter mx-2" />

                        <button
                          onClick={handleWithdraw}
                          disabled={isWithdrawn}
                          className="bid-btn bid-btn-withdraw"
                        >
                          {isWithdrawn ? '✗ Skipped' : '⏭ Skip'}
                        </button>
                      </>
                    ) : (
                      <>
                        {/* Subsequent bids: increment buttons */}
                        <button
                          onClick={() => handleBid(0.25)}
                          disabled={!canBid || myPurse < (auctionState?.currentPrice || 0) + 0.25}
                          className="bid-btn bid-btn-25"
                        >
                          +25 L
                        </button>
                        <button
                          onClick={() => handleBid(0.50)}
                          disabled={!canBid || myPurse < (auctionState?.currentPrice || 0) + 0.50}
                          className="bid-btn bid-btn-50"
                        >
                          +50 L
                        </button>
                        <button
                          onClick={() => handleBid(1.0)}
                          disabled={!canBid || myPurse < (auctionState?.currentPrice || 0) + 1.0}
                          className="bid-btn bid-btn-100"
                        >
                          +1 Cr
                        </button>

                        <div className="h-8 w-px bg-surface-lighter mx-2" />

                        <button
                          onClick={handleWithdraw}
                          disabled={isWithdrawn || isMyBid}
                          className="bid-btn bid-btn-withdraw"
                        >
                          {isWithdrawn ? '✗ Withdrawn' : '🚫 Withdraw'}
                        </button>
                      </>
                    )}

                    {isMyBid && (
                      <span className="ml-auto text-success text-sm font-semibold flex items-center gap-1">
                        ✓ You hold the highest bid — wait for others
                      </span>
                    )}

                    {isWithdrawn && !isMyBid && (
                      <span className="ml-auto text-text-muted text-sm">
                        {isFirstBid ? 'Skipped this player' : 'Withdrawn from this player'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Bid History */}
            <div className="glass-card fade-in" style={{ maxHeight: '300px', overflow: 'hidden' }}>
              <h3 className="text-sm font-bold text-text-muted mb-3 uppercase tracking-wider">Bid History</h3>
              <div ref={bidHistoryRef} className="space-y-2 overflow-y-auto" style={{ maxHeight: '240px' }}>
                {bidHistory.length === 0 ? (
                  <p className="text-text-muted text-sm text-center py-4">No bids yet for this player</p>
                ) : (
                  bidHistory.map((bid, i) => (
                    <div
                      key={i}
                      className={`flex items-center justify-between py-2 px-3 rounded-lg ${
                        i === 0 ? 'bg-primary/10 border border-primary/20' : 'bg-bg-light'
                      } fade-in`}
                    >
                      <div className="flex items-center gap-2">
                        <span>{TEAM_LOGOS[bid.teamName] || '🏏'}</span>
                        <span className="font-semibold text-sm">{bid.teamName}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-sm">{formatPrice(bid.amount)}</span>
                        <span className="text-text-muted text-xs ml-2">
                          {bid.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right sidebar - Squad Summary + Team Purses */}
          <div className="space-y-6">
            {/* Team Purses */}
            <div className="glass-card fade-in">
              <h3 className="text-sm font-bold text-text-muted mb-3 uppercase tracking-wider">Team Purses</h3>
              <div className="space-y-2">
                {auctionState?.teamPurses && Object.entries(auctionState.teamPurses)
                  .sort(([, a], [, b]) => (b as number) - (a as number))
                  .map(([team, purse]) => (
                    <div
                      key={team}
                      className={`flex items-center justify-between py-2 px-3 rounded-lg ${
                        team === myTeam ? 'bg-primary/10 border border-primary/20' : 'bg-bg-light'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{TEAM_LOGOS[team]}</span>
                        <span className={`text-sm font-semibold ${team === myTeam ? 'text-primary-light' : ''}`}>
                          {team}
                        </span>
                      </div>
                      <span className="text-sm font-mono">{formatPrice(purse as number)}</span>
                    </div>
                  ))}
              </div>
            </div>

            {/* My Squad */}
            {myTeam && squads[myTeam] && squads[myTeam].length > 0 && (
              <div className="glass-card fade-in">
                <h3 className="text-sm font-bold text-text-muted mb-3 uppercase tracking-wider">
                  {TEAM_LOGOS[myTeam]} {myTeam} Squad ({squads[myTeam].length})
                </h3>
                <div className="space-y-2">
                  {squads[myTeam].map((s: any, i: number) => (
                    <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-bg-light text-sm">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: ROLE_COLORS[s.player?.role] || '#6366f1' }}
                        />
                        <span className="font-medium truncate">{s.player?.name}</span>
                      </div>
                      <span className="text-xs font-mono text-accent">{formatPrice(s.price)}</span>
                    </div>
                  ))}
                </div>

                {/* Role distribution */}
                <div className="mt-3 pt-3 border-t border-surface-lighter">
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(ROLE_LABELS).map(([role, label]) => {
                      const count = squads[myTeam]?.filter((s: any) => s.player?.role === role).length || 0;
                      return (
                        <span
                          key={role}
                          className="text-xs px-2 py-1 rounded-full"
                          style={{ backgroundColor: `${ROLE_COLORS[role]}20`, color: ROLE_COLORS[role] }}
                        >
                          {label}: {count}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
