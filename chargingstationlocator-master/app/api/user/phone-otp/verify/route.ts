import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import PhoneOtp from '@/models/PhoneOtp';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const { code } = await request.json();
  if (!code || typeof code !== 'string')
    return NextResponse.json({ success: false, error: 'Code is required' }, { status: 400 });

  await connectDB();

  const otp = await PhoneOtp.findOne({ userId: session.user.id });

  if (!otp)
    return NextResponse.json(
      { success: false, error: 'No pending verification. Request a new code.' },
      { status: 400 }
    );

  if (otp.expiresAt < new Date()) {
    await otp.deleteOne();
    return NextResponse.json({ success: false, error: 'Code expired. Request a new one.' }, { status: 400 });
  }

  // Max 5 attempts
  if (otp.attempts >= 5) {
    await otp.deleteOne();
    return NextResponse.json(
      { success: false, error: 'Too many attempts. Request a new code.' },
      { status: 400 }
    );
  }

  if (otp.code !== code.trim()) {
    otp.attempts += 1;
    await otp.save();
    return NextResponse.json(
      { success: false, error: `Incorrect code. ${5 - otp.attempts} attempt(s) remaining.` },
      { status: 400 }
    );
  }

  // Correct — save phone as verified on the user
  await User.findByIdAndUpdate(session.user.id, {
    $set: { phone: otp.phone, phoneVerified: true },
  });

  await otp.deleteOne();

  return NextResponse.json({ success: true });
}
