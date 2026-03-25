'use client';

import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useRouter, useParams } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { connectSocket, SOCKET_EVENTS } from '@/lib/socket';

const TEAM_LOGOS: Record<string, string> = {
  CSK: '💛', RCB: '❤️', MI: '💙', KKR: '💜',
  SRH: '🧡', RR: '💗', DC: '🩵', PBKS: '🔴',
  GT: '🖤', LSG: '💕',
};

const TEAM_NAMES: Record<string, string> = {
  CSK: 'Chennai Super Kings', RCB: 'Royal Challengers', MI: 'Mumbai Indians',
  KKR: 'Kolkata Knight Riders', SRH: 'Sunrisers Hyderabad', RR: 'Rajasthan Royals',
  DC: 'Delhi Capitals', PBKS: 'Punjab Kings', GT: 'Gujarat Titans', LSG: 'Lucknow Super Giants',
};

interface Participant {
  id: string;
  userId: string;
  teamName: string | null;
  isHost: boolean;
  user: { id: string; name: string; email: string; avatar?: string };
}

export default function LobbyPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const code = (params.code as string).toUpperCase();

  const [room, setRoom] = useState<any>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [error, setError] = useState('');
  const [loadingRoom, setLoadingRoom] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [copied, setCopied] = useState(false);

  const isHost = room?.hostId === user?.id;

  const fetchRoom = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.getRoom(token, code);
      setRoom(data.room);
      setParticipants(data.room.participants);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingRoom(false);
    }
  }, [token, code]);

  useEffect(() => {
    fetchRoom();
  }, [fetchRoom]);

  useEffect(() => {
    if (!token || !room) return;

    const socket = connectSocket(token);
    socket.emit(SOCKET_EVENTS.JOIN_ROOM, { roomCode: code, token });

    socket.on(SOCKET_EVENTS.ROOM_UPDATE, (data: any) => {
      setParticipants(data.participants);
      if (data.status === 'AUCTIONING') {
        router.push(`/room/${code}/auction`);
      }
    });

    socket.on(SOCKET_EVENTS.AUCTION_STATE, () => {
      router.push(`/room/${code}/auction`);
    });

    socket.on(SOCKET_EVENTS.ERROR, (data: any) => {
      setError(data.message);
    });

    return () => {
      socket.off(SOCKET_EVENTS.ROOM_UPDATE);
      socket.off(SOCKET_EVENTS.AUCTION_STATE);
      socket.off(SOCKET_EVENTS.ERROR);
    };
  }, [token, room, code, router]);

  const handleAssignTeams = async () => {
    if (!token) return;
    setAssigning(true);
    setError('');
    try {
      const data = await api.assignTeams(token, code);
      setParticipants(data.room.participants);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAssigning(false);
    }
  };

  const handleStartAuction = async () => {
    if (!token || !room) return;
    setStarting(true);
    setError('');
    try {
      const socket = connectSocket(token);
      socket.emit(SOCKET_EVENTS.START_AUCTION, { roomId: room.id });
    } catch (err: any) {
      setError(err.message);
      setStarting(false);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading || loadingRoom) {
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

  const allTeamsAssigned = participants.every(p => p.teamName);

  return (
    <div className="min-h-screen gradient-bg">
      {/* Header */}
      <header className="border-b border-surface-lighter/50 backdrop-blur-md bg-bg/50 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => router.push('/dashboard')} className="text-text-muted hover:text-text transition flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back
          </button>
          <div className="text-center">
            <h1 className="text-lg font-bold">Auction Lobby</h1>
          </div>
          <div className="w-16" />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Room Code */}
        <div className="text-center mb-8 slide-up">
          <p className="text-text-muted text-sm mb-2">Room Code</p>
          <button
            onClick={handleCopyCode}
            className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-surface border-2 border-primary/30 hover:border-primary/60 transition-all group"
          >
            <span className="text-3xl font-black tracking-[0.3em] text-primary-light font-mono">{code}</span>
            <svg className="w-5 h-5 text-text-muted group-hover:text-primary-light transition" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
          {copied && <p className="text-success text-sm mt-2 fade-in">Copied to clipboard!</p>}
          <p className="text-text-muted text-xs mt-2">Share this code with other participants</p>
        </div>

        {/* Room Settings */}
        {room && (
          <div className="flex flex-wrap justify-center gap-4 mb-8 text-sm text-text-muted">
            <span>💰 <strong className="text-text">{room.purse} Cr</strong></span>
            <span>⏱ <strong className="text-text">{room.timerDuration}s</strong></span>
            <span>👥 <strong className="text-text">{participants.length}/10</strong></span>
            <span>📊 <strong className="text-text">{room.minPlayers}-{room.maxPlayers}</strong> squad</span>
            <span>🌍 <strong className="text-text">≤{room.overseasLimit}</strong> overseas</span>
          </div>
        )}

        {error && (
          <div className="text-danger bg-danger/10 rounded-xl px-4 py-3 mb-6 text-sm text-center">
            {error}
          </div>
        )}

        {/* Participants */}
        <div className="glass-card mb-6 fade-in">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-primary-light" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Participants ({participants.length})
          </h3>

          <div className="space-y-3">
            {participants.map((p, idx) => (
              <div
                key={p.id}
                className={`flex items-center justify-between p-3 rounded-xl transition-all ${
                  p.userId === user.id ? 'bg-primary/10 border border-primary/30' : 'bg-bg-light hover:bg-surface-lighter/20'
                }`}
                style={{ animationDelay: `${idx * 0.05}s` }}
              >
                <div className="flex items-center gap-3">
                  {p.user.avatar ? (
                    <img src={p.user.avatar} alt="" className="w-10 h-10 rounded-full ring-2 ring-surface-lighter" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-surface-lighter flex items-center justify-center text-lg font-bold">
                      {p.user.name[0]}
                    </div>
                  )}
                  <div>
                    <p className="font-semibold flex items-center gap-2">
                      {p.user.name}
                      {p.isHost && (
                        <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded-full">HOST</span>
                      )}
                      {p.userId === user.id && (
                        <span className="text-xs bg-primary/20 text-primary-light px-2 py-0.5 rounded-full">YOU</span>
                      )}
                    </p>
                    <p className="text-xs text-text-muted">{p.user.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {p.teamName ? (
                    <div className={`team-${p.teamName} px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2`}
                      style={{ background: `var(--team-color, #6366f1)20`, borderLeft: `3px solid var(--team-color, #6366f1)` }}>
                      <span>{TEAM_LOGOS[p.teamName] || '🏏'}</span>
                      <span>{p.teamName}</span>
                    </div>
                  ) : (
                    <span className="text-text-muted text-sm italic">No team</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Host Controls */}
        {isHost && (
          <div className="glass-card fade-in">
            <h3 className="text-lg font-bold mb-4">🎮 Host Controls</h3>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => router.push(`/room/${code}/players`)}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-accent to-amber-600 font-bold hover:shadow-lg hover:shadow-accent/25 transition-all"
              >
                📋 Select Players {room?.selectedPlayers?.length > 0 ? `(${room.selectedPlayers.length})` : ''}
              </button>

              <button
                onClick={handleAssignTeams}
                disabled={assigning || participants.length < 2}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-primary to-purple-600 font-bold hover:shadow-lg hover:shadow-primary/25 transition-all disabled:opacity-50"
              >
                {assigning ? 'Assigning...' : '🎲 Assign Teams Randomly'}
              </button>

              <button
                onClick={handleStartAuction}
                disabled={starting || !allTeamsAssigned || participants.length < 2}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-success to-emerald-600 font-bold hover:shadow-lg hover:shadow-success/25 transition-all disabled:opacity-50"
              >
                {starting ? 'Starting...' : '🏏 Start Auction'}
              </button>
            </div>

            {room?.selectedPlayers?.length > 0 && (
              <p className="text-text-muted text-sm mt-3">
                ✓ {room.selectedPlayers.length} players selected for auction
              </p>
            )}
            {(!room?.selectedPlayers || room.selectedPlayers.length === 0) && (
              <p className="text-accent text-sm mt-3">
                💡 No players selected — all {93} seeded players will be used. Click "Select Players" to customize.
              </p>
            )}

            {participants.length < 2 && (
              <p className="text-accent text-sm mt-3">Need at least 2 participants to start</p>
            )}
            {participants.length >= 2 && !allTeamsAssigned && (
              <p className="text-accent text-sm mt-3">Assign teams to all participants before starting</p>
            )}
          </div>
        )}

        {!isHost && (
          <div className="text-center text-text-muted py-8">
            <p className="text-lg mb-2">⏳ Waiting for the host to start the auction...</p>
            <p className="text-sm">The host will assign teams and begin the auction</p>
          </div>
        )}
      </main>
    </div>
  );
}
