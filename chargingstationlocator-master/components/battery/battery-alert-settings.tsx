'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Bell, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { PhoneVerification } from './phone-verification';

export function BatteryAlertSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [phone, setPhone] = useState('');
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [threshold, setThreshold] = useState(20);
  const [smsEnabled, setSmsEnabled] = useState(false);

  useEffect(() => {
    fetch('/api/user/alert-settings')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setPhone(data.phone ?? '');
          setPhoneVerified(data.phoneVerified ?? false);
          setThreshold(data.batteryAlertThreshold ?? 20);
          setSmsEnabled(data.smsAlertsEnabled ?? false);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // Save threshold (and SMS toggle) — phone is saved via OTP verification flow
  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/user/alert-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batteryAlertThreshold: threshold,
          // Only enable SMS if phone is verified
          smsAlertsEnabled: smsEnabled && phoneVerified,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Settings saved');
        setSaved(true);
      } else {
        toast.error(data.error || 'Failed to save');
      }
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSmsToggle = (val: boolean) => {
    setSaved(false);
    if (val && !phoneVerified) {
      setSmsEnabled(true);
    } else {
      setSmsEnabled(val);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Battery Alert Settings
        </CardTitle>
        <CardDescription>
          Get notified when your EV battery drops below a threshold — via the app and optionally by SMS.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">

        {/* Threshold slider */}
        <div className="space-y-3">
          <Label>Alert threshold: {threshold}%</Label>
          <Slider
            min={5}
            max={50}
            step={5}
            value={[threshold]}
            onValueChange={([v]) => { setThreshold(v); setSaved(false); }}
          />
          <p className="text-xs text-muted-foreground">
            You'll receive an alert when battery falls below {threshold}%.
          </p>
        </div>

        {/* SMS toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>SMS Alerts</Label>
            <p className="text-xs text-muted-foreground">
              Receive a text message with nearby station links
            </p>
          </div>
          <Switch checked={smsEnabled} onCheckedChange={handleSmsToggle} />
        </div>

        {/* Phone verification section — shown when SMS is toggled on */}
        {smsEnabled && (
          <div className="rounded-md border p-4 space-y-3 bg-muted/30">
            {phoneVerified && phone ? (
              <div className="space-y-2">
                <Label className="text-sm">Verified number</Label>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">{phone}</span>
                  <Badge variant="outline" className="text-green-700 border-green-400 text-xs">Verified</Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-6 ml-auto"
                    onClick={() => { setPhoneVerified(false); setPhone(''); }}
                  >
                    Change
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-1.5 text-sm text-amber-700 dark:text-amber-400">
                  <AlertCircle className="h-4 w-4" />
                  Verify your phone number to enable SMS alerts
                </div>
                <PhoneVerification
                  initialPhone={phone}
                  onVerified={(verifiedPhone) => {
                    setPhone(verifiedPhone);
                    setPhoneVerified(true);
                  }}
                />
              </>
            )}
          </div>
        )}

        <Button onClick={save} disabled={saving || saved} className="w-full">
          {saving
            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>
            : saved
            ? <><CheckCircle2 className="mr-2 h-4 w-4" />Saved</>
            : 'Save Settings'
          }
        </Button>
      </CardContent>
    </Card>
  );
}
