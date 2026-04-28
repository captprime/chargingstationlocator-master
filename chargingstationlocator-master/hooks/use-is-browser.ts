import { useState, useEffect } from 'react';

/**
 * Custom hook to safely detect if code is running in a browser environment
 * 
 * @returns {boolean} True if running in a browser, false during server-side rendering
 * 
 * @example
 * const isBrowser = useIsBrowser();
 * 
 * // Safe window access
 * useEffect(() => {
 *   if (isBrowser) {
 *     window.addEventListener('resize', handleResize);
 *     return () => window.removeEventListener('resize', handleResize);
 *   }
 * }, [isBrowser]);
 */
export function useIsBrowser() {
  const [isBrowser, setIsBrowser] = useState(false);
  
  // This effect will only run after the component has mounted on the client
  useEffect(() => {
    setIsBrowser(true);
  }, []);
  
  return isBrowser;
}