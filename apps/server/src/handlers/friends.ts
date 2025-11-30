/**
 * Friend-related message handlers
 */

import { eq, or, and, inArray, sql } from "drizzle-orm";
import { db, users, friends, notifications } from "../lib/db";
import {
  send,
  getDisplayName,
  broadcast,
  isValidUserId,
  isValidUUID,
} from "../lib/utils";
import { userConnections } from "../lib/state";
import { notifyAdmin } from "../services/email";
import type {
  FriendRequestNotificationData,
  ActivityNotificationData,
} from "@pico/types";

/**
 * Create a notification in the database
 */
async function createNotification(
  userId: string,
  type: "friend_request" | "activity",
  title: string,
  message: string,
  data: FriendRequestNotificationData | ActivityNotificationData,
) {
  await db.insert(notifications).values({
    userId,
    type,
    title,
    message,
    data: data as any,
    read: false,
    createdAt: new Date(),
  });
}

export async function getFriends(
  ws: any,
  userId: string,
  data: any,
  requestId?: string,
) {
  const page = data?.page ?? 1;
  const perPage = Math.min(data?.perPage ?? 50, 100);
  const sortBy = data?.sortBy ?? "username";

  if (page < 1 || perPage < 1) {
    return send(
      ws,
      "error",
      undefined,
      "Invalid pagination parameters",
      requestId,
    );
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.discordId, userId))
    .limit(1);
  if (!user) {
    return send(
      ws,
      "friends_list",
      {
        data: [],
        pagination: {
          page: 1,
          perPage,
          total: 0,
          totalPages: 0,
          hasMore: false,
        },
      },
      undefined,
      requestId,
    );
  }

  // Get total count
  const [{ count: total }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(friends)
    .where(
      and(
        or(eq(friends.userId, user.id), eq(friends.friendId, user.id)),
        eq(friends.status, "accepted"),
      ),
    );

  const totalPages = Math.ceil(total / perPage);
  const offset = (page - 1) * perPage;

  // Get friendships
  const friendships = await db
    .select()
    .from(friends)
    .where(
      and(
        or(eq(friends.userId, user.id), eq(friends.friendId, user.id)),
        eq(friends.status, "accepted"),
      ),
    )
    .limit(perPage)
    .offset(offset);

  // Get friend user IDs
  const friendIds = [
    ...new Set(
      friendships.map((f) => (f.userId === user.id ? f.friendId : f.userId)),
    ),
  ];

  // Fetch friend details
  const friendUsers =
    friendIds.length > 0
      ? await db.select().from(users).where(inArray(users.id, friendIds))
      : [];

  // Build response
  let list = friendIds.map((fid) => {
    const friendship = friendships.find(
      (f) =>
        (f.userId === user.id && f.friendId === fid) ||
        (f.friendId === user.id && f.userId === fid),
    )!;
    const friend = friendUsers.find((u) => u.id === fid);

    return {
      id: friendship.id,
      status: friendship.status,
      createdAt: friendship.createdAt.toISOString(),
      friendUserId: friend?.discordId || fid,
      friendDiscordId: friend?.discordId || null,
      friendUsername: friend?.username || null,
      friendDisplayName: friend ? getDisplayName(friend) : null,
      friendAvatar: friend?.avatar || null,
      friendPlayer: friend?.player || null,
      friendTimeZone:
        friend?.showTimezone !== false ? friend?.timeZone || null : null,
      friendUsePlayerAsDisplayName: friend?.usePlayerAsDisplayName ?? false,
      isOnline: userConnections.has(friend?.discordId || ""),
    };
  });

  // Sort
  if (sortBy === "online") {
    list.sort((a, b) =>
      a.isOnline === b.isOnline
        ? (a.friendDisplayName || "").localeCompare(b.friendDisplayName || "")
        : a.isOnline
          ? -1
          : 1,
    );
  } else if (sortBy === "recent") {
    list.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  } else {
    list.sort((a, b) =>
      (a.friendDisplayName || "").localeCompare(b.friendDisplayName || ""),
    );
  }

  send(
    ws,
    "friends_list",
    {
      friends: list,
      pagination: {
        page,
        perPage,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    },
    undefined,
    requestId,
  );
}

export async function sendFriendRequest(
  ws: any,
  userId: string,
  data: any,
  requestId?: string,
) {
  const friendCode = data?.friendCode;
  const targetDiscordId = data?.discordId;

  if (!friendCode && !targetDiscordId) {
    return send(
      ws,
      "error",
      undefined,
      "Friend code or Discord ID is required",
      requestId,
    );
  }

  const [sender] = await db
    .select()
    .from(users)
    .where(eq(users.discordId, userId))
    .limit(1);
  if (!sender) {
    return send(
      ws,
      "error",
      undefined,
      "Current user not found in database",
      requestId,
    );
  }

  let target;
  if (friendCode) {
    [target] = await db
      .select()
      .from(users)
      .where(eq(users.friendCode, friendCode))
      .limit(1);
    if (!target) {
      return send(
        ws,
        "error",
        undefined,
        "User not found with that friend code",
        requestId,
      );
    }
  } else {
    [target] = await db
      .select()
      .from(users)
      .where(eq(users.discordId, targetDiscordId))
      .limit(1);
    if (!target) {
      return send(ws, "error", undefined, "User not found", requestId);
    }
  }

  if (target.discordId === userId) {
    return send(
      ws,
      "error",
      undefined,
      "Cannot send friend request to yourself",
      requestId,
    );
  }

  // Check existing friendship
  const [existing] = await db
    .select()
    .from(friends)
    .where(
      or(
        and(eq(friends.userId, sender.id), eq(friends.friendId, target.id)),
        and(eq(friends.userId, target.id), eq(friends.friendId, sender.id)),
      ),
    )
    .limit(1);

  if (existing) {
    return send(
      ws,
      "error",
      undefined,
      existing.status === "pending"
        ? "Friend request already sent"
        : "Already friends",
      requestId,
    );
  }

  // Create bidirectional pending friendships:
  // 1. sender → target (pending)
  // 2. target → sender (pending)
  const [[newFriendship], [reciprocalFriendship]] = await Promise.all([
    db
      .insert(friends)
      .values({
        userId: sender.id,
        friendId: target.id,
        status: "pending",
      })
      .returning(),
    db
      .insert(friends)
      .values({
        userId: target.id,
        friendId: sender.id,
        status: "pending",
      })
      .returning(),
  ]);

  // Create notification for recipient
  const notificationData: FriendRequestNotificationData = {
    type: "friend_request",
    friendshipId: newFriendship.id,
    fromUserId: sender.id,
    fromDiscordId: sender.discordId,
    fromUsername: sender.username,
    fromDisplayName: getDisplayName(sender),
    fromAvatar: sender.avatar,
    fromPlayer: sender.player,
  };

  await createNotification(
    target.id,
    "friend_request",
    "Friend Request",
    `${getDisplayName(sender)} sent you a friend request`,
    notificationData,
  );

  // Send full outgoing request object to sender
  send(
    ws,
    "friend_request_sent",
    {
      success: true,
      id: newFriendship.id,
      status: "pending",
      createdAt: newFriendship.createdAt.toISOString(),
      fromUserId: target.id,
      fromDiscordId: target.discordId,
      fromUsername: target.username,
      fromDisplayName: getDisplayName(target),
      fromAvatar: target.avatar,
      fromPlayer: target.player,
      fromTimeZone: target.timeZone,
      fromUsePlayerAsDisplayName: target.usePlayerAsDisplayName,
      direction: "outgoing",
    },
    undefined,
    requestId,
  );

  // Broadcast to sender's other connections (cross-device sync)
  broadcast([sender.discordId], "friend_request_sent", {
    success: true,
    id: newFriendship.id,
    status: "pending",
    createdAt: newFriendship.createdAt.toISOString(),
    fromUserId: target.id,
    fromDiscordId: target.discordId,
    fromUsername: target.username,
    fromDisplayName: getDisplayName(target),
    fromAvatar: target.avatar,
    fromPlayer: target.player,
    fromTimeZone: target.timeZone,
    fromUsePlayerAsDisplayName: target.usePlayerAsDisplayName,
    direction: "outgoing",
  });

  // Notify recipient if online
  broadcast([target.discordId], "friend_request_received", {
    id: newFriendship.id,
    fromUserId: sender.id,
    fromDiscordId: sender.discordId,
    fromUsername: sender.username,
    fromDisplayName: getDisplayName(sender),
    fromAvatar: sender.avatar,
    fromFriendCode: sender.friendCode,
    createdAt: newFriendship.createdAt.toISOString(),
    // Backwards compatibility
    discordId: sender.discordId,
    username: sender.username,
  });

  // Notify admin
  notifyAdmin(
    "Friend Request Sent",
    `"${getDisplayName(sender)}" sent a friend request to "${getDisplayName(target)}"`,
  );
}

export async function acceptFriendRequest(
  ws: any,
  userId: string,
  data: any,
  requestId?: string,
) {
  const friendshipId = data?.friendshipId;
  const friendCode = data?.friendCode;

  if (!friendshipId && !friendCode) {
    return send(
      ws,
      "error",
      undefined,
      "Either friendshipId or friendCode is required",
      requestId,
    );
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.discordId, userId))
    .limit(1);
  if (!user) return send(ws, "error", undefined, "User not found", requestId);

  let friendship;

  if (friendshipId) {
    // Original behavior: accept by friendship ID
    if (!isValidUserId(friendshipId)) {
      return send(ws, "error", undefined, "Invalid friendship ID", requestId);
    }
    [friendship] = await db
      .select()
      .from(friends)
      .where(eq(friends.id, friendshipId))
      .limit(1);
  } else if (friendCode) {
    // New behavior: accept by friend code (look up sender by friend code)
    const [sender] = await db
      .select()
      .from(users)
      .where(eq(users.friendCode, friendCode))
      .limit(1);
    if (!sender) {
      return send(
        ws,
        "error",
        undefined,
        "User not found with that friend code",
        requestId,
      );
    }
    // Find pending friendship from that sender to this user
    [friendship] = await db
      .select()
      .from(friends)
      .where(
        and(
          eq(friends.userId, sender.id),
          eq(friends.friendId, user.id),
          eq(friends.status, "pending"),
        ),
      )
      .limit(1);
  }

  if (!friendship)
    return send(ws, "error", undefined, "Friend request not found", requestId);

  if (friendship.friendId !== user.id) {
    return send(ws, "error", undefined, "Not authorized", requestId);
  }

  if (friendship.status !== "pending") {
    return send(
      ws,
      "error",
      undefined,
      "Friend request already processed",
      requestId,
    );
  }

  // Update status for BOTH bidirectional friendship records
  // (one from sender→target, one from target→sender)
  await db
    .update(friends)
    .set({ status: "accepted" })
    .where(
      or(
        and(
          eq(friends.userId, friendship.userId),
          eq(friends.friendId, friendship.friendId),
        ),
        and(
          eq(friends.userId, friendship.friendId),
          eq(friends.friendId, friendship.userId),
        ),
      ),
    );

  // Get sender details
  const [sender] = await db
    .select()
    .from(users)
    .where(eq(users.id, friendship.userId))
    .limit(1);

  // Create activity notification for sender
  if (sender) {
    const activityData: ActivityNotificationData = {
      type: "activity",
      activityType: "friend_online",
      relatedUserId: user.id,
      relatedUsername: user.username,
      relatedDisplayName: getDisplayName(user),
    };

    await createNotification(
      sender.id,
      "activity",
      "Friend Request Accepted",
      `${getDisplayName(user)} accepted your friend request`,
      activityData,
    );
  }

  // Send full friend object to accepter
  send(
    ws,
    "friend_request_accepted",
    {
      success: true,
      id: friendship.id,
      status: "accepted",
      createdAt: friendship.createdAt.toISOString(),
      friendUserId: sender ? sender.id : friendship.userId,
      friendDiscordId: sender ? sender.discordId : "",
      friendUsername: sender ? sender.username : "",
      friendDisplayName: sender ? getDisplayName(sender) : "",
      friendAvatar: sender ? sender.avatar : null,
      friendPlayer: sender ? sender.player : null,
      friendTimeZone: sender ? sender.timeZone : null,
      friendUsePlayerAsDisplayName: sender
        ? sender.usePlayerAsDisplayName
        : false,
      isOnline: sender ? userConnections.has(sender.discordId) : false,
    },
    undefined,
    requestId,
  );

  // Notify sender if online
  if (sender) {
    broadcast([sender.discordId], "friend_request_accepted_notification", {
      success: true,
      id: friendship.id,
      status: "accepted",
      createdAt: friendship.createdAt.toISOString(),
      friendUserId: user.id,
      friendDiscordId: user.discordId,
      friendUsername: user.username,
      friendDisplayName: getDisplayName(user),
      friendAvatar: user.avatar,
      friendPlayer: user.player,
      friendTimeZone: user.timeZone,
      friendUsePlayerAsDisplayName: user.usePlayerAsDisplayName,
      isOnline: userConnections.has(user.discordId),
      // Backwards compatibility
      discordId: user.discordId,
    });
  }
}

export async function denyFriendRequest(
  ws: any,
  userId: string,
  data: any,
  requestId?: string,
) {
  const friendshipId = data?.friendshipId;
  const friendCode = data?.friendCode;

  if (!friendshipId && !friendCode) {
    return send(
      ws,
      "error",
      undefined,
      "Either friendshipId or friendCode is required",
      requestId,
    );
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.discordId, userId))
    .limit(1);
  if (!user) return send(ws, "error", undefined, "User not found", requestId);

  let friendship;

  if (friendshipId) {
    // Original behavior: deny by friendship ID
    if (!isValidUserId(friendshipId)) {
      return send(ws, "error", undefined, "Invalid friendship ID", requestId);
    }
    [friendship] = await db
      .select()
      .from(friends)
      .where(eq(friends.id, friendshipId))
      .limit(1);
  } else if (friendCode) {
    // New behavior: deny by friend code (look up sender by friend code)
    const [sender] = await db
      .select()
      .from(users)
      .where(eq(users.friendCode, friendCode))
      .limit(1);
    if (!sender) {
      return send(
        ws,
        "error",
        undefined,
        "User not found with that friend code",
        requestId,
      );
    }
    // Find pending friendship from that sender to this user
    [friendship] = await db
      .select()
      .from(friends)
      .where(
        and(
          eq(friends.userId, sender.id),
          eq(friends.friendId, user.id),
          eq(friends.status, "pending"),
        ),
      )
      .limit(1);
  }

  if (!friendship)
    return send(ws, "error", undefined, "Friend request not found", requestId);

  if (friendship.friendId !== user.id) {
    return send(ws, "error", undefined, "Not authorized", requestId);
  }

  // Delete the friendship
  await db.delete(friends).where(eq(friends.id, friendship.id));

  send(
    ws,
    "friend_request_denied",
    { success: true, friendshipId: friendship.id },
    undefined,
    requestId,
  );
}

export async function cancelFriendRequest(
  ws: any,
  userId: string,
  data: any,
  requestId?: string,
) {
  const friendshipId = data?.friendshipId;

  if (!friendshipId || !isValidUserId(friendshipId)) {
    return send(ws, "error", undefined, "Invalid friendship ID", requestId);
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.discordId, userId))
    .limit(1);
  if (!user) return send(ws, "error", undefined, "User not found", requestId);

  const [friendship] = await db
    .select()
    .from(friends)
    .where(eq(friends.id, friendshipId))
    .limit(1);
  if (!friendship)
    return send(ws, "error", undefined, "Friend request not found", requestId);

  // Validate that the user is the sender (not the recipient)
  if (friendship.userId !== user.id) {
    return send(
      ws,
      "error",
      undefined,
      "Not authorized to cancel this request",
      requestId,
    );
  }

  // Validate that the request is still pending
  if (friendship.status !== "pending") {
    return send(
      ws,
      "error",
      undefined,
      "Can only cancel pending requests",
      requestId,
    );
  }

  // Delete the friendship
  await db.delete(friends).where(eq(friends.id, friendshipId));

  send(ws, "friend_request_cancelled", { friendshipId }, undefined, requestId);
}

export async function removeFriend(
  ws: any,
  userId: string,
  data: any,
  requestId?: string,
) {
  const friendshipId = data?.friendshipId;
  const friendCode = data?.friendCode;

  if (!friendshipId && !friendCode) {
    return send(
      ws,
      "error",
      undefined,
      "Either friendshipId or friendCode is required",
      requestId,
    );
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.discordId, userId))
    .limit(1);
  if (!user) return send(ws, "error", undefined, "User not found", requestId);

  let friendship;

  if (friendshipId) {
    // Original behavior: remove by friendship ID
    if (!isValidUUID(friendshipId)) {
      return send(ws, "error", undefined, "Invalid friendship ID", requestId);
    }
    // Get the friendship to find the friend's Discord ID for notifications
    [friendship] = await db
      .select({
        id: friends.id,
        userId: friends.userId,
        friendId: friends.friendId,
        friendDiscordId: users.discordId,
      })
      .from(friends)
      .leftJoin(users, eq(users.id, friends.friendId))
      .where(and(eq(friends.id, friendshipId), eq(friends.userId, user.id)))
      .limit(1);
  } else if (friendCode) {
    // New behavior: remove by friend code
    const [friendUser] = await db
      .select()
      .from(users)
      .where(eq(users.friendCode, friendCode))
      .limit(1);
    if (!friendUser) {
      return send(
        ws,
        "error",
        undefined,
        "User not found with that friend code",
        requestId,
      );
    }

    // Find the friendship (check both directions)
    [friendship] = await db
      .select({
        id: friends.id,
        userId: friends.userId,
        friendId: friends.friendId,
        friendDiscordId: users.discordId,
      })
      .from(friends)
      .leftJoin(users, eq(users.id, friends.friendId))
      .where(
        and(
          or(
            and(
              eq(friends.userId, user.id),
              eq(friends.friendId, friendUser.id),
            ),
            and(
              eq(friends.userId, friendUser.id),
              eq(friends.friendId, user.id),
            ),
          ),
          eq(friends.status, "accepted"),
        ),
      )
      .limit(1);
  }

  if (!friendship)
    return send(ws, "error", undefined, "Friendship not found", requestId);

  // Delete friendship (bidirectional)
  await db
    .delete(friends)
    .where(
      or(
        and(
          eq(friends.userId, user.id),
          eq(friends.friendId, friendship.friendId),
        ),
        and(
          eq(friends.userId, friendship.friendId),
          eq(friends.friendId, user.id),
        ),
      ),
    );

  send(
    ws,
    "friend_removed",
    { success: true, friendshipId: friendship.id },
    undefined,
    requestId,
  );

  // Notify friend if online
  if (friendship.friendDiscordId) {
    broadcast([friendship.friendDiscordId], "friend_removed_notification", {
      removedByDiscordId: user.discordId,
      removedByUsername: user.username,
      removedByDisplayName: getDisplayName(user),
    });
  }
}

export async function getFriendRequests(
  ws: any,
  userId: string,
  data: any,
  requestId?: string,
) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.discordId, userId))
    .limit(1);
  if (!user)
    return send(
      ws,
      "friend_requests",
      { data: { incoming: [], outgoing: [] } },
      undefined,
      requestId,
    );

  // Get all pending friend requests
  const pending = await db
    .select()
    .from(friends)
    .where(
      and(
        or(eq(friends.userId, user.id), eq(friends.friendId, user.id)),
        eq(friends.status, "pending"),
      ),
    );

  // Get user IDs
  const userIds = [...new Set(pending.flatMap((f) => [f.userId, f.friendId]))];
  const allUsers = await db
    .select()
    .from(users)
    .where(inArray(users.id, userIds));

  // Build incoming/outgoing
  const incoming = pending
    .filter((f) => f.friendId === user.id)
    .map((f) => {
      const sender = allUsers.find((u) => u.id === f.userId);
      return {
        id: f.id,
        fromUserId: f.userId,
        fromDiscordId: sender?.discordId || null,
        fromUsername: sender?.username || null,
        fromDisplayName: sender ? getDisplayName(sender) : null,
        fromAvatar: sender?.avatar || null,
        createdAt: f.createdAt.toISOString(),
      };
    });

  const outgoing = pending
    .filter((f) => f.userId === user.id)
    .map((f) => {
      const recipient = allUsers.find((u) => u.id === f.friendId);
      return {
        id: f.id,
        toUserId: f.friendId,
        toDiscordId: recipient?.discordId || null,
        toUsername: recipient?.username || null,
        toDisplayName: recipient ? getDisplayName(recipient) : null,
        toAvatar: recipient?.avatar || null,
        createdAt: f.createdAt.toISOString(),
      };
    });

  send(ws, "friend_requests", { incoming, outgoing }, undefined, requestId);
}
