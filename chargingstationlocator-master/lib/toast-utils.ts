import { toast } from 'sonner';

// Success toast
export const showSuccessToast = (message: string, description?: string) => {
  toast.success(message, {
    description,
    duration: 4000,
  });
};

// Error toast
export const showErrorToast = (message: string, description?: string) => {
  toast.error(message, {
    description,
    duration: 5000,
  });
};

// Info toast
export const showInfoToast = (message: string, description?: string) => {
  toast.info(message, {
    description,
    duration: 4000,
  });
};

// Warning toast
export const showWarningToast = (message: string, description?: string) => {
  toast.warning(message, {
    description,
    duration: 4000,
  });
};

// Loading toast with promise
export const showLoadingToast = <T>(
  promise: Promise<T>,
  messages: {
    loading: string;
    success: string;
    error: string;
  }
): Promise<T> => {
  toast.promise(promise, {
    loading: messages.loading,
    success: messages.success,
    error: messages.error,
  });
  return promise;
};

// Custom toast with action
export const showActionToast = (
  message: string,
  action: {
    label: string;
    onClick: () => void;
  },
  description?: string
) => {
  toast(message, {
    description,
    action: {
      label: action.label,
      onClick: action.onClick,
    },
    duration: 6000,
  });
};

// Dismiss all toasts
export const dismissAllToasts = () => {
  toast.dismiss();
};

// Common app-specific toasts
export const appToasts = {
  // Authentication
  loginSuccess: () => showSuccessToast('Welcome back!', 'You have been successfully logged in.'),
  loginError: () => showErrorToast('Login failed', 'Please check your credentials and try again.'),
  logoutSuccess: () => showSuccessToast('Logged out', 'You have been successfully logged out.'),
  registrationSuccess: () => showSuccessToast('Account created!', 'Welcome to ChargeSense.'),
  registrationError: () => showErrorToast('Registration failed', 'Please try again or contact support.'),

  // Device management
  deviceRegistered: (deviceName: string) => 
    showSuccessToast('Device registered!', `${deviceName} has been linked to your account.`),
  deviceRegistrationError: () => 
    showErrorToast('Device registration failed', 'Please check the vehicle ID and try again.'),

  // Battery monitoring
  batteryLow: () => 
    showWarningToast('Battery Low!', 'Your battery is running low. Consider finding a charging station.'),
  batteryCritical: () => 
    showErrorToast('Critical Battery Level!', 'Your battery is critically low. Find a charging station immediately.'),

  // Station management
  stationAdded: (stationName: string) => 
    showSuccessToast('Station added!', `${stationName} has been added successfully.`),
  stationUpdated: (stationName: string) => 
    showSuccessToast('Station updated!', `${stationName} has been updated successfully.`),
  stationDeleted: (stationName: string) => 
    showSuccessToast('Station deleted!', `${stationName} has been removed.`),
  stationError: () => 
    showErrorToast('Station operation failed', 'Please try again or contact support.'),

  // Location services
  locationPermissionDenied: () => 
    showWarningToast('Location access denied', 'Please enable location services to find nearby stations.'),
  locationError: () => 
    showErrorToast('Location error', 'Unable to get your location. Please try again.'),

  // Network errors
  networkError: () => 
    showErrorToast('Network error', 'Please check your internet connection and try again.'),
  serverError: () => 
    showErrorToast('Server error', 'Something went wrong on our end. Please try again later.'),

  // Generic
  saveSuccess: () => showSuccessToast('Saved!', 'Your changes have been saved successfully.'),
  saveError: () => showErrorToast('Save failed', 'Unable to save your changes. Please try again.'),
  copySuccess: () => showSuccessToast('Copied!', 'Text copied to clipboard.'),
  copyError: () => showErrorToast('Copy failed', 'Unable to copy to clipboard.'),
};