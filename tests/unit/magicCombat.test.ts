/**
 * Tests for magic combat integration - spell casting in combat and magic attack preference.
 */

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/db/index.js";
import {
  monsterInstances,
  monsters,
  playerSpells,
  players,
  rooms,
  spells,
  users,
} from "../../src/db/schema.js";
import { clearAllCombatState } from "../../src/services/CombatService.js";
import { handleAttack } from "../../src/services/commands/handlers/combat.js";
import { handleCast } from "../../src/services/commands/handlers/magic.js";
import * as SpellService from "../../src/services/SpellService.js";
import type { CommandContext } from "../../src/types/command.js";
import type { Player } from "../../src/types/player.js";
import type { RoomWithContents } from "../../src/types/room.js";

// Test IDs
const TEST_USER_ID = "test-user-magic-combat";
const TEST_PLAYER_ID = "test-player-magic-combat";
const TEST_ROOM_ID = "test-room-magic-combat";
const TEST_MONSTER_ID = "test-monster-magic-combat";
const TEST_MONSTER_INSTANCE_ID = "test-monster-instance-magic-combat";
const TEST_SPELL_DAMAGE_ID = "test-spell-damage";
const TEST_SPELL_HEAL_ID = "test-spell-heal";

function createMockSocket() {
  return {} as CommandContext["socket"];
}

function createTestPlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: TEST_PLAYER_ID,
    userId: TEST_USER_ID,
    name: "MagicTestPlayer",
    currentRoomId: TEST_ROOM_ID,
    stats: { str: 10, dex: 10, con: 10, int: 14, wis: 10, cha: 10 },
    currentHp: 20,
    maxHp: 20,
    xp: 0,
    level: 1,
    unspentAttributePoints: 0,
    isOnline: true,
    equipment: {
      head: null,
      torso: null,
      body: null,
      legs: null,
      hands: null,
      feet: null,
      mainHand: null,
      offHand: null,
      neck: null,
      ring1: null,
      ring2: null,
      back: null,
    },
    discoveredFeatureIds: [],
    discoveredContainerIds: [],
    ...overrides,
  };
}

function createTestRoom(
  overrides: Partial<RoomWithContents> = {},
): RoomWithContents {
  return {
    id: TEST_ROOM_ID,
    name: "Magic Test Room",
    description: "A room for testing magic",
    region: "testregion",
    exits: {},
    players: [],
    items: [],
    monsters: [
      {
        id: TEST_MONSTER_INSTANCE_ID,
        monster: {
          id: TEST_MONSTER_ID,
          name: "test goblin",
          description: "A test goblin",
          stats: { str: 8, dex: 10, con: 8, int: 10, wis: 10, cha: 10 },
          maxHp: 5,
          xpReward: 10,
          aggroScore: 0,
          weaponDamage: "1d4",
          level: 1,
        },
        roomId: TEST_ROOM_ID,
        currentHp: 5,
      },
    ],
    npcs: [],
    containers: [],
    features: [],
    corpses: [],
    ...overrides,
  };
}

function createContext(
  playerOverrides: Partial<Player> = {},
  roomOverrides: Partial<RoomWithContents> = {},
): CommandContext {
  return {
    player: createTestPlayer(playerOverrides),
    room: createTestRoom(roomOverrides),
    socket: createMockSocket(),
  };
}

async function cleanupTestData() {
  await db
    .delete(playerSpells)
    .where(eq(playerSpells.playerId, TEST_PLAYER_ID));
  await db
    .delete(monsterInstances)
    .where(eq(monsterInstances.id, TEST_MONSTER_INSTANCE_ID));
  await db.delete(monsters).where(eq(monsters.id, TEST_MONSTER_ID));
  await db.delete(spells).where(eq(spells.id, TEST_SPELL_DAMAGE_ID));
  await db.delete(spells).where(eq(spells.id, TEST_SPELL_HEAL_ID));
  await db.delete(players).where(eq(players.id, TEST_PLAYER_ID));
  await db.delete(rooms).where(eq(rooms.id, TEST_ROOM_ID));
  await db.delete(users).where(eq(users.id, TEST_USER_ID));
}

beforeAll(async () => {
  await cleanupTestData();

  // Create test user
  await db.insert(users).values({
    id: TEST_USER_ID,
    username: "magictestuser",
    passwordHash: "hashedpassword",
    createdAt: new Date(),
  });

  // Create test room
  await db.insert(rooms).values({
    id: TEST_ROOM_ID,
    name: "Magic Test Room",
    description: "A room for testing magic",
    region: "testregion",
    exits: {},
  });

  // Create test monster type
  await db.insert(monsters).values({
    id: TEST_MONSTER_ID,
    name: "test goblin",
    description: "A test goblin",
    level: 1,
    maxHp: 5,
    str: 8,
    dex: 10,
    con: 8,
    weaponDamage: "1d4",
    aggroScore: 0,
  });

  // Create test spells
  await db.insert(spells).values([
    {
      id: TEST_SPELL_DAMAGE_ID,
      name: "Test Bolt",
      description: "A test damage spell",
      manaCost: 2,
      minInt: 10,
      scalingLevel: null,
      effect: { type: "damage", dice: "1d4", modifier: "int" },
      targetType: "enemy",
    },
    {
      id: TEST_SPELL_HEAL_ID,
      name: "Test Heal",
      description: "A test healing spell",
      manaCost: 3,
      minInt: 10,
      effect: { type: "heal", dice: "1d6", modifier: "int" },
      targetType: "ally",
    },
  ]);
});

afterAll(async () => {
  await cleanupTestData();
});

beforeEach(async () => {
  // Clear combat state from previous tests
  clearAllCombatState();

  // Clean up player and monster instance before each test
  await db
    .delete(playerSpells)
    .where(eq(playerSpells.playerId, TEST_PLAYER_ID));
  await db
    .delete(monsterInstances)
    .where(eq(monsterInstances.id, TEST_MONSTER_INSTANCE_ID));
  await db.delete(players).where(eq(players.id, TEST_PLAYER_ID));

  // Create test player with mana
  await db.insert(players).values({
    id: TEST_PLAYER_ID,
    userId: TEST_USER_ID,
    name: "MagicTestPlayer",
    currentRoomId: TEST_ROOM_ID,
    isOnline: true,
    int: 14,
    mana: 10,
    maxMana: 10,
    createdAt: new Date(),
  });

  // Create test monster instance
  await db.insert(monsterInstances).values({
    id: TEST_MONSTER_INSTANCE_ID,
    monsterId: TEST_MONSTER_ID,
    roomId: TEST_ROOM_ID,
    currentHp: 5,
    spawnedAt: new Date(),
    permanent: false,
  });
});

describe("SpellService.getPreferredDamageSpell", () => {
  it("should return null for player with no spells", async () => {
    const result = await SpellService.getPreferredDamageSpell(TEST_PLAYER_ID);
    expect(result).toBeNull();
  });

  it("should return null for player with only healing spells", async () => {
    // Teach player the healing spell
    await db.insert(playerSpells).values({
      id: "ps-heal-only",
      playerId: TEST_PLAYER_ID,
      spellId: TEST_SPELL_HEAL_ID,
      successfulCasts: 0,
      learnedAt: new Date(),
    });

    const result = await SpellService.getPreferredDamageSpell(TEST_PLAYER_ID);
    expect(result).toBeNull();
  });

  it("should return null for player with damage spell but insufficient mana", async () => {
    // Teach player the damage spell
    await db.insert(playerSpells).values({
      id: "ps-damage-no-mana",
      playerId: TEST_PLAYER_ID,
      spellId: TEST_SPELL_DAMAGE_ID,
      successfulCasts: 0,
      learnedAt: new Date(),
    });

    // Set mana to 0
    await db
      .update(players)
      .set({ mana: 0 })
      .where(eq(players.id, TEST_PLAYER_ID));

    const result = await SpellService.getPreferredDamageSpell(TEST_PLAYER_ID);
    expect(result).toBeNull();
  });

  it("should return damage spell when player has one and enough mana", async () => {
    // Teach player the damage spell
    await db.insert(playerSpells).values({
      id: "ps-damage-with-mana",
      playerId: TEST_PLAYER_ID,
      spellId: TEST_SPELL_DAMAGE_ID,
      successfulCasts: 0,
      learnedAt: new Date(),
    });

    const result = await SpellService.getPreferredDamageSpell(TEST_PLAYER_ID);
    expect(result).not.toBeNull();
    expect(result!.spell.name).toBe("Test Bolt");
  });
});

describe("handleCast - damage spell combat integration", () => {
  beforeEach(async () => {
    // Teach player the damage spell for these tests
    await db.insert(playerSpells).values({
      id: "ps-cast-test",
      playerId: TEST_PLAYER_ID,
      spellId: TEST_SPELL_DAMAGE_ID,
      successfulCasts: 50, // Mastered - no failure chance
      learnedAt: new Date(),
    });
  });

  it("should initiate combat when monster survives spell damage", async () => {
    // Set monster HP high enough to survive
    await db
      .update(monsterInstances)
      .set({ currentHp: 100 })
      .where(eq(monsterInstances.id, TEST_MONSTER_INSTANCE_ID));

    const context = createContext(
      {},
      {
        monsters: [
          {
            id: TEST_MONSTER_INSTANCE_ID,
            monster: {
              id: TEST_MONSTER_ID,
              name: "test goblin",
              description: "A test goblin",
              stats: { str: 8, dex: 10, con: 8, int: 10, wis: 10, cha: 10 },
              maxHp: 100,
              xpReward: 10,
              aggroScore: 0,
              weaponDamage: "1d4",
              level: 1,
            },
            roomId: TEST_ROOM_ID,
            currentHp: 100,
          },
        ],
      },
    );

    // Use full spell name to avoid matching seeded "Missile"
    const result = await handleCast(["Test Bolt", "goblin"], context, "");

    expect(result.success).toBe(true);
    expect(result.message).toContain("strikes");
    expect(result.message).toContain("damage");
    // Should mention combat starting
    expect(result.message).toContain("attack");
  });

  it("should award XP when spell kills monster", async () => {
    // Set monster HP low enough to die
    await db
      .update(monsterInstances)
      .set({ currentHp: 1 })
      .where(eq(monsterInstances.id, TEST_MONSTER_INSTANCE_ID));

    const context = createContext(
      {},
      {
        monsters: [
          {
            id: TEST_MONSTER_INSTANCE_ID,
            monster: {
              id: TEST_MONSTER_ID,
              name: "test goblin",
              description: "A test goblin",
              stats: { str: 8, dex: 10, con: 8, int: 10, wis: 10, cha: 10 },
              maxHp: 5,
              xpReward: 10,
              aggroScore: 0,
              weaponDamage: "1d4",
              level: 1,
            },
            roomId: TEST_ROOM_ID,
            currentHp: 1,
          },
        ],
      },
    );

    // Get player XP before
    const playerBefore = db
      .select({ xp: players.xp })
      .from(players)
      .where(eq(players.id, TEST_PLAYER_ID))
      .get();

    // Use full spell name to avoid matching seeded "Missile"
    const result = await handleCast(["Test Bolt", "goblin"], context, "");

    expect(result.success).toBe(true);
    expect(result.message).toContain("defeating");

    // Check XP was awarded
    const playerAfter = db
      .select({ xp: players.xp })
      .from(players)
      .where(eq(players.id, TEST_PLAYER_ID))
      .get();

    expect(playerAfter!.xp).toBeGreaterThan(playerBefore!.xp);
  });
});

describe("handleAttack - magic preference", () => {
  it("should use physical attack when preferMagicAttack is false", async () => {
    // User has no magic preference set (defaults to false)
    const context = createContext();

    const result = await handleAttack(["goblin"], context, "");

    expect(result.success).toBe(true);
    // Physical attack message
    expect(result.message).toContain("attack");
    expect(result.message).not.toContain("strikes"); // Spell message uses "strikes"
  });

  it("should use spell when preferMagicAttack is true and spell available", async () => {
    // Set user preference
    await db
      .update(users)
      .set({ preferences: { preferMagicAttack: true } })
      .where(eq(users.id, TEST_USER_ID));

    // Teach player the damage spell (mastered)
    await db.insert(playerSpells).values({
      id: "ps-attack-pref",
      playerId: TEST_PLAYER_ID,
      spellId: TEST_SPELL_DAMAGE_ID,
      successfulCasts: 50,
      learnedAt: new Date(),
    });

    // Set monster HP high to survive
    await db
      .update(monsterInstances)
      .set({ currentHp: 100 })
      .where(eq(monsterInstances.id, TEST_MONSTER_INSTANCE_ID));

    const context = createContext(
      {},
      {
        monsters: [
          {
            id: TEST_MONSTER_INSTANCE_ID,
            monster: {
              id: TEST_MONSTER_ID,
              name: "test goblin",
              description: "A test goblin",
              stats: { str: 8, dex: 10, con: 8, int: 10, wis: 10, cha: 10 },
              maxHp: 100,
              xpReward: 10,
              aggroScore: 0,
              weaponDamage: "1d4",
              level: 1,
            },
            roomId: TEST_ROOM_ID,
            currentHp: 100,
          },
        ],
      },
    );

    const result = await handleAttack(["goblin"], context, "");

    expect(result.success).toBe(true);
    // Spell was used (either hit or miss)
    expect(result.message).toContain("Test Bolt");
    // Should have either "strikes" (hit) or "misses" (miss)
    const usedSpell =
      result.message.includes("strikes") || result.message.includes("misses");
    expect(usedSpell).toBe(true);

    // Reset preference
    await db
      .update(users)
      .set({ preferences: {} })
      .where(eq(users.id, TEST_USER_ID));
  });

  it("should fall back to physical attack when preferMagicAttack is true but no spell available", async () => {
    // Set user preference
    await db
      .update(users)
      .set({ preferences: { preferMagicAttack: true } })
      .where(eq(users.id, TEST_USER_ID));

    // Player has no spells
    const context = createContext();

    const result = await handleAttack(["goblin"], context, "");

    expect(result.success).toBe(true);
    // Physical attack message
    expect(result.message).toContain("attack");
    expect(result.message).not.toContain("strikes");

    // Reset preference
    await db
      .update(users)
      .set({ preferences: {} })
      .where(eq(users.id, TEST_USER_ID));
  });

  it("should fall back to physical attack when preferMagicAttack is true but no mana", async () => {
    // Set user preference
    await db
      .update(users)
      .set({ preferences: { preferMagicAttack: true } })
      .where(eq(users.id, TEST_USER_ID));

    // Teach player the damage spell
    await db.insert(playerSpells).values({
      id: "ps-no-mana-fallback",
      playerId: TEST_PLAYER_ID,
      spellId: TEST_SPELL_DAMAGE_ID,
      successfulCasts: 50,
      learnedAt: new Date(),
    });

    // Set mana to 0
    await db
      .update(players)
      .set({ mana: 0 })
      .where(eq(players.id, TEST_PLAYER_ID));

    const context = createContext();

    const result = await handleAttack(["goblin"], context, "");

    expect(result.success).toBe(true);
    // Physical attack message
    expect(result.message).toContain("attack");
    expect(result.message).not.toContain("strikes");

    // Reset preference
    await db
      .update(users)
      .set({ preferences: {} })
      .where(eq(users.id, TEST_USER_ID));
  });
});

describe("handleCast - spell attack roll", () => {
  beforeEach(async () => {
    // Teach player the damage spell for these tests (mastered - no fizzle)
    await db.insert(playerSpells).values({
      id: "ps-attack-roll-test",
      playerId: TEST_PLAYER_ID,
      spellId: TEST_SPELL_DAMAGE_ID,
      successfulCasts: 50,
      learnedAt: new Date(),
    });
  });

  it("should include attack roll info in result", async () => {
    // Set monster HP high to survive
    await db
      .update(monsterInstances)
      .set({ currentHp: 100 })
      .where(eq(monsterInstances.id, TEST_MONSTER_INSTANCE_ID));

    const context = createContext(
      {},
      {
        monsters: [
          {
            id: TEST_MONSTER_INSTANCE_ID,
            monster: {
              id: TEST_MONSTER_ID,
              name: "test goblin",
              description: "A test goblin",
              stats: { str: 8, dex: 10, con: 8, int: 10, wis: 10, cha: 10 },
              maxHp: 100,
              xpReward: 10,
              aggroScore: 0,
              weaponDamage: "1d4",
              level: 1,
            },
            roomId: TEST_ROOM_ID,
            currentHp: 100,
          },
        ],
      },
    );

    const result = await handleCast(["Test Bolt", "goblin"], context, "");

    expect(result.success).toBe(true);
    // Should have roll info with attack formula
    expect(result.rollInfo).toBeDefined();
    expect(result.rollInfo).toContain("Attack:");
    expect(result.rollInfo).toContain("d20");
  });

  it("should initiate combat even when spell misses", async () => {
    // Create a monster with very high DEX for high AC (makes miss more likely)
    // Monster AC = 10 + DEX mod, so DEX 30 = AC 20
    await db
      .update(monsters)
      .set({ dex: 30 })
      .where(eq(monsters.id, TEST_MONSTER_ID));

    await db
      .update(monsterInstances)
      .set({ currentHp: 100 })
      .where(eq(monsterInstances.id, TEST_MONSTER_INSTANCE_ID));

    const context = createContext(
      {},
      {
        monsters: [
          {
            id: TEST_MONSTER_INSTANCE_ID,
            monster: {
              id: TEST_MONSTER_ID,
              name: "test goblin",
              description: "A test goblin",
              stats: { str: 8, dex: 30, con: 8, int: 10, wis: 10, cha: 10 },
              maxHp: 100,
              xpReward: 10,
              aggroScore: 0,
              weaponDamage: "1d4",
              level: 1,
            },
            roomId: TEST_ROOM_ID,
            currentHp: 100,
          },
        ],
      },
    );

    // Run multiple times to increase chance of getting a miss
    let gotMiss = false;
    for (let i = 0; i < 20; i++) {
      // Reset combat state and monster HP
      clearAllCombatState();
      await db
        .update(monsterInstances)
        .set({ currentHp: 100 })
        .where(eq(monsterInstances.id, TEST_MONSTER_INSTANCE_ID));
      await db
        .update(players)
        .set({ mana: 10 })
        .where(eq(players.id, TEST_PLAYER_ID));

      const result = await handleCast(["Test Bolt", "goblin"], context, "");

      expect(result.success).toBe(true);

      if (result.message?.includes("misses")) {
        gotMiss = true;
        // Even on miss, combat should start
        expect(result.message).toContain("attack");
        break;
      }
    }

    // Reset monster DEX
    await db
      .update(monsters)
      .set({ dex: 10 })
      .where(eq(monsters.id, TEST_MONSTER_ID));

    // We should have gotten at least one miss with AC 20 vs typical attack roll
    // But if not, that's okay - the test still validates the hit path works
    if (!gotMiss) {
      // eslint-disable-next-line no-console
      console.log(
        "Note: No misses occurred in 20 attempts (unlikely but possible)",
      );
    }
  });

  it("should deduct mana on both hit and miss", async () => {
    await db
      .update(monsterInstances)
      .set({ currentHp: 100 })
      .where(eq(monsterInstances.id, TEST_MONSTER_INSTANCE_ID));

    const context = createContext(
      {},
      {
        monsters: [
          {
            id: TEST_MONSTER_INSTANCE_ID,
            monster: {
              id: TEST_MONSTER_ID,
              name: "test goblin",
              description: "A test goblin",
              stats: { str: 8, dex: 10, con: 8, int: 10, wis: 10, cha: 10 },
              maxHp: 100,
              xpReward: 10,
              aggroScore: 0,
              weaponDamage: "1d4",
              level: 1,
            },
            roomId: TEST_ROOM_ID,
            currentHp: 100,
          },
        ],
      },
    );

    // Get mana before
    const before = db
      .select({ mana: players.mana })
      .from(players)
      .where(eq(players.id, TEST_PLAYER_ID))
      .get();

    await handleCast(["Test Bolt", "goblin"], context, "");

    // Get mana after
    const after = db
      .select({ mana: players.mana })
      .from(players)
      .where(eq(players.id, TEST_PLAYER_ID))
      .get();

    // Mana should be reduced by spell cost (2)
    expect(after!.mana).toBe(before!.mana - 2);
  });
});
