import mongoose, { Schema, Document } from 'mongoose';
import connectDB from '@/lib/mongodb';

// Define the security audit log schema
export interface ISecurityAudit extends Document {
  userId?: string;
  ipAddress?: string;
  action: string;
  resource: string;
  resourceId?: string;
  status: 'success' | 'failure' | 'warning';
  details?: Record<string, unknown>;
  timestamp: Date;
}

const SecurityAuditSchema = new Schema<ISecurityAudit>({
  userId: {
    type: String,
    index: true
  },
  ipAddress: {
    type: String,
    index: true
  },
  action: {
    type: String,
    required: true,
    index: true
  },
  resource: {
    type: String,
    required: true,
    index: true
  },
  resourceId: {
    type: String,
    index: true
  },
  status: {
    type: String,
    enum: ['success', 'failure', 'warning'],
    required: true,
    index: true
  },
  details: {
    type: Schema.Types.Mixed
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Create or get the model
const SecurityAudit = mongoose.models.SecurityAudit || 
  mongoose.model<ISecurityAudit>('SecurityAudit', SecurityAuditSchema);

/**
 * Log a security event
 */
export async function logSecurityEvent({
  userId,
  ipAddress,
  action,
  resource,
  resourceId,
  status,
  details
}: {
  userId?: string;
  ipAddress?: string;
  action: string;
  resource: string;
  resourceId?: string;
  status: 'success' | 'failure' | 'warning';
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    await connectDB();
    
    await SecurityAudit.create({
      userId,
      ipAddress,
      action,
      resource,
      resourceId,
      status,
      details,
      timestamp: new Date()
    });
  } catch (error) {
    // Log to console but don't fail the request
    console.error('Failed to log security event:', error);
  }
}

/**
 * Detect suspicious activity based on patterns
 * Returns true if activity is suspicious
 */
export async function detectSuspiciousActivity(
  userId: string,
  action: string,
  resource: string,
  timeWindowMinutes: number = 5
): Promise<boolean> {
  try {
    await connectDB();
    
    const timeWindow = new Date();
    timeWindow.setMinutes(timeWindow.getMinutes() - timeWindowMinutes);
    
    // Count recent actions by this user
    const recentActionCount = await SecurityAudit.countDocuments({
      userId,
      action,
      resource,
      timestamp: { $gte: timeWindow }
    });
    
    // Count recent failures by this user
    const recentFailureCount = await SecurityAudit.countDocuments({
      userId,
      action,
      resource,
      status: 'failure',
      timestamp: { $gte: timeWindow }
    });
    
    // Count recent actions across all resources for this user (broader pattern detection)
    const recentTotalActionCount = await SecurityAudit.countDocuments({
      userId,
      timestamp: { $gte: timeWindow }
    });
    
    // Define thresholds for suspicious activity based on action type
    let actionThreshold: number;
    let failureThreshold: number;
    let totalActionThreshold: number;
    
    switch (action) {
      case 'session_complete':
        actionThreshold = 5; // Max 5 session completions in 5 minutes
        failureThreshold = 3;
        totalActionThreshold = 20;
        break;
      case 'view_active_sessions':
        actionThreshold = 15; // Max 15 views in 5 minutes
        failureThreshold = 5;
        totalActionThreshold = 30;
        break;
      case 'view_session_history':
        actionThreshold = 10; // Max 10 history views in 5 minutes
        failureThreshold = 5;
        totalActionThreshold = 25;
        break;
      default:
        actionThreshold = 10;
        failureThreshold = 3;
        totalActionThreshold = 25;
    }
    
    return recentActionCount > actionThreshold || 
           recentFailureCount >= failureThreshold ||
           recentTotalActionCount > totalActionThreshold;
  } catch (error) {
    console.error('Error detecting suspicious activity:', error);
    return false; // Default to not suspicious on error
  }
}

/**
 * Log suspicious activity with details
 */
export async function logSuspiciousActivity(
  userId: string,
  ipAddress: string | undefined,
  action: string,
  resource: string,
  resourceId: string | undefined,
  details: Record<string, unknown>
): Promise<void> {
  await logSecurityEvent({
    userId,
    ipAddress,
    action,
    resource,
    resourceId,
    status: 'warning',
    details: {
      ...details,
      suspicious: true,
      detectedAt: new Date()
    }
  });
}

/**
 * Get security statistics for monitoring dashboard
 */
export async function getSecurityStats(timeWindowHours: number = 24): Promise<{
  totalEvents: number;
  failureEvents: number;
  suspiciousEvents: number;
  topFailedActions: Array<{ action: string; count: number }>;
  topFailedIps: Array<{ ipAddress: string; count: number }>;
}> {
  try {
    await connectDB();
    
    const timeWindow = new Date();
    timeWindow.setHours(timeWindow.getHours() - timeWindowHours);
    
    const [
      totalEvents,
      failureEvents,
      suspiciousEvents,
      topFailedActions,
      topFailedIps
    ] = await Promise.all([
      SecurityAudit.countDocuments({
        timestamp: { $gte: timeWindow }
      }),
      
      SecurityAudit.countDocuments({
        status: 'failure',
        timestamp: { $gte: timeWindow }
      }),
      
      SecurityAudit.countDocuments({
        'details.suspicious': true,
        timestamp: { $gte: timeWindow }
      }),
      
      SecurityAudit.aggregate([
        {
          $match: {
            status: 'failure',
            timestamp: { $gte: timeWindow }
          }
        },
        {
          $group: {
            _id: '$action',
            count: { $sum: 1 }
          }
        },
        {
          $sort: { count: -1 }
        },
        {
          $limit: 5
        },
        {
          $project: {
            action: '$_id',
            count: 1,
            _id: 0
          }
        }
      ]),
      
      SecurityAudit.aggregate([
        {
          $match: {
            status: 'failure',
            ipAddress: { $exists: true, $ne: null },
            timestamp: { $gte: timeWindow }
          }
        },
        {
          $group: {
            _id: '$ipAddress',
            count: { $sum: 1 }
          }
        },
        {
          $sort: { count: -1 }
        },
        {
          $limit: 5
        },
        {
          $project: {
            ipAddress: '$_id',
            count: 1,
            _id: 0
          }
        }
      ])
    ]);
    
    return {
      totalEvents,
      failureEvents,
      suspiciousEvents,
      topFailedActions,
      topFailedIps
    };
  } catch (error) {
    console.error('Error getting security stats:', error);
    return {
      totalEvents: 0,
      failureEvents: 0,
      suspiciousEvents: 0,
      topFailedActions: [],
      topFailedIps: []
    };
  }
}

/**
 * Check if an IP address should be blocked based on failure patterns
 */
export async function shouldBlockIp(
  ipAddress: string,
  timeWindowMinutes: number = 15
): Promise<boolean> {
  try {
    await connectDB();
    
    const timeWindow = new Date();
    timeWindow.setMinutes(timeWindow.getMinutes() - timeWindowMinutes);
    
    // Count failures from this IP in the time window
    const failureCount = await SecurityAudit.countDocuments({
      ipAddress,
      status: 'failure',
      timestamp: { $gte: timeWindow }
    });
    
    // Block if more than 10 failures in 15 minutes
    return failureCount > 10;
  } catch (error) {
    console.error('Error checking IP block status:', error);
    return false;
  }
}

/**
 * Validate session ownership to prevent unauthorized access
 */
export async function validateSessionOwnership(
  sessionId: string,
  userId: string,
  ipAddress?: string
): Promise<{ isValid: boolean; reason?: string }> {
  try {
    await connectDB();
    
    // Import here to avoid circular dependency
    const { default: ChargingSession } = await import('@/models/ChargingSession');
    
    const session = await ChargingSession.findById(sessionId);
    
    if (!session) {
      await logSecurityEvent({
        userId,
        ipAddress,
        action: 'session_ownership_validation',
        resource: 'charging_session',
        resourceId: sessionId,
        status: 'failure',
        details: {
          reason: 'Session not found'
        }
      });
      
      return { isValid: false, reason: 'Session not found' };
    }
    
    if (session.userId !== userId) {
      await logSecurityEvent({
        userId,
        ipAddress,
        action: 'session_ownership_validation',
        resource: 'charging_session',
        resourceId: sessionId,
        status: 'failure',
        details: {
          reason: 'Session ownership mismatch',
          sessionOwner: session.userId,
          requestingUser: userId
        }
      });
      
      return { isValid: false, reason: 'Unauthorized access to session' };
    }
    
    return { isValid: true };
  } catch (error) {
    console.error('Error validating session ownership:', error);
    return { isValid: false, reason: 'Validation error' };
  }
}

const securityAudit = {
  logSecurityEvent,
  detectSuspiciousActivity,
  logSuspiciousActivity,
  getSecurityStats,
  shouldBlockIp,
  validateSessionOwnership
};

export default securityAudit;