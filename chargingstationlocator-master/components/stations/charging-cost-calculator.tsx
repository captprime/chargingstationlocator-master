'use client';

import { useState, useMemo } from 'react';
import { ChargingStation } from '@/types/station';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Calculator, Zap } from 'lucide-react';

interface ChargingCostCalculatorProps {
  stations: ChargingStation[];
}

export function ChargingCostCalculator({ stations }: ChargingCostCalculatorProps) {
  const [batterySize, setBatterySize] = useState(40); // kWh
  const [currentPct, setCurrentPct] = useState(20);
  const [targetPct, setTargetPct] = useState(80);

  const unitsRequired = useMemo(() => {
    const diff = Math.max(0, targetPct - currentPct);
    return (diff / 100) * batterySize;
  }, [batterySize, currentPct, targetPct]);

  const topStations = useMemo(() => {
    return [...stations]
      .sort((a, b) => a.pricePerKwh - b.pricePerKwh)
      .slice(0, 5)
      .map(s => ({
        ...s,
        estimatedCost: unitsRequired * s.pricePerKwh,
      }));
  }, [stations, unitsRequired]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-violet-600" />
          Charging Cost Calculator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Battery Size (kWh)</Label>
            <Input
              type="number"
              min={5}
              max={200}
              value={batterySize}
              onChange={e => setBatterySize(Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Current: {currentPct}%</Label>
            <Slider min={0} max={99} step={1} value={[currentPct]} onValueChange={v => setCurrentPct(v[0])} />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Target: {targetPct}%</Label>
            <Slider min={1} max={100} step={1} value={[targetPct]} onValueChange={v => setTargetPct(v[0])} />
          </div>
        </div>

        <div className="bg-violet-50 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-violet-600" />
            <span className="text-sm font-medium text-violet-800">Units Required</span>
          </div>
          <span className="text-2xl font-bold text-violet-700">{unitsRequired.toFixed(2)} kWh</span>
        </div>

        {topStations.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Estimated cost at nearby stations</p>
            <div className="space-y-2">
              {topStations.map(s => (
                <div key={s.id ?? s._id?.toString()} className="flex items-center justify-between text-sm py-2 border-b last:border-0">
                  <div>
                    <span className="font-medium">{s.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">₹{s.pricePerKwh}/kWh</span>
                  </div>
                  <span className="font-semibold text-emerald-700">₹{s.estimatedCost.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {stations.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-2">Load nearby stations to see cost estimates</p>
        )}
      </CardContent>
    </Card>
  );
}
