import { describe, expect, it } from "vitest";
import {
  babToLevel,
  parsePrerequisites,
  scaleLevel,
} from "../../src/services/feats/prerequisiteParser.js";

describe("Prerequisite Parser", () => {
  describe("parsePrerequisites", () => {
    const knownFeats = new Set(["Dodge", "Power Attack", "Combat Expertise"]);

    describe("stat parsing", () => {
      it("should parse single stat requirement", () => {
        const result = parsePrerequisites("Dex 13", knownFeats);

        expect(result.prerequisites).toHaveLength(1);
        expect(result.prerequisites[0]).toEqual({
          type: "stat",
          key: "dex",
          value: 13,
        });
        expect(result.supportability).toBe("supported");
      });

      it("should parse multiple stat requirements", () => {
        const result = parsePrerequisites("Str 15, Int 13", knownFeats);

        expect(result.prerequisites).toHaveLength(2);
        expect(result.prerequisites[0]).toEqual({
          type: "stat",
          key: "str",
          value: 15,
        });
        expect(result.prerequisites[1]).toEqual({
          type: "stat",
          key: "int",
          value: 13,
        });
        expect(result.supportability).toBe("supported");
      });

      it("should parse all stat types case-insensitively", () => {
        const stats = ["Str", "DEX", "con", "INT", "Wis", "CHA"];
        for (const stat of stats) {
          const result = parsePrerequisites(`${stat} 10`, knownFeats);
          expect(result.prerequisites[0].type).toBe("stat");
          expect(result.prerequisites[0].key).toBe(stat.toLowerCase());
        }
      });
    });

    describe("level parsing", () => {
      it("should parse simple level requirement", () => {
        const result = parsePrerequisites("level 5", knownFeats);

        expect(result.prerequisites).toHaveLength(1);
        expect(result.prerequisites[0]).toEqual({
          type: "level",
          key: null,
          value: 5,
        });
        expect(result.supportability).toBe("supported");
      });

      it("should parse 'character level' format", () => {
        const result = parsePrerequisites("character level 10", knownFeats);

        expect(result.prerequisites).toHaveLength(1);
        expect(result.prerequisites[0]).toEqual({
          type: "level",
          key: null,
          value: 10,
        });
        expect(result.supportability).toBe("supported");
      });
    });

    describe("BAB parsing", () => {
      it("should parse base attack bonus requirement", () => {
        const result = parsePrerequisites("base attack bonus +1", knownFeats);

        expect(result.prerequisites).toHaveLength(1);
        expect(result.prerequisites[0]).toEqual({
          type: "bab",
          key: null,
          value: 1,
        });
        expect(result.supportability).toBe("supported");
      });

      it("should parse higher BAB values", () => {
        const result = parsePrerequisites("base attack bonus +6", knownFeats);

        expect(result.prerequisites[0]).toEqual({
          type: "bab",
          key: null,
          value: 6,
        });
      });
    });

    describe("feat matching", () => {
      it("should match known feat names", () => {
        const result = parsePrerequisites("Dodge", knownFeats);

        expect(result.prerequisites).toHaveLength(1);
        expect(result.prerequisites[0]).toEqual({
          type: "feat",
          key: "Dodge",
          value: null,
        });
        expect(result.supportability).toBe("supported");
      });

      it("should match feat names case-insensitively", () => {
        const result = parsePrerequisites("dodge", knownFeats);

        expect(result.prerequisites[0]).toEqual({
          type: "feat",
          key: "Dodge",
          value: null,
        });
      });

      it("should match multiple feat prerequisites", () => {
        const result = parsePrerequisites("Dodge, Power Attack", knownFeats);

        expect(result.prerequisites).toHaveLength(2);
        expect(result.prerequisites[0].type).toBe("feat");
        expect(result.prerequisites[1].type).toBe("feat");
      });
    });

    describe("unsupported prerequisites", () => {
      it("should mark unknown text as unsupported", () => {
        const result = parsePrerequisites("ability to cast spells", knownFeats);

        expect(result.prerequisites).toHaveLength(1);
        expect(result.prerequisites[0]).toEqual({
          type: "unsupported",
          key: "ability to cast spells",
          value: null,
        });
        expect(result.supportability).toBe("unsupported");
      });

      it("should return partially_supported for mixed prerequisites", () => {
        const result = parsePrerequisites(
          "Dex 13, ability to cast spells",
          knownFeats,
        );

        expect(result.prerequisites).toHaveLength(2);
        expect(result.prerequisites[0].type).toBe("stat");
        expect(result.prerequisites[1].type).toBe("unsupported");
        expect(result.supportability).toBe("partially_supported");
      });
    });

    describe("empty and special cases", () => {
      it("should handle empty string", () => {
        const result = parsePrerequisites("", knownFeats);

        expect(result.prerequisites).toHaveLength(0);
        expect(result.supportability).toBe("supported");
      });

      it("should handle em dash (—) as no prerequisites", () => {
        const result = parsePrerequisites("—", knownFeats);

        expect(result.prerequisites).toHaveLength(0);
        expect(result.supportability).toBe("supported");
      });

      it("should handle 'none' as no prerequisites", () => {
        const result = parsePrerequisites("none", knownFeats);

        expect(result.prerequisites).toHaveLength(0);
        expect(result.supportability).toBe("supported");
      });

      it("should handle whitespace-only string", () => {
        const result = parsePrerequisites("   ", knownFeats);

        expect(result.prerequisites).toHaveLength(0);
        expect(result.supportability).toBe("supported");
      });
    });

    describe("complex prerequisites", () => {
      it("should parse mixed stat and feat requirements", () => {
        const result = parsePrerequisites("Dex 13, Dodge", knownFeats);

        expect(result.prerequisites).toHaveLength(2);
        expect(result.prerequisites[0].type).toBe("stat");
        expect(result.prerequisites[1].type).toBe("feat");
        expect(result.supportability).toBe("supported");
      });

      it("should handle semicolon separators", () => {
        const result = parsePrerequisites("Str 13; Dex 13", knownFeats);

        expect(result.prerequisites).toHaveLength(2);
      });

      it("should handle 'or' separators", () => {
        const result = parsePrerequisites("Str 13 or Dex 13", knownFeats);

        expect(result.prerequisites).toHaveLength(2);
      });
    });
  });

  describe("scaleLevel", () => {
    it("should return 1 for PF level 1", () => {
      expect(scaleLevel(1)).toBe(1);
    });

    it("should return 8 for PF level 5", () => {
      expect(scaleLevel(5)).toBe(8);
    });

    it("should return 20 for PF level 10", () => {
      expect(scaleLevel(10)).toBe(20);
    });

    it("should return 38 for PF level 15", () => {
      expect(scaleLevel(15)).toBe(38);
    });

    it("should return 60 for PF level 20", () => {
      expect(scaleLevel(20)).toBe(60);
    });
  });

  describe("babToLevel", () => {
    it("should return 0 for BAB 0", () => {
      expect(babToLevel(0)).toBe(0);
    });

    it("should return 3 for BAB +1", () => {
      expect(babToLevel(1)).toBe(3);
    });

    it("should return 6 for BAB +2", () => {
      expect(babToLevel(2)).toBe(6);
    });

    it("should return 9 for BAB +3", () => {
      expect(babToLevel(3)).toBe(9);
    });
  });
});
