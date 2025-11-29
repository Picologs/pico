/**
 * Get Discord default avatar color based on user ID (consistent per user)
 * Returns one of Discord's 5 default avatar colors
 */
export function getDiscordColor(userId: string): string {
  const colors = [
    "#ED4245", // Red
    "#5865F2", // Blurple
    "#57F287", // Green
    "#F0B232", // Orange
    "#EB459E", // Pink
  ];

  // Simple hash function to get consistent color for same user
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
}
