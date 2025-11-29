/**
 * Tauri WebSocket Adapter
 *
 * Polyfills the native WebSocket API to use Tauri's plugin-websocket.
 * This allows the shared-svelte library's WebSocket client to work in Tauri.
 *
 * The adapter wraps Tauri's WebSocket implementation to match the standard
 * WebSocket API, enabling seamless use of the same client code in both
 * browser and Tauri environments.
 *
 * @see https://v2.tauri.app/plugin/websocket/
 */

import TauriWebSocketClient from '@tauri-apps/plugin-websocket';
import type { Message } from '@tauri-apps/plugin-websocket';

/**
 * Install the Tauri WebSocket polyfill
 *
 * Replaces the global WebSocket constructor with Tauri's implementation.
 * This must be called before any WebSocket connections are created.
 */
export function installTauriWebSocketPolyfill() {
	if (typeof window === 'undefined') {
		console.warn('[Tauri WebSocket Adapter] Not in browser environment, skipping polyfill');
		return;
	}

	// Store reference to original WebSocket for debugging
	const OriginalWebSocket = window.WebSocket;

	// Create WebSocket wrapper that uses Tauri's connect function
	class TauriWebSocket extends EventTarget {
		// WebSocket standard properties
		public url: string;
		public readyState: number = 0; // CONNECTING
		public bufferedAmount: number = 0;
		public extensions: string = '';
		public protocol: string = '';
		public binaryType: BinaryType = 'blob';

		// WebSocket standard constants
		public static readonly CONNECTING = 0;
		public static readonly OPEN = 1;
		public static readonly CLOSING = 2;
		public static readonly CLOSED = 3;

		public readonly CONNECTING = 0;
		public readonly OPEN = 1;
		public readonly CLOSING = 2;
		public readonly CLOSED = 3;

		// Event handlers
		public onopen: ((this: WebSocket, ev: Event) => any) | null = null;
		public onclose: ((this: WebSocket, ev: CloseEvent) => any) | null = null;
		public onerror: ((this: WebSocket, ev: Event) => any) | null = null;
		public onmessage: ((this: WebSocket, ev: MessageEvent) => any) | null = null;

		private _tauriWebSocket: TauriWebSocketClient | null = null;

		constructor(url: string, protocols?: string | string[]) {
			super();
			this.url = url;

			// Note: Tauri WebSocket doesn't support protocols in the same way
			// For now, we'll ignore protocols parameter

			// Connect using Tauri's WebSocket plugin
			TauriWebSocketClient.connect(url)
				.then((ws) => {
					this._tauriWebSocket = ws;
					this.readyState = TauriWebSocket.OPEN;

					// Handle messages
					ws.addListener((msg: Message) => {
						let data: any;

						// Convert Tauri message format to standard WebSocket format
						if (msg.type === 'Text') {
							data = msg.data;
						} else if (msg.type === 'Binary') {
							data = new Uint8Array(msg.data);
						} else if (msg.type === 'Close') {
							// Handle close event
							this.readyState = TauriWebSocket.CLOSED;
							const closeEvent = new CloseEvent('close', {
								code: msg.data?.code || 1000,
								reason: msg.data?.reason || '',
								wasClean: true
							});
							this.onclose?.(closeEvent as any);
							this.dispatchEvent(closeEvent);
							return;
						} else {
							// Ping/Pong messages are handled internally
							return;
						}

						const messageEvent = new MessageEvent('message', {
							data: data,
							origin: this.url
						});
						this.onmessage?.(messageEvent as any);
						this.dispatchEvent(messageEvent);
					});

					// Dispatch open event
					const openEvent = new Event('open');
					this.onopen?.(openEvent as any);
					this.dispatchEvent(openEvent);
				})
				.catch((error) => {
					console.error('[Tauri WebSocket] Connection failed:', error);
					this.readyState = TauriWebSocket.CLOSED;
					const errorEvent = new Event('error');
					this.onerror?.(errorEvent as any);
					this.dispatchEvent(errorEvent);
				});
		}

		/**
		 * Send data through the WebSocket
		 */
		public send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
			if (this.readyState !== TauriWebSocket.OPEN) {
				throw new Error('WebSocket is not open');
			}

			if (!this._tauriWebSocket) {
				throw new Error('Tauri WebSocket not initialized');
			}

			// Convert data to Tauri message format
			if (typeof data === 'string') {
				// Send as text message
				this._tauriWebSocket.send(data);
			} else if (data instanceof ArrayBuffer) {
				// Send as binary message (convert to number array)
				this._tauriWebSocket.send(Array.from(new Uint8Array(data)));
			} else if (data instanceof Uint8Array) {
				// Send as binary message (convert to number array)
				this._tauriWebSocket.send(Array.from(data));
			} else if (ArrayBuffer.isView(data)) {
				// Send as binary message (convert to number array)
				this._tauriWebSocket.send(Array.from(new Uint8Array(data.buffer)));
			} else {
				// For Blob, we'd need to convert it - for now just stringify
				console.warn('[Tauri WebSocket] Blob data not fully supported, converting to string');
				this._tauriWebSocket.send(String(data));
			}
		}

		/**
		 * Close the WebSocket connection
		 */
		public close(code?: number, reason?: string): void {
			if (this.readyState === TauriWebSocket.CLOSED || this.readyState === TauriWebSocket.CLOSING) {
				return;
			}

			this.readyState = TauriWebSocket.CLOSING;

			if (this._tauriWebSocket) {
				this._tauriWebSocket
					.disconnect()
					.then(() => {
						this.readyState = TauriWebSocket.CLOSED;
						const closeEvent = new CloseEvent('close', {
							code: code || 1000,
							reason: reason || '',
							wasClean: true
						});
						this.onclose?.(closeEvent as any);
						this.dispatchEvent(closeEvent);
					})
					.catch((error: any) => {
						console.error('[Tauri WebSocket] Close failed:', error);
						this.readyState = TauriWebSocket.CLOSED;
					});
			} else {
				this.readyState = TauriWebSocket.CLOSED;
			}
		}
	}

	// Replace global WebSocket
	(window as any).WebSocket = TauriWebSocket;

	console.log('[Tauri WebSocket Adapter] Polyfill installed, original:', OriginalWebSocket.name);
}
