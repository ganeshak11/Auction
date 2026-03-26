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

const RATING_COLORS: Record<string, string> = {
  'A+': '#10b981', 'A': '#22c55e', 'B+': '#3b82f6',
  'B': '#6366f1', 'C+': '#f59e0b', 'C': '#ef4444',
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

interface TeamAnalysis {
  teamName: string;
  ownerName: string;
  rank: number;
  rating: string;
  strengths: string[];
  weaknesses: string[];
  bestBuy: string;
  commentary: string;
}

interface AIAnalysis {
  winner: {
    teamName: string;
    ownerName: string;
    reasoning: string;
  };
  teamAnalyses: TeamAnalysis[];
  overallSummary: string;
}

export default function ResultsPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const code = (params.code as string).toUpperCase();

  const [results, setResults] = useState<ResultEntry[]>([]);
  const [squads, setSquads] = useState<any[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [loadingResults, setLoadingResults] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [aiPollCount, setAiPollCount] = useState(0);

  const fetchResults = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.getResults(token, code);
      setResults(data.results || []);
      setSquads(data.squads || []);
      if (data.aiAnalysis) {
        setAiAnalysis(data.aiAnalysis);
      }
      return data.aiAnalysis;
    } catch (err) {
      console.error('Failed to fetch results:', err);
      return null;
    } finally {
      setLoadingResults(false);
    }
  }, [token, code]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  // Poll for AI analysis if not available yet (Gemini runs in background)
  useEffect(() => {
    if (aiAnalysis || aiPollCount >= 12) return; // Stop after 12 attempts (60s)

    const pollTimer = setTimeout(async () => {
      const analysis = await fetchResults();
      if (!analysis) {
        setAiPollCount(prev => prev + 1);
      }
    }, 5000);

    return () => clearTimeout(pollTimer);
  }, [aiAnalysis, aiPollCount, fetchResults]);

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

  const getTeamAnalysis = (teamName: string): TeamAnalysis | undefined =>
    aiAnalysis?.teamAnalyses?.find(a => a.teamName === teamName);

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

        {/* AI Winner Announcement */}
        {aiAnalysis?.winner ? (
          <div className="text-center mb-8 slide-up">
            <div className="inline-block glass-card px-12 py-8 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-transparent to-purple-500/10" />
              <div className="relative">
                <div className="text-6xl mb-3">🏆</div>
                <p className="text-text-muted text-xs tracking-[0.3em] mb-2">AI VERDICT • AUCTION CHAMPION</p>
                <h2 className="text-3xl font-black mb-2">
                  <span className="text-2xl mr-2">{TEAM_LOGOS[aiAnalysis.winner.teamName]}</span>
                  {aiAnalysis.winner.ownerName}
                </h2>
                <p className="text-sm text-text-muted mb-3">({aiAnalysis.winner.teamName})</p>
                <p className="text-base text-text-secondary max-w-lg mx-auto leading-relaxed">
                  {aiAnalysis.winner.reasoning}
                </p>
              </div>
            </div>
          </div>
        ) : results.length > 0 ? (
          <div className="text-center mb-8 slide-up">
            <div className="inline-block glass-card px-12 py-8">
              <div className="text-6xl mb-3">🏆</div>
              <p className="text-text-muted text-sm mb-1">AUCTION CHAMPION</p>
              <h2 className="text-3xl font-black mb-2">
                <span className="text-2xl mr-2">{TEAM_LOGOS[results[0].teamName]}</span>
                {results[0].user?.name || results[0].teamName}
              </h2>
              <p className="text-xl font-bold text-accent">{results[0].score}/100</p>
            </div>
          </div>
        ) : null}

        {/* AI Overall Summary */}
        {aiAnalysis?.overallSummary && (
          <div className="glass-card mb-8 fade-in">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🤖</span>
              <div>
                <h3 className="text-sm font-bold text-text-muted mb-2 uppercase tracking-wider">AI Auction Recap</h3>
                <p className="text-text-secondary leading-relaxed">{aiAnalysis.overallSummary}</p>
              </div>
            </div>
          </div>
        )}

        {/* AI Loading */}
        {!aiAnalysis && aiPollCount < 12 && results.length > 0 && (
          <div className="glass-card mb-8 fade-in text-center py-6">
            <div className="spinner mx-auto mb-3" />
            <p className="text-text-muted text-sm">🤖 Gemini AI is analyzing the teams...</p>
            <p className="text-text-muted text-xs mt-1">This takes a few seconds</p>
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
                  <th className="text-center py-3 px-3">AI Rating</th>
                  <th className="text-center py-3 px-3">Completeness</th>
                  <th className="text-center py-3 px-3">Role Balance</th>
                  <th className="text-center py-3 px-3">Purse Eff.</th>
                  <th className="text-center py-3 px-3">Discipline</th>
                  <th className="text-center py-3 px-3">Total</th>
                  <th className="text-center py-3 px-3">Details</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result, idx) => {
                  const analysis = getTeamAnalysis(result.teamName);
                  return (
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
                          <div>
                            <span className="font-bold">{result.user?.name || result.teamName}</span>
                            <span className="text-text-muted text-xs ml-1">({result.teamName})</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        {analysis ? (
                          <span
                            className="font-black text-sm px-2 py-0.5 rounded-full"
                            style={{
                              backgroundColor: `${RATING_COLORS[analysis.rating] || '#6366f1'}20`,
                              color: RATING_COLORS[analysis.rating] || '#6366f1',
                            }}
                          >
                            {analysis.rating}
                          </span>
                        ) : (
                          <span className="text-text-muted text-xs">—</span>
                        )}
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
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected team detail + AI analysis */}
        {selectedTeam && (() => {
          const analysis = getTeamAnalysis(selectedTeam);
          return (
            <div className="space-y-6 fade-in">
              {/* AI Analysis Card */}
              {analysis && (
                <div className="glass-card">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-2xl">🤖</span>
                    <h3 className="text-lg font-bold">AI Analysis — {analysis.ownerName}</h3>
                    <span
                      className="font-black text-sm px-3 py-1 rounded-full ml-auto"
                      style={{
                        backgroundColor: `${RATING_COLORS[analysis.rating] || '#6366f1'}20`,
                        color: RATING_COLORS[analysis.rating] || '#6366f1',
                      }}
                    >
                      Grade: {analysis.rating}
                    </span>
                  </div>

                  <p className="text-text-secondary mb-4 leading-relaxed">{analysis.commentary}</p>

                  <div className="grid sm:grid-cols-2 gap-4 mb-4">
                    <div className="bg-success/5 border border-success/20 rounded-xl p-4">
                      <h4 className="text-xs font-bold text-success uppercase tracking-wider mb-2">💪 Strengths</h4>
                      <ul className="space-y-1">
                        {analysis.strengths.map((s, i) => (
                          <li key={i} className="text-sm text-text-secondary flex items-start gap-2">
                            <span className="text-success mt-0.5">✓</span> {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="bg-danger/5 border border-danger/20 rounded-xl p-4">
                      <h4 className="text-xs font-bold text-danger uppercase tracking-wider mb-2">⚠️ Weaknesses</h4>
                      <ul className="space-y-1">
                        {analysis.weaknesses.map((w, i) => (
                          <li key={i} className="text-sm text-text-secondary flex items-start gap-2">
                            <span className="text-danger mt-0.5">✗</span> {w}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {analysis.bestBuy && (
                    <div className="bg-accent/5 border border-accent/20 rounded-xl p-3 flex items-center gap-2">
                      <span className="text-lg">⭐</span>
                      <div>
                        <span className="text-xs font-bold text-accent uppercase tracking-wider">Best Buy: </span>
                        <span className="text-sm text-text-secondary">{analysis.bestBuy}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Squad Detail */}
              <div className="glass-card">
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
            </div>
          );
        })()}

        {/* AI Team Analysis Cards (when no team selected) */}
        {!selectedTeam && aiAnalysis?.teamAnalyses && aiAnalysis.teamAnalyses.length > 0 && (
          <div className="space-y-4 fade-in">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <span>🤖</span> AI Team Breakdown
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              {aiAnalysis.teamAnalyses.map((analysis) => (
                <div
                  key={analysis.teamName}
                  className="glass-card cursor-pointer hover:border-primary/30 transition"
                  onClick={() => setSelectedTeam(analysis.teamName)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{TEAM_LOGOS[analysis.teamName]}</span>
                      <div>
                        <span className="font-bold">{analysis.ownerName}</span>
                        <span className="text-text-muted text-xs ml-1">({analysis.teamName})</span>
                      </div>
                    </div>
                    <span
                      className="font-black text-sm px-3 py-1 rounded-full"
                      style={{
                        backgroundColor: `${RATING_COLORS[analysis.rating] || '#6366f1'}20`,
                        color: RATING_COLORS[analysis.rating] || '#6366f1',
                      }}
                    >
                      {analysis.rating}
                    </span>
                  </div>
                  <p className="text-sm text-text-secondary leading-relaxed mb-3">{analysis.commentary}</p>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-accent">⭐ {analysis.bestBuy}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
