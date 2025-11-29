<script lang="ts">
  import { Download } from "@lucide/svelte";
  import Dialog from "./Dialog.svelte";

  /**
   * Getting Started dialog component
   * Shown to new users without a playername to guide them to download the desktop app
   */

  interface Props {
    /**
     * Controls dialog visibility (bindable)
     */
    open?: boolean;

    /**
     * Download URL - server-side redirect route or direct link
     */
    downloadUrl?: string;
  }

  let {
    open = $bindable(false),
    downloadUrl = "/download",
  }: Props = $props();

  function handleDownload() {
    window.open(downloadUrl, "_blank");
    open = false;
  }

  function handleSkip() {
    open = false;
  }
</script>

<Dialog bind:open title="Download Picologs App" size="md" showFooter={false}>
  <div class="flex flex-col gap-6">
    <!-- Description -->
    <div class="space-y-3">
      <p class="text-sm text-white/90">
        The desktop app automatically monitors your Star Citizen game logs and
        populates your player name, then shares your activities with friends and
        groups in real-time.
      </p>
      <p class="text-sm text-white/70">
        No logs are saved or shared with non-friends or groups.
      </p>
    </div>

    <!-- Action Buttons -->
    <div class="flex flex-col gap-2 border-t border-white/10 pt-4">
      <button
        type="button"
        onclick={handleDownload}
        class="
					flex
					items-center
					justify-center
					gap-2
					rounded-md
					bg-discord
					px-4
					py-2.5
					text-sm
					font-medium
					text-white
					transition-colors
					hover:bg-discord/80
					focus:ring-2
					focus:ring-discord
					focus:ring-offset-2
					focus:outline-none
				"
      >
        <Download size={16} />
        Download Desktop App
      </button>
      <button
        type="button"
        onclick={handleSkip}
        class="
					rounded-md
					px-4
					py-2
					text-sm
					font-medium
					text-white/70
					transition-colors
					hover:bg-white/5
					hover:text-white
				"
      >
        Skip for now
      </button>
    </div>
  </div>
</Dialog>
