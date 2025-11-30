/**
 * WebSocket message dispatcher
 * Routes messages to appropriate handlers
 */

import * as friendHandlers from "../handlers/friends";
import * as groupHandlers from "../handlers/groups";
import * as discoverHandlers from "../handlers/discover";
import * as logHandlers from "../handlers/logs";
import * as logSchemaHandlers from "../handlers/log-schema";
import * as profileHandlers from "../handlers/profile";
import * as dashboardHandlers from "../handlers/dashboard";
import * as adminHandlers from "../handlers/admin";
import { send } from "../lib/utils";

import type { ServerWebSocket } from "bun";

/**
 * Dispatch authenticated WebSocket message to appropriate handler
 */
export async function dispatchMessage(
  ws: ServerWebSocket<any>,
  userId: string,
  type: string,
  data: any,
  requestId?: string,
): Promise<void> {
  switch (type) {
    // Friends
    case "get_friends":
      return await friendHandlers.getFriends(ws, userId, data, requestId);
    case "send_friend_request":
      return await friendHandlers.sendFriendRequest(
        ws,
        userId,
        data,
        requestId,
      );
    case "accept_friend_request":
      return await friendHandlers.acceptFriendRequest(
        ws,
        userId,
        data,
        requestId,
      );
    case "deny_friend_request":
      return await friendHandlers.denyFriendRequest(
        ws,
        userId,
        data,
        requestId,
      );
    case "cancel_friend_request":
      return await friendHandlers.cancelFriendRequest(
        ws,
        userId,
        data,
        requestId,
      );
    case "remove_friend":
      return await friendHandlers.removeFriend(ws, userId, data, requestId);
    case "get_friend_requests":
      return await friendHandlers.getFriendRequests(
        ws,
        userId,
        data,
        requestId,
      );

    // Dashboard (combined friends + groups + invitations)
    case "get_dashboard_data":
      return await dashboardHandlers.getDashboardData(
        ws,
        userId,
        data,
        requestId,
      );

    // Groups
    case "get_groups":
      return await groupHandlers.getGroups(ws, userId, data, requestId);
    case "create_group":
      return await groupHandlers.createGroup(ws, userId, data, requestId);
    case "update_group":
      return await groupHandlers.updateGroup(ws, userId, data, requestId);
    case "delete_group":
      return await groupHandlers.deleteGroup(ws, userId, data, requestId);
    case "leave_group":
      return await groupHandlers.leaveGroup(ws, userId, data, requestId);
    case "invite_friend_to_group":
      return await groupHandlers.inviteFriendToGroup(
        ws,
        userId,
        data,
        requestId,
      );
    case "accept_group_invitation":
      return await groupHandlers.acceptGroupInvitation(
        ws,
        userId,
        data,
        requestId,
      );
    case "deny_group_invitation":
      return await groupHandlers.denyGroupInvitation(
        ws,
        userId,
        data,
        requestId,
      );
    case "cancel_group_invitation":
      return await groupHandlers.cancelGroupInvitation(
        ws,
        userId,
        data,
        requestId,
      );
    case "get_group_invitations":
      return await groupHandlers.getGroupInvitations(ws, userId, requestId);
    case "get_group_members":
      return await groupHandlers.getGroupMembers(ws, userId, data, requestId);
    case "update_member_role":
      return await groupHandlers.updateMemberRole(ws, userId, data, requestId);
    case "remove_member_from_group":
      return await groupHandlers.removeMemberFromGroup(
        ws,
        userId,
        data,
        requestId,
      );

    // Group Discovery
    case "get_discoverable_groups":
      return await discoverHandlers.getDiscoverableGroups(
        ws,
        userId,
        data,
        requestId,
      );
    case "get_discover_tags":
      return await discoverHandlers.getDiscoverTags(ws, userId, requestId);
    case "join_open_group":
      return await discoverHandlers.joinOpenGroup(ws, userId, data, requestId);
    case "request_join_group":
      return await discoverHandlers.requestJoinGroup(
        ws,
        userId,
        data,
        requestId,
      );
    case "get_join_requests":
      return await discoverHandlers.getJoinRequests(
        ws,
        userId,
        data,
        requestId,
      );
    case "review_join_request":
      return await discoverHandlers.reviewJoinRequest(
        ws,
        userId,
        data,
        requestId,
      );

    // Logs
    case "send_logs":
      return await logHandlers.sendLogs(ws, userId, data, requestId);
    case "batch_logs":
      return await logHandlers.batchLogs(ws, userId, data, requestId);
    case "batch_group_logs":
      return await logHandlers.batchGroupLogs(ws, userId, data, requestId);

    // Log Schema Discovery
    case "report_log_patterns":
      return await logSchemaHandlers.reportLogPatterns(
        ws,
        userId,
        data,
        requestId,
      );
    case "get_log_pattern_stats":
      return await logSchemaHandlers.getLogPatternStats(
        ws,
        userId,
        data,
        requestId,
      );

    // Profile
    case "get_user_profile":
      return await profileHandlers.getUserProfile(ws, userId, data, requestId);
    case "update_user_profile":
      return await profileHandlers.updateUserProfile(
        ws,
        userId,
        data,
        requestId,
      );
    case "delete_user_profile":
      return await profileHandlers.deleteUserProfile(
        ws,
        userId,
        data,
        requestId,
      );

    // Admin
    case "admin_block_user":
      return await adminHandlers.blockUser(ws, userId, data, requestId);
    case "admin_unblock_user":
      return await adminHandlers.unblockUser(ws, userId, data, requestId);
    case "admin_toggle_signups":
      return await adminHandlers.toggleSignups(ws, userId, data, requestId);
    case "admin_get_settings":
      return await adminHandlers.getAdminSettings(ws, userId, data, requestId);

    default:
      send(ws, "error", undefined, `Unknown message type: ${type}`, requestId);
  }
}
