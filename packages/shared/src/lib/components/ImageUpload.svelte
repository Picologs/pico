<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    /** Current image URL (if any) */
    currentImage?: string | null;
    /** Callback when upload succeeds */
    onUploadSuccess: (url: string) => void;
    /** Callback when upload fails */
    onUploadError?: (error: string) => void;
    /** JWT token for authentication */
    token: string;
    /** Upload server URL (default: http://localhost:8080) */
    serverUrl?: string;
    /** Custom fetch function (default: browser fetch, use Tauri fetch in desktop app) */
    fetchFn?: typeof fetch;
    /** Custom button content */
    children?: Snippet;
    /** Custom CSS classes for button styling (overrides default .upload-button styles) */
    buttonClass?: string;
  }

  let {
    currentImage = $bindable(),
    onUploadSuccess,
    onUploadError,
    token,
    serverUrl = 'http://localhost:8080',
    fetchFn = fetch,
    children,
    buttonClass
  }: Props = $props();

  let fileInput: HTMLInputElement;
  let previewUrl = $state<string | null>(null);
  let uploading = $state(false);
  let resizing = $state(false);
  let error = $state<string | null>(null);

  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const TARGET_SIZE = 512; // Avatar dimensions

  /**
   * Check if a GIF file is animated by parsing its header
   * Returns true if the GIF contains multiple frames
   */
  async function isAnimatedGif(file: File): Promise<boolean> {
    if (file.type !== 'image/gif') return false;

    const buffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(buffer);

    // Check for GIF89a signature
    const signature = String.fromCharCode(...uint8.slice(0, 6));
    if (signature !== 'GIF89a') return false;

    // Look for multiple image descriptors (0x2C)
    let frames = 0;
    for (let i = 13; i < uint8.length - 1; i++) {
      if (uint8[i] === 0x21 && uint8[i + 1] === 0xF9) {
        // Graphics Control Extension - indicates a frame
        frames++;
        if (frames > 1) return true;
      }
    }
    return false;
  }

  /**
   * Check if a WebP file is animated by parsing its RIFF header
   * Returns true if the WebP contains an ANIM chunk
   */
  async function isAnimatedWebP(file: File): Promise<boolean> {
    if (file.type !== 'image/webp') return false;

    const buffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(buffer);

    // Check for RIFF and WEBP signatures
    const riff = String.fromCharCode(...uint8.slice(0, 4));
    const webp = String.fromCharCode(...uint8.slice(8, 12));
    if (riff !== 'RIFF' || webp !== 'WEBP') return false;

    // Look for ANIM chunk (indicates animation)
    for (let i = 12; i < uint8.length - 4; i++) {
      const chunk = String.fromCharCode(...uint8.slice(i, i + 4));
      if (chunk === 'ANIM') return true;
    }
    return false;
  }

  /**
   * Resize image to circular avatar using native browser APIs
   * Uses createImageBitmap + OffscreenCanvas for optimal performance
   *
   * Note: Animated images (GIF/WebP) are returned unchanged to preserve
   * animation frames. Server-side processing handles animated resizing.
   */
  async function resizeImage(file: File): Promise<Blob> {
    // Check if image is animated - if so, let server handle it
    const isAnimated = await isAnimatedGif(file) || await isAnimatedWebP(file);
    if (isAnimated) {
      return file;
    }
    try {
      // Decode image efficiently
      const bitmap = await createImageBitmap(file);

      // Use OffscreenCanvas for non-blocking rendering
      const canvas = new OffscreenCanvas(TARGET_SIZE, TARGET_SIZE);
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Canvas context not available');
      }

      // Calculate dimensions to fill circle (cover fit)
      const scale = Math.max(TARGET_SIZE / bitmap.width, TARGET_SIZE / bitmap.height);
      const scaledWidth = bitmap.width * scale;
      const scaledHeight = bitmap.height * scale;

      // Center crop calculation
      const offsetX = (scaledWidth - TARGET_SIZE) / 2;
      const offsetY = (scaledHeight - TARGET_SIZE) / 2;

      // Draw image with cover fit
      ctx.drawImage(
        bitmap,
        -offsetX,
        -offsetY,
        scaledWidth,
        scaledHeight
      );

      // Create circular clipping mask
      ctx.globalCompositeOperation = 'destination-in';
      ctx.beginPath();
      ctx.arc(TARGET_SIZE / 2, TARGET_SIZE / 2, TARGET_SIZE / 2, 0, Math.PI * 2);
      ctx.fill();

      // Convert to WebP (matches server settings)
      const blob = await canvas.convertToBlob({
        type: 'image/webp',
        quality: 0.85
      });

      bitmap.close(); // Clean up
      return blob;
    } catch (err) {
      console.warn('Client-side resize failed, uploading original:', err);
      // Fallback to original file
      return file;
    }
  }

  async function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];

    if (!file) return;

    // Reset error
    error = null;

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      error = `Invalid file type. Allowed: ${ALLOWED_TYPES.map(t => t.split('/')[1]).join(', ')}`;
      onUploadError?.(error);
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      error = `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`;
      onUploadError?.(error);
      return;
    }

    // Show preview and auto-upload
    resizing = true;
    const reader = new FileReader();

    reader.onload = async (e) => {
      previewUrl = e.target?.result as string;
      resizing = false;

      // Auto-upload immediately
      await uploadFile(file);
    };

    reader.readAsDataURL(file);
  }

  async function uploadFile(file: File) {
    uploading = true;
    error = null;

    try {
      // Resize image to circular avatar
      resizing = true;
      const resizedBlob = await resizeImage(file);
      resizing = false;

      const formData = new FormData();

      // Convert Blob to File with proper metadata for server validation
      // If animated, preserve original format; otherwise use WebP
      let fileToUpload: File;
      if (resizedBlob instanceof File) {
        // Animated image - use original file
        fileToUpload = resizedBlob;
      } else {
        // Static image - converted to WebP
        fileToUpload = new File([resizedBlob], 'avatar.webp', { type: 'image/webp' });
      }

      formData.append('file', fileToUpload);

      const response = await fetchFn(`${serverUrl}/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || data.details || 'Upload failed');
      }

      const data = await response.json();
      onUploadSuccess(data.url);
      currentImage = data.url;
      previewUrl = null; // Clear preview after successful upload
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error occurred';
      onUploadError?.(error);
      previewUrl = null;
    } finally {
      uploading = false;
      resizing = false;
    }
  }

  function openFileDialog() {
    fileInput.click();
  }
</script>

<div class="image-upload">
  <input
    type="file"
    bind:this={fileInput}
    onchange={handleFileSelect}
    accept={ALLOWED_TYPES.join(',')}
    style="display: none;"
  />

  {#if previewUrl || currentImage}
    <div class="preview">
      <img src={previewUrl || currentImage} alt="Preview" />
      {#if uploading || resizing}
        <div class="overlay">
          <div class="spinner"></div>
          <p>{uploading ? 'Uploading...' : 'Processing...'}</p>
        </div>
      {/if}
    </div>
  {/if}

  <button
    type="button"
    onclick={openFileDialog}
    disabled={uploading || resizing}
    class={buttonClass || 'upload-button'}
  >
    {#if children}
      {@render children()}
    {:else}
      {resizing ? 'Processing...' : uploading ? 'Uploading...' : currentImage ? 'Change Image' : 'Upload Image'}
    {/if}
  </button>

  {#if error}
    <p class="error">{error}</p>
  {/if}
</div>

<style>
  .image-upload {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    align-items: center;
  }

  .preview {
    position: relative;
    width: 64px;
    height: 64px;
    border-radius: 50%;
    overflow: hidden;
    border: 2px solid rgba(255, 255, 255, 0.1);
  }

  .preview img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .spinner {
    width: 1.5rem;
    height: 1.5rem;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
  }

  .overlay p {
    color: white;
    font-size: 0.75rem;
    margin: 0;
  }

  .upload-button {
    padding: 0.5rem 1rem;
    background: var(--primary-color, #3b82f6);
    color: white;
    border: none;
    border-radius: 0.375rem;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
    transition: background 0.2s;
  }

  .upload-button:hover:not(:disabled) {
    background: var(--primary-hover, #2563eb);
  }

  .upload-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .error {
    color: var(--error-color, #ef4444);
    font-size: 0.875rem;
    margin: 0;
    text-align: center;
  }
</style>
