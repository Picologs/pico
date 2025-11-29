/**
 * Core Type Zod Schemas
 *
 * Runtime validation schemas for core domain types used in WebSocket messages.
 * These schemas mirror the TypeScript interfaces in /core/*.ts files.
 *
 * @module types/websocket/contracts/core-schemas
 */

import { z } from "zod";

// ============================================================================
// Pagination Schema
// ============================================================================

/**
 * Pagination metadata schema
 */
export const PaginationMetadataSchema = z.object({
  page: z.number().int().min(1),
  perPage: z.number().int().min(1),
  total: z.number().int().min(0),
  totalPages: z.number().int().min(0),
  hasMore: z.boolean(),
});

// ============================================================================
// User/Profile Schemas
// ============================================================================

/**
 * User profile schema
 */
export const UserProfileSchema = z.object({
  id: z.string().uuid(),
  discordId: z.string(),
  username: z.string(),
  avatar: z.string().nullable(),
  player: z.string().nullable(),
  timeZone: z.string().nullable(),
  usePlayerAsDisplayName: z.boolean(),
  showTimezone: z.boolean().optional(),
  friendCode: z.string().nullable(),
  role: z.enum(["user", "admin"]),
  createdAt: z.string(),
  updatedAt: z.string(),
  displayName: z.string().optional(),
});

/**
 * Profile update data schema
 */
export const ProfileUpdateDataSchema = z.object({
  player: z.string().nullable().optional(),
  timeZone: z.string().nullable().optional(),
  usePlayerAsDisplayName: z.boolean().optional(),
  showTimezone: z.boolean().optional(),
});

// ============================================================================
// Friend Schemas
// ============================================================================

/**
 * Friend relationship schema
 */
export const FriendSchema = z.object({
  id: z.string().uuid(),
  status: z.string(),
  createdAt: z.string(),
  friendUserId: z.string().uuid(),
  friendDiscordId: z.string(),
  friendUsername: z.string(),
  friendDisplayName: z.string(),
  friendAvatar: z.string().nullable(),
  friendPlayer: z.string().nullable(),
  friendTimeZone: z.string().nullable(),
  friendUsePlayerAsDisplayName: z.boolean(),
  friendCode: z.string().nullable().optional(),
  isOnline: z.boolean().optional(),
  isConnected: z.boolean().optional(),
});

/**
 * Friend request schema
 */
export const FriendRequestSchema = z.object({
  id: z.string().uuid(),
  status: z.string(),
  createdAt: z.string(),
  fromUserId: z.string().uuid(),
  fromDiscordId: z.string(),
  fromUsername: z.string(),
  fromDisplayName: z.string(),
  fromAvatar: z.string().nullable(),
  fromPlayer: z.string().nullable(),
  fromTimeZone: z.string().nullable(),
  fromUsePlayerAsDisplayName: z.boolean(),
  direction: z.enum(["incoming", "outgoing"]),
});

/**
 * Friend requests response schema
 */
export const FriendRequestsResponseSchema = z.object({
  incoming: z.array(FriendRequestSchema),
  outgoing: z.array(FriendRequestSchema),
});

// ============================================================================
// Group Schemas
// ============================================================================

/**
 * Group role enum schema
 */
export const GroupRoleSchema = z.enum(["owner", "admin", "member"]);

/**
 * Group visibility schema
 */
export const GroupVisibilitySchema = z.enum(["private", "discoverable"]);

/**
 * Group join method schema
 */
export const GroupJoinMethodSchema = z.enum(["open", "request"]);

/**
 * Group schema
 */
export const GroupSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().optional(),
  avatar: z.string().nullable(),
  memberCount: z.number().int().min(0),
  memberRole: GroupRoleSchema,
  tags: z.array(z.string()),
  ownerId: z.string().uuid().optional(),
  visibility: GroupVisibilitySchema,
  joinMethod: GroupJoinMethodSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  pendingJoinRequestCount: z.number().int().min(0).optional(),
});

/**
 * Group member schema
 */
export const GroupMemberSchema = z.object({
  id: z.string().uuid().optional(),
  groupId: z.string().uuid(),
  userId: z.string().uuid(),
  discordId: z.string(),
  username: z.string(),
  displayName: z.string(),
  player: z.string().nullable(),
  avatar: z.string().nullable(),
  timeZone: z.string().nullable(),
  role: GroupRoleSchema,
  usePlayerAsDisplayName: z.boolean().optional(),
  joinedAt: z.string(),
  canInvite: z.boolean(),
  canRemoveMembers: z.boolean(),
  canEditGroup: z.boolean(),
  isOnline: z.boolean().optional(),
  isConnected: z.boolean().optional(),
});

/**
 * Group invitation schema
 */
export const GroupInvitationSchema = z.object({
  id: z.string().uuid(),
  groupId: z.string().uuid(),
  group: z.object({
    id: z.string().uuid(),
    name: z.string(),
    description: z.string().optional(),
    avatar: z.string().nullable(),
    tags: z.array(z.string()).optional(),
  }),
  inviterId: z.string().uuid(),
  inviterUsername: z.string(),
  inviterDisplayName: z.string().optional(),
  inviterAvatar: z.string().nullable().optional(),
  inviterPlayer: z.string().nullable().optional(),
  createdAt: z.string(),
  status: z.string().optional(),
  respondedAt: z.string().optional(),
});

/**
 * Discoverable group schema (public group info)
 */
export const DiscoverableGroupSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().optional(),
  avatar: z.string().nullable(),
  tags: z.array(z.string()),
  memberCount: z.number().int().min(0),
  joinMethod: GroupJoinMethodSchema,
  createdAt: z.string(),
  ownerUsername: z.string().optional(),
  ownerAvatar: z.string().nullable().optional(),
  isJoined: z.boolean().optional(),
  hasPendingRequest: z.boolean().optional(),
});

/**
 * Group join request status schema
 */
export const GroupJoinRequestStatusSchema = z.enum([
  "pending",
  "approved",
  "denied",
]);

/**
 * Group join request schema
 */
export const GroupJoinRequestSchema = z.object({
  id: z.string().uuid(),
  groupId: z.string().uuid(),
  groupName: z.string(),
  groupAvatar: z.string().nullable(),
  userId: z.string().uuid(),
  username: z.string(),
  displayName: z.string(),
  avatar: z.string().nullable(),
  message: z.string().optional(),
  status: GroupJoinRequestStatusSchema,
  createdAt: z.string(),
});

// ============================================================================
// Log Schemas
// ============================================================================

/**
 * Log event type enum schema
 */
export const LogEventTypeSchema = z.enum([
  "connection",
  "vehicle_control_flow",
  "actor_death",
  "location_change",
  "destruction",
  "system_quit",
  "hospital_respawn",
  "mission_shared",
  "mission_completed",
  "mission_ended",
  "mission_objective",
  "hangar_door",
  "docking_tube",
  "landing_pad",
  "medical_bed",
  "purchase",
  "insurance_claim",
  "quantum_travel",
  "quantum_arrival",
  "equipment_received",
  "equipment_equip",
  "environmental_hazard",
  "fatal_collision",
  "item_placement",
  "bounty_marker",
  "bounty_kill",
  "killing_spree",
  "corpsify",
  "equipment_group",
  "insurance_group",
  "vehicle_control_group",
  "vehicle_error_group",
  "vehicle_exit_group",
  "mission_group",
  "mission_objective_group",
  "environmental_hazard_group",
  "inventory_group",
  "quantum_travel_group",
  "respawn_group",
  "crash_death_group",
  "cross_player_group",
  "bounty_kill_group",
]);

/**
 * Log metadata schema
 * Uses passthrough() for additional custom metadata fields
 */
export const LogMetadataSchema = z
  .object({
    // Vehicle/Ship metadata
    vehicleName: z.string().optional(),
    vehicleId: z.string().optional(),
    team: z.string().optional(),
    entityType: z.string().optional(),
    action: z
      .enum([
        "requesting",
        "granted",
        "releasing",
        "unknown",
        "placing",
        "placed",
      ])
      .optional(),

    // Combat metadata
    victimName: z.string().optional(),
    victimId: z.string().optional(),
    killerName: z.string().optional(),
    killerId: z.string().optional(),
    weaponInstance: z.string().optional(),
    weaponClass: z.string().optional(),
    damageType: z.string().optional(),
    deathCause: z.string().optional(),

    // Location metadata
    zone: z.string().optional(),
    location: z.string().optional(),
    spawnpoint: z.string().optional(),

    // Direction
    direction: z
      .object({
        x: z.string(),
        y: z.string(),
        z: z.string(),
      })
      .optional(),

    // Destruction metadata
    destroyLevel: z.string().optional(),
    destroyLevelFrom: z.string().optional(),
    destroyLevelTo: z.string().optional(),
    causeName: z.string().optional(),
    causeId: z.string().optional(),

    // Player metadata
    player: z.string().optional(),
    playerId: z.string().optional(),
    reason: z.string().optional(),

    // Equipment/Item metadata
    itemName: z.string().optional(),
    itemId: z.string().optional(),
    itemClass: z.string().optional(),
    attachmentName: z.string().optional(),
    attachmentStatus: z.string().optional(),
    attachmentPort: z.string().optional(),
    port: z.string().optional(),
    postAction: z.string().optional(),

    // Collision metadata
    hitEntity: z.string().optional(),
    hitEntityPlayer: z.string().optional(),
    hitEntityShip: z.string().optional(),
    part: z.string().optional(),
    crashPart: z.string().optional(),

    // Mission metadata
    missionId: z.string().optional(),
    completionType: z.string().optional(),

    // Bounty metadata
    objectiveId: z.string().optional(),
    generatorName: z.string().optional(),
    contract: z.string().optional(),
    targetType: z.string().optional(),
    isAIKill: z.boolean().optional(),
  })
  .passthrough();

/**
 * Ship group schema (forward declaration for Log recursion)
 */
export const ShipGroupSchema: z.ZodType<{
  vehicleId: string;
  vehicleName: string;
  team: string;
  location: string;
  events: z.infer<typeof LogSchema>[];
}> = z.lazy(() =>
  z.object({
    vehicleId: z.string(),
    vehicleName: z.string(),
    team: z.string(),
    location: z.string(),
    events: z.array(LogSchema),
  }),
);

/**
 * Log entry schema (recursive for children)
 */
export const LogSchema: z.ZodType<{
  id: string;
  userId: string;
  player?: string | null;
  emoji: string;
  line: string;
  timestamp: string;
  original: string;
  open: boolean;
  reportedBy?: string[];
  eventType?: z.infer<typeof LogEventTypeSchema>;
  metadata?: z.infer<typeof LogMetadataSchema>;
  ship?: z.infer<typeof ShipGroupSchema>;
  children?: z.infer<typeof LogSchema>[];
}> = z.lazy(() =>
  z.object({
    id: z.string(),
    userId: z.string(),
    player: z.string().nullable(),
    emoji: z.string(),
    line: z.string(),
    timestamp: z.string(),
    original: z.string(),
    open: z.boolean(),
    reportedBy: z.array(z.string()).optional(),
    eventType: LogEventTypeSchema.optional(),
    metadata: LogMetadataSchema.optional(),
    ship: ShipGroupSchema.optional(),
    children: z.array(LogSchema).optional(),
  }),
);

/**
 * LogTransmit schema (optimized for network transmission)
 * Excludes 'original' and 'open' fields
 */
export const LogTransmitSchema: z.ZodType<{
  id: string;
  userId: string;
  player?: string | null;
  emoji: string;
  line: string;
  timestamp: string;
  reportedBy?: string[];
  eventType?: z.infer<typeof LogEventTypeSchema>;
  metadata?: z.infer<typeof LogMetadataSchema>;
  ship?: z.infer<typeof ShipGroupSchema>;
  children?: z.infer<typeof LogTransmitSchema>[];
}> = z.lazy(() =>
  z.object({
    id: z.string(),
    userId: z.string(),
    player: z.string().nullable(),
    emoji: z.string(),
    line: z.string(),
    timestamp: z.string(),
    reportedBy: z.array(z.string()).optional(),
    eventType: LogEventTypeSchema.optional(),
    metadata: LogMetadataSchema.optional(),
    ship: ShipGroupSchema.optional(),
    children: z.array(LogTransmitSchema).optional(),
  }),
);

// ============================================================================
// Type Exports (inferred from schemas)
// ============================================================================

export type PaginationMetadataSchemaType = z.infer<
  typeof PaginationMetadataSchema
>;
export type UserProfileSchemaType = z.infer<typeof UserProfileSchema>;
export type FriendSchemaType = z.infer<typeof FriendSchema>;
export type FriendRequestSchemaType = z.infer<typeof FriendRequestSchema>;
export type GroupSchemaType = z.infer<typeof GroupSchema>;
export type GroupMemberSchemaType = z.infer<typeof GroupMemberSchema>;
export type GroupInvitationSchemaType = z.infer<typeof GroupInvitationSchema>;
export type DiscoverableGroupSchemaType = z.infer<
  typeof DiscoverableGroupSchema
>;
export type GroupJoinRequestSchemaType = z.infer<typeof GroupJoinRequestSchema>;
export type LogSchemaType = z.infer<typeof LogSchema>;
export type LogTransmitSchemaType = z.infer<typeof LogTransmitSchema>;
