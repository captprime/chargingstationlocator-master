import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import connectDB from '@/lib/mongodb';
import PhoneOtp from '@/models/PhoneOtp';

async function sendOtpSms(phone: string, code: string): Promise<{ ok: boolean; error?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;
  const from       = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !from) {
    // Dev fallback: log the OTP so it can be tested without Twilio
    console.log(`[DEV] OTP for ${phone}: ${code}`);
    return { ok: true };
  }

  try {
    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: phone,
          From: from,
          Body: `Your ChargeSense verification code is: ${code}. Valid for 10 minutes.`,
        }).toString(),
      }
    );

    const result = await res.json();

    if (!res.ok) {
      console.error('[Twilio] Error:', JSON.stringify(result));
      // Twilio error 21608 = unverified number on trial account
      if (result.code === 21608) {
        return { ok: false, error: 'This phone number is not verified with your Twilio trial account. Add it at twilio.com/console/phone-numbers/verified.' };
      }
      // Twilio error 21211 = invalid To number
      if (result.code === 21211) {
        return { ok: false, error: 'Invalid phone number format.' };
      }
      return { ok: false, error: result.message || 'Twilio SMS failed.' };
    }

    return { ok: true };
  } catch (err) {
    console.error('[Twilio] Network error:', err);
    return { ok: false, error: 'Network error contacting Twilio.' };
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const { phone } = await request.json();

  if (!phone || !/^\+[1-9]\d{7,14}$/.test(phone))
    return NextResponse.json(
      { success: false, error: 'Phone must be in E.164 format, e.g. +12345678900' },
      { status: 400 }
    );

  await connectDB();

  // Rate-limit: max 1 OTP per minute per user
  const recent = await PhoneOtp.findOne({
    userId: session.user.id,
    expiresAt: { $gt: new Date(Date.now() - 9 * 60 * 1000) }, // sent within last 1 min
  });
  if (recent)
    return NextResponse.json(
      { success: false, error: 'Please wait before requesting another code.' },
      { status: 429 }
    );

  // Generate 6-digit OTP
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Delete any existing OTPs for this user
  await PhoneOtp.deleteMany({ userId: session.user.id });

  await PhoneOtp.create({ userId: session.user.id, phone, code, expiresAt });

  const result = await sendOtpSms(phone, code);
  if (!result.ok) {
    // In development, still allow proceeding — return the OTP in the response
    const isDev = process.env.NODE_ENV === 'development';
    if (isDev) {
      console.log(`[DEV] SMS failed but OTP saved. Code for ${phone}: ${code}`);
      return NextResponse.json({
        success: true,
        devOtp: code,
        warning: `SMS failed (${result.error}). Dev mode: use this code → ${code}`,
      });
    }
    return NextResponse.json(
      { success: false, error: result.error ?? 'Failed to send SMS.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
