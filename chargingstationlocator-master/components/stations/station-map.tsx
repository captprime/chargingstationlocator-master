'use client';

import dynamic from 'next/dynamic';
import { ChargingStation } from '@/types/station';

const StationMapClient = dynamic(
  () => import('./station-map-client').then(mod => ({ default: mod.StationMapClient })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[520px] rounded-xl bg-muted flex items-center justify-center border border-border">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Loading map…</p>
        </div>
      </div>
    )
  }
);

interface StationMapProps {
  stations: ChargingStation[];
  userLocation?: { latitude: number; longitude: number };
  loading?: boolean;
  onStationSelect?: (station: ChargingStation) => void;
  onQueueUpdate?: (stationId: string, newQueueLength: number) => void;
}

export function StationMap(props: StationMapProps) {
  return <StationMapClient {...props} />;
}