'use client';

import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function Dashboard() {
  const { user, token, loading, logout } = useAuth();
  const router = useRouter();
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Room settings
  const [purse, setPurse] = useState(100);
  const [timerDuration, setTimerDuration] = useState(15);
  const [maxPlayers, setMaxPlayers] = useState(25);
  const [minPlayers, setMinPlayers] = useState(15);
  const [overseasLimit, setOverseasLimit] = useState(8);
  const [minBat, setMinBat] = useState(3);
  const [minBowl, setMinBowl] = useState(3);
  const [minAr, setMinAr] = useState(1);
  const [minWk, setMinWk] = useState(1);

  useEffect(() => {
    if (!loading && (!user || !token)) {
      router.push('/');
    }
  }, [loading, user, token, router]);

  if (loading || !user || !token) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-bg">
        <div className="spinner" />
      </div>
    );
  }

  const handleCreateRoom = async () => {
    setCreating(true);
    setError('');
    try {
      const data = await api.createRoom(token, {
        purse,
        timerDuration,
        maxPlayers,
        minPlayers,
        overseasLimit,
        minBat,
        minBowl,
        minAr,
        minWk,
      });
      router.push(`/room/${data.room.code}/lobby`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!joinCode.trim()) {
      setError('Enter a room code');
      return;
    }
    setJoining(true);
    setError('');
    try {
      const data = await api.joinRoom(token, joinCode.trim());
      router.push(`/room/${data.room.code}/lobby`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setJoining(false);
    }
  };

  const SettingRow = ({ label, value, onChange, min, max, unit }: {
    label: string; value: number; onChange: (v: number) => void; min: number; max: number; unit?: string;
  }) => (
    <div className="flex items-center justify-between gap-3">
      <label className="text-sm text-text-muted whitespace-nowrap">{label}</label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          className="w-7 h-7 rounded-lg bg-bg flex items-center justify-center text-text-muted hover:bg-surface-lighter hover:text-text transition text-sm font-bold"
        >−</button>
        <span className="text-sm font-bold w-10 text-center">{value}{unit || ''}</span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          className="w-7 h-7 rounded-lg bg-bg flex items-center justify-center text-text-muted hover:bg-surface-lighter hover:text-text transition text-sm font-bold"
        >+</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen gradient-bg">
      {/* Header */}
      <header className="border-b border-surface-lighter/50 backdrop-blur-md bg-bg/50 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏏</span>
            <h1 className="text-xl font-bold bg-gradient-to-r from-primary-light to-accent bg-clip-text text-transparent">
              Mock IPL Auction
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {user.avatar && (
                <img src={user.avatar} alt="" className="w-8 h-8 rounded-full ring-2 ring-primary/30" />
              )}
              <span className="text-sm font-medium hidden sm:block">{user.name}</span>
            </div>
            <button
              onClick={logout}
              className="text-sm text-text-muted hover:text-text transition px-3 py-1.5 rounded-lg hover:bg-surface-lighter/50"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Welcome */}
        <div className="mb-8 fade-in">
          <h2 className="text-3xl font-bold mb-2">
            Welcome, <span className="text-primary-light">{user.name}</span>
          </h2>
          <p className="text-text-muted">Create or join an auction room to start bidding</p>
        </div>

        {/* Action cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Create Room Card */}
          <div className="glass-card glass-card-hover slide-up">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold">Create Room</h3>
                <p className="text-text-muted text-sm">Host a new auction</p>
              </div>
            </div>

            {/* Settings toggle */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="text-sm text-primary-light hover:text-primary mb-4 flex items-center gap-1"
            >
              <svg className={`w-4 h-4 transition ${showSettings ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Auction Settings
            </button>

            {showSettings && (
              <div className="space-y-4 mb-4 p-4 rounded-xl bg-bg-light border border-surface-lighter">
                {/* General */}
                <div>
                  <p className="text-xs font-bold text-primary-light uppercase tracking-wider mb-3">General</p>
                  <div className="space-y-3">
                    <SettingRow label="Purse (Cr)" value={purse} onChange={setPurse} min={50} max={200} />
                    <SettingRow label="Timer (sec)" value={timerDuration} onChange={setTimerDuration} min={5} max={60} unit="s" />
                  </div>
                </div>

                <div className="h-px bg-surface-lighter" />

                {/* Squad Size */}
                <div>
                  <p className="text-xs font-bold text-accent uppercase tracking-wider mb-3">Squad Size</p>
                  <div className="space-y-3">
                    <SettingRow label="Min Players" value={minPlayers} onChange={setMinPlayers} min={11} max={maxPlayers} />
                    <SettingRow label="Max Players" value={maxPlayers} onChange={setMaxPlayers} min={minPlayers} max={30} />
                    <SettingRow label="Overseas Limit" value={overseasLimit} onChange={setOverseasLimit} min={0} max={10} />
                  </div>
                </div>

                <div className="h-px bg-surface-lighter" />

                {/* Role Minimums */}
                <div>
                  <p className="text-xs font-bold text-success uppercase tracking-wider mb-3">Minimum per Role</p>
                  <div className="grid grid-cols-2 gap-3">
                    <SettingRow label="🏏 Batters" value={minBat} onChange={setMinBat} min={0} max={10} />
                    <SettingRow label="🎯 Bowlers" value={minBowl} onChange={setMinBowl} min={0} max={10} />
                    <SettingRow label="⚡ All-Rounders" value={minAr} onChange={setMinAr} min={0} max={10} />
                    <SettingRow label="🧤 Keepers" value={minWk} onChange={setMinWk} min={0} max={5} />
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={handleCreateRoom}
              disabled={creating}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-primary-dark font-bold hover:shadow-lg hover:shadow-primary/25 transition-all disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create Room'}
            </button>
          </div>

          {/* Join Room Card */}
          <div className="glass-card glass-card-hover slide-up" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent to-amber-600 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold">Join Room</h3>
                <p className="text-text-muted text-sm">Enter an auction code</p>
              </div>
            </div>

            <div className="mb-4">
              <input
                type="text"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Enter room code (e.g. A7K9P2QX)"
                maxLength={8}
                className="w-full px-4 py-3 rounded-xl bg-bg-light border border-surface-lighter focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all text-center text-xl font-mono tracking-widest uppercase placeholder:text-sm placeholder:tracking-normal placeholder:font-sans"
              />
            </div>

            <button
              onClick={handleJoinRoom}
              disabled={joining || !joinCode.trim()}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-accent to-amber-600 font-bold hover:shadow-lg hover:shadow-accent/25 transition-all disabled:opacity-50"
            >
              {joining ? 'Joining...' : 'Join Room'}
            </button>
          </div>
        </div>

        {error && (
          <div className="text-danger bg-danger/10 rounded-xl px-4 py-3 mb-6 text-sm">
            {error}
          </div>
        )}

        {/* Auction History */}
        {user.auctionResults && user.auctionResults.length > 0 && (
          <div className="glass-card fade-in">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-primary-light" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Auction History
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-text-muted border-b border-surface-lighter">
                    <th className="text-left py-2 px-3">Room</th>
                    <th className="text-left py-2 px-3">Team</th>
                    <th className="text-left py-2 px-3">Rank</th>
                    <th className="text-left py-2 px-3">Score</th>
                    <th className="text-left py-2 px-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {user.auctionResults.map((result: any) => (
                    <tr key={result.id} className="border-b border-surface-lighter/30 hover:bg-surface-lighter/10">
                      <td className="py-2 px-3 font-mono">{result.room?.code || '—'}</td>
                      <td className="py-2 px-3 font-semibold">{result.teamName}</td>
                      <td className="py-2 px-3">#{result.rank}</td>
                      <td className="py-2 px-3">{result.score}/100</td>
                      <td className="py-2 px-3 text-text-muted">
                        {new Date(result.room?.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
