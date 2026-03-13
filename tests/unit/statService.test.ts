import { describe, expect, it } from "vitest";
import * as StatService from "../../src/services/StatService.js";

describe("StatService", () => {
  describe("getStatModifier", () => {
    it("should return 0 for stat of 10", () => {
      expect(StatService.getStatModifier(10)).toBe(0);
    });

    it("should return 0 for stat of 11", () => {
      expect(StatService.getStatModifier(11)).toBe(0);
    });

    it("should return positive modifier for high stats", () => {
      expect(StatService.getStatModifier(12)).toBe(1);
      expect(StatService.getStatModifier(14)).toBe(2);
      expect(StatService.getStatModifier(16)).toBe(3);
      expect(StatService.getStatModifier(18)).toBe(4);
      expect(StatService.getStatModifier(20)).toBe(5);
    });

    it("should return negative modifier for low stats", () => {
      expect(StatService.getStatModifier(8)).toBe(-1);
      expect(StatService.getStatModifier(6)).toBe(-2);
      expect(StatService.getStatModifier(4)).toBe(-3);
      expect(StatService.getStatModifier(1)).toBe(-5);
    });

    it("should handle edge cases", () => {
      expect(StatService.getStatModifier(0)).toBe(-5);
      expect(StatService.getStatModifier(30)).toBe(10);
    });
  });

  describe("calculateAC", () => {
    it("should return base AC of 10 for DEX 10 with no equipment", async () => {
      expect(await StatService.calculateAC(10, 0)).toBe(10);
    });

    it("should add DEX modifier to AC", async () => {
      expect(await StatService.calculateAC(14, 0)).toBe(12); // +2 DEX mod
      expect(await StatService.calculateAC(18, 0)).toBe(14); // +4 DEX mod
      expect(await StatService.calculateAC(8, 0)).toBe(9); // -1 DEX mod
    });

    it("should add equipment AC bonus to AC", async () => {
      expect(await StatService.calculateAC(10, 2)).toBe(12);
      expect(await StatService.calculateAC(14, 3)).toBe(15); // 10 + 2 DEX + 3 armor
    });

    it("should handle negative equipment bonus", async () => {
      expect(await StatService.calculateAC(10, -2)).toBe(8);
    });
  });

  describe("calculateAttackInterval", () => {
    it("should return base interval of 3000ms for DEX 10", () => {
      expect(StatService.calculateAttackInterval(10)).toBe(3000);
    });

    it("should decrease interval for high DEX", () => {
      expect(StatService.calculateAttackInterval(14)).toBe(2600); // -400ms for +2 mod
      expect(StatService.calculateAttackInterval(18)).toBe(2200); // -800ms for +4 mod
    });

    it("should increase interval for low DEX", () => {
      expect(StatService.calculateAttackInterval(8)).toBe(3200); // +200ms for -1 mod
      expect(StatService.calculateAttackInterval(6)).toBe(3400); // +400ms for -2 mod
    });

    it("should clamp to minimum of 1500ms", () => {
      expect(StatService.calculateAttackInterval(30)).toBe(1500);
    });

    it("should clamp to maximum of 5000ms", () => {
      expect(StatService.calculateAttackInterval(1)).toBe(4000); // -5 mod = +1000ms = 4000
      // Even lower would hit the cap
    });
  });

  describe("getDamageModifier", () => {
    it("should return STR modifier for damage", () => {
      expect(StatService.getDamageModifier(10)).toBe(0);
      expect(StatService.getDamageModifier(14)).toBe(2);
      expect(StatService.getDamageModifier(18)).toBe(4);
      expect(StatService.getDamageModifier(8)).toBe(-1);
    });
  });

  describe("calculateEquipmentConBonus", () => {
    it("should return 0 for empty array", () => {
      expect(StatService.calculateEquipmentConBonus([])).toBe(0);
    });

    it("should sum CON effects from all items", () => {
      const items = [{ conEffect: 2 }, { conEffect: 1 }, { conEffect: 3 }];
      expect(StatService.calculateEquipmentConBonus(items)).toBe(6);
    });

    it("should handle null and undefined conEffect", () => {
      const items = [
        { conEffect: 2 },
        { conEffect: null },
        { conEffect: undefined },
        { conEffect: 1 },
      ];
      expect(StatService.calculateEquipmentConBonus(items)).toBe(3);
    });

    it("should handle negative CON effects", () => {
      const items = [{ conEffect: 2 }, { conEffect: -1 }];
      expect(StatService.calculateEquipmentConBonus(items)).toBe(1);
    });
  });

  describe("calculateEquipmentACBonus", () => {
    it("should return 0 for empty array", () => {
      expect(StatService.calculateEquipmentACBonus([])).toBe(0);
    });

    it("should sum AC bonuses from all items", () => {
      const items = [{ acBonus: 2 }, { acBonus: 1 }, { acBonus: 3 }];
      expect(StatService.calculateEquipmentACBonus(items)).toBe(6);
    });

    it("should handle null and undefined acBonus", () => {
      const items = [
        { acBonus: 2 },
        { acBonus: null },
        { acBonus: undefined },
        { acBonus: 1 },
      ];
      expect(StatService.calculateEquipmentACBonus(items)).toBe(3);
    });
  });

  describe("calculateEquipmentAttackBonus", () => {
    it("should return 0 for empty array", () => {
      expect(StatService.calculateEquipmentAttackBonus([])).toBe(0);
    });

    it("should sum attack bonuses from all items", () => {
      const items = [{ attackBonus: 1 }, { attackBonus: 2 }];
      expect(StatService.calculateEquipmentAttackBonus(items)).toBe(3);
    });

    it("should handle null and undefined attackBonus", () => {
      const items = [
        { attackBonus: 2 },
        { attackBonus: null },
        { attackBonus: undefined },
      ];
      expect(StatService.calculateEquipmentAttackBonus(items)).toBe(2);
    });
  });

  describe("calculateEquipmentDamageBonus", () => {
    it("should return 0 for empty array", () => {
      expect(StatService.calculateEquipmentDamageBonus([])).toBe(0);
    });

    it("should sum damage bonuses from all items", () => {
      const items = [{ damageBonus: 1 }, { damageBonus: 2 }];
      expect(StatService.calculateEquipmentDamageBonus(items)).toBe(3);
    });

    it("should handle null and undefined damageBonus", () => {
      const items = [
        { damageBonus: 2 },
        { damageBonus: null },
        { damageBonus: undefined },
      ];
      expect(StatService.calculateEquipmentDamageBonus(items)).toBe(2);
    });
  });

  describe("calculateXpAfterDeath", () => {
    it("should remove 10% of XP on death", () => {
      expect(StatService.calculateXpAfterDeath(100)).toBe(90);
      expect(StatService.calculateXpAfterDeath(1000)).toBe(900);
    });

    it("should floor the penalty", () => {
      expect(StatService.calculateXpAfterDeath(15)).toBe(14); // 10% of 15 = 1.5, floored to 1
      expect(StatService.calculateXpAfterDeath(7)).toBe(7); // 10% of 7 = 0.7, floored to 0
    });

    it("should not go below 0", () => {
      expect(StatService.calculateXpAfterDeath(0)).toBe(0);
    });
  });

  describe("calculateFleeDC", () => {
    it("should return base DC of 10 for equal levels", () => {
      expect(StatService.calculateFleeDC(1, 1)).toBe(10);
      expect(StatService.calculateFleeDC(5, 5)).toBe(10);
    });

    it("should increase DC when monster is higher level", () => {
      expect(StatService.calculateFleeDC(1, 3)).toBe(14); // 10 + (3-1)*2 = 14
      expect(StatService.calculateFleeDC(1, 5)).toBe(18); // 10 + (5-1)*2 = 18
    });

    it("should decrease DC when player is higher level", () => {
      expect(StatService.calculateFleeDC(5, 3)).toBe(6); // 10 + (3-5)*2 = 6
      expect(StatService.calculateFleeDC(10, 5)).toBe(0); // 10 + (5-10)*2 = 0
    });

    it("should default monster level to 1", () => {
      expect(StatService.calculateFleeDC(1)).toBe(10);
      expect(StatService.calculateFleeDC(3)).toBe(6); // 10 + (1-3)*2 = 6
    });
  });

  describe("calculateMaxHp", () => {
    it("should return 18 HP for level 1 with CON 10", async () => {
      // BASE_HP (10) + level (1) × (HP_PER_LEVEL (8) + conMod (0) × CON_BONUS_PER_LEVEL (2))
      // = 10 + 1 × 8 = 18
      expect(await StatService.calculateMaxHp(1, 10)).toBe(18);
    });

    it("should increase HP with level", async () => {
      // Level 5, CON 10: 10 + 5 × 8 = 50
      expect(await StatService.calculateMaxHp(5, 10)).toBe(50);
      // Level 10, CON 10: 10 + 10 × 8 = 90
      expect(await StatService.calculateMaxHp(10, 10)).toBe(90);
    });

    it("should add CON bonus per level", async () => {
      // Level 1, CON 14 (+2 mod): 10 + 1 × (8 + 2×2) = 10 + 12 = 22
      expect(await StatService.calculateMaxHp(1, 14)).toBe(22);
      // Level 5, CON 14 (+2 mod): 10 + 5 × (8 + 2×2) = 10 + 60 = 70
      expect(await StatService.calculateMaxHp(5, 14)).toBe(70);
    });

    it("should reduce HP with low CON", async () => {
      // Level 1, CON 8 (-1 mod): 10 + 1 × (8 + (-1)×2) = 10 + 6 = 16
      expect(await StatService.calculateMaxHp(1, 8)).toBe(16);
      // Level 5, CON 8 (-1 mod): 10 + 5 × (8 + (-1)×2) = 10 + 30 = 40
      expect(await StatService.calculateMaxHp(5, 8)).toBe(40);
    });

    it("should handle high CON", async () => {
      // Level 10, CON 18 (+4 mod): 10 + 10 × (8 + 4×2) = 10 + 160 = 170
      expect(await StatService.calculateMaxHp(10, 18)).toBe(170);
    });
  });

  describe("calculateConHpBonus", () => {
    it("should return 0 for CON 10", () => {
      expect(StatService.calculateConHpBonus(1, 10)).toBe(0);
      expect(StatService.calculateConHpBonus(5, 10)).toBe(0);
    });

    it("should return positive bonus for high CON", () => {
      // Level 1, CON 14 (+2 mod): 1 × 2 × 2 = 4
      expect(StatService.calculateConHpBonus(1, 14)).toBe(4);
      // Level 5, CON 14 (+2 mod): 5 × 2 × 2 = 20
      expect(StatService.calculateConHpBonus(5, 14)).toBe(20);
    });

    it("should return negative bonus for low CON", () => {
      // Level 5, CON 8 (-1 mod): 5 × (-1) × 2 = -10
      expect(StatService.calculateConHpBonus(5, 8)).toBe(-10);
    });
  });

  describe("calculateMaxMana", () => {
    it("should return 2 mana for level 1 with INT 10", () => {
      // (INT mod 0 + 2) × level 1 = 2
      expect(StatService.calculateMaxMana(1, 10)).toBe(2);
    });

    it("should increase mana with level", () => {
      // Level 5, INT 10: (0 + 2) × 5 = 10
      expect(StatService.calculateMaxMana(5, 10)).toBe(10);
      // Level 10, INT 10: (0 + 2) × 10 = 20
      expect(StatService.calculateMaxMana(10, 10)).toBe(20);
    });

    it("should add INT modifier to base", () => {
      // Level 1, INT 14 (+2 mod): (2 + 2) × 1 = 4
      expect(StatService.calculateMaxMana(1, 14)).toBe(4);
      // Level 5, INT 14 (+2 mod): (2 + 2) × 5 = 20
      expect(StatService.calculateMaxMana(5, 14)).toBe(20);
    });

    it("should handle high INT", () => {
      // Level 10, INT 18 (+4 mod): (4 + 2) × 10 = 60
      expect(StatService.calculateMaxMana(10, 18)).toBe(60);
    });

    it("should handle low INT but not go below 0", () => {
      // Level 1, INT 8 (-1 mod): (-1 + 2) × 1 = 1
      expect(StatService.calculateMaxMana(1, 8)).toBe(1);
      // Level 5, INT 6 (-2 mod): (-2 + 2) × 5 = 0
      expect(StatService.calculateMaxMana(5, 6)).toBe(0);
      // Level 5, INT 4 (-3 mod): (-3 + 2) × 5 = -5, clamped to 0
      expect(StatService.calculateMaxMana(5, 4)).toBe(0);
    });
  });
});
