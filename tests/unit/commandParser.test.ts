import { describe, expect, it } from "vitest";
import * as CommandParser from "../../src/services/CommandParser.js";

describe("CommandParser", () => {
  describe("tokenize", () => {
    it("should lowercase and split input", () => {
      const tokens = CommandParser.tokenize("GO North");
      expect(tokens).toEqual(["go", "north"]);
    });

    it("should strip articles", () => {
      const tokens = CommandParser.tokenize("get the sword");
      expect(tokens).toEqual(["get", "sword"]);
    });

    it("should strip multiple articles", () => {
      const tokens = CommandParser.tokenize("put a sword in the chest");
      expect(tokens).toEqual(["put", "sword", "in", "chest"]);
    });

    it("should handle extra whitespace", () => {
      const tokens = CommandParser.tokenize("  go   north  ");
      expect(tokens).toEqual(["go", "north"]);
    });

    it("should return empty array for empty input", () => {
      const tokens = CommandParser.tokenize("");
      expect(tokens).toEqual([]);
    });
  });

  describe("extractQuantity", () => {
    it("should extract numeric quantity", () => {
      const result = CommandParser.extractQuantity(["get", "3", "coins"]);
      expect(result.quantity).toBe(3);
      expect(result.tokens).toEqual(["get", "coins"]);
    });

    it("should extract 'all' quantity", () => {
      const result = CommandParser.extractQuantity(["get", "all", "coins"]);
      expect(result.quantity).toBe("all");
      expect(result.tokens).toEqual(["get", "coins"]);
    });

    it("should return undefined for no quantity", () => {
      const result = CommandParser.extractQuantity(["get", "sword"]);
      expect(result.quantity).toBeUndefined();
      expect(result.tokens).toEqual(["get", "sword"]);
    });
  });

  describe("parse - movement", () => {
    it("should parse direct direction", () => {
      const cmd = CommandParser.parse("north");
      expect(cmd.type).toBe("movement");
      expect(cmd.action).toBe("move");
      expect(cmd.target).toBe("north");
    });

    it("should parse direction alias", () => {
      const cmd = CommandParser.parse("n");
      expect(cmd.type).toBe("movement");
      expect(cmd.action).toBe("move");
      expect(cmd.target).toBe("north");
    });

    it("should parse movement verb + direction", () => {
      const cmd = CommandParser.parse("go north");
      expect(cmd.type).toBe("movement");
      expect(cmd.action).toBe("move");
      expect(cmd.target).toBe("north");
    });

    it("should parse walk + direction alias", () => {
      const cmd = CommandParser.parse("walk e");
      expect(cmd.type).toBe("movement");
      expect(cmd.action).toBe("move");
      expect(cmd.target).toBe("east");
    });

    it("should handle movement verb without direction", () => {
      const cmd = CommandParser.parse("go");
      expect(cmd.type).toBe("movement");
      expect(cmd.action).toBe("move");
      expect(cmd.target).toBeUndefined();
    });
  });

  describe("parse - chat", () => {
    it("should parse say command", () => {
      const cmd = CommandParser.parse("say hello everyone");
      expect(cmd.type).toBe("chat");
      expect(cmd.action).toBe("speak");
      expect(cmd.target).toBe("hello everyone");
    });

    it("should parse shout command", () => {
      const cmd = CommandParser.parse("shout help");
      expect(cmd.type).toBe("chat");
      expect(cmd.action).toBe("shout");
      expect(cmd.target).toBe("help");
    });

    it("should parse whisper with target and message", () => {
      const cmd = CommandParser.parse("whisper bob hello there");
      expect(cmd.type).toBe("chat");
      expect(cmd.action).toBe("whisper");
      expect(cmd.target).toBe("bob");
      expect(cmd.args).toEqual(["hello", "there"]);
    });

    it("should parse emote command", () => {
      const cmd = CommandParser.parse("emote waves");
      expect(cmd.type).toBe("chat");
      expect(cmd.action).toBe("emote");
      expect(cmd.target).toBe("waves");
    });
  });

  describe("parse - items", () => {
    it("should parse get command", () => {
      const cmd = CommandParser.parse("get sword");
      expect(cmd.type).toBe("item");
      expect(cmd.action).toBe("get");
      expect(cmd.target).toBe("sword");
    });

    it("should parse take as get", () => {
      const cmd = CommandParser.parse("take the sword");
      expect(cmd.type).toBe("item");
      expect(cmd.action).toBe("get");
      expect(cmd.target).toBe("sword");
    });

    it("should parse get with quantity", () => {
      const cmd = CommandParser.parse("get 3 coins");
      expect(cmd.type).toBe("item");
      expect(cmd.action).toBe("get");
      expect(cmd.target).toBe("coins");
      expect(cmd.args).toEqual(["3"]);
    });

    it("should parse get all", () => {
      const cmd = CommandParser.parse("get all coins");
      expect(cmd.type).toBe("item");
      expect(cmd.action).toBe("get");
      expect(cmd.target).toBe("coins");
      expect(cmd.args).toEqual(["all"]);
    });

    it("should parse drop command", () => {
      const cmd = CommandParser.parse("drop sword");
      expect(cmd.type).toBe("item");
      expect(cmd.action).toBe("drop");
      expect(cmd.target).toBe("sword");
    });

    it("should parse examine command", () => {
      const cmd = CommandParser.parse("examine sword");
      expect(cmd.type).toBe("item");
      expect(cmd.action).toBe("examine");
      expect(cmd.target).toBe("sword");
    });

    it("should parse look at as examine", () => {
      const cmd = CommandParser.parse("look at the sword");
      expect(cmd.type).toBe("item");
      expect(cmd.action).toBe("examine");
      expect(cmd.target).toBe("sword");
    });

    it("should parse inventory command", () => {
      const cmd = CommandParser.parse("inventory");
      expect(cmd.type).toBe("item");
      expect(cmd.action).toBe("inventory");
    });

    it("should parse i as inventory", () => {
      const cmd = CommandParser.parse("i");
      expect(cmd.type).toBe("item");
      expect(cmd.action).toBe("inventory");
    });

    it("should handle multi-word targets", () => {
      const cmd = CommandParser.parse("get rusty sword");
      expect(cmd.type).toBe("item");
      expect(cmd.action).toBe("get");
      expect(cmd.target).toBe("rusty sword");
    });
  });

  describe("parse - combat", () => {
    it("should parse attack command", () => {
      const cmd = CommandParser.parse("attack goblin");
      expect(cmd.type).toBe("combat");
      expect(cmd.action).toBe("attack");
      expect(cmd.target).toBe("goblin");
    });

    it("should parse fight as attack", () => {
      const cmd = CommandParser.parse("fight the goblin");
      expect(cmd.type).toBe("combat");
      expect(cmd.action).toBe("attack");
      expect(cmd.target).toBe("goblin");
    });

    it("should parse kill as attack", () => {
      const cmd = CommandParser.parse("kill giant spider");
      expect(cmd.type).toBe("combat");
      expect(cmd.action).toBe("attack");
      expect(cmd.target).toBe("giant spider");
    });
  });

  describe("parse - info", () => {
    it("should parse look without target as room look", () => {
      const cmd = CommandParser.parse("look");
      expect(cmd.type).toBe("info");
      expect(cmd.action).toBe("look");
    });

    it("should parse l as look", () => {
      const cmd = CommandParser.parse("l");
      expect(cmd.type).toBe("info");
      expect(cmd.action).toBe("look");
    });

    it("should parse look with target as examine", () => {
      const cmd = CommandParser.parse("look sword");
      expect(cmd.type).toBe("item");
      expect(cmd.action).toBe("examine");
      expect(cmd.target).toBe("sword");
    });

    it("should parse stats command", () => {
      const cmd = CommandParser.parse("stats");
      expect(cmd.type).toBe("info");
      expect(cmd.action).toBe("stats");
    });

    it("should parse help command", () => {
      const cmd = CommandParser.parse("help");
      expect(cmd.type).toBe("info");
      expect(cmd.action).toBe("help");
    });

    it("should parse help with topic", () => {
      const cmd = CommandParser.parse("help combat");
      expect(cmd.type).toBe("info");
      expect(cmd.action).toBe("help");
      expect(cmd.target).toBe("combat");
    });
  });

  describe("parse - unknown", () => {
    it("should return unknown for unrecognized command", () => {
      const cmd = CommandParser.parse("dance");
      expect(cmd.type).toBe("unknown");
      expect(cmd.action).toBe("dance");
    });

    it("should suggest similar command", () => {
      const cmd = CommandParser.parse("nort");
      expect(cmd.type).toBe("unknown");
      expect(cmd.args).toContain("north");
    });

    it("should return unknown for empty input", () => {
      const cmd = CommandParser.parse("");
      expect(cmd.type).toBe("unknown");
    });
  });

  describe("case insensitivity", () => {
    it("should handle uppercase commands", () => {
      const cmd = CommandParser.parse("NORTH");
      expect(cmd.type).toBe("movement");
      expect(cmd.target).toBe("north");
    });

    it("should handle mixed case", () => {
      const cmd = CommandParser.parse("Go NoRtH");
      expect(cmd.type).toBe("movement");
      expect(cmd.target).toBe("north");
    });
  });
});
