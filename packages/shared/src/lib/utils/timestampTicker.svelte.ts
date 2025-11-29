/**
 * Global timestamp ticker for efficient timestamp updates
 *
 * Instead of each component creating its own setInterval,
 * all components subscribe to this single 60-second ticker.
 *
 * This reduces CPU usage from O(n) timers to O(1) timer
 * where n = number of log items displayed.
 */

let tick = $state(0);
let intervalId: ReturnType<typeof setInterval> | null = null;
let subscriberCount = 0;

/**
 * Subscribe to the global ticker
 * Returns the current tick count (increments every 60 seconds)
 */
export function useTimestampTicker() {
  subscriberCount++;

  // Start the interval when first subscriber joins
  if (subscriberCount === 1 && !intervalId) {
    intervalId = setInterval(() => {
      tick++;
    }, 60000); // 60 seconds
  }

  // Cleanup function
  $effect(() => {
    return () => {
      subscriberCount--;

      // Stop the interval when last subscriber leaves
      if (subscriberCount === 0 && intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };
  });

  return {
    get tick() {
      return tick;
    },
  };
}
