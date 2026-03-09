/**
 * Item seeder - generates all weapons, armor, and miscellaneous items
 * Data sourced from Pathfinder SRD
 */

import type * as schema from "../schema.js";

type ItemInsert = typeof schema.items.$inferInsert;

/**
 * Returns all weapon item definitions
 */
export function getWeaponsData(): ItemInsert[] {
  return [
    // ============================================
    // SIMPLE WEAPONS - Unarmed
    // ============================================
    {
      id: "item-gauntlet",
      name: "gauntlet",
      pluralName: "gauntlets",
      description:
        "A metal glove that lets you deal lethal damage with unarmed strikes.",
      category: "weapon",
      equipSlots: ["mainHand"],
      weaponDamage: "1d3",
      weaponType: "bludgeoning",
      weaponRange: "melee",
      size: 1,
    },
    // ============================================
    // SIMPLE WEAPONS - Light Melee
    // ============================================
    {
      id: "item-dagger",
      name: "dagger",
      pluralName: "daggers",
      description:
        "A small, easily concealed blade useful for both combat and utility. Can be thrown.",
      category: "weapon",
      equipSlots: ["mainHand", "offHand"],
      weaponDamage: "1d4",
      weaponType: "piercing",
      weaponRange: "melee",
      size: 1,
    },
    {
      id: "item-punching-dagger",
      name: "punching dagger",
      pluralName: "punching daggers",
      description:
        "A blade designed to be gripped in the fist with the blade protruding between the fingers.",
      category: "weapon",
      equipSlots: ["mainHand", "offHand"],
      weaponDamage: "1d4",
      weaponType: "piercing",
      weaponRange: "melee",
      size: 1,
    },
    {
      id: "item-spiked-gauntlet",
      name: "spiked gauntlet",
      pluralName: "spiked gauntlets",
      description: "A gauntlet fitted with metal spikes for punching attacks.",
      category: "weapon",
      equipSlots: ["mainHand"],
      weaponDamage: "1d4",
      weaponType: "piercing",
      weaponRange: "melee",
      size: 1,
    },
    {
      id: "item-light-mace",
      name: "light mace",
      pluralName: "light maces",
      description:
        "A short-handled mace with a weighted head, easy to wield in one hand.",
      category: "weapon",
      equipSlots: ["mainHand", "offHand"],
      weaponDamage: "1d6",
      weaponType: "bludgeoning",
      weaponRange: "melee",
      size: 1,
    },
    {
      id: "item-sickle",
      name: "sickle",
      pluralName: "sickles",
      description:
        "A curved blade on a short handle, originally a farming tool but effective in combat.",
      category: "weapon",
      equipSlots: ["mainHand", "offHand"],
      weaponDamage: "1d6",
      weaponType: "slashing",
      weaponRange: "melee",
      size: 1,
    },
    // ============================================
    // SIMPLE WEAPONS - One-Handed Melee
    // ============================================
    {
      id: "item-club",
      name: "club",
      pluralName: "clubs",
      description:
        "A simple wooden club, the most basic of weapons. Can be thrown.",
      category: "weapon",
      equipSlots: ["mainHand", "offHand"],
      weaponDamage: "1d6",
      weaponType: "bludgeoning",
      weaponRange: "melee",
      size: 2,
    },
    {
      id: "item-heavy-mace",
      name: "heavy mace",
      pluralName: "heavy maces",
      description:
        "A sturdy mace with a heavy flanged head designed to crush armor.",
      category: "weapon",
      equipSlots: ["mainHand"],
      weaponDamage: "1d8",
      weaponType: "bludgeoning",
      weaponRange: "melee",
      size: 2,
    },
    {
      id: "item-morningstar",
      name: "morningstar",
      pluralName: "morningstars",
      description:
        "A spiked metal ball on a wooden handle, combining piercing and bludgeoning damage.",
      category: "weapon",
      equipSlots: ["mainHand"],
      weaponDamage: "1d8",
      weaponType: "bludgeoning",
      weaponRange: "melee",
      size: 2,
    },
    {
      id: "item-shortspear",
      name: "shortspear",
      pluralName: "shortspears",
      description: "A short spear suitable for one-handed use or throwing.",
      category: "weapon",
      equipSlots: ["mainHand", "offHand"],
      weaponDamage: "1d6",
      weaponType: "piercing",
      weaponRange: "melee",
      size: 2,
    },
    // ============================================
    // SIMPLE WEAPONS - Two-Handed Melee
    // ============================================
    {
      id: "item-longspear",
      name: "longspear",
      pluralName: "longspears",
      description:
        "A long spear with reach, allowing attacks against foes 10 feet away.",
      category: "weapon",
      equipSlots: ["mainHand"],
      weaponDamage: "1d8",
      weaponType: "piercing",
      weaponRange: "melee",
      size: 3,
    },
    {
      id: "item-quarterstaff",
      name: "quarterstaff",
      pluralName: "quarterstaves",
      description:
        "A simple wooden staff, versatile and effective in trained hands.",
      category: "weapon",
      equipSlots: ["mainHand"],
      weaponDamage: "1d6",
      weaponType: "bludgeoning",
      weaponRange: "melee",
      size: 3,
    },
    {
      id: "item-spear",
      name: "spear",
      pluralName: "spears",
      description: "A versatile polearm that can be used two-handed or thrown.",
      category: "weapon",
      equipSlots: ["mainHand"],
      weaponDamage: "1d8",
      weaponType: "piercing",
      weaponRange: "melee",
      size: 3,
    },
    // ============================================
    // SIMPLE WEAPONS - Ranged
    // ============================================
    {
      id: "item-heavy-crossbow",
      name: "heavy crossbow",
      pluralName: "heavy crossbows",
      description:
        "A powerful crossbow that requires a winch to reload but deals significant damage.",
      category: "weapon",
      equipSlots: ["mainHand"],
      weaponDamage: "1d10",
      weaponType: "piercing",
      weaponRange: "ranged",
      size: 2,
    },
    {
      id: "item-light-crossbow",
      name: "light crossbow",
      pluralName: "light crossbows",
      description:
        "A crossbow that can be reloaded with a lever, balancing power and speed.",
      category: "weapon",
      equipSlots: ["mainHand"],
      weaponDamage: "1d8",
      weaponType: "piercing",
      weaponRange: "ranged",
      size: 2,
    },
    {
      id: "item-dart",
      name: "dart",
      pluralName: "darts",
      description: "A small thrown weapon with a weighted tip.",
      category: "weapon",
      equipSlots: ["mainHand"],
      weaponDamage: "1d4",
      weaponType: "piercing",
      weaponRange: "ranged",
      isBulk: true,
      size: 0,
    },
    {
      id: "item-javelin",
      name: "javelin",
      pluralName: "javelins",
      description: "A light spear designed for throwing.",
      category: "weapon",
      equipSlots: ["mainHand"],
      weaponDamage: "1d6",
      weaponType: "piercing",
      weaponRange: "ranged",
      size: 2,
    },
    {
      id: "item-sling",
      name: "sling",
      pluralName: "slings",
      description:
        "A simple weapon that hurls stones or bullets with surprising force.",
      category: "weapon",
      equipSlots: ["mainHand"],
      weaponDamage: "1d4",
      weaponType: "bludgeoning",
      weaponRange: "ranged",
      size: 0,
    },

    // ============================================
    // MARTIAL WEAPONS - Light Melee
    // ============================================
    {
      id: "item-throwing-axe",
      name: "throwing axe",
      pluralName: "throwing axes",
      description: "A small axe balanced for throwing.",
      category: "weapon",
      equipSlots: ["mainHand", "offHand"],
      weaponDamage: "1d6",
      weaponType: "slashing",
      weaponRange: "melee",
      size: 1,
    },
    {
      id: "item-light-hammer",
      name: "light hammer",
      pluralName: "light hammers",
      description: "A small hammer that can be thrown or used in melee.",
      category: "weapon",
      equipSlots: ["mainHand", "offHand"],
      weaponDamage: "1d4",
      weaponType: "bludgeoning",
      weaponRange: "melee",
      size: 1,
    },
    {
      id: "item-handaxe",
      name: "handaxe",
      pluralName: "handaxes",
      description: "A small axe designed for one-handed use.",
      category: "weapon",
      equipSlots: ["mainHand", "offHand"],
      weaponDamage: "1d6",
      weaponType: "slashing",
      weaponRange: "melee",
      size: 1,
    },
    {
      id: "item-kukri",
      name: "kukri",
      pluralName: "kukris",
      description:
        "A curved blade with a wide cutting edge, favored for its vicious critical hits.",
      category: "weapon",
      equipSlots: ["mainHand", "offHand"],
      weaponDamage: "1d4",
      weaponType: "slashing",
      weaponRange: "melee",
      size: 1,
    },
    {
      id: "item-light-pick",
      name: "light pick",
      pluralName: "light picks",
      description: "A small pick designed to punch through armor.",
      category: "weapon",
      equipSlots: ["mainHand", "offHand"],
      weaponDamage: "1d4",
      weaponType: "piercing",
      weaponRange: "melee",
      size: 1,
    },
    {
      id: "item-sap",
      name: "sap",
      pluralName: "saps",
      description:
        "A leather-wrapped club filled with sand, designed to knock out rather than kill.",
      category: "weapon",
      equipSlots: ["mainHand", "offHand"],
      weaponDamage: "1d6",
      weaponType: "bludgeoning",
      weaponRange: "melee",
      size: 1,
    },
    {
      id: "item-short-sword",
      name: "short sword",
      pluralName: "short swords",
      description: "A light, quick blade favored by rogues and dual-wielders.",
      category: "weapon",
      equipSlots: ["mainHand", "offHand"],
      weaponDamage: "1d6",
      weaponType: "piercing",
      weaponRange: "melee",
      size: 1,
    },
    // ============================================
    // MARTIAL WEAPONS - One-Handed Melee
    // ============================================
    {
      id: "item-battleaxe",
      name: "battleaxe",
      pluralName: "battleaxes",
      description: "A heavy single-bladed axe designed for combat.",
      category: "weapon",
      equipSlots: ["mainHand"],
      weaponDamage: "1d8",
      weaponType: "slashing",
      weaponRange: "melee",
      size: 2,
    },
    {
      id: "item-flail",
      name: "flail",
      pluralName: "flails",
      description:
        "A spiked ball on a chain attached to a handle, difficult to block.",
      category: "weapon",
      equipSlots: ["mainHand"],
      weaponDamage: "1d8",
      weaponType: "bludgeoning",
      weaponRange: "melee",
      size: 2,
    },
    {
      id: "item-longsword",
      name: "longsword",
      pluralName: "longswords",
      description:
        "The quintessential knight's weapon, balanced for both cutting and thrusting.",
      category: "weapon",
      equipSlots: ["mainHand"],
      weaponDamage: "1d8",
      weaponType: "slashing",
      weaponRange: "melee",
      size: 2,
    },
    {
      id: "item-heavy-pick",
      name: "heavy pick",
      pluralName: "heavy picks",
      description:
        "A military pick designed to penetrate heavy armor with devastating effect.",
      category: "weapon",
      equipSlots: ["mainHand"],
      weaponDamage: "1d6",
      weaponType: "piercing",
      weaponRange: "melee",
      size: 2,
    },
    {
      id: "item-rapier",
      name: "rapier",
      pluralName: "rapiers",
      description:
        "A slender, sharply pointed sword optimized for thrusting attacks.",
      category: "weapon",
      equipSlots: ["mainHand"],
      weaponDamage: "1d6",
      weaponType: "piercing",
      weaponRange: "melee",
      size: 2,
    },
    {
      id: "item-scimitar",
      name: "scimitar",
      pluralName: "scimitars",
      description:
        "A curved sword with a single sharp edge, excellent for slashing.",
      category: "weapon",
      equipSlots: ["mainHand"],
      weaponDamage: "1d6",
      weaponType: "slashing",
      weaponRange: "melee",
      size: 2,
    },
    {
      id: "item-trident",
      name: "trident",
      pluralName: "tridents",
      description: "A three-pronged spear that can be thrown or used in melee.",
      category: "weapon",
      equipSlots: ["mainHand"],
      weaponDamage: "1d8",
      weaponType: "piercing",
      weaponRange: "melee",
      size: 2,
    },
    {
      id: "item-warhammer",
      name: "warhammer",
      pluralName: "warhammers",
      description:
        "A hammer designed for war, capable of crushing armor and bone.",
      category: "weapon",
      equipSlots: ["mainHand"],
      weaponDamage: "1d8",
      weaponType: "bludgeoning",
      weaponRange: "melee",
      size: 2,
    },
    // ============================================
    // MARTIAL WEAPONS - Two-Handed Melee
    // ============================================
    {
      id: "item-falchion",
      name: "falchion",
      pluralName: "falchions",
      description:
        "A heavy, curved sword with a single edge, devastating on critical hits.",
      category: "weapon",
      equipSlots: ["mainHand"],
      weaponDamage: "2d4",
      weaponType: "slashing",
      weaponRange: "melee",
      size: 3,
    },
    {
      id: "item-glaive",
      name: "glaive",
      pluralName: "glaives",
      description:
        "A polearm with a single-edged blade, offering reach in combat.",
      category: "weapon",
      equipSlots: ["mainHand"],
      weaponDamage: "1d10",
      weaponType: "slashing",
      weaponRange: "melee",
      size: 3,
    },
    {
      id: "item-greataxe",
      name: "greataxe",
      pluralName: "greataxes",
      description: "A massive double-headed axe that deals tremendous damage.",
      category: "weapon",
      equipSlots: ["mainHand"],
      weaponDamage: "1d12",
      weaponType: "slashing",
      weaponRange: "melee",
      size: 3,
    },
    {
      id: "item-greatclub",
      name: "greatclub",
      pluralName: "greatclubs",
      description: "An enormous wooden club, simple but brutally effective.",
      category: "weapon",
      equipSlots: ["mainHand"],
      weaponDamage: "1d10",
      weaponType: "bludgeoning",
      weaponRange: "melee",
      size: 3,
    },
    {
      id: "item-heavy-flail",
      name: "heavy flail",
      pluralName: "heavy flails",
      description:
        "A two-handed flail with a larger spiked head for maximum impact.",
      category: "weapon",
      equipSlots: ["mainHand"],
      weaponDamage: "1d10",
      weaponType: "bludgeoning",
      weaponRange: "melee",
      size: 3,
    },
    {
      id: "item-greatsword",
      name: "greatsword",
      pluralName: "greatswords",
      description:
        "A massive two-handed sword, the weapon of choice for powerful warriors.",
      category: "weapon",
      equipSlots: ["mainHand"],
      weaponDamage: "2d6",
      weaponType: "slashing",
      weaponRange: "melee",
      size: 3,
    },
    {
      id: "item-guisarme",
      name: "guisarme",
      pluralName: "guisarmes",
      description:
        "A polearm with a curved blade, useful for tripping opponents.",
      category: "weapon",
      equipSlots: ["mainHand"],
      weaponDamage: "2d4",
      weaponType: "slashing",
      weaponRange: "melee",
      size: 3,
    },
    {
      id: "item-halberd",
      name: "halberd",
      pluralName: "halberds",
      description:
        "A versatile polearm combining an axe blade, spike, and hook.",
      category: "weapon",
      equipSlots: ["mainHand"],
      weaponDamage: "1d10",
      weaponType: "slashing",
      weaponRange: "melee",
      size: 3,
    },
    {
      id: "item-lance",
      name: "lance",
      pluralName: "lances",
      description:
        "A long spear designed for mounted combat, devastating on a charge.",
      category: "weapon",
      equipSlots: ["mainHand"],
      weaponDamage: "1d8",
      weaponType: "piercing",
      weaponRange: "melee",
      size: 3,
    },
    {
      id: "item-ranseur",
      name: "ranseur",
      pluralName: "ranseurs",
      description:
        "A polearm with a spear point flanked by curved blades for disarming.",
      category: "weapon",
      equipSlots: ["mainHand"],
      weaponDamage: "2d4",
      weaponType: "piercing",
      weaponRange: "melee",
      size: 3,
    },
    {
      id: "item-scythe",
      name: "scythe",
      pluralName: "scythes",
      description:
        "A farming tool converted to a weapon, with a wickedly sharp curved blade.",
      category: "weapon",
      equipSlots: ["mainHand"],
      weaponDamage: "2d4",
      weaponType: "slashing",
      weaponRange: "melee",
      size: 3,
    },

    // ============================================
    // MARTIAL WEAPONS - Ranged
    // ============================================
    {
      id: "item-longbow",
      name: "longbow",
      pluralName: "longbows",
      description:
        "A tall bow that requires strength to draw but has excellent range.",
      category: "weapon",
      equipSlots: ["mainHand"],
      weaponDamage: "1d8",
      weaponType: "piercing",
      weaponRange: "ranged",
      size: 3,
    },
    {
      id: "item-composite-longbow",
      name: "composite longbow",
      pluralName: "composite longbows",
      description:
        "A longbow made of layered materials, allowing strength to add to damage.",
      category: "weapon",
      equipSlots: ["mainHand"],
      weaponDamage: "1d8",
      weaponType: "piercing",
      weaponRange: "ranged",
      size: 3,
    },
    {
      id: "item-shortbow",
      name: "shortbow",
      pluralName: "shortbows",
      description:
        "A compact bow suitable for use on horseback or in tight spaces.",
      category: "weapon",
      equipSlots: ["mainHand"],
      weaponDamage: "1d6",
      weaponType: "piercing",
      weaponRange: "ranged",
      size: 2,
    },
    {
      id: "item-composite-shortbow",
      name: "composite shortbow",
      pluralName: "composite shortbows",
      description: "A shortbow made of layered materials for added power.",
      category: "weapon",
      equipSlots: ["mainHand"],
      weaponDamage: "1d6",
      weaponType: "piercing",
      weaponRange: "ranged",
      size: 2,
    },
    // ============================================
    // EXOTIC WEAPONS - Light Melee
    // ============================================
    {
      id: "item-kama",
      name: "kama",
      pluralName: "kamas",
      description:
        "A sickle-like weapon favored by monks, useful for tripping.",
      category: "weapon",
      equipSlots: ["mainHand", "offHand"],
      weaponDamage: "1d6",
      weaponType: "slashing",
      weaponRange: "melee",
      size: 1,
    },
    {
      id: "item-nunchaku",
      name: "nunchaku",
      pluralName: "nunchaku",
      description: "Two wooden sticks connected by a chain, a monk's weapon.",
      category: "weapon",
      equipSlots: ["mainHand", "offHand"],
      weaponDamage: "1d6",
      weaponType: "bludgeoning",
      weaponRange: "melee",
      size: 1,
    },
    {
      id: "item-sai",
      name: "sai",
      pluralName: "sais",
      description:
        "A three-pronged metal weapon excellent for disarming opponents.",
      category: "weapon",
      equipSlots: ["mainHand", "offHand"],
      weaponDamage: "1d4",
      weaponType: "bludgeoning",
      weaponRange: "melee",
      size: 1,
    },
    {
      id: "item-siangham",
      name: "siangham",
      pluralName: "sianghams",
      description:
        "A shaft of metal with a pointed tip, a monk's piercing weapon.",
      category: "weapon",
      equipSlots: ["mainHand", "offHand"],
      weaponDamage: "1d6",
      weaponType: "piercing",
      weaponRange: "melee",
      size: 1,
    },
    // ============================================
    // EXOTIC WEAPONS - One-Handed Melee
    // ============================================
    {
      id: "item-bastard-sword",
      name: "bastard sword",
      pluralName: "bastard swords",
      description:
        "A versatile sword that can be wielded one or two-handed with training.",
      category: "weapon",
      equipSlots: ["mainHand"],
      weaponDamage: "1d10",
      weaponType: "slashing",
      weaponRange: "melee",
      size: 2,
    },
    {
      id: "item-dwarven-waraxe",
      name: "dwarven waraxe",
      pluralName: "dwarven waraxes",
      description:
        "A heavy axe designed by dwarven smiths, deadly in trained hands.",
      category: "weapon",
      equipSlots: ["mainHand"],
      weaponDamage: "1d10",
      weaponType: "slashing",
      weaponRange: "melee",
      size: 2,
    },
    {
      id: "item-whip",
      name: "whip",
      pluralName: "whips",
      description: "A leather whip with reach, dealing nonlethal damage.",
      category: "weapon",
      equipSlots: ["mainHand"],
      weaponDamage: "1d3",
      weaponType: "slashing",
      weaponRange: "melee",
      size: 1,
    },
    // ============================================
    // EXOTIC WEAPONS - Two-Handed Melee
    // ============================================
    {
      id: "item-orc-double-axe",
      name: "orc double axe",
      pluralName: "orc double axes",
      description: "A double-headed axe that can strike with both ends.",
      category: "weapon",
      equipSlots: ["mainHand"],
      weaponDamage: "1d8",
      weaponType: "slashing",
      weaponRange: "melee",
      size: 3,
    },
    {
      id: "item-spiked-chain",
      name: "spiked chain",
      pluralName: "spiked chains",
      description:
        "A length of chain with spikes, offering reach and versatility.",
      category: "weapon",
      equipSlots: ["mainHand"],
      weaponDamage: "2d4",
      weaponType: "piercing",
      weaponRange: "melee",
      size: 3,
    },
    {
      id: "item-dire-flail",
      name: "dire flail",
      pluralName: "dire flails",
      description: "A double flail with spiked heads on both ends.",
      category: "weapon",
      equipSlots: ["mainHand"],
      weaponDamage: "1d8",
      weaponType: "bludgeoning",
      weaponRange: "melee",
      size: 3,
    },
    {
      id: "item-gnome-hooked-hammer",
      name: "gnome hooked hammer",
      pluralName: "gnome hooked hammers",
      description:
        "A double weapon with a hammer head and a hook, favored by gnomes.",
      category: "weapon",
      equipSlots: ["mainHand"],
      weaponDamage: "1d8",
      weaponType: "bludgeoning",
      weaponRange: "melee",
      size: 2,
    },
    {
      id: "item-two-bladed-sword",
      name: "two-bladed sword",
      pluralName: "two-bladed swords",
      description: "A sword with blades on both ends, allowing rapid attacks.",
      category: "weapon",
      equipSlots: ["mainHand"],
      weaponDamage: "1d8",
      weaponType: "slashing",
      weaponRange: "melee",
      size: 3,
    },
    {
      id: "item-dwarven-urgrosh",
      name: "dwarven urgrosh",
      pluralName: "dwarven urgroshes",
      description: "A dwarven double weapon with an axe head and spear point.",
      category: "weapon",
      equipSlots: ["mainHand"],
      weaponDamage: "1d8",
      weaponType: "slashing",
      weaponRange: "melee",
      size: 3,
    },
    // ============================================
    // EXOTIC WEAPONS - Ranged
    // ============================================
    {
      id: "item-bolas",
      name: "bolas",
      pluralName: "bolas",
      description: "Weighted balls on cords, thrown to entangle opponents.",
      category: "weapon",
      equipSlots: ["mainHand"],
      weaponDamage: "1d4",
      weaponType: "bludgeoning",
      weaponRange: "ranged",
      size: 1,
    },
    {
      id: "item-hand-crossbow",
      name: "hand crossbow",
      pluralName: "hand crossbows",
      description: "A small crossbow that can be fired with one hand.",
      category: "weapon",
      equipSlots: ["mainHand", "offHand"],
      weaponDamage: "1d4",
      weaponType: "piercing",
      weaponRange: "ranged",
      size: 1,
    },
    {
      id: "item-repeating-heavy-crossbow",
      name: "repeating heavy crossbow",
      pluralName: "repeating heavy crossbows",
      description: "A heavy crossbow with a magazine allowing rapid fire.",
      category: "weapon",
      equipSlots: ["mainHand"],
      weaponDamage: "1d10",
      weaponType: "piercing",
      weaponRange: "ranged",
      size: 3,
    },
    {
      id: "item-repeating-light-crossbow",
      name: "repeating light crossbow",
      pluralName: "repeating light crossbows",
      description: "A light crossbow with a magazine for quick reloading.",
      category: "weapon",
      equipSlots: ["mainHand"],
      weaponDamage: "1d8",
      weaponType: "piercing",
      weaponRange: "ranged",
      size: 2,
    },
    {
      id: "item-net",
      name: "net",
      pluralName: "nets",
      description: "A weighted net thrown to entangle opponents.",
      category: "weapon",
      equipSlots: ["mainHand"],
      weaponDamage: "0",
      weaponType: "bludgeoning",
      weaponRange: "ranged",
      size: 2,
    },
    {
      id: "item-shuriken",
      name: "shuriken",
      pluralName: "shuriken",
      description: "Small thrown blades, treated as ammunition for monks.",
      category: "weapon",
      equipSlots: ["mainHand"],
      weaponDamage: "1d2",
      weaponType: "piercing",
      weaponRange: "ranged",
      isBulk: true,
      size: 0,
    },
  ];
}

/**
 * Returns all armor and shield item definitions
 */
export function getArmorData(): ItemInsert[] {
  return [
    // ============================================
    // LIGHT ARMOR
    // ============================================
    {
      id: "item-padded-armor",
      name: "padded armor",
      pluralName: "padded armor",
      description:
        "Heavy, quilted cloth armor offering minimal protection but maximum mobility.",
      category: "armor",
      equipSlots: ["body"],
      acBonus: 1,
      size: 2,
    },
    {
      id: "item-leather-armor",
      name: "leather armor",
      pluralName: "leather armor",
      description:
        "Armor made of hardened leather, offering decent protection without hindering movement.",
      category: "armor",
      equipSlots: ["body"],
      acBonus: 2,
      size: 2,
    },
    {
      id: "item-studded-leather",
      name: "studded leather",
      pluralName: "studded leather",
      description:
        "Leather armor reinforced with metal studs for added protection.",
      category: "armor",
      equipSlots: ["body"],
      acBonus: 3,
      size: 2,
    },
    {
      id: "item-chain-shirt",
      name: "chain shirt",
      pluralName: "chain shirts",
      description:
        "A shirt of interlocking metal rings, the best light armor available.",
      category: "armor",
      equipSlots: ["body"],
      acBonus: 4,
      size: 2,
    },
    // ============================================
    // MEDIUM ARMOR
    // ============================================
    {
      id: "item-hide-armor",
      name: "hide armor",
      pluralName: "hide armor",
      description:
        "Armor made from the thick hides of beasts, crude but effective.",
      category: "armor",
      equipSlots: ["body"],
      acBonus: 3,
      size: 3,
    },
    {
      id: "item-scale-mail",
      name: "scale mail",
      pluralName: "scale mail",
      description:
        "Armor made of overlapping metal scales sewn to a leather backing.",
      category: "armor",
      equipSlots: ["body"],
      acBonus: 4,
      size: 3,
    },
    {
      id: "item-chainmail",
      name: "chainmail",
      pluralName: "chainmail",
      description:
        "A full suit of interlocking metal rings covering the entire body.",
      category: "armor",
      equipSlots: ["body"],
      acBonus: 5,
      size: 3,
    },
    {
      id: "item-breastplate",
      name: "breastplate",
      pluralName: "breastplates",
      description:
        "A fitted metal torso piece with flexible leather beneath, balancing protection and mobility.",
      category: "armor",
      equipSlots: ["body"],
      acBonus: 5,
      size: 3,
    },
    // ============================================
    // HEAVY ARMOR
    // ============================================
    {
      id: "item-splint-mail",
      name: "splint mail",
      pluralName: "splint mail",
      description:
        "Armor made of vertical metal strips riveted to a leather backing.",
      category: "armor",
      equipSlots: ["body"],
      acBonus: 6,
      size: 3,
    },
    {
      id: "item-banded-mail",
      name: "banded mail",
      pluralName: "banded mail",
      description:
        "Overlapping horizontal metal bands riveted to chain and leather.",
      category: "armor",
      equipSlots: ["body"],
      acBonus: 6,
      size: 3,
    },
    {
      id: "item-half-plate",
      name: "half-plate",
      pluralName: "half-plate",
      description:
        "Plate armor covering vital areas with chain protecting the joints.",
      category: "armor",
      equipSlots: ["body"],
      acBonus: 7,
      size: 3,
    },
    {
      id: "item-full-plate",
      name: "full plate",
      pluralName: "full plate",
      description:
        "A complete suit of articulated metal plates, the pinnacle of armor protection.",
      category: "armor",
      equipSlots: ["body"],
      acBonus: 8,
      size: 3,
    },
    // ============================================
    // SHIELDS
    // ============================================
    {
      id: "item-buckler",
      name: "buckler",
      pluralName: "bucklers",
      description:
        "A small metal shield strapped to the forearm, allowing use of that hand.",
      category: "armor",
      equipSlots: ["offHand"],
      acBonus: 1,
      size: 1,
    },
    {
      id: "item-light-wooden-shield",
      name: "light wooden shield",
      pluralName: "light wooden shields",
      description: "A small wooden shield, light and easy to maneuver.",
      category: "armor",
      equipSlots: ["offHand"],
      acBonus: 1,
      size: 2,
    },
    {
      id: "item-light-steel-shield",
      name: "light steel shield",
      pluralName: "light steel shields",
      description: "A small steel shield offering better protection than wood.",
      category: "armor",
      equipSlots: ["offHand"],
      acBonus: 1,
      size: 2,
    },
    {
      id: "item-heavy-wooden-shield",
      name: "heavy wooden shield",
      pluralName: "heavy wooden shields",
      description: "A large wooden shield providing solid protection.",
      category: "armor",
      equipSlots: ["offHand"],
      acBonus: 2,
      size: 2,
    },
    {
      id: "item-heavy-steel-shield",
      name: "heavy steel shield",
      pluralName: "heavy steel shields",
      description:
        "A large steel shield, the standard for professional soldiers.",
      category: "armor",
      equipSlots: ["offHand"],
      acBonus: 2,
      size: 2,
    },
    {
      id: "item-tower-shield",
      name: "tower shield",
      pluralName: "tower shields",
      description:
        "A massive shield nearly as tall as a person, providing cover but hindering attacks.",
      category: "armor",
      equipSlots: ["offHand"],
      acBonus: 4,
      size: 3,
    },
  ];
}

/**
 * Returns miscellaneous item definitions (consumables, tools, currency, etc.)
 * These are custom items not from the SRD tables
 */
export function getMiscItemsData(): ItemInsert[] {
  return [
    // ============================================
    // CUSTOM WEAPONS (kept from original seed)
    // ============================================
    {
      id: "item-rusty-sword",
      name: "rusty sword",
      pluralName: "rusty swords",
      description:
        "A battered old sword, its blade pitted with rust. Despite its poor condition, it still has a sharp edge.",
      category: "weapon",
      equipSlots: ["mainHand", "offHand"],
      weaponDamage: "1d6",
      weaponType: "slashing",
      weaponRange: "melee",
      attackBonus: 1,
      damageBonus: 1,
      size: 2,
    },
    // ============================================
    // CUSTOM ARMOR (kept from original seed)
    // ============================================
    {
      id: "item-leather-cap",
      name: "leather cap",
      pluralName: "leather caps",
      description:
        "A simple cap made of boiled leather. It offers modest protection.",
      category: "armor",
      equipSlots: ["head"],
      acBonus: 1,
      size: 1,
    },
    // ============================================
    // CONSUMABLES
    // ============================================
    {
      id: "item-healing-potion",
      name: "healing potion",
      pluralName: "healing potions",
      description:
        "A small vial filled with a glowing red liquid. It smells faintly of cherries.",
      category: "consumable",
      hpEffect: 10,
      size: 1,
    },
    // ============================================
    // TOOLS
    // ============================================
    {
      id: "item-torch",
      name: "torch",
      pluralName: "torches",
      description:
        "A wooden torch wrapped in oil-soaked rags. It provides light in dark places.",
      category: "tool",
      equipSlots: ["mainHand", "offHand"],
      size: 2,
    },
    // ============================================
    // CURRENCY
    // ============================================
    {
      id: "item-gold-coin",
      name: "gold coin",
      pluralName: "gold coins",
      description:
        "A shiny gold coin stamped with the image of a long-forgotten king.",
      category: "currency",
      isBulk: true,
      size: 0,
    },
    {
      id: "item-copper-coin",
      name: "copper coin",
      pluralName: "copper coins",
      description:
        "A tarnished copper coin. It's not worth much, but every bit counts.",
      category: "currency",
      isBulk: true,
      size: 0,
    },
    // ============================================
    // FOOD
    // ============================================
    {
      id: "item-stale-bread",
      name: "stale bread",
      pluralName: "stale bread",
      description:
        "A hard loaf of bread, several days old. Still edible, if not appetizing.",
      category: "food",
      hpEffect: 2,
      size: 1,
    },
    // ============================================
    // JUNK
    // ============================================
    {
      id: "item-circus-flyer",
      name: "circus flyer",
      pluralName: "circus flyers",
      description:
        "A colorful paper flyer advertising 'The Magnificent Traveling Circus of Wonders!' It promises acrobats, fire-breathers, and a mysterious fortune teller. The show dates have long since passed.",
      category: "junk",
      size: 0,
    },
    {
      id: "item-small-rock",
      name: "small rock",
      pluralName: "small rocks",
      description:
        "A smooth, palm-sized rock. Good for skipping across water or throwing at things.",
      category: "junk",
      isBulk: true,
      size: 0,
    },
    {
      id: "item-blue-feather",
      name: "blue feather",
      pluralName: "blue feathers",
      description:
        "A brilliant blue feather, likely from a jay or some exotic forest bird. It shimmers faintly in the light.",
      category: "junk",
      size: 0,
    },
  ];
}
