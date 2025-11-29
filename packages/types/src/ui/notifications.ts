/**
 * Notification Types
 *
 * Client-side UI notification types for toast messages and alerts.
 * Used across all applications for consistent notification display.
 *
 * @module types/ui/notifications
 */

/**
 * Notification severity/type
 */
export type NotificationType = "success" | "error" | "info";

/**
 * Notification options for object-based API
 */
export interface NotificationOptions {
  /** The notification message to display */
  message: string;

  /** The type/severity of the notification */
  type: NotificationType;

  /** Optional custom icon (emoji or icon name) */
  customIcon?: string;

  /** Whether to auto-dismiss the notification (default: true for success/info, false for error) */
  autoDismiss?: boolean;

  /** Auto-dismiss duration in milliseconds (default: 5000) */
  duration?: number;
}

/**
 * Unified notification callback - supports both function-based and object-based APIs
 *
 * Function-based (backward compatible):
 * ```ts
 * onNotification('Success!', 'success', '✓') // third parameter is customIcon
 * ```
 *
 * Object-based (recommended):
 * ```ts
 * onNotification({ message: 'Success!', type: 'success', customIcon: '✓', autoDismiss: true })
 * ```
 */
export type NotificationCallback =
  // Object-based API (recommended)
  | ((options: NotificationOptions) => void)
  // Function-based API (backward compatible)
  | ((
      message: string,
      type: NotificationType,
      customIcon?: string,
      autoDismiss?: boolean,
    ) => void);

/**
 * Helper to normalize notification callback arguments
 * Supports both object-based and function-based APIs
 */
export function normalizeNotification(
  ...args: [NotificationOptions] | [string, NotificationType, string?, boolean?]
): NotificationOptions {
  if (typeof args[0] === "object") {
    // Object-based API
    return args[0];
  } else {
    // Function-based API
    const [message, type, customIcon, autoDismiss] = args as [
      string,
      NotificationType,
      string?,
      boolean?,
    ];
    return { message, type, customIcon, autoDismiss };
  }
}

/**
 * Helper function to call a notification callback with normalized options
 */
export function callNotification(
  callback: NotificationCallback,
  options: NotificationOptions,
): void {
  // Try object-based first
  try {
    (callback as (options: NotificationOptions) => void)(options);
  } catch {
    // Fallback to function-based
    const { message, type, customIcon, autoDismiss } = options;
    (
      callback as (
        m: string,
        t: NotificationType,
        i?: string,
        a?: boolean,
      ) => void
    )(message, type, customIcon, autoDismiss);
  }
}
