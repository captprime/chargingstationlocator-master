'use client';

import { useMemo } from 'react';
import { ChargingStation } from '@/types/station';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sparkles, MapPin, DollarSign, Users, ArrowRight, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AIRecommendationProps {
  stations: ChargingStation[];
  batteryPercentage?: number;
  onStationSelect?: (station: ChargingStation) => void;
}

interface ScoredStation extends ChargingStation {
  score: number;
  reason: string;
}

function scoreStation(station: ChargingStation, maxDistance: number, maxPrice: number, maxQueue: number): number {
  const dist = station.distance ?? 0;
  const price = station.pricePerKwh ?? 0;
  const queue = station.queueLength ?? 0;
  const distScore = maxDistance > 0 ? 1 - dist / maxDistance : 1;
  const priceScore = maxPrice > 0 ? 1 - price / maxPrice : 1;
  const queueScore = maxQueue > 0 ? 1 - queue / maxQueue : 1;
  return distScore * 0.35 + priceScore * 0.35 + queueScore * 0.30;
}

function getReason(station: ScoredStation, stations: ScoredStation[]): string {
  const cheapest = [...stations].sort((a, b) => a.pricePerKwh - b.pricePerKwh)[0];
  const closest = [...stations].sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0))[0];
  const leastQueue = [...stations].sort((a, b) => a.queueLength - b.queueLength)[0];
  const reasons: string[] = [];
  if (station.name === cheapest.name) reasons.push('cheapest price');
  if (station.name === closest.name) reasons.push('closest');
  if (station.name === leastQueue.name) reasons.push('shortest queue');
  if (reasons.length === 0) reasons.push('best overall balance');
  return reasons.join(' & ');
}

export function AIRecommendation({ stations, batteryPercentage, onStationSelect }: AIRecommendationProps) {
  const recommendations = useMemo(() => {
    if (stations.length === 0) return [];
    const maxDistance = Math.max(...stations.map(s => s.distance ?? 0));
    const maxPrice = Math.max(...stations.map(s => s.pricePerKwh));
    const maxQueue = Math.max(...stations.map(s => s.queueLength));
    const scored: ScoredStation[] = stations.map(s => ({
      ...s,
      score: scoreStation(s, maxDistance, maxPrice, maxQueue),
      reason: '',
    })).sort((a, b) => b.score - a.score);
    return scored.slice(0, 3).map(s => ({ ...s, reason: getReason(s, scored) }));
  }, [stations]);

  if (stations.length === 0) return null;

  const top = recommendations[0];

  return (
    <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50/60 to-white">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-emerald-800 text-base">
            <Sparkles className="h-4 w-4 text-emerald-600" />
            AI Recommendation
          </CardTitle>
          <span className="text-xs text-muted-foreground">Score = Distance · Price · Queue</span>
        </div>
        {batteryPercentage !== undefined && batteryPercentage <= 30 && (
          <div className="text-xs bg-orange-100 text-orange-700 rounded-md px-3 py-1.5 mt-1">
            ⚡ Battery at {batteryPercentage}% — charge soon
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Top pick — full clickable card */}
        <button
          onClick={() => onStationSelect?.(top)}
          className="w-full text-left bg-white rounded-xl border-2 border-emerald-200 p-4 hover:border-emerald-400 hover:shadow-md transition-all group"
        >
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-widest mb-0.5">Best Pick</p>
              <p className="font-semibold text-gray-900 text-base group-hover:text-emerald-700 transition-colors">{top.name}</p>
              <p className="text-xs text-emerald-600 mt-0.5">Best {top.reason}</p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <Badge className="bg-emerald-600 text-white text-xs px-2">{Math.round(top.score * 100)}% match</Badge>
              {top.fastCharging && (
                <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs px-2">
                  <Zap className="h-2.5 w-2.5 mr-0.5" />Fast
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground mt-3">
            <span className="flex items-center gap-1"><MapPin className="h-3 w-3 text-blue-500" />{top.distance?.toFixed(1)} km</span>
            <span className="flex items-center gap-1"><DollarSign className="h-3 w-3 text-green-500" />₹{top.pricePerKwh}/kWh</span>
            <span className="flex items-center gap-1"><Users className="h-3 w-3 text-orange-500" />{top.queueLength} waiting</span>
            <span className="ml-auto flex items-center gap-1 text-emerald-600 font-medium">
              View <ArrowRight className="h-3 w-3" />
            </span>
          </div>
        </button>

        {/* Runner-ups */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {recommendations.slice(1).map((s, i) => (
            <button
              key={s.id ?? s._id?.toString()}
              onClick={() => onStationSelect?.(s)}
              className="text-left bg-white rounded-lg border border-gray-100 p-3 hover:border-emerald-200 hover:shadow-sm transition-all group"
            >
              <div className="flex items-start justify-between mb-1">
                <div>
                  <span className="text-[10px] text-muted-foreground">#{i + 2}</span>
                  <p className="font-medium text-sm text-gray-800 group-hover:text-emerald-700 transition-colors leading-tight">{s.name}</p>
                  <p className="text-[10px] text-emerald-600 mt-0.5">{s.reason}</p>
                </div>
                <Badge variant="outline" className="text-[10px] px-1.5 shrink-0">{Math.round(s.score * 100)}%</Badge>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-1.5">
                <span>{s.distance?.toFixed(1)} km</span>
                <span>₹{s.pricePerKwh}/kWh</span>
                <span>{s.queueLength} waiting</span>
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
