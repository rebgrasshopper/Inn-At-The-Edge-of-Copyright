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
    it("should return base AC of 10 for DEX 10 with no equipment", () => {
      expect(StatService.calculateAC(10, 0)).toBe(10);
    });

    it("should add DEX modifier to AC", () => {
      expect(StatService.calculateAC(14, 0)).toBe(12); // +2 DEX mod
      expect(StatService.calculateAC(18, 0)).toBe(14); // +4 DEX mod
      expect(StatService.calculateAC(8, 0)).toBe(9); // -1 DEX mod
    });

    it("should add equipment CON bonus to AC", () => {
      expect(StatService.calculateAC(10, 2)).toBe(12);
      expect(StatService.calculateAC(14, 3)).toBe(15); // 10 + 2 DEX + 3 CON
    });

    it("should handle negative equipment bonus", () => {
      expect(StatService.calculateAC(10, -2)).toBe(8);
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
});
