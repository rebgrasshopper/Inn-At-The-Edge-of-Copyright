import { describe, expect, it } from "vitest";
import { processAttack } from "../../src/services/CombatService.js";
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

      // 1d1 (1) + STR mod (-5) = -4, but minimum is 1
      expect(result.hit).toBe(true);
      expect(result.damage).toBe(1);
    });

    it("should mark defender as dead when HP reaches 0", () => {
      const attacker = createPlayer({
        stats: { str: 30, dex: 30, con: 10 }, // High stats
      });
      const defender = createMonster({ currentHp: 1, ac: 1 });
      const weapon = createWeapon({ damage: "10d10" }); // Lots of damage

      const result = processAttack(attacker, defender, weapon);

      expect(result.hit).toBe(true);
      expect(result.defenderHp).toBe(0);
      expect(result.defenderDead).toBe(true);
      expect(result.message).toContain("defeating");
    });

    it("should not reduce HP below 0", () => {
      const attacker = createPlayer({
        stats: { str: 30, dex: 30, con: 10 },
      });
      const defender = createMonster({ currentHp: 1, ac: 1 });
      const weapon = createWeapon({ damage: "100d100" }); // Massive overkill

      const result = processAttack(attacker, defender, weapon);

      expect(result.defenderHp).toBe(0);
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
  });
});
