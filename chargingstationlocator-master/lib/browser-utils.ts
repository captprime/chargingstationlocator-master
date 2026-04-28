/**
 * Safely check if code is running in a browser environment
 * 
 * @returns {boolean} True if running in a browser, false during server-side rendering
 */
export const isBrowser = typeof window !== 'undefined';

/**
 * Safely access browser window object
 * 
 * @returns {Window | undefined} Window object if in browser, undefined otherwise
 */
export const getWindow = (): Window | undefined => {
  return isBrowser ? window : undefined;
};

/**
 * Safely access browser navigator object
 * 
 * @returns {Navigator | undefined} Navigator object if in browser, undefined otherwise
 */
export const getNavigator = (): Navigator | undefined => {
  return isBrowser ? navigator : undefined;
};

/**
 * Safely access browser document object
 * 
 * @returns {Document | undefined} Document object if in browser, undefined otherwise
 */
export const getDocument = (): Document | undefined => {
  return isBrowser ? document : undefined;
};

/**
 * Safely access browser localStorage object
 * 
 * @returns {Storage | undefined} localStorage object if in browser, undefined otherwise
 */
export const getLocalStorage = (): Storage | undefined => {
  if (isBrowser) {
    try {
      return localStorage;
    } catch (e) {
      console.error('localStorage is not available:', e);
      return undefined;
    }
  }
  return undefined;
};

/**
 * Safely access browser sessionStorage object
 * 
 * @returns {Storage | undefined} sessionStorage object if in browser, undefined otherwise
 */
export const getSessionStorage = (): Storage | undefined => {
  if (isBrowser) {
    try {
      return sessionStorage;
    } catch (e) {
      console.error('sessionStorage is not available:', e);
      return undefined;
    }
  }
  return undefined;
};

/**
 * Safely execute a function only in browser environment
 * 
 * @param {Function} fn Function to execute in browser environment
 * @param {unknown[]} args Arguments to pass to the function
 * @returns {ReturnType<typeof fn> | undefined} Function result if in browser, undefined otherwise
 */
export function runInBrowser<T extends (...args: unknown[]) => unknown>(
  fn: T,
  ...args: Parameters<T>
): ReturnType<T> | undefined {
  if (isBrowser) {
    return fn(...args) as ReturnType<T>;
  }
  return undefined;
}

/**
 * Safely open a URL in a new tab/window
 * 
 * @param {string} url URL to open
 * @param {string} target Target window (_blank, _self, etc.)
 * @returns {Window | null | undefined} Window object if in browser and successful, null if browser blocks it, undefined if not in browser
 */
export const safeWindowOpen = (url: string, target: string = '_blank'): Window | null | undefined => {
  return runInBrowser(() => window.open(url, target));
};

/**
 * Safely get the current URL
 * 
 * @returns {string | undefined} Current URL if in browser, undefined otherwise
 */
export const getCurrentUrl = (): string | undefined => {
  return isBrowser ? window.location.href : undefined;
};