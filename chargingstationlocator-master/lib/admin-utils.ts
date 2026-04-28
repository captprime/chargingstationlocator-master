import { getServerSession } from 'next-auth';
import { authOptions } from './auth-options';
import { NextRequest } from 'next/server';

/**
 * Check if the current session user has admin role
 */
export async function isAdmin(): Promise<boolean> {
  try {
    const session = await getServerSession(authOptions);
    return session?.user?.role === 'admin';
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

/**
 * Get the current session and verify admin role
 * Throws error if not admin
 */
export async function requireAdmin() {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    throw new Error('Authentication required');
  }
  
  if (session.user.role !== 'admin') {
    throw new Error('Admin access required');
  }
  
  return session;
}

/**
 * Get the current admin's ID
 * Throws error if not admin
 */
export async function getCurrentAdminId(): Promise<string> {
  const session = await requireAdmin();
  return session.user.id;
}

/**
 * Middleware function to check admin access for API routes
 */
export function withAdminAuth<T, TContext = unknown>(
  handler: (req: NextRequest, context: TContext) => Promise<T>
) {
  return async (req: NextRequest, context: TContext) => {
    try {
      await requireAdmin();
      return await handler(req, context);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Access denied';
      
      if (message === 'Authentication required') {
        return new Response(
          JSON.stringify({ error: 'Authentication required' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }
  };
}

/**
 * Client-side hook to check admin status
 */
export function useAdminCheck() {
  // This will be used in client components
  return {
    isAdmin: (session: { user?: { role?: string } }) => session?.user?.role === 'admin',
    requireAdmin: (session: { user?: { role?: string } }) => {
      if (!session) {
        throw new Error('Authentication required');
      }
      if (session.user?.role !== 'admin') {
        throw new Error('Admin access required');
      }
      return true;
    }
  };
}