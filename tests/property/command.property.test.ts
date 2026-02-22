import { test } from "@fast-check/vitest";
import { describe, expect } from "vitest";
import * as CommandParser from "../../src/services/CommandParser.js";
import {
  chatAliasesArb,
  combatAliasesArb,
  gibberishArb,
  itemAliasesArb,
  movementAliasesArb,
  validCommandArb,
} from "../generators/command.generator.js";

describe("Command Parser Property Tests", () => {
  /**
   * Feature: mud-game-rebuild, Property 10: Command Alias Equivalence
   * **Validates: Requirements 4.1**
   *
   * For any set of command aliases (e.g., "n", "north", "go north"),
   * the parser SHALL produce equivalent ParsedCommand results.
   */
  describe("Property 10: Command Alias Equivalence", () => {
    test.prop([movementAliasesArb], { numRuns: 20 })(
      "movement aliases should produce equivalent results",
      ({ inputs, direction }) => {
        const results = inputs.map((input) => CommandParser.parse(input));

        // All should be movement type
        for (const result of results) {
          expect(result.type).toBe("movement");
          expect(result.action).toBe("move");
          expect(result.target).toBe(direction);
        }
      },
    );

    test.prop([itemAliasesArb], { numRuns: 20 })(
      "item aliases should produce equivalent results",
      ({ inputs, action, target }) => {
        const results = inputs.map((input) => CommandParser.parse(input));

        // All should be item type with same action and target
        for (const result of results) {
          expect(result.type).toBe("item");
          expect(result.action).toBe(action);
          expect(result.target).toBe(target);
        }
      },
    );

    test.prop([chatAliasesArb], { numRuns: 20 })(
      "chat aliases should produce equivalent results",
      ({ inputs, action, target }) => {
        const results = inputs.map((input) => CommandParser.parse(input));

        // All should be chat type with same action and target
        for (const result of results) {
          expect(result.type).toBe("chat");
          expect(result.action).toBe(action);
          expect(result.target).toBe(target);
        }
      },
    );

    test.prop([combatAliasesArb], { numRuns: 20 })(
      "combat aliases should produce equivalent results",
      ({ inputs, action, target }) => {
        const results = inputs.map((input) => CommandParser.parse(input));

        // All should be combat type with same action and target
        for (const result of results) {
          expect(result.type).toBe("combat");
          expect(result.action).toBe(action);
          expect(result.target).toBe(target);
        }
      },
    );
  });

  /**
   * Feature: mud-game-rebuild, Property 11: Command Recognition
   * **Validates: Requirements 4.2**
   *
   * For any valid command input, the parser SHALL recognize it as a known
   * command type. For any gibberish input, the parser SHALL return "unknown".
   */
  describe("Property 11: Command Recognition", () => {
    test.prop([validCommandArb], { numRuns: 20 })(
      "valid commands should be recognized",
      (input) => {
        const result = CommandParser.parse(input);
        expect(result.type).not.toBe("unknown");
      },
    );

    test.prop([gibberishArb], { numRuns: 20 })(
      "gibberish should return unknown",
      (input) => {
        const result = CommandParser.parse(input);
        expect(result.type).toBe("unknown");
      },
    );
  });
});
