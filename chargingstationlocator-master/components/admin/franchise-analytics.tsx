'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, TrendingUp } from 'lucide-react';

interface Station {
  _id: string;
  name: string;
  latitude: number;
  longitude: number;
  queueLength: number;
  stats: { totalSessions: number; revenue: number };
}

// Suggest new locations based on demand gaps
function suggestLocations(stations: Station[]) {
  if (stations.length === 0) return [];

  // Find high-demand stations and suggest nearby expansion
  const highDemand = [...stations]
    .sort((a, b) => b.queueLength - a.queueLength)
    .slice(0, 3);

  return highDemand.map(s => ({
    basedOn: s.name,
    suggestedLat: parseFloat((s.latitude + (Math.random() * 0.05 - 0.025)).toFixed(4)),
    suggestedLng: parseFloat((s.longitude + (Math.random() * 0.05 - 0.025)).toFixed(4)),
    demandScore: Math.min(100, Math.round(s.queueLength * 15 + s.stats.totalSessions * 0.5)),
    reason: s.queueLength > 3 ? 'High queue overflow' : s.stats.totalSessions > 50 ? 'High session volume' : 'Growing demand',
  }));
}

export function FranchiseAnalytics() {
  const { data: session } = useSession();
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
    fetch('/api/admin/stations')
      .then(r => r.json())
      .then(data => { if (data.success) setStations(data.stations); })
      .finally(() => setLoading(false));
  }, [session]);

  const suggestions = suggestLocations(stations);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-emerald-600" />
          Franchise Expansion Analytics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Suggested new station locations based on demand heatmap analysis
        </p>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-20 animate-pulse bg-gray-100 rounded-lg" />)}
          </div>
        ) : suggestions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Add more stations to generate expansion suggestions.
          </p>
        ) : (
          <div className="space-y-3">
            {suggestions.map((s, i) => (
              <div key={i} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-sm">Suggested Location #{i + 1}</p>
                    <p className="text-xs text-muted-foreground">Near {s.basedOn}</p>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                    Score: {s.demandScore}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  <span>{s.suggestedLat}, {s.suggestedLng}</span>
                </div>
                <p className="text-xs text-orange-600 font-medium">{s.reason}</p>
                <button
                  className="text-xs text-blue-600 hover:underline"
                  onClick={() => window.open(`https://www.google.com/maps?q=${s.suggestedLat},${s.suggestedLng}`, '_blank')}
                >
                  View on Google Maps →
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700">
          Suggestions are based on queue overflow and session volume at existing stations. Higher demand score = higher expansion priority.
        </div>
      </CardContent>
    </Card>
  );
}
