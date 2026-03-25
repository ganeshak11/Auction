'use client';

import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useRouter, useParams } from 'next/navigation';
import { useState, useEffect, useCallback, useMemo } from 'react';

const ROLE_COLORS: Record<string, string> = {
  BAT: '#3b82f6', BOWL: '#10b981', AR: '#8b5cf6', WK: '#f59e0b',
};
const ROLE_LABELS: Record<string, string> = {
  BAT: 'Batter', BOWL: 'Bowler', AR: 'All-Rounder', WK: 'Wicket-Keeper',
};

interface Player {
  id: string;
  name: string;
  role: string;
  country: string;
  basePrice: number;
  isOverseas: boolean;
  battingStyle: string;
  bowlingStyle: string;
}

export default function PlayerSelectionPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const code = (params.code as string).toUpperCase();

  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [countryFilter, setCountryFilter] = useState<string>('ALL');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      const [playersData, selectedData] = await Promise.all([
        api.getPlayers(token),
        api.getSelectedPlayers(token, code),
      ]);
      setAllPlayers(playersData.players);

      const existingIds = new Set<string>(
        (selectedData.selectedPlayers || []).map((sp: any) => sp.playerId)
      );
      setSelectedIds(existingIds);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingData(false);
    }
  }, [token, code]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const countries = useMemo(() => {
    const set = new Set(allPlayers.map(p => p.country));
    return ['ALL', ...Array.from(set).sort()];
  }, [allPlayers]);

  const filteredPlayers = useMemo(() => {
    return allPlayers.filter(p => {
      if (roleFilter !== 'ALL' && p.role !== roleFilter) return false;
      if (countryFilter !== 'ALL' && p.country !== countryFilter) return false;
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [allPlayers, roleFilter, countryFilter, search]);

  const togglePlayer = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    const ids = new Set(selectedIds);
    filteredPlayers.forEach(p => ids.add(p.id));
    setSelectedIds(ids);
  };

  const deselectAll = () => {
    const ids = new Set(selectedIds);
    filteredPlayers.forEach(p => ids.delete(p.id));
    setSelectedIds(ids);
  };

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const result = await api.saveSelectedPlayers(token, code, Array.from(selectedIds));
      setSuccess(`Saved ${result.count} players for auction`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const formatPrice = (price: number) => {
    if (price >= 1) return `₹${price.toFixed(2)} Cr`;
    return `₹${(price * 100).toFixed(0)} L`;
  };

  // Role counts in selection
  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = { BAT: 0, BOWL: 0, AR: 0, WK: 0 };
    allPlayers.forEach(p => {
      if (selectedIds.has(p.id)) counts[p.role] = (counts[p.role] || 0) + 1;
    });
    return counts;
  }, [allPlayers, selectedIds]);

  const overseasCount = useMemo(() => {
    return allPlayers.filter(p => selectedIds.has(p.id) && p.isOverseas).length;
  }, [allPlayers, selectedIds]);

  if (loading || loadingData) {
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

  return (
    <div className="min-h-screen gradient-bg">
      {/* Header */}
      <header className="border-b border-surface-lighter/50 backdrop-blur-md bg-bg/80 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push(`/room/${code}/lobby`)}
              className="text-text-muted hover:text-text transition"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div>
              <h1 className="text-sm font-bold text-primary-light">SELECT PLAYERS</h1>
              <p className="text-xs text-text-muted font-mono">{code}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 text-xs">
              {Object.entries(ROLE_LABELS).map(([role, label]) => (
                <span key={role} className="px-2 py-1 rounded-full" style={{ backgroundColor: `${ROLE_COLORS[role]}20`, color: ROLE_COLORS[role] }}>
                  {label}: {roleCounts[role]}
                </span>
              ))}
              <span className="px-2 py-1 rounded-full bg-surface-lighter text-text-muted">
                ✈️ {overseasCount}
              </span>
            </div>
            <div className="text-right">
              <p className="text-lg font-black text-accent">{selectedIds.size}</p>
              <p className="text-xs text-text-muted">selected</p>
            </div>
          </div>
        </div>
      </header>

      {/* Toasts */}
      {error && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-danger text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-lg fade-in">
          {error}
        </div>
      )}
      {success && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-success text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-lg fade-in">
          {success}
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-4">
        {/* Filters */}
        <div className="glass-card mb-4">
          <div className="flex flex-wrap gap-3 items-center">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search players..."
              className="flex-1 min-w-[200px] px-3 py-2 rounded-lg bg-bg-light border border-surface-lighter text-sm focus:border-primary focus:outline-none"
            />

            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              className="px-3 py-2 rounded-lg bg-bg-light border border-surface-lighter text-sm focus:border-primary focus:outline-none"
            >
              <option value="ALL">All Roles</option>
              {Object.entries(ROLE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>

            <select
              value={countryFilter}
              onChange={e => setCountryFilter(e.target.value)}
              className="px-3 py-2 rounded-lg bg-bg-light border border-surface-lighter text-sm focus:border-primary focus:outline-none"
            >
              {countries.map(c => (
                <option key={c} value={c}>{c === 'ALL' ? 'All Countries' : c}</option>
              ))}
            </select>

            <div className="flex gap-2">
              <button onClick={selectAll} className="text-xs px-3 py-2 rounded-lg bg-primary/20 text-primary-light hover:bg-primary/30 transition">
                Select All
              </button>
              <button onClick={deselectAll} className="text-xs px-3 py-2 rounded-lg bg-danger/20 text-danger hover:bg-danger/30 transition">
                Deselect All
              </button>
            </div>
          </div>
          <p className="text-xs text-text-muted mt-2">
            Showing {filteredPlayers.length} of {allPlayers.length} players • {selectedIds.size} selected for auction
          </p>
        </div>

        {/* Player grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-6">
          {filteredPlayers.map(player => {
            const isSelected = selectedIds.has(player.id);
            return (
              <button
                key={player.id}
                onClick={() => togglePlayer(player.id)}
                className={`text-left p-3 rounded-xl border-2 transition-all ${
                  isSelected
                    ? 'border-primary bg-primary/10 shadow-md shadow-primary/10'
                    : 'border-surface-lighter bg-bg-light hover:border-surface-lighter/80 hover:bg-surface-lighter/20'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold shrink-0"
                    style={{ backgroundColor: `${ROLE_COLORS[player.role]}20`, color: ROLE_COLORS[player.role] }}
                  >
                    {player.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{player.name}</p>
                    <div className="flex items-center gap-1 mt-0.5 text-xs text-text-muted">
                      <span
                        className="px-1.5 py-0.5 rounded-full text-xs font-medium"
                        style={{ backgroundColor: `${ROLE_COLORS[player.role]}15`, color: ROLE_COLORS[player.role] }}
                      >
                        {player.role}
                      </span>
                      <span>{player.isOverseas ? '✈️' : '🇮🇳'}</span>
                      <span className="truncate">{player.country}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-bold text-accent">{formatPrice(player.basePrice)}</span>
                    <div className="mt-1">
                      {isSelected ? (
                        <span className="text-primary-light text-lg">✓</span>
                      ) : (
                        <span className="text-surface-lighter text-lg">○</span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Sticky save bar */}
        <div className="sticky bottom-0 py-4 -mx-4 px-4 bg-gradient-to-t from-bg via-bg/95 to-transparent">
          <div className="max-w-md mx-auto flex gap-3">
            <button
              onClick={() => router.push(`/room/${code}/lobby`)}
              className="flex-1 py-3 rounded-xl bg-surface-lighter text-text font-bold hover:bg-surface-lighter/80 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || selectedIds.size === 0}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-primary to-primary-dark font-bold hover:shadow-lg hover:shadow-primary/25 transition-all disabled:opacity-50"
            >
              {saving ? 'Saving...' : `Save ${selectedIds.size} Players`}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
