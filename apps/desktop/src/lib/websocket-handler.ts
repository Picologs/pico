/**
 * WebSocket Handler Factory
 *
 * Creates a reusable WebSocket connection with auto-reconnection,
 * authentication, and message handling capabilities.
 */

export interface WebSocketConfig {
	url: string;
	token?: string;
	userId?: string;
	onMessage?: (message: any) => void;
	onConnect?: () => void;
	onDisconnect?: () => void;
	onError?: (error: any) => void;
	autoReconnect?: boolean;
	maxReconnectAttempts?: number;
}

export interface WebSocketHandler {
	connect: () => void;
	disconnect: () => void;
	send: (message: any) => void;
	isConnected: () => boolean;
}

export function createWebSocketHandler(config: WebSocketConfig): WebSocketHandler {
	let ws: WebSocket | null = null;
	let reconnectAttempts = 0;
	let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
	let isManualDisconnect = false;
	let isConnecting = false;

	const {
		url,
		token,
		userId,
		onMessage,
		onConnect,
		onDisconnect,
		onError,
		autoReconnect = true,
		maxReconnectAttempts = 5
	} = config;

	/**
	 * Calculate exponential backoff delay
	 * 1s → 2s → 4s → 8s → 16s → max 30s
	 */
	function getReconnectDelay(): number {
		const baseDelay = 1000;
		const maxDelay = 30000;
		const delay = Math.min(baseDelay * Math.pow(2, reconnectAttempts), maxDelay);
		return delay;
	}

	/**
	 * Clear any pending reconnection timeout
	 */
	function clearReconnectTimeout(): void {
		if (reconnectTimeout) {
			clearTimeout(reconnectTimeout);
			reconnectTimeout = null;
		}
	}

	/**
	 * Attempt to reconnect with exponential backoff
	 */
	function attemptReconnect(): void {
		if (isManualDisconnect || !autoReconnect) {
			return;
		}

		if (reconnectAttempts >= maxReconnectAttempts) {
			onError?.({ message: 'Max reconnection attempts reached' });
			return;
		}

		const delay = getReconnectDelay();
		reconnectAttempts++;

		reconnectTimeout = setTimeout(() => {
			connect();
		}, delay);
	}

	/**
	 * Send authentication message
	 */
	function authenticate(): void {
		if (!token || !userId) {
			return;
		}

		const authMessage = {
			type: 'register',
			userId,
			token,
			clientType: 'desktop',
			timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
		};

		send(authMessage);
	}

	/**
	 * Handle incoming WebSocket messages
	 */
	function handleMessage(event: MessageEvent): void {
		try {
			const message = JSON.parse(event.data);

			// Auto-respond to ping messages
			if (message.type === 'ping') {
				send({ type: 'pong' });
				return;
			}

			// Route to user-provided handler
			onMessage?.(message);
		} catch (error) {
			console.error('[WebSocket] Failed to parse message', error);
			onError?.(error);
		}
	}

	/**
	 * Handle WebSocket connection opened
	 */
	function handleOpen(): void {
		isConnecting = false;
		reconnectAttempts = 0;
		clearReconnectTimeout();

		// Authenticate if credentials provided
		authenticate();

		// Notify connection success
		onConnect?.();
	}

	/**
	 * Handle WebSocket connection closed
	 */
	function handleClose(event: CloseEvent): void {
		isConnecting = false;
		ws = null;

		// Notify disconnection
		onDisconnect?.();

		// Attempt reconnection if not manual disconnect
		if (!isManualDisconnect && autoReconnect) {
			attemptReconnect();
		}
	}

	/**
	 * Handle WebSocket errors
	 */
	function handleError(event: Event): void {
		console.error('[WebSocket] Connection error', event);
		isConnecting = false;

		onError?.(event);
	}

	/**
	 * Connect to WebSocket server
	 */
	function connect(): void {
		// Prevent multiple simultaneous connection attempts
		if (
			isConnecting ||
			ws?.readyState === WebSocket.OPEN ||
			ws?.readyState === WebSocket.CONNECTING
		) {
			return;
		}

		try {
			isManualDisconnect = false;
			isConnecting = true;

			ws = new WebSocket(url);

			ws.onopen = handleOpen;
			ws.onmessage = handleMessage;
			ws.onclose = handleClose;
			ws.onerror = handleError;
		} catch (error) {
			console.error('[WebSocket] Failed to create connection', error);
			isConnecting = false;
			onError?.(error);

			// Retry connection if auto-reconnect enabled
			if (autoReconnect && !isManualDisconnect) {
				attemptReconnect();
			}
		}
	}

	/**
	 * Disconnect from WebSocket server
	 */
	function disconnect(): void {
		isManualDisconnect = true;
		isConnecting = false;
		reconnectAttempts = 0;
		clearReconnectTimeout();

		if (ws) {
			// Remove event listeners to prevent reconnection
			ws.onopen = null;
			ws.onmessage = null;
			ws.onclose = null;
			ws.onerror = null;

			// Close connection if open or connecting
			if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
				ws.close();
			}

			ws = null;
		}
	}

	/**
	 * Send message through WebSocket
	 */
	function send(message: any): void {
		if (!ws || ws.readyState !== WebSocket.OPEN) {
			console.error('[WebSocket] Cannot send message - not connected');
			return;
		}

		try {
			const payload = JSON.stringify(message);
			ws.send(payload);
		} catch (error) {
			console.error('[WebSocket] Failed to send message', error);
			onError?.(error);
		}
	}

	/**
	 * Check if WebSocket is connected
	 */
	function isConnected(): boolean {
		return ws?.readyState === WebSocket.OPEN;
	}

	return {
		connect,
		disconnect,
		send,
		isConnected
	};
}
