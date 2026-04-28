'use client';

import MapTest from '@/components/stations/map-test';

export default function StationsTestPage() {
  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold mb-6">Charging Stations Map Test</h1>
      <MapTest />
    </div>
  );
}