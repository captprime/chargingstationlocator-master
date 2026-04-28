'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Phone, ShieldCheck, Loader2, CheckCircle2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface PhoneVerificationProps {
  initialPhone?: string;
  onVerified: (phone: string) => void;
}

type Step = 'enter_phone' | 'enter_otp' | 'verified';

export function PhoneVerification({ initialPhone = '', onVerified }: PhoneVerificationProps) {
  const [step, setStep] = useState<Step>(initialPhone ? 'enter_phone' : 'enter_phone');
  const [phone, setPhone] = useState(initialPhone);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [devOtp, setDevOtp] = useState<string | null>(null);

  const sendOtp = async () => {
    setError('');
    if (!phone || !/^\+[1-9]\d{7,14}$/.test(phone)) {
      setError('Enter a valid phone number in E.164 format, e.g. +12345678900');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/user/phone-otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error); return; }
      if (data.devOtp) {
        setDevOtp(data.devOtp);
        toast.warning(`Dev mode: SMS failed. Your OTP is ${data.devOtp}`);
      } else {
        toast.success('Verification code sent!');
      }
      setStep('enter_otp');
    } catch {
      setError('Failed to send code. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    setError('');
    if (otp.length !== 6) { setError('Enter the 6-digit code'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/user/phone-otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: otp }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error); return; }
      setStep('verified');
      toast.success('Phone number verified!');
      onVerified(phone);
    } catch {
      setError('Verification failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'verified') {
    return (
      <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
        <CheckCircle2 className="h-4 w-4" />
        <span>{phone}</span>
        <Badge variant="outline" className="text-green-700 border-green-400 text-xs">Verified</Badge>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {step === 'enter_phone' && (
        <>
          <Label htmlFor="otp-phone" className="flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5" />
            Phone number (E.164 format)
          </Label>
          <div className="flex gap-2">
            <Input
              id="otp-phone"
              type="tel"
              placeholder="+12345678900"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setError(''); }}
              disabled={loading}
            />
            <Button onClick={sendOtp} disabled={loading} className="shrink-0">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send OTP'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Include country code, e.g. +1 for US/Canada.</p>
        </>
      )}

      {step === 'enter_otp' && (
        <>
          <Label className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            Enter the 6-digit code sent to {phone}
          </Label>
          {devOtp && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm">
              <span className="text-amber-700">Dev mode — SMS failed. Your code:</span>
              <button
                className="font-mono font-bold text-amber-900 tracking-widest hover:underline"
                onClick={() => setOtp(devOtp)}
              >
                {devOtp}
              </button>
              <span className="text-xs text-amber-600">(click to fill)</span>
            </div>
          )}
          <InputOTP maxLength={6} value={otp} onChange={setOtp}>
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
          <div className="flex items-center gap-3">
            <Button onClick={verifyOtp} disabled={loading || otp.length !== 6}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Verify
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs gap-1"
              onClick={() => { setStep('enter_phone'); setOtp(''); setError(''); }}
              disabled={loading}
            >
              <RefreshCw className="h-3 w-3" />
              Change number
            </Button>
          </div>
        </>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
