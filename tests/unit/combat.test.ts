import { describe, expect, it } from "vitest";
import { processAttack } from "../../src/services/CombatService.js";
import type { CombatParticipant } from "../../src/types/combat.js";

describe("CombatService", () => {
  describe("processAttack", () => {
    const createPlayer = (
      overrides?: Partial<CombatParticipant>,
    ): CombatParticipant => ({
      type: "player",
      id: "test-player",
      name: "TestPlayer",
      currentHp: 20,
      maxHp: 20,
      stats: { str: 14, dex: 12, con: 10 },
      weaponDamage: "1d6",
      weaponRange: "melee",
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
      weaponDamage: "1d4",
      weaponRange: "melee",
      ac: 10,
      level: 1,
      ...overrides,
    });

    it("should return hit=false when attack roll is below AC", () => {
      const attacker = createPlayer({ stats: { str: 1, dex: 10, con: 10 } }); // Very low STR for melee
      const defender = createMonster({ ac: 25 }); // Very high AC

      // With STR 1 (modifier -5), even rolling 20 gives 15, below AC 25
      // Run multiple times to ensure we get a miss
      let gotMiss = false;
      for (let i = 0; i < 100; i++) {
        const result = processAttack(attacker, defender);
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

      const result = processAttack(attacker, defender);

      expect(result.hit).toBe(true);
      expect(result.damage).toBeGreaterThan(0);
      expect(result.defenderHp).toBeLessThan(defender.currentHp);
      expect(result.message).toContain("hits");
      expect(result.message).toContain("damage");
    });

    it("should include STR modifier in damage", () => {
      const attacker = createPlayer({
        stats: { str: 18, dex: 14, con: 10 }, // +4 STR mod
        weaponDamage: "1d1", // Always rolls 1
      });
      const defender = createMonster({ ac: 1 });

      const result = processAttack(attacker, defender);

      // 1d1 (1) + STR mod (4) = 5 damage minimum
      expect(result.hit).toBe(true);
      expect(result.damage).toBeGreaterThanOrEqual(5);
    });

    it("should deal minimum 1 damage even with negative STR", () => {
      const attacker = createPlayer({
        stats: { str: 1, dex: 30, con: 10 }, // -5 STR mod, high DEX won't help melee attack
        weaponDamage: "1d1", // Always rolls 1
      });
      const defender = createMonster({ ac: 1 });

      const result = processAttack(attacker, defender);

      // 1d1 (1) + STR mod (-5) = -4, but minimum is 1
      expect(result.hit).toBe(true);
      expect(result.damage).toBe(1);
    });

    it("should mark defender as dead when HP reaches 0", () => {
      const attacker = createPlayer({
        stats: { str: 30, dex: 30, con: 10 }, // High stats
        weaponDamage: "10d10", // Lots of damage
      });
      const defender = createMonster({ currentHp: 1, ac: 1 });

      const result = processAttack(attacker, defender);

      expect(result.hit).toBe(true);
      expect(result.defenderHp).toBe(0);
      expect(result.defenderDead).toBe(true);
      expect(result.message).toContain("defeating");
    });

    it("should not reduce HP below 0", () => {
      const attacker = createPlayer({
        stats: { str: 30, dex: 30, con: 10 },
        weaponDamage: "100d100", // Massive overkill
      });
      const defender = createMonster({ currentHp: 1, ac: 1 });

      const result = processAttack(attacker, defender);

      expect(result.defenderHp).toBe(0);
    });

    it("should include attacker and defender names in message", () => {
      const attacker = createPlayer({
        name: "Hero",
        stats: { str: 30, dex: 12, con: 10 },
      });
      const defender = createMonster({ name: "dragon", ac: 1 });

      const result = processAttack(attacker, defender);

      expect(result.message).toContain("Hero");
      expect(result.message).toContain("dragon");
    });

    it("should show remaining HP in hit message", () => {
      const attacker = createPlayer({ stats: { str: 30, dex: 10, con: 10 } });
      const defender = createMonster({ currentHp: 100, maxHp: 100, ac: 1 });

      const result = processAttack(attacker, defender);

      if (result.hit && !result.defenderDead) {
        expect(result.message).toContain("/100 HP");
      }
    });

    it("should use default weapon damage of 1d4 when none specified", () => {
      const attacker = createPlayer({
        stats: { str: 10, dex: 10, con: 10 },
        weaponDamage: null,
      });
      const defender = createMonster({ ac: 1 });

      // Run multiple times to verify damage is in 1d4 range (1-4) + 0 STR mod
      for (let i = 0; i < 20; i++) {
        const result = processAttack(attacker, defender);
        if (result.hit) {
          expect(result.damage).toBeGreaterThanOrEqual(1);
          expect(result.damage).toBeLessThanOrEqual(4);
        }
      }
    });

    it("should record attack roll and target AC", () => {
      const attacker = createPlayer();
      const defender = createMonster({ ac: 15 });

      const result = processAttack(attacker, defender);

      expect(result.attackRoll).toBeGreaterThanOrEqual(1);
      expect(result.attackRoll).toBeLessThanOrEqual(21); // d20 + modifier
      expect(result.targetAC).toBe(15);
    });
  });
});
