import { NextRequest, NextResponse } from 'next/server';
import { RegisterSchema } from '@/lib/validation';
import { hashPassword, normalizeEmail } from '@/lib/auth-utils';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';

export async function POST(request: NextRequest) {
  try {
    // Connect to MongoDB
    await connectDB();

    const body = await request.json();
    
    // Validate request data
    const validationResult = RegisterSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Validation failed',
          details: validationResult.error.message
        },
        { status: 400 }
      );
    }

    const { name, email, password } = validationResult.data;
    const normalizedEmail = normalizeEmail(email);

    // Check if user already exists
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'User with this email already exists' 
        },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create new user in MongoDB
    const newUser = new User({
      name,
      email: normalizedEmail,
      password: hashedPassword,
      role: 'user'
    });

    await newUser.save();

    // Return success response (without password)
    return NextResponse.json({
      success: true,
      user: {
        id: newUser._id.toString(),
        name: newUser.name,
        email: newUser.email,
        role: newUser.role
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error' 
      },
      { status: 500 }
    );
  }
}