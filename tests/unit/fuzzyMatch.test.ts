/**
 * Tests for fuzzyMatch utility
 */

import { describe, expect, it } from "vitest";
import { fuzzyFindFirst, fuzzyMatch } from "../../src/utils/fuzzyMatch.js";

describe("fuzzyMatch", () => {
  describe("exact matching", () => {
    it("should match exact singular name", () => {
      const result = fuzzyMatch("rusty sword", "rusty sword");
      expect(result.matches).toBe(true);
      expect(result.matchedPlural).toBe(false);
    });

    it("should match exact plural name", () => {
      const result = fuzzyMatch("gold coins", "gold coin", "gold coins");
      expect(result.matches).toBe(true);
      expect(result.matchedPlural).toBe(true);
    });

    it("should be case insensitive", () => {
      const result = fuzzyMatch("RUSTY SWORD", "rusty sword");
      expect(result.matches).toBe(true);
    });
  });

  describe("prefix matching", () => {
    it("should match prefix of singular name", () => {
      const result = fuzzyMatch("rust", "rusty sword");
      expect(result.matches).toBe(true);
      expect(result.matchedPlural).toBe(false);
    });

    it("should match prefix of plural name", () => {
      const result = fuzzyMatch("gold co", "gold coin", "gold coins");
      expect(result.matches).toBe(true);
      // Matches singular first since both start with "gold co"
      expect(result.matchedPlural).toBe(false);
    });

    it("should prefer singular over plural for prefix match", () => {
      const result = fuzzyMatch("rock", "small rock", "small rocks");
      expect(result.matches).toBe(true);
      expect(result.matchedPlural).toBe(false);
    });
  });

  describe("word matching", () => {
    it("should match word in singular name", () => {
      const result = fuzzyMatch("sword", "rusty sword");
      expect(result.matches).toBe(true);
      expect(result.matchedPlural).toBe(false);
    });

    it("should match word in plural name", () => {
      const result = fuzzyMatch("coins", "gold coin", "gold coins");
      expect(result.matches).toBe(true);
      expect(result.matchedPlural).toBe(true);
    });

    it("should match partial word", () => {
      const result = fuzzyMatch("swo", "rusty sword");
      expect(result.matches).toBe(true);
    });

    it("should match 'coin' to 'gold coin'", () => {
      const result = fuzzyMatch("coin", "gold coin", "gold coins");
      expect(result.matches).toBe(true);
      expect(result.matchedPlural).toBe(false);
    });
  });

  describe("non-matching", () => {
    it("should not match unrelated names", () => {
      const result = fuzzyMatch("apple", "rusty sword");
      expect(result.matches).toBe(false);
    });

    it("should not match partial middle of word", () => {
      const result = fuzzyMatch("wor", "rusty sword");
      expect(result.matches).toBe(false);
    });

    it("should not match empty search term to non-empty name", () => {
      const result = fuzzyMatch("", "rusty sword");
      expect(result.matches).toBe(false);
    });
  });
});

describe("fuzzyFindFirst", () => {
  const candidates = [
    { name: "rusty sword", pluralName: null },
    { name: "gold coin", pluralName: "gold coins" },
    { name: "small rock", pluralName: "small rocks" },
    { name: "healing potion", pluralName: "healing potions" },
  ];

  it("should find exact match", () => {
    const result = fuzzyFindFirst("gold coin", candidates);
    expect(result).not.toBeNull();
    expect(result?.item.name).toBe("gold coin");
    expect(result?.matchedPlural).toBe(false);
  });

  it("should find by word match", () => {
    const result = fuzzyFindFirst("sword", candidates);
    expect(result).not.toBeNull();
    expect(result?.item.name).toBe("rusty sword");
  });

  it("should find by prefix match", () => {
    const result = fuzzyFindFirst("heal", candidates);
    expect(result).not.toBeNull();
    expect(result?.item.name).toBe("healing potion");
  });

  it("should return first match when multiple could match", () => {
    // Both "small rock" and "rusty sword" have 's' words
    const result = fuzzyFindFirst("small", candidates);
    expect(result).not.toBeNull();
    expect(result?.item.name).toBe("small rock");
  });

  it("should return null when no match found", () => {
    const result = fuzzyFindFirst("banana", candidates);
    expect(result).toBeNull();
  });

  it("should indicate when plural was matched", () => {
    const result = fuzzyFindFirst("coins", candidates);
    expect(result).not.toBeNull();
    expect(result?.item.name).toBe("gold coin");
    expect(result?.matchedPlural).toBe(true);
  });
});
