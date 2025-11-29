/**
 * Get the display name for a user based on their usePlayerAsDisplayName preference
 * @param user - User object with username, player, and usePlayerAsDisplayName fields
 * @returns The appropriate display name (never returns Discord username if usePlayerAsDisplayName is true)
 */
export function getDisplayName(user: {
  username: string;
  player: string | null;
  usePlayerAsDisplayName: boolean | null;
}): string {
  if (user.usePlayerAsDisplayName && user.player) {
    return user.player;
  }
  return user.username;
}
