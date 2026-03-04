import { test } from "@fast-check/vitest";
import { eq, sql } from "drizzle-orm";
import * as fc from "fast-check";
import { v4 as uuidv4 } from "uuid";
import { afterAll, beforeAll, beforeEach, describe, expect } from "vitest";
import { db } from "../../src/db/index.js";
import { feats, playerFeats, players, users } from "../../src/db/schema.js";
import {
  canDualWield,
  getACModifiers,
  getAttackModifiers,
  getDamageModifiers,
  getToughnessBonus,
} from "../../src/services/FeatEffectHandler.js";
import {
  babToLevel,
  scaleLevel,
} from "../../src/services/feats/prerequisiteParser.js";
import {
  acquireFeat,
  calculateBAB,
  checkPrerequisites,
  getActiveStance,
  getAvailableFeats,
  getFeatsByCategory,
  grantFeatSlot,
  setActiveStance,
} from "../../src/services/FeatService.js";
import {
  babValueArb,
  pfLevelArb,
  playerLevelArb,
  positiveFeatSlotsArb,
  statValueArb,
  weaponRangeArb,
} from "../generators/feat.generator.js";

let testUserId: string;
let testPlayerId: string;

// Feat IDs for the 6 starter feats (populated in beforeAll)
let toughnessFeatId: string;
let dodgeFeatId: string;
let combatExpertiseFeatId: string;
let powerAttackFeatId: string;
let deadlyAimFeatId: string;
let twoWeaponFightingFeatId: string;

beforeAll(async () => {
  // Clean up only our test data (respect foreign keys, don't delete seeded data)
  await db
    .delete(playerFeats)
    .where(
      sql`player_id IN (SELECT id FROM players WHERE user_id IN (SELECT id FROM users WHERE username LIKE 'feattest_%'))`,
    );
  await db
    .delete(players)
    .where(
      sql`user_id IN (SELECT id FROM users WHERE username LIKE 'feattest_%')`,
    );
  await db.delete(users).where(sql`username LIKE 'feattest_%'`);

  testUserId = uuidv4();
  await db.insert(users).values({
    id: testUserId,
    username: `feattest_${uuidv4().slice(0, 8)}`,
    passwordHash: "hashedpassword",
    createdAt: new Date(),
  });

  const toughness = await db
    .select()
    .from(feats)
    .where(sql`lower(${feats.name}) = 'toughness'`)
    .limit(1);
  toughnessFeatId = toughness[0]?.id;

  const dodge = await db
    .select()
    .from(feats)
    .where(sql`lower(${feats.name}) = 'dodge'`)
    .limit(1);
  dodgeFeatId = dodge[0]?.id;

  const combatExpertise = await db
    .select()
    .from(feats)
    .where(sql`lower(${feats.name}) = 'combat expertise'`)
    .limit(1);
  combatExpertiseFeatId = combatExpertise[0]?.id;

  const powerAttack = await db
    .select()
    .from(feats)
    .where(sql`lower(${feats.name}) = 'power attack'`)
    .limit(1);
  powerAttackFeatId = powerAttack[0]?.id;

  const deadlyAim = await db
    .select()
    .from(feats)
    .where(sql`lower(${feats.name}) = 'deadly aim'`)
    .limit(1);
  deadlyAimFeatId = deadlyAim[0]?.id;

  const twoWeaponFighting = await db
    .select()
    .from(feats)
    .where(sql`lower(${feats.name}) = 'two-weapon fighting'`)
    .limit(1);
  twoWeaponFightingFeatId = twoWeaponFighting[0]?.id;
});

beforeEach(async () => {
  // Clean up test player data only (testPlayerId may be undefined on first run)
  if (testPlayerId) {
    await db.delete(playerFeats).where(eq(playerFeats.playerId, testPlayerId));
  }
  await db.delete(players).where(eq(players.userId, testUserId));

  testPlayerId = uuidv4();
  await db.insert(players).values({
    id: testPlayerId,
    name: `TestPlayer_${uuidv4().slice(0, 6)}`,
    userId: testUserId,
    currentRoomId: "starting-room",
    str: 10,
    dex: 10,
    con: 10,
    int: 10,
    wis: 10,
    cha: 10,
    level: 1,
    xp: 0,
    currentHp: 10,
    maxHp: 10,
    unspentAttributePoints: 0,
    unspentFeatSlots: 0,
    activeStance: null,
    createdAt: new Date(),
  });
});

afterAll(async () => {
  // Clean up test data only (don't delete seeded data)
  if (testPlayerId) {
    await db.delete(playerFeats).where(eq(playerFeats.playerId, testPlayerId));
  }
  await db.delete(players).where(eq(players.userId, testUserId));
  await db.delete(users).where(sql`username LIKE 'feattest_%'`);
});

describe("Feat Property Tests", () => {
  describe("Property 1: Level Scaling Formula", () => {
    test.prop([pfLevelArb], { numRuns: 20 })(
      "scaleLevel should produce game level >= input PF level",
      (pfLevel: number) => {
        const gameLevel = scaleLevel(pfLevel);
        expect(gameLevel).toBeGreaterThanOrEqual(pfLevel);
      },
    );

    test.prop([pfLevelArb], { numRuns: 20 })(
      "scaleLevel should follow the formula",
      (pfLevel: number) => {
        const gameLevel = scaleLevel(pfLevel);
        const expected = Math.round(pfLevel * (1 + pfLevel * 0.1));
        expect(gameLevel).toBe(expected);
      },
    );
  });

  describe("Property 16: BAB Calculation", () => {
    test.prop([playerLevelArb], { numRuns: 20 })(
      "calculateBAB should return floor(level / 3)",
      (level: number) => {
        const bab = calculateBAB(level);
        expect(bab).toBe(Math.floor(level / 3));
      },
    );

    test.prop([babValueArb], { numRuns: 20 })(
      "babToLevel should return bab * 3",
      (bab: number) => {
        const level = babToLevel(bab);
        expect(level).toBe(bab * 3);
      },
    );
  });

  describe("Property 3: Prerequisite Evaluation", () => {
    test.prop([statValueArb], { numRuns: 20 })(
      "player with sufficient dex should meet Dodge prerequisite",
      async (dexValue: number) => {
        await db
          .update(players)
          .set({ dex: dexValue })
          .where(eq(players.id, testPlayerId));
        const result = await checkPrerequisites(testPlayerId, dodgeFeatId);

        if (dexValue >= 13) {
          expect(result.met).toBe(true);
        } else {
          expect(result.met).toBe(false);
          expect(result.unmetRequirements.some((r) => r.includes("Dex"))).toBe(
            true,
          );
        }
      },
    );
  });

  describe("Property 19: Available Feats Filtering", () => {
    test.prop([statValueArb], { numRuns: 20 })(
      "available feats should only include feats with met prerequisites",
      async (dexValue: number) => {
        await db
          .update(players)
          .set({ dex: dexValue, int: dexValue, str: dexValue })
          .where(eq(players.id, testPlayerId));
        const available = await getAvailableFeats(testPlayerId);

        for (const feat of available) {
          const prereqResult = await checkPrerequisites(testPlayerId, feat.id);
          expect(prereqResult.met).toBe(true);
        }
      },
    );
  });

  describe("Property 4: Unsupported Feat Handling", () => {
    test.prop([fc.constant(true)], { numRuns: 5 })(
      "available feats should only include supported feats",
      async () => {
        await db
          .update(players)
          .set({ dex: 99, int: 99, str: 99, level: 99 })
          .where(eq(players.id, testPlayerId));
        const available = await getAvailableFeats(testPlayerId);

        for (const feat of available) {
          expect(feat.supportabilityStatus).toBe("supported");
        }
      },
    );
  });

  describe("Property 5: Even Level Feat Slot Grant", () => {
    test.prop([fc.integer({ min: 0, max: 10 })], { numRuns: 20 })(
      "grantFeatSlot should increment unspent_feat_slots by 1",
      async (initialSlots: number) => {
        await db
          .update(players)
          .set({ unspentFeatSlots: initialSlots })
          .where(eq(players.id, testPlayerId));
        await grantFeatSlot(testPlayerId);

        const player = await db
          .select({ unspentFeatSlots: players.unspentFeatSlots })
          .from(players)
          .where(eq(players.id, testPlayerId))
          .get();
        expect(player?.unspentFeatSlots).toBe(initialSlots + 1);
      },
    );
  });

  describe("Property 6: Feat Acquisition Invariants", () => {
    test.prop([positiveFeatSlotsArb], { numRuns: 20 })(
      "successful acquisition should decrement slots and create record",
      async (initialSlots: number) => {
        // Clean up feats from previous iteration
        await db
          .delete(playerFeats)
          .where(eq(playerFeats.playerId, testPlayerId));

        await db
          .update(players)
          .set({ unspentFeatSlots: initialSlots })
          .where(eq(players.id, testPlayerId));
        const result = await acquireFeat(testPlayerId, toughnessFeatId);

        expect(result.success).toBe(true);

        const player = db
          .select({ unspentFeatSlots: players.unspentFeatSlots })
          .from(players)
          .where(eq(players.id, testPlayerId))
          .get();
        expect(player?.unspentFeatSlots).toBe(initialSlots - 1);
      },
    );
  });

  describe("Property 7: Zero Slots Rejection", () => {
    test.prop([fc.constant(0)], { numRuns: 5 })(
      "acquisition should fail with 0 slots",
      async () => {
        // Clean up feats from previous iteration
        await db
          .delete(playerFeats)
          .where(eq(playerFeats.playerId, testPlayerId));

        await db
          .update(players)
          .set({ unspentFeatSlots: 0 })
          .where(eq(players.id, testPlayerId));
        const result = await acquireFeat(testPlayerId, toughnessFeatId);

        expect(result.success).toBe(false);
        expect(result.message).toContain("don't have any feat slots");
      },
    );
  });

  describe("Property 8: Unique Player-Feat Constraint", () => {
    test.prop([fc.constant(true)], { numRuns: 5 })(
      "duplicate acquisition should fail",
      async () => {
        // Clean up feats from previous iteration
        await db
          .delete(playerFeats)
          .where(eq(playerFeats.playerId, testPlayerId));

        await db
          .update(players)
          .set({ unspentFeatSlots: 5 })
          .where(eq(players.id, testPlayerId));

        const firstResult = await acquireFeat(testPlayerId, toughnessFeatId);
        expect(firstResult.success).toBe(true);

        const secondResult = await acquireFeat(testPlayerId, toughnessFeatId);
        expect(secondResult.success).toBe(false);
        expect(secondResult.message).toContain("already have");
      },
    );
  });

  describe("Property 18: Category Filtering", () => {
    test.prop([fc.constant("Combat")], { numRuns: 5 })(
      "getFeatsByCategory should return only feats in specified category",
      async (category: string) => {
        const featsInCategory = await getFeatsByCategory(category);

        for (const feat of featsInCategory) {
          expect(feat.category.toLowerCase()).toBe(category.toLowerCase());
        }
      },
    );
  });

  describe("Property 15: Single Active Stance", () => {
    test.prop([fc.constant(true)], { numRuns: 5 })(
      "activating a new stance should deactivate the previous one",
      async () => {
        // Clean up feats and stance from previous iteration
        await db
          .delete(playerFeats)
          .where(eq(playerFeats.playerId, testPlayerId));
        // Power Attack requires Str 13 and BAB +1 (level 3)
        // Combat Expertise requires Int 13
        await db
          .update(players)
          .set({
            int: 15,
            str: 15,
            dex: 15,
            level: 3,
            unspentFeatSlots: 3,
            activeStance: null,
          })
          .where(eq(players.id, testPlayerId));

        const ceResult = await acquireFeat(testPlayerId, combatExpertiseFeatId);
        expect(ceResult.success).toBe(true);

        const paResult = await acquireFeat(testPlayerId, powerAttackFeatId);
        expect(paResult.success).toBe(true);

        const ceStanceResult = await setActiveStance(
          testPlayerId,
          combatExpertiseFeatId,
        );
        expect(ceStanceResult.success).toBe(true);

        let activeStance = await getActiveStance(testPlayerId);
        expect(activeStance?.name).toBe("Combat Expertise");

        const paStanceResult = await setActiveStance(
          testPlayerId,
          powerAttackFeatId,
        );
        expect(paStanceResult.success).toBe(true);

        activeStance = await getActiveStance(testPlayerId);
        expect(activeStance?.name).toBe("Power Attack");
      },
    );
  });

  describe("Property 10: Toughness HP Bonus", () => {
    test.prop([playerLevelArb], { numRuns: 20 })(
      "Toughness bonus should be +3 HP, +1 per level beyond 3rd",
      async (level: number) => {
        // Clean up feats from previous iteration
        await db
          .delete(playerFeats)
          .where(eq(playerFeats.playerId, testPlayerId));

        await db
          .update(players)
          .set({ level, unspentFeatSlots: 1 })
          .where(eq(players.id, testPlayerId));

        const bonusWithout = await getToughnessBonus(testPlayerId, level);
        expect(bonusWithout).toBe(0);

        await acquireFeat(testPlayerId, toughnessFeatId);

        const bonusWith = await getToughnessBonus(testPlayerId, level);
        const expectedBonus = 3 + Math.max(0, level - 3);
        expect(bonusWith).toBe(expectedBonus);
      },
    );
  });

  describe("Property 11: Dodge AC Bonus", () => {
    test.prop([fc.constant(true)], { numRuns: 5 })(
      "Dodge should grant +1 AC",
      async () => {
        // Clean up feats from previous iteration
        await db
          .delete(playerFeats)
          .where(eq(playerFeats.playerId, testPlayerId));

        await db
          .update(players)
          .set({ dex: 15, unspentFeatSlots: 1 })
          .where(eq(players.id, testPlayerId));

        const modifiersWithout = await getACModifiers(testPlayerId);
        expect(modifiersWithout.dodge).toBe(0);

        await acquireFeat(testPlayerId, dodgeFeatId);

        const modifiersWith = await getACModifiers(testPlayerId);
        expect(modifiersWith.dodge).toBe(1);
      },
    );
  });

  describe("Property 12: Combat Expertise Stance Effects", () => {
    test.prop([fc.constant(true)], { numRuns: 5 })(
      "Combat Expertise should grant +1 AC and -1 attack when active",
      async () => {
        // Clean up feats and stance from previous iteration
        await db
          .delete(playerFeats)
          .where(eq(playerFeats.playerId, testPlayerId));

        await db
          .update(players)
          .set({ int: 15, unspentFeatSlots: 1, activeStance: null })
          .where(eq(players.id, testPlayerId));

        await acquireFeat(testPlayerId, combatExpertiseFeatId);

        let acMods = await getACModifiers(testPlayerId);
        let attackMods = await getAttackModifiers(testPlayerId);
        expect(acMods.stance).toBe(0);
        expect(attackMods.stance).toBe(0);

        await setActiveStance(testPlayerId, combatExpertiseFeatId);

        acMods = await getACModifiers(testPlayerId);
        attackMods = await getAttackModifiers(testPlayerId);
        expect(acMods.stance).toBe(1);
        expect(attackMods.stance).toBe(-1);
      },
    );
  });

  describe("Property 13: Power Attack Stance Effects", () => {
    test.prop([weaponRangeArb], { numRuns: 20 })(
      "Power Attack should grant +2 damage only with melee weapons",
      async (weaponRange) => {
        // Clean up feats and stance from previous iteration
        await db
          .delete(playerFeats)
          .where(eq(playerFeats.playerId, testPlayerId));

        // Power Attack requires Str 13 and BAB +1 (level 3)
        await db
          .update(players)
          .set({ str: 15, level: 3, unspentFeatSlots: 1, activeStance: null })
          .where(eq(players.id, testPlayerId));

        const acquireResult = await acquireFeat(
          testPlayerId,
          powerAttackFeatId,
        );
        expect(acquireResult.success).toBe(true);

        const stanceResult = await setActiveStance(
          testPlayerId,
          powerAttackFeatId,
        );
        expect(stanceResult.success).toBe(true);

        const damageMods = await getDamageModifiers(testPlayerId, weaponRange);
        const attackMods = await getAttackModifiers(testPlayerId);

        if (weaponRange === "melee") {
          expect(damageMods.stance).toBe(2);
        } else {
          expect(damageMods.stance).toBe(0);
        }
        expect(attackMods.stance).toBe(-1);
      },
    );
  });

  describe("Property 14: Deadly Aim Stance Effects", () => {
    test.prop([weaponRangeArb], { numRuns: 20 })(
      "Deadly Aim should grant +2 damage only with ranged weapons",
      async (weaponRange) => {
        // Clean up feats and stance from previous iteration
        await db
          .delete(playerFeats)
          .where(eq(playerFeats.playerId, testPlayerId));

        // Deadly Aim requires Dex 13 and BAB +1 (level 3)
        await db
          .update(players)
          .set({ dex: 15, level: 3, unspentFeatSlots: 1, activeStance: null })
          .where(eq(players.id, testPlayerId));

        await acquireFeat(testPlayerId, deadlyAimFeatId);
        await setActiveStance(testPlayerId, deadlyAimFeatId);

        const damageMods = await getDamageModifiers(testPlayerId, weaponRange);
        const attackMods = await getAttackModifiers(testPlayerId);

        if (weaponRange === "ranged") {
          expect(damageMods.stance).toBe(2);
        } else {
          expect(damageMods.stance).toBe(0);
        }
        expect(attackMods.stance).toBe(-1);
      },
    );
  });

  describe("Property 17: Two-Weapon Fighting Validation", () => {
    test.prop([fc.constant(true)], { numRuns: 5 })(
      "canDualWield should return true only with Two-Weapon Fighting feat",
      async () => {
        // Clean up feats from previous iteration
        await db
          .delete(playerFeats)
          .where(eq(playerFeats.playerId, testPlayerId));

        // Two-Weapon Fighting requires Dex 15
        await db
          .update(players)
          .set({ dex: 15, unspentFeatSlots: 1 })
          .where(eq(players.id, testPlayerId));

        const canWithout = await canDualWield(testPlayerId);
        expect(canWithout).toBe(false);

        const result = await acquireFeat(testPlayerId, twoWeaponFightingFeatId);
        expect(result.success).toBe(true);

        const canWith = await canDualWield(testPlayerId);
        expect(canWith).toBe(true);
      },
    );
  });

  describe("Property 20: Feat Slot Display", () => {
    test.prop([fc.integer({ min: 0, max: 10 })], { numRuns: 20 })(
      "grantFeatSlot should correctly accumulate slots",
      async (slotsToGrant: number) => {
        await db
          .update(players)
          .set({ unspentFeatSlots: 0 })
          .where(eq(players.id, testPlayerId));

        for (let i = 0; i < slotsToGrant; i++) {
          await grantFeatSlot(testPlayerId);
        }

        const player = await db
          .select({ unspentFeatSlots: players.unspentFeatSlots })
          .from(players)
          .where(eq(players.id, testPlayerId))
          .get();
        expect(player?.unspentFeatSlots).toBe(slotsToGrant);
      },
    );
  });

  describe("Property 9: Cascade Delete", () => {
    test.prop([fc.constant(true)], { numRuns: 1 })(
      "deleting a feat should cascade delete player_feats",
      async () => {
        const tempFeatId = uuidv4();
        await db.insert(feats).values({
          id: tempFeatId,
          name: `TempFeat_${tempFeatId.slice(0, 6)}`,
          prerequisitesText: null,
          shortDescription: "Temporary test feat",
          longDescription: null,
          sourceBook: "Test",
          category: "Test",
          effectType: null,
          supportabilityStatus: "supported",
        });

        await db
          .update(players)
          .set({ unspentFeatSlots: 1 })
          .where(eq(players.id, testPlayerId));
        await acquireFeat(testPlayerId, tempFeatId);

        const beforeDelete = await db
          .select()
          .from(playerFeats)
          .where(eq(playerFeats.featId, tempFeatId))
          .get();
        expect(beforeDelete).toBeDefined();

        await db.delete(feats).where(eq(feats.id, tempFeatId));

        const afterDelete = await db
          .select()
          .from(playerFeats)
          .where(eq(playerFeats.featId, tempFeatId))
          .get();
        expect(afterDelete).toBeUndefined();
      },
    );
  });
});
