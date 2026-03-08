import { test } from "@fast-check/vitest";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect } from "vitest";
import { db } from "../../src/db/index.js";
import { players as playersTable, rooms, users } from "../../src/db/schema.js";
import * as ChatService from "../../src/services/ChatService.js";
import { chatMessageArb, regionArb } from "../generators/chat.generator.js";
import { roomIdArb } from "../generators/room.generator.js";

const testUserId = "test-user-chat-prop";

/**
 * Clean up only the test-specific data created by this test file.
 * Does not delete seeded data to avoid foreign key issues.
 */
async function cleanupTestData() {
  // Only delete players created by this test (they have our specific userId)
  await db.delete(playersTable).where(eq(playersTable.userId, testUserId));
  // Delete our test user
  await db.delete(users).where(eq(users.id, testUserId));
}

beforeAll(async () => {
  await cleanupTestData();

  await db.insert(users).values({
    id: testUserId,
    username: "chatproptestuser",
    passwordHash: "hashedpassword",
    createdAt: new Date(),
  });
});

afterAll(async () => {
  await cleanupTestData();
});

describe("ChatService Property Tests", () => {
  /**
   * **Validates: Requirements 4.1, 4.2, 4.3**
   *
   * Property 12: Chat Message Routing
   * For any chat message: speak messages SHALL target only the sender's current room,
   * shout messages SHALL target all rooms in the sender's region, and whisper messages
   * SHALL target only the specified recipient player.
   */
  describe("Property 12: Chat Message Routing", () => {
    test.prop([chatMessageArb, regionArb, roomIdArb], { numRuns: 20 })(
      "speak messages target only the sender's current room",
      async (message, region, roomId) => {
        const playerId = `prop-player-speak-${Date.now()}-${Math.random()}`;

        await db.insert(rooms).values({
          id: roomId,
          name: "Test Room",
          description: "A test room",
          region,
          exits: {},
        });

        await db.insert(playersTable).values({
          id: playerId,
          userId: testUserId,
          name: `Speaker${Date.now()}`,
          currentRoomId: roomId,
          isOnline: true,
          createdAt: new Date(),
        });

        try {
          const result = await ChatService.speak(playerId, message);

          expect(result.success).toBe(true);
          expect(result.scope).toBeDefined();
          expect(result.scope!.type).toBe("room");
          expect(
            (result.scope as { type: "room"; roomId: string }).roomId,
          ).toBe(roomId);
          expect(result.message!.type).toBe("speech");
        } finally {
          await db.delete(playersTable).where(eq(playersTable.id, playerId));
          await db.delete(rooms).where(eq(rooms.id, roomId));
        }
      },
    );

    test.prop([chatMessageArb, regionArb, roomIdArb], { numRuns: 20 })(
      "shout messages target the sender's region",
      async (message, region, roomId) => {
        const playerId = `prop-player-shout-${Date.now()}-${Math.random()}`;

        await db.insert(rooms).values({
          id: roomId,
          name: "Test Room",
          description: "A test room",
          region,
          exits: {},
        });

        await db.insert(playersTable).values({
          id: playerId,
          userId: testUserId,
          name: `Shouter${Date.now()}`,
          currentRoomId: roomId,
          isOnline: true,
          createdAt: new Date(),
        });

        try {
          const result = await ChatService.shout(playerId, message);

          expect(result.success).toBe(true);
          expect(result.scope).toBeDefined();
          expect(result.scope!.type).toBe("region");
          expect(
            (result.scope as { type: "region"; region: string }).region,
          ).toBe(region);
          expect(result.message!.type).toBe("speech");
          expect(result.message!.content).toBe(message.trim().toUpperCase());
        } finally {
          await db.delete(playersTable).where(eq(playersTable.id, playerId));
          await db.delete(rooms).where(eq(rooms.id, roomId));
        }
      },
    );

    test.prop([chatMessageArb, regionArb, roomIdArb], { numRuns: 20 })(
      "whisper messages target only the specified recipient",
      async (message, region, roomId) => {
        const senderId = `prop-sender-${Date.now()}-${Math.random()}`;
        const recipientId = `prop-recipient-${Date.now()}-${Math.random()}`;
        const senderName = `Sender${Date.now()}`;
        const recipientName = `Recipient${Date.now()}`;

        await db.insert(rooms).values({
          id: roomId,
          name: "Test Room",
          description: "A test room",
          region,
          exits: {},
        });

        await db.insert(playersTable).values([
          {
            id: senderId,
            userId: testUserId,
            name: senderName,
            currentRoomId: roomId,
            isOnline: true,
            createdAt: new Date(),
          },
          {
            id: recipientId,
            userId: testUserId,
            name: recipientName,
            currentRoomId: roomId,
            isOnline: true,
            createdAt: new Date(),
          },
        ]);

        try {
          const result = await ChatService.whisper(
            senderId,
            recipientName,
            message,
          );

          expect(result.success).toBe(true);
          expect(result.scope).toBeDefined();
          expect(result.scope!.type).toBe("player");
          expect(
            (result.scope as { type: "player"; playerId: string }).playerId,
          ).toBe(recipientId);
          expect(result.message!.type).toBe("whisper");
          expect(result.message!.sender).toBe(senderName);
        } finally {
          await db.delete(playersTable).where(eq(playersTable.id, senderId));
          await db.delete(playersTable).where(eq(playersTable.id, recipientId));
          await db.delete(rooms).where(eq(rooms.id, roomId));
        }
      },
    );

    test.prop([chatMessageArb, regionArb, roomIdArb], { numRuns: 20 })(
      "emote messages target only the sender's current room",
      async (action, region, roomId) => {
        const playerId = `prop-player-emote-${Date.now()}-${Math.random()}`;

        await db.insert(rooms).values({
          id: roomId,
          name: "Test Room",
          description: "A test room",
          region,
          exits: {},
        });

        await db.insert(playersTable).values({
          id: playerId,
          userId: testUserId,
          name: `Emoter${Date.now()}`,
          currentRoomId: roomId,
          isOnline: true,
          createdAt: new Date(),
        });

        try {
          const result = await ChatService.emote(playerId, action);

          expect(result.success).toBe(true);
          expect(result.scope).toBeDefined();
          expect(result.scope!.type).toBe("room");
          expect(
            (result.scope as { type: "room"; roomId: string }).roomId,
          ).toBe(roomId);
          expect(result.message!.type).toBe("emote");
        } finally {
          await db.delete(playersTable).where(eq(playersTable.id, playerId));
          await db.delete(rooms).where(eq(rooms.id, roomId));
        }
      },
    );
  });
});
