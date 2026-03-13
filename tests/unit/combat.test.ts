import { describe, expect, it } from "vitest";
import { processAttack } from "../../src/services/CombatService.js";
import {
  calculateGroupXpMultiplier,
  calculateXpReward,
} from "../../src/services/StatService.js";
import type { CombatParticipant, WeaponData } from "../../src/types/combat.js";

describe("CombatService", () => {
  describe("processAttack", () => {
    const createWeapon = (overrides?: Partial<WeaponData>): WeaponData => ({
      damage: "1d6",
      range: "melee",
      attackBonus: 0,
      damageBonus: 0,
      ...overrides,
    });

    const createPlayer = (
      overrides?: Partial<CombatParticipant>,
    ): CombatParticipant => ({
      type: "player",
      id: "test-player",
      name: "TestPlayer",
      currentHp: 20,
      maxHp: 20,
      stats: { str: 14, dex: 12, con: 10 },
      mainHandWeapon: createWeapon(),
      offHandWeapon: null,
      ac: 12,
      level: 1,
      ...overrides,
    });

    const createMonster = (
      overrides?: Partial<CombatParticipant>,
    ): CombatParticipant => ({
      type: "monster",
      id: "test-monster",
      name: "goblin",
      currentHp: 8,
      maxHp: 8,
      stats: { str: 10, dex: 10, con: 10 },
      mainHandWeapon: createWeapon({ damage: "1d4" }),
      offHandWeapon: null,
      ac: 10,
      level: 1,
      ...overrides,
    });

    // Default weapon for tests
    const defaultWeapon = createWeapon();

    it("should return hit=false when attack roll is below AC", () => {
      const attacker = createPlayer({ stats: { str: 1, dex: 10, con: 10 } }); // Very low STR for melee
      const defender = createMonster({ ac: 25 }); // Very high AC

      // With STR 1 (modifier -5), even rolling 20 gives 15, below AC 25
      // Run multiple times to ensure we get a miss
      let gotMiss = false;
      for (let i = 0; i < 100; i++) {
        const result = processAttack(attacker, defender, defaultWeapon);
        if (!result.hit) {
          gotMiss = true;
          expect(result.damage).toBeNull();
          expect(result.defenderHp).toBe(defender.currentHp);
          expect(result.defenderDead).toBe(false);
          expect(result.message).toContain("misses");
          break;
        }
      }
      expect(gotMiss).toBe(true);
    });

    it("should deal damage when attack hits", () => {
      const attacker = createPlayer({ stats: { str: 30, dex: 14, con: 10 } }); // Very high STR to guarantee hit
      const defender = createMonster({ ac: 5, currentHp: 100, maxHp: 100 }); // Very low AC, high HP to avoid death

      const result = processAttack(attacker, defender, defaultWeapon);

      expect(result.hit).toBe(true);
      expect(result.damage).toBeGreaterThan(0);
      expect(result.defenderHp).toBeLessThan(defender.currentHp);
      expect(result.message).toContain("hits");
      expect(result.message).toContain("damage");
    });

    it("should include STR modifier in damage", () => {
      const attacker = createPlayer({
        stats: { str: 18, dex: 14, con: 10 }, // +4 STR mod
      });
      const defender = createMonster({ ac: 1 });
      const weapon = createWeapon({ damage: "1d1" }); // Always rolls 1

      const result = processAttack(attacker, defender, weapon);

      // 1d1 (1) + STR mod (4) = 5 damage minimum
      expect(result.hit).toBe(true);
      expect(result.damage).toBeGreaterThanOrEqual(5);
    });

    it("should deal minimum 1 damage even with negative STR", () => {
      const attacker = createPlayer({
        stats: { str: 1, dex: 30, con: 10 }, // -5 STR mod
      });
      const defender = createMonster({ ac: 1 }); // Very low AC to guarantee hit despite -5 STR
      const weapon = createWeapon({ damage: "1d1", attackBonus: 10 }); // +10 attack bonus to guarantee hit

      const result = processAttack(attacker, defender, weapon);

      // Natural 1 always misses, so check if hit before asserting damage
      if (result.hit) {
        // 1d1 (1) + STR mod (-5) = -4, but minimum is 1
        expect(result.damage).toBe(1);
      } else {
        // Natural 1 - attack missed
        expect(result.damage).toBeNull();
      }
    });

    it("should mark defender as dead when HP reaches 0", () => {
      const attacker = createPlayer({
        stats: { str: 30, dex: 30, con: 10 }, // High stats
      });
      const defender = createMonster({ currentHp: 1, ac: 1 });
      const weapon = createWeapon({ damage: "10d10" }); // Lots of damage

      const result = processAttack(attacker, defender, weapon);

      // Natural 1 always misses, so we may need to retry
      if (result.hit) {
        expect(result.defenderHp).toBe(0);
        expect(result.defenderDead).toBe(true);
        expect(result.message).toContain("defeating");
      } else {
        // Natural 1 - attack missed
        expect(result.defenderHp).toBe(1);
        expect(result.defenderDead).toBe(false);
      }
    });

    it("should not reduce HP below 0", () => {
      const attacker = createPlayer({
        stats: { str: 30, dex: 30, con: 10 },
      });
      const defender = createMonster({ currentHp: 1, ac: 1 });
      const weapon = createWeapon({ damage: "100d100" }); // Massive overkill

      const result = processAttack(attacker, defender, weapon);

      // If hit, HP should be 0 (not negative). If natural 1, HP stays at 1.
      if (result.hit) {
        expect(result.defenderHp).toBe(0);
      } else {
        // Natural 1 always misses
        expect(result.defenderHp).toBe(1);
      }
    });

    it("should include attacker and defender names in message", () => {
      const attacker = createPlayer({
        name: "Hero",
        stats: { str: 30, dex: 12, con: 10 },
      });
      const defender = createMonster({ name: "dragon", ac: 1 });

      const result = processAttack(attacker, defender, defaultWeapon);

      expect(result.message).toContain("Hero");
      expect(result.message).toContain("dragon");
    });

    it("should show remaining HP in hit message", () => {
      const attacker = createPlayer({ stats: { str: 30, dex: 10, con: 10 } });
      const defender = createMonster({ currentHp: 100, maxHp: 100, ac: 1 });

      const result = processAttack(attacker, defender, defaultWeapon);

      if (result.hit && !result.defenderDead) {
        expect(result.message).toContain("/100 HP");
      }
    });

    it("should use provided weapon damage dice", () => {
      const attacker = createPlayer({
        stats: { str: 10, dex: 10, con: 10 },
      });
      const defender = createMonster({ ac: 1 });
      const weapon = createWeapon({ damage: "1d4" });

      // Run multiple times to verify damage is in 1d4 range (1-4) + 0 STR mod
      for (let i = 0; i < 20; i++) {
        const result = processAttack(attacker, defender, weapon);
        if (result.hit) {
          expect(result.damage).toBeGreaterThanOrEqual(1);
          expect(result.damage).toBeLessThanOrEqual(4);
        }
      }
    });

    it("should record attack roll and target AC", () => {
      const attacker = createPlayer();
      const defender = createMonster({ ac: 15 });

      const result = processAttack(attacker, defender, defaultWeapon);

      expect(result.attackRoll).toBeGreaterThanOrEqual(1);
      expect(result.attackRoll).toBeLessThanOrEqual(22); // d20 + STR modifier (+2 from STR 14)
      expect(result.targetAC).toBe(15);
    });

    it("should apply dual wield penalty to attack roll", () => {
      const attacker = createPlayer({ stats: { str: 10, dex: 10, con: 10 } });
      const defender = createMonster({ ac: 15 });

      // With -4 penalty, attack roll should be lower
      const result = processAttack(
        attacker,
        defender,
        defaultWeapon,
        undefined,
        -4,
      );

      // Attack roll should include the -4 penalty
      // d20 + 0 (STR mod) + 0 (BAB) + 0 (weapon bonus) - 4 (dual wield)
      expect(result.attackRoll).toBeGreaterThanOrEqual(-3); // 1 - 4 = -3
      expect(result.attackRoll).toBeLessThanOrEqual(16); // 20 - 4 = 16
    });

    it("should apply weapon attack bonus to attack roll", () => {
      const attacker = createPlayer({ stats: { str: 10, dex: 10, con: 10 } });
      const defender = createMonster({ ac: 15 });
      const magicWeapon = createWeapon({ attackBonus: 2 });

      const result = processAttack(attacker, defender, magicWeapon);

      // Attack roll should include the +2 weapon bonus
      // d20 + 0 (STR mod) + 0 (BAB) + 2 (weapon bonus)
      expect(result.attackRoll).toBeGreaterThanOrEqual(3); // 1 + 2 = 3
      expect(result.attackRoll).toBeLessThanOrEqual(22); // 20 + 2 = 22
    });

    it("should apply weapon damage bonus to damage", () => {
      const attacker = createPlayer({ stats: { str: 10, dex: 10, con: 10 } });
      const defender = createMonster({ ac: 1 });
      const magicWeapon = createWeapon({ damage: "1d1", damageBonus: 3 });

      const result = processAttack(attacker, defender, magicWeapon);

      // 1d1 (1) + 0 (STR mod) + 3 (weapon bonus) = 4
      expect(result.hit).toBe(true);
      expect(result.damage).toBe(4);
    });

    it("should use DEX for ranged weapon attacks", () => {
      const attacker = createPlayer({
        stats: { str: 10, dex: 18, con: 10 }, // +4 DEX mod
      });
      const defender = createMonster({ ac: 1 });
      const rangedWeapon = createWeapon({ range: "ranged" });

      const result = processAttack(attacker, defender, rangedWeapon);

      // Attack roll should use DEX (+4) instead of STR (+0)
      // d20 + 4 (DEX mod) + 0 (BAB) + 0 (weapon bonus)
      expect(result.attackRoll).toBeGreaterThanOrEqual(5); // 1 + 4 = 5
      expect(result.attackRoll).toBeLessThanOrEqual(24); // 20 + 4 = 24
    });

    it("should always miss on natural 1 regardless of modifiers", () => {
      // Run many times to statistically catch natural 1s
      const attacker = createPlayer({
        stats: { str: 30, dex: 30, con: 10 }, // +10 STR mod
        level: 20, // High BAB
      });
      const defender = createMonster({ ac: 1 }); // Very low AC

      let sawNatural1Miss = false;
      for (let i = 0; i < 100; i++) {
        const result = processAttack(attacker, defender, defaultWeapon);
        // If attack roll is very low (1 + modifiers), it was a natural 1
        // With +10 STR and high BAB, a roll of ~11-15 indicates natural 1
        if (!result.hit && result.attackRoll <= 20) {
          sawNatural1Miss = true;
          break;
        }
      }
      // With 100 attempts, probability of never rolling a 1 is (19/20)^100 ≈ 0.006
      expect(sawNatural1Miss).toBe(true);
    });

    it("should always hit on natural 20 regardless of AC", () => {
      // Run many times to statistically catch natural 20s
      const attacker = createPlayer({
        stats: { str: 1, dex: 1, con: 10 }, // -5 STR mod
        level: 1, // No BAB
      });
      const defender = createMonster({ ac: 100 }); // Impossibly high AC

      let sawNatural20Hit = false;
      for (let i = 0; i < 100; i++) {
        const result = processAttack(attacker, defender, defaultWeapon);
        if (result.hit) {
          sawNatural20Hit = true;
          break;
        }
      }
      // With 100 attempts, probability of never rolling a 20 is (19/20)^100 ≈ 0.006
      expect(sawNatural20Hit).toBe(true);
    });
  });

  describe("calculateGroupXpMultiplier", () => {
    it("should return 1 for solo player", () => {
      expect(calculateGroupXpMultiplier(1)).toBe(1);
    });

    it("should return 0.6 for 2 players", () => {
      // (1 + 0.2 * 1) / 2 = 1.2 / 2 = 0.6
      expect(calculateGroupXpMultiplier(2)).toBe(0.6);
    });

    it("should return ~0.467 for 3 players", () => {
      // (1 + 0.2 * 2) / 3 = 1.4 / 3 ≈ 0.467
      expect(calculateGroupXpMultiplier(3)).toBeCloseTo(0.467, 2);
    });

    it("should return 0.4 for 4 players", () => {
      // (1 + 0.2 * 3) / 4 = 1.6 / 4 = 0.4
      expect(calculateGroupXpMultiplier(4)).toBe(0.4);
    });

    it("should return 0.36 for 5 players", () => {
      // (1 + 0.2 * 4) / 5 = 1.8 / 5 = 0.36
      expect(calculateGroupXpMultiplier(5)).toBe(0.36);
    });

    it("should cap bonus at 5 players (6+ players get same multiplier as 5)", () => {
      // (1 + 0.2 * 4) / 6 = 1.8 / 6 = 0.3
      expect(calculateGroupXpMultiplier(6)).toBe(0.3);
      // (1 + 0.2 * 4) / 10 = 1.8 / 10 = 0.18
      expect(calculateGroupXpMultiplier(10)).toBe(0.18);
    });

    it("should handle edge case of 0 participants", () => {
      expect(calculateGroupXpMultiplier(0)).toBe(1);
    });
  });

  describe("Group XP calculation", () => {
    it("should give higher level player more XP when helping lower level player", () => {
      // Level 5 player vs Level 5 monster: 40 XP solo
      // Level 3 player vs Level 5 monster: 80 XP solo (monster 2 levels higher)
      const level5Solo = calculateXpReward(5, 5);
      const level3Solo = calculateXpReward(5, 3);

      expect(level5Solo).toBe(40);
      expect(level3Solo).toBe(80);

      // Pool: 40 + 80 = 120, Average: 60
      const pool = level5Solo + level3Solo;
      const average = pool / 2;
      expect(average).toBe(60);

      // Each gets: 60 × 0.6 = 36 XP
      const multiplier = calculateGroupXpMultiplier(2);
      const xpEach = Math.floor(average * multiplier);
      expect(xpEach).toBe(36);

      // Level 5 player gets 36 instead of 40 (slight penalty for easy kill)
      // Level 3 player gets 36 instead of 80 (big penalty but still good XP)
      // But if level 5 helped level 3 kill a level 3 monster:
      // Level 5 solo: 20 XP (monster 2 levels lower)
      // Level 3 solo: 40 XP (same level)
      // Pool: 60, Average: 30, Each: 30 × 0.6 = 18 XP
      // Level 5 gets 18 instead of 20 - small penalty
      // Level 3 gets 18 instead of 40 - bigger penalty but still helped
    });

    it("should give same XP to equal level players", () => {
      // Two level 5 players vs Level 5 monster
      const soloXp = calculateXpReward(5, 5);
      expect(soloXp).toBe(40);

      // Pool: 40 + 40 = 80, Average: 40
      const pool = soloXp * 2;
      const average = pool / 2;
      expect(average).toBe(40);

      // Each gets: 40 × 0.6 = 24 XP
      const multiplier = calculateGroupXpMultiplier(2);
      const xpEach = Math.floor(average * multiplier);
      expect(xpEach).toBe(24);
    });
  });
});
