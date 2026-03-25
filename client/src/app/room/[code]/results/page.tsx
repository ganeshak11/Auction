'use client';

import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useRouter, useParams } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';

const TEAM_LOGOS: Record<string, string> = {
  CSK: '💛', RCB: '❤️', MI: '💙', KKR: '💜',
  SRH: '🧡', RR: '💗', DC: '🩵', PBKS: '🔴',
  GT: '🖤', LSG: '💕',
};

const ROLE_COLORS: Record<string, string> = {
  BAT: '#3b82f6', BOWL: '#10b981', AR: '#8b5cf6', WK: '#f59e0b',
};

interface ResultEntry {
  teamName: string;
  userId: string;
  score: number;
  rank: number;
  metrics: {
    completeness: number;
    roleBalance: number;
    purseEfficiency: number;
    bidDiscipline: number;
    total: number;
  };
  user?: { name: string; avatar?: string };
}

export default function ResultsPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const code = (params.code as string).toUpperCase();

  const [results, setResults] = useState<ResultEntry[]>([]);
  const [squads, setSquads] = useState<any[]>([]);
  const [loadingResults, setLoadingResults] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const fetchResults = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.getResults(token, code);
      setResults(data.results || []);
      setSquads(data.squads || []);
    } catch (err) {
      console.error('Failed to fetch results:', err);
    } finally {
      setLoadingResults(false);
    }
  }, [token, code]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  const handleExport = async () => {
    if (!token) return;
    setExporting(true);
    try {
      const csv = await api.exportCSV(token, code);
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `auction_${code}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  const formatPrice = (price: number) => {
    if (price >= 1) return `₹${price.toFixed(2)} Cr`;
    return `₹${(price * 100).toFixed(0)} L`;
  };

  if (loading || loadingResults) {
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

  const teamSquad = selectedTeam ? squads.filter((s: any) => s.teamName === selectedTeam) : [];
  const medalEmojis = ['🥇', '🥈', '🥉'];

  return (
    <div className="min-h-screen gradient-bg">
      {/* Header */}
      <header className="border-b border-surface-lighter/50 backdrop-blur-md bg-bg/50 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => router.push('/dashboard')} className="text-text-muted hover:text-text transition flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Dashboard
          </button>
          <h1 className="text-lg font-bold">🏆 Auction Results</h1>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="text-sm px-4 py-2 rounded-lg bg-primary/20 text-primary-light hover:bg-primary/30 transition disabled:opacity-50"
          >
            {exporting ? 'Exporting...' : '📥 Export CSV'}
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Winner highlight */}
        {results.length > 0 && (
          <div className="text-center mb-8 slide-up">
            <div className="inline-block glass-card px-12 py-8">
              <div className="text-6xl mb-3">🏆</div>
              <p className="text-text-muted text-sm mb-1">AUCTION CHAMPION</p>
              <h2 className="text-3xl font-black mb-2">
                <span className="text-2xl mr-2">{TEAM_LOGOS[results[0].teamName]}</span>
                {results[0].teamName}
              </h2>
              <p className="text-xl font-bold text-accent">{results[0].score}/100</p>
              {results[0].user && (
                <p className="text-text-muted text-sm mt-2">Managed by {results[0].user.name}</p>
              )}
            </div>
          </div>
        )}

        {/* Leaderboard */}
        <div className="glass-card mb-8 fade-in">
          <h3 className="text-lg font-bold mb-4">📊 Leaderboard</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-text-muted border-b border-surface-lighter">
                  <th className="text-left py-3 px-3">Rank</th>
                  <th className="text-left py-3 px-3">Team</th>
                  <th className="text-center py-3 px-3">Completeness</th>
                  <th className="text-center py-3 px-3">Role Balance</th>
                  <th className="text-center py-3 px-3">Purse Efficiency</th>
                  <th className="text-center py-3 px-3">Bid Discipline</th>
                  <th className="text-center py-3 px-3">Total</th>
                  <th className="text-center py-3 px-3">Squad</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result, idx) => (
                  <tr
                    key={result.teamName}
                    className={`border-b border-surface-lighter/30 hover:bg-surface-lighter/10 transition cursor-pointer ${
                      result.teamName === selectedTeam ? 'bg-primary/5' : ''
                    }`}
                    onClick={() => setSelectedTeam(selectedTeam === result.teamName ? null : result.teamName)}
                  >
                    <td className="py-3 px-3 font-bold text-lg">
                      {idx < 3 ? medalEmojis[idx] : `#${result.rank}`}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{TEAM_LOGOS[result.teamName]}</span>
                        <span className="font-bold">{result.teamName}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="font-mono">{result.metrics.completeness}</span>
                      <span className="text-text-muted text-xs">/30</span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="font-mono">{result.metrics.roleBalance}</span>
                      <span className="text-text-muted text-xs">/25</span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="font-mono">{result.metrics.purseEfficiency}</span>
                      <span className="text-text-muted text-xs">/25</span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="font-mono">{result.metrics.bidDiscipline}</span>
                      <span className="text-text-muted text-xs">/20</span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`font-black text-lg ${idx === 0 ? 'text-accent' : idx < 3 ? 'text-primary-light' : ''}`}>
                        {result.score}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <button className="text-primary-light text-xs hover:underline">
                        {selectedTeam === result.teamName ? 'Hide' : 'View'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected team squad detail */}
        {selectedTeam && (
          <div className="glass-card fade-in">
            <h3 className="text-lg font-bold mb-4">
              {TEAM_LOGOS[selectedTeam]} {selectedTeam} Squad ({teamSquad.length} players)
            </h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {teamSquad.map((s: any, i: number) => (
                <div
                  key={i}
                  className="bg-bg-light rounded-xl p-3 flex items-center gap-3 hover:bg-surface-lighter/20 transition"
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold"
                    style={{ backgroundColor: `${ROLE_COLORS[s.player?.role]}20`, color: ROLE_COLORS[s.player?.role] }}
                  >
                    {s.player?.name?.[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{s.player?.name}</p>
                    <div className="flex items-center gap-2 text-xs text-text-muted">
                      <span>{s.player?.role}</span>
                      <span>•</span>
                      <span>{s.player?.country}</span>
                    </div>
                  </div>
                  <span className="text-accent font-bold text-sm whitespace-nowrap">{formatPrice(s.price)}</span>
                </div>
              ))}
            </div>

            {teamSquad.length === 0 && (
              <p className="text-text-muted text-center py-4">No players in this squad</p>
            )}

            {/* Squad summary */}
            <div className="mt-4 pt-4 border-t border-surface-lighter flex flex-wrap gap-4 text-sm">
              <div>
                <span className="text-text-muted">Total Spent: </span>
                <span className="font-bold text-accent">
                  {formatPrice(teamSquad.reduce((sum: number, s: any) => sum + s.price, 0))}
                </span>
              </div>
              <div>
                <span className="text-text-muted">Overseas: </span>
                <span className="font-bold">
                  {teamSquad.filter((s: any) => s.player?.isOverseas).length}
                </span>
              </div>
              {Object.entries({ BAT: 'Batters', BOWL: 'Bowlers', AR: 'All-Rounders', WK: 'Keepers' }).map(([role, label]) => (
                <div key={role}>
                  <span className="text-text-muted">{label}: </span>
                  <span className="font-bold" style={{ color: ROLE_COLORS[role] }}>
                    {teamSquad.filter((s: any) => s.player?.role === role).length}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
