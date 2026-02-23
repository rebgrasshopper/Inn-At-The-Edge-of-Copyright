import * as fc from "fast-check";

// Movement command aliases that should all produce the same result
export const movementAliasesArb = fc.constantFrom(
  {
    inputs: ["north", "n", "go north", "walk north", "move north"],
    direction: "north",
  },
  {
    inputs: ["south", "s", "go south", "walk south", "move south"],
    direction: "south",
  },
  {
    inputs: ["east", "e", "go east", "walk east", "move east"],
    direction: "east",
  },
  {
    inputs: ["west", "w", "go west", "walk west", "move west"],
    direction: "west",
  },
  { inputs: ["up", "u", "go up", "walk up", "move up"], direction: "up" },
  {
    inputs: ["down", "d", "go down", "walk down", "move down"],
    direction: "down",
  },
);

// Item command aliases
export const itemAliasesArb = fc.constantFrom(
  {
    inputs: ["get sword", "take sword", "grab sword"],
    action: "get",
    target: "sword",
  },
  { inputs: ["drop sword"], action: "drop", target: "sword" },
  { inputs: ["put sword", "place sword"], action: "put", target: "sword" },
  {
    inputs: ["examine sword", "inspect sword"],
    action: "examine",
    target: "sword",
  },
  { inputs: ["inventory", "inv", "i"], action: "inventory", target: undefined },
);

// Chat command aliases
export const chatAliasesArb = fc.constantFrom(
  {
    inputs: ["say hello", "speak hello", "talk hello"],
    action: "speak",
    target: "hello",
  },
  { inputs: ["shout help", "yell help"], action: "shout", target: "help" },
);

// Combat command aliases
export const combatAliasesArb = fc.constantFrom({
  inputs: ["attack goblin", "fight goblin", "kill goblin", "hit goblin"],
  action: "attack",
  target: "goblin",
});

// Valid commands that should be recognized
export const validCommandArb = fc.constantFrom(
  "north",
  "n",
  "go north",
  "say hello",
  "shout help",
  "whisper bob hi",
  "get sword",
  "take the sword",
  "drop sword",
  "examine sword",
  "look at sword",
  "inventory",
  "i",
  "attack goblin",
  "fight goblin",
  "look",
  "l",
  "stats",
  "help",
);

// Gibberish that should return unknown
export const gibberishArb = fc
  .string({ minLength: 3, maxLength: 15 })
  .filter((s) => {
    const lower = s.toLowerCase().trim();
    // Filter out anything that starts with a known command
    const knownPrefixes = [
      "north",
      "south",
      "east",
      "west",
      "up",
      "down",
      "n",
      "s",
      "e",
      "w",
      "u",
      "d",
      "go",
      "walk",
      "move",
      "exit",
      "leave",
      "say",
      "speak",
      "talk",
      "shout",
      "yell",
      "whisper",
      "tell",
      "emote",
      "me",
      "get",
      "take",
      "grab",
      "pick",
      "drop",
      "put",
      "examine",
      "inspect",
      "inventory",
      "inv",
      "i",
      "attack",
      "fight",
      "kill",
      "hit",
      "strike",
      "look",
      "l",
      "stats",
      "stat",
      "score",
      "help",
      "?",
    ];
    return !knownPrefixes.some((p) => lower.startsWith(p));
  })
  .map((s) => s.replace(/[^a-zA-Z]/g, "x")); // Ensure alphanumeric
