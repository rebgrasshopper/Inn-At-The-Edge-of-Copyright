import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/db/index.js";
import {
  containerInventory,
  containers,
  features,
  items,
  monsterInstances,
  monsterSpawns,
  monsters,
  npcs,
  playerInventory,
  players as playersTable,
  roomInventory,
  rooms,
  users,
} from "../../src/db/schema.js";
import * as ChatService from "../../src/services/ChatService.js";

const testUserId = "test-user-chat";
const testPlayer1Id = "test-player-chat-1";
const testPlayer2Id = "test-player-chat-2";
const testRoom1Id = "test-room-chat-1";
const testRoom2Id = "test-room-chat-2";

async function cleanupTestData() {
  await db.delete(containerInventory);
  await db.delete(monsterInstances);
  await db.delete(monsterSpawns);
  await db.delete(roomInventory);
  await db.delete(playerInventory);
  await db.delete(features);
  await db.delete(containers);
  await db.delete(npcs);
  await db.delete(playersTable);
  await db.delete(monsters);
  await db.delete(items);
  await db.delete(rooms);
  await db.delete(users);
}

beforeAll(async () => {
  await cleanupTestData();

  // Create test user
  await db.insert(users).values({
    id: testUserId,
    username: "chattestuser",
    passwordHash: "hashedpassword",
    createdAt: new Date(),
  });

  // Create test rooms in same region
  await db.insert(rooms).values([
    {
      id: testRoom1Id,
      name: "Chat Room 1",
      description: "A test room for chat",
      region: "chatregion",
      exits: { east: { roomId: testRoom2Id } },
    },
    {
      id: testRoom2Id,
      name: "Chat Room 2",
      description: "Another test room",
      region: "chatregion",
      exits: { west: { roomId: testRoom1Id } },
    },
  ]);
});

afterAll(async () => {
  await cleanupTestData();
});

describe("ChatService", () => {
  beforeEach(async () => {
    await db.delete(playerInventory);
    await db.delete(playersTable);

    // Create two test players in room 1
    await db.insert(playersTable).values([
      {
        id: testPlayer1Id,
        userId: testUserId,
        name: "ChatPlayer1",
        currentRoomId: testRoom1Id,
        isOnline: true,
        createdAt: new Date(),
      },
      {
        id: testPlayer2Id,
        userId: testUserId,
        name: "ChatPlayer2",
        currentRoomId: testRoom1Id,
        isOnline: true,
        createdAt: new Date(),
      },
    ]);
  });

  describe("speak", () => {
    it("should create a chat message with room scope", async () => {
      const result = await ChatService.speak(testPlayer1Id, "Hello everyone!");

      expect(result.success).toBe(true);
      expect(result.message).toBeDefined();
      expect(result.message!.type).toBe("chat");
      expect(result.message!.content).toBe("Hello everyone!");
      expect(result.message!.sender).toBe("ChatPlayer1");
      expect(result.scope).toEqual({ type: "room", roomId: testRoom1Id });
    });

    it("should fail for non-existent player", async () => {
      const result = await ChatService.speak("non-existent", "Hello!");

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("should fail for empty message", async () => {
      const result = await ChatService.speak(testPlayer1Id, "   ");

      expect(result.success).toBe(false);
      expect(result.error).toContain("empty");
    });

    it("should trim message content", async () => {
      const result = await ChatService.speak(testPlayer1Id, "  Hello!  ");

      expect(result.success).toBe(true);
      expect(result.message!.content).toBe("Hello!");
    });
  });

  describe("shout", () => {
    it("should create a chat message with region scope", async () => {
      const result = await ChatService.shout(testPlayer1Id, "Help!");

      expect(result.success).toBe(true);
      expect(result.message).toBeDefined();
      expect(result.message!.type).toBe("chat");
      expect(result.message!.content).toBe("HELP!"); // Uppercase for shouting
      expect(result.message!.sender).toBe("ChatPlayer1");
      expect(result.scope).toEqual({ type: "region", region: "chatregion" });
    });

    it("should fail for non-existent player", async () => {
      const result = await ChatService.shout("non-existent", "Help!");

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("should fail for empty message", async () => {
      const result = await ChatService.shout(testPlayer1Id, "");

      expect(result.success).toBe(false);
      expect(result.error).toContain("empty");
    });
  });

  describe("whisper", () => {
    it("should create a whisper message with player scope", async () => {
      const result = await ChatService.whisper(
        testPlayer1Id,
        "ChatPlayer2",
        "Psst, secret!",
      );

      expect(result.success).toBe(true);
      expect(result.message).toBeDefined();
      expect(result.message!.type).toBe("whisper");
      expect(result.message!.content).toBe("Psst, secret!");
      expect(result.message!.sender).toBe("ChatPlayer1");
      expect(result.scope).toEqual({ type: "player", playerId: testPlayer2Id });
    });

    it("should match player by prefix", async () => {
      const result = await ChatService.whisper(testPlayer1Id, "Chat", "Hello!");

      // Should match ChatPlayer2 (not self)
      expect(result.success).toBe(true);
      expect(result.scope).toEqual({ type: "player", playerId: testPlayer2Id });
    });

    it("should fail for non-existent target", async () => {
      const result = await ChatService.whisper(
        testPlayer1Id,
        "Nobody",
        "Hello!",
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("no one named");
    });

    it("should allow whispering to self with room notice", async () => {
      const result = await ChatService.whisper(
        testPlayer1Id,
        "ChatPlayer1",
        "Hello me!",
      );

      expect(result.success).toBe(true);
      expect(result.message).toBeDefined();
      expect(result.message!.type).toBe("whisper");
      expect(result.scope).toEqual({ type: "player", playerId: testPlayer1Id });

      // Room should be notified
      expect(result.roomNotice).toBeDefined();
      expect(result.roomNotice!.type).toBe("emote");
      expect(result.roomNotice!.content).toContain("whispering to themself");
      expect(result.roomNotice!.sender).toBe("ChatPlayer1");
    });

    it("should fail for empty message", async () => {
      const result = await ChatService.whisper(
        testPlayer1Id,
        "ChatPlayer2",
        "",
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("empty");
    });

    it("should fail for empty target", async () => {
      const result = await ChatService.whisper(testPlayer1Id, "", "Hello!");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Who");
    });

    it("should not find player in different room", async () => {
      // Move player 2 to room 2
      await db
        .update(playersTable)
        .set({ currentRoomId: testRoom2Id })
        .where(eq(playersTable.id, testPlayer2Id));

      const result = await ChatService.whisper(
        testPlayer1Id,
        "ChatPlayer2",
        "Hello!",
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("no one named");
    });
  });

  describe("emote", () => {
    it("should create an emote message with room scope", async () => {
      const result = await ChatService.emote(
        testPlayer1Id,
        "waves enthusiastically",
      );

      expect(result.success).toBe(true);
      expect(result.message).toBeDefined();
      expect(result.message!.type).toBe("emote");
      expect(result.message!.content).toBe("waves enthusiastically");
      expect(result.message!.sender).toBe("ChatPlayer1");
      expect(result.scope).toEqual({ type: "room", roomId: testRoom1Id });
    });

    it("should fail for non-existent player", async () => {
      const result = await ChatService.emote("non-existent", "waves");

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("should fail for empty action", async () => {
      const result = await ChatService.emote(testPlayer1Id, "   ");

      expect(result.success).toBe(false);
      expect(result.error).toContain("What do you want");
    });
  });
});
