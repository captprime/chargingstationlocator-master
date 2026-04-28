import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  await connectDB();
  const user = await User.findById(session.user.id).select('phone phoneVerified batteryAlertThreshold smsAlertsEnabled');
  if (!user) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });

  return NextResponse.json({
    success: true,
    phone: user.phone ?? '',
    phoneVerified: user.phoneVerified ?? false,
    batteryAlertThreshold: user.batteryAlertThreshold ?? 20,
    smsAlertsEnabled: user.smsAlertsEnabled ?? false,
  });
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  await connectDB();

  const body = await request.json();
  const { phone, batteryAlertThreshold, smsAlertsEnabled } = body;

  const update: Record<string, unknown> = {};

  if (phone !== undefined) {
    // Basic E.164 format check
    if (phone && !/^\+[1-9]\d{7,14}$/.test(phone)) {
      return NextResponse.json(
        { success: false, error: 'Phone must be in E.164 format, e.g. +12345678900' },
        { status: 400 }
      );
    }
    // If phone number changed, reset verification status
    const existing = await User.findById(session.user.id).select('phone');
    if (existing?.phone !== phone) update.phoneVerified = false;
    update.phone = phone || null;
  }

  if (batteryAlertThreshold !== undefined) {
    const t = Number(batteryAlertThreshold);
    if (isNaN(t) || t < 5 || t > 50) {
      return NextResponse.json(
        { success: false, error: 'Threshold must be between 5 and 50' },
        { status: 400 }
      );
    }
    update.batteryAlertThreshold = t;
  }

  if (smsAlertsEnabled !== undefined) {
    update.smsAlertsEnabled = Boolean(smsAlertsEnabled);
  }

  await User.findByIdAndUpdate(session.user.id, { $set: update });

  return NextResponse.json({ success: true });
}
