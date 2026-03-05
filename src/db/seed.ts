import bcrypt from "bcrypt";
import Database from "better-sqlite3";
import { randomUUID } from "crypto";
import * as dotenv from "dotenv";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";
import { seedFeats } from "./seeders/featSeeder.js";

dotenv.config();

const sqlite = new Database(process.env.DATABASE_URL || "game.db");
const db = drizzle(sqlite, { schema });

async function seed() {
  console.log("🌱 Seeding database...\n");

  // ============================================
  // TEST ACCOUNT - For development convenience
  // ============================================
  console.log("Creating test account...");

  const testUserId = "user-test-fox";
  const testPlayerId = "player-test-djim";
  const passwordHash = await bcrypt.hash("henhouse", 10);

  await db
    .insert(schema.users)
    .values({
      id: testUserId,
      username: "fox",
      passwordHash,
      createdAt: new Date(),
    })
    .onConflictDoNothing();

  console.log("  ✓ Created test user (fox/henhouse)\n");

  // ============================================
  // ROOMS - A small starter area
  // ============================================
  console.log("Creating rooms...");

  const townSquareId = "room-town-square";
  const tavernId = "room-tavern";
  const marketId = "room-market";
  const forestPathId = "room-forest-path";
  const forestClearingId = "room-forest-clearing";

  const roomsData = [
    {
      id: townSquareId,
      name: "Town Square",
      description:
        "You stand in the heart of a small village. A weathered stone fountain bubbles quietly in the center, surrounded by cobblestones worn smooth by countless footsteps. A moss-covered statue of some forgotten hero stands watch nearby.",
      navDescription:
        "To the north, the warm glow of a tavern beckons. An open-air market lies to the east, and a dirt path leads south into a dark forest.",
      region: "village",
      exits: {
        north: { roomId: tavernId },
        east: { roomId: marketId },
        south: { roomId: forestPathId },
      },
    },
    {
      id: tavernId,
      name: "The Rusty Tankard",
      description:
        "The tavern is warm and inviting, filled with the smell of roasting meat and spilled ale. A crackling fireplace dominates one wall, casting dancing shadows across rough wooden tables. A grizzled barkeep polishes mugs behind a long oak counter. Above the bar hangs a mounted trophy - the head of some fearsome beast. In the corner, a well-worn dartboard awaits challengers.",
      navDescription: "The exit to the town square lies to the south.",
      region: "village",
      exits: { south: { roomId: townSquareId } },
    },
    {
      id: marketId,
      name: "Village Market",
      description:
        "Colorful stalls line this bustling marketplace. Merchants hawk their wares - fresh bread, gleaming weapons, mysterious potions, and bolts of fine cloth. The air is thick with the mingled scents of spices from nearby barrels. A weathered notice board stands near the entrance.",
      navDescription: "The town square is to the west.",
      region: "village",
      exits: { west: { roomId: townSquareId } },
    },
    {
      id: forestPathId,
      name: "Forest Path",
      description:
        "A narrow dirt path winds between ancient oak trees. Dappled sunlight filters through the canopy above, and the sounds of the village fade behind you. The undergrowth rustles with unseen creatures. Weathered trail markers point the way deeper into the woods.",
      navDescription:
        "The path continues deeper into the forest to the south, or you can return north to the village.",
      region: "darkwood",
      exits: {
        north: { roomId: townSquareId },
        south: { roomId: forestClearingId },
      },
    },
    {
      id: forestClearingId,
      name: "Forest Clearing",
      description:
        "You emerge into a small clearing carpeted with soft moss. Shafts of golden light pierce the canopy, illuminating a ring of mushrooms at the clearing's center. A gnarled tree with a twisted trunk dominates one edge. The forest feels ancient here, watchful. Strange sounds echo from deeper in the woods.",
      navDescription: "The path back to the village lies to the north.",
      region: "darkwood",
      exits: { north: { roomId: forestPathId } },
    },
  ];

  for (const room of roomsData) {
    await db.insert(schema.rooms).values(room).onConflictDoNothing();
  }
  console.log(`  ✓ Created ${roomsData.length} rooms\n`);

  // ============================================
  // ITEMS - Basic starter items
  // ============================================
  console.log("Creating items...");

  const itemsData: (typeof schema.items.$inferInsert)[] = [
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
      strEffect: 2,
      isBulk: false,
      size: 2, // medium
    },
    {
      id: "item-leather-cap",
      name: "leather cap",
      pluralName: "leather caps",
      description:
        "A simple cap made of boiled leather. It offers modest protection.",
      category: "armor",
      equipSlots: ["head"],
      conEffect: 1,
      isBulk: false,
      size: 1, // small
    },
    {
      id: "item-healing-potion",
      name: "healing potion",
      pluralName: "healing potions",
      description:
        "A small vial filled with a glowing red liquid. It smells faintly of cherries.",
      category: "consumable",
      hpEffect: 10,
      isBulk: false,
      size: 1, // small
    },
    {
      id: "item-torch",
      name: "torch",
      pluralName: "torches",
      description:
        "A wooden torch wrapped in oil-soaked rags. It provides light in dark places.",
      category: "tool",
      equipSlots: ["mainHand", "offHand"],
      isBulk: false,
      size: 2, // medium
    },
    {
      id: "item-gold-coin",
      name: "gold coin",
      pluralName: "gold coins",
      description:
        "A shiny gold coin stamped with the image of a long-forgotten king.",
      category: "currency",
      isBulk: true,
      size: 0, // tiny
    },
    {
      id: "item-stale-bread",
      name: "stale bread",
      pluralName: "stale bread",
      description:
        "A hard loaf of bread, several days old. Still edible, if not appetizing.",
      category: "food",
      hpEffect: 2,
      isBulk: false,
      size: 1, // small
    },
    {
      id: "item-circus-flyer",
      name: "circus flyer",
      pluralName: "circus flyers",
      description:
        "A colorful paper flyer advertising 'The Magnificent Traveling Circus of Wonders!' It promises acrobats, fire-breathers, and a mysterious fortune teller. The show dates have long since passed.",
      category: "junk",
      isBulk: false,
      size: 0, // tiny
    },
    {
      id: "item-copper-coin",
      name: "copper coin",
      pluralName: "copper coins",
      description:
        "A tarnished copper coin. It's not worth much, but every bit counts.",
      category: "currency",
      isBulk: true,
      size: 0, // tiny
    },
    {
      id: "item-small-rock",
      name: "small rock",
      pluralName: "small rocks",
      description:
        "A smooth, palm-sized rock. Good for skipping across water or throwing at things.",
      category: "junk",
      isBulk: true,
      size: 0, // tiny
    },
    {
      id: "item-blue-feather",
      name: "blue feather",
      pluralName: "blue feathers",
      description:
        "A brilliant blue feather, likely from a jay or some exotic forest bird. It shimmers faintly in the light.",
      category: "junk",
      isBulk: false,
      size: 0, // tiny
    },
  ];

  for (const item of itemsData) {
    await db.insert(schema.items).values(item).onConflictDoNothing();
  }
  console.log(`  ✓ Created ${itemsData.length} items\n`);

  // ============================================
  // TEST PLAYER - Djim with starting gear
  // ============================================
  console.log("Creating test character...");

  await db
    .insert(schema.players)
    .values({
      id: testPlayerId,
      userId: testUserId,
      name: "Djim",
      currentRoomId: townSquareId,
      str: 12,
      dex: 14,
      con: 10,
      int: 10,
      wis: 10,
      cha: 12,
      currentHp: 10000,
      maxHp: 10000,
      xp: 900,
      level: 3,
      unspentAttributePoints: 0,
      isOnline: false,
      createdAt: new Date(),
    })
    .onConflictDoNothing();

  // Give Djim starting inventory
  await db
    .insert(schema.playerInventory)
    .values([
      {
        id: randomUUID(),
        playerId: testPlayerId,
        itemId: "item-rusty-sword",
        quantity: 1,
      },
      {
        id: randomUUID(),
        playerId: testPlayerId,
        itemId: "item-gold-coin",
        quantity: 3,
      },
    ])
    .onConflictDoNothing();

  console.log("  ✓ Created Djim with rusty sword and 3 gold coins\n");

  // ============================================
  // ROOM INVENTORY - Place some items in rooms
  // ============================================
  console.log("Placing items in rooms...");

  const roomInventoryData = [
    {
      id: randomUUID(),
      roomId: townSquareId,
      itemId: "item-gold-coin",
      quantity: 3,
    },
    {
      id: randomUUID(),
      roomId: townSquareId,
      itemId: "item-circus-flyer",
      quantity: 1,
    },
    {
      id: randomUUID(),
      roomId: townSquareId,
      itemId: "item-copper-coin",
      quantity: 1,
    },
    {
      id: randomUUID(),
      roomId: townSquareId,
      itemId: "item-small-rock",
      quantity: 8,
    },
    {
      id: randomUUID(),
      roomId: tavernId,
      itemId: "item-stale-bread",
      quantity: 1,
    },
    {
      id: randomUUID(),
      roomId: marketId,
      itemId: "item-healing-potion",
      quantity: 2,
    },
    {
      id: randomUUID(),
      roomId: forestPathId,
      itemId: "item-torch",
      quantity: 1,
    },
    {
      id: randomUUID(),
      roomId: forestClearingId,
      itemId: "item-rusty-sword",
      quantity: 1,
    },
  ];

  for (const inv of roomInventoryData) {
    await db.insert(schema.roomInventory).values(inv).onConflictDoNothing();
  }
  console.log(`  ✓ Placed items in ${roomInventoryData.length} locations\n`);

  // ============================================
  // MONSTERS - Basic enemies
  // ============================================
  console.log("Creating monsters...");

  const monstersData = [
    {
      id: "monster-goblin",
      name: "goblin",
      description:
        "A small, green-skinned creature with pointed ears and sharp teeth. It clutches a crude wooden club.",
      str: 8,
      dex: 14,
      con: 10,
      int: 6,
      wis: 8,
      cha: 6,
      maxHp: 8,
      xpReward: 25,
      aggroScore: 2, // Attacks level 1-2 players
      weaponDamage: "1d4",
      level: 1,
    },
    {
      id: "monster-wolf",
      name: "wolf",
      description:
        "A large grey wolf with matted fur and hungry yellow eyes. It growls menacingly.",
      str: 12,
      dex: 15,
      con: 12,
      int: 3,
      wis: 12,
      cha: 6,
      maxHp: 12,
      xpReward: 50,
      aggroScore: 3, // Attacks level 1-3 players
      weaponDamage: "1d6",
      level: 2,
    },
    {
      id: "monster-giant-spider",
      name: "giant spider",
      description:
        "A spider the size of a large dog, its eight legs clicking against the ground. Venom drips from its fangs.",
      str: 10,
      dex: 16,
      con: 10,
      int: 2,
      wis: 10,
      cha: 2,
      maxHp: 10,
      xpReward: 40,
      aggroScore: 0, // Passive - only attacks when provoked
      weaponDamage: "1d4+1",
      level: 2,
    },
  ];

  for (const monster of monstersData) {
    await db.insert(schema.monsters).values(monster).onConflictDoNothing();
  }
  console.log(`  ✓ Created ${monstersData.length} monster types\n`);

  // ============================================
  // MONSTER SPAWNS - Where monsters can appear
  // ============================================
  console.log("Setting up monster spawn points...");

  const monsterSpawnsData = [
    {
      id: randomUUID(),
      monsterId: "monster-goblin",
      roomId: forestPathId,
      maxCount: 2,
    },
    {
      id: randomUUID(),
      monsterId: "monster-wolf",
      roomId: forestClearingId,
      maxCount: 1,
    },
    {
      id: randomUUID(),
      monsterId: "monster-giant-spider",
      roomId: forestClearingId,
      maxCount: 1,
    },
  ];

  for (const spawn of monsterSpawnsData) {
    await db.insert(schema.monsterSpawns).values(spawn).onConflictDoNothing();
  }
  console.log(`  ✓ Created ${monsterSpawnsData.length} spawn points\n`);

  // ============================================
  // MONSTER INSTANCES - Spawn initial monsters
  // ============================================
  console.log("Spawning initial monsters...");

  const monsterInstancesData = [
    {
      id: randomUUID(),
      monsterId: "monster-goblin",
      roomId: forestPathId,
      currentHp: 8,
      spawnedAt: new Date(),
    },
    {
      id: randomUUID(),
      monsterId: "monster-wolf",
      roomId: forestClearingId,
      currentHp: 12,
      spawnedAt: new Date(),
    },
  ];

  for (const instance of monsterInstancesData) {
    await db
      .insert(schema.monsterInstances)
      .values(instance)
      .onConflictDoNothing();
  }
  console.log(`  ✓ Spawned ${monsterInstancesData.length} monsters\n`);

  // ============================================
  // NPCs - Friendly characters
  // ============================================
  console.log("Creating NPCs...");

  const npcsData = [
    {
      id: "npc-barkeep",
      name: "Grimjaw the Barkeep",
      description:
        "A burly man with a thick grey beard and arms like tree trunks. Despite his intimidating appearance, his eyes are kind.",
      roomId: tavernId,
    },
    {
      id: "npc-merchant",
      name: "Elara the Merchant",
      description:
        "A sharp-eyed woman in colorful robes. She watches potential customers with a calculating gaze.",
      roomId: marketId,
    },
  ];

  for (const npc of npcsData) {
    await db.insert(schema.npcs).values(npc).onConflictDoNothing();
  }
  console.log(`  ✓ Created ${npcsData.length} NPCs\n`);

  // ============================================
  // CONTAINERS - Hidden treasures
  // ============================================
  console.log("Creating containers...");

  const containersData: (typeof schema.containers.$inferInsert)[] = [
    {
      id: "container-tavern-chest",
      roomId: tavernId,
      name: "old chest",
      description:
        "A dusty wooden chest sits in the corner, half-hidden behind some barrels.",
      isHidden: false,
      size: 4 as const, // huge - can hold large items
    },
    {
      id: "container-hidden-cache",
      roomId: forestClearingId,
      name: "hidden cache",
      description:
        "A small hollow beneath a gnarled tree root contains a leather pouch.",
      aliases: ["pouch", "hollow"],
      revealedText: "Under the root of a nearby tree you see a leather pouch.",
      isHidden: true,
      revealCommand: "search mushrooms",
      size: 2 as const, // medium - can hold small items only
    },
    {
      id: "container-market-stash",
      roomId: marketId,
      name: "hidden compartment",
      description:
        "A small compartment hidden beneath the loose board. It looks like someone's secret stash.",
      aliases: ["compartment", "stash"],
      revealedText: "A hidden compartment lies open beneath the loose board.",
      isHidden: true,
      size: 3 as const, // large - can hold medium items
    },
  ];

  for (const container of containersData) {
    await db.insert(schema.containers).values(container).onConflictDoNothing();
  }
  console.log(`  ✓ Created ${containersData.length} containers\n`);

  // ============================================
  // CONTAINER INVENTORY - Items in containers
  // ============================================
  console.log("Filling containers...");

  const containerInventoryData = [
    {
      id: randomUUID(),
      containerId: "container-tavern-chest",
      itemId: "item-leather-cap",
      quantity: 1,
    },
    {
      id: randomUUID(),
      containerId: "container-hidden-cache",
      itemId: "item-healing-potion",
      quantity: 1,
    },
    {
      id: randomUUID(),
      containerId: "container-hidden-cache",
      itemId: "item-gold-coin",
      quantity: 5,
    },
    {
      id: randomUUID(),
      containerId: "container-market-stash",
      itemId: "item-gold-coin",
      quantity: 8,
    },
    {
      id: randomUUID(),
      containerId: "container-market-stash",
      itemId: "item-copper-coin",
      quantity: 15,
    },
  ];

  for (const inv of containerInventoryData) {
    await db
      .insert(schema.containerInventory)
      .values(inv)
      .onConflictDoNothing();
  }
  console.log(`  ✓ Added items to containers\n`);

  // ============================================
  // FEATURES - Interactive room elements
  // ============================================
  console.log("Creating room features...");

  const featuresData = [
    {
      id: "feature-fountain",
      roomId: townSquareId,
      name: "stone fountain",
      description:
        "The fountain's water is crystal clear. Coins glitter at the bottom.",
      triggerVerbs: ["drink", "taste"],
      triggerTarget: "fountain",
      successMessage:
        "You drink from the fountain. The water is refreshingly cool and seems to invigorate you.",
      successEffects: [{ type: "heal" as const, amount: 5 }],
      isHidden: false,
      isDiscovered: false,
      refuseGetMessage:
        "You reach toward the glittering coins, but a strange sense of foreboding stays your hand. Best not to tempt fate.",
      refuseDropMessage:
        "You consider tossing something into the fountain, but think better of it. Who knows what wishes might be disturbed?",
    },
    {
      id: "feature-mushroom-ring",
      roomId: forestClearingId,
      name: "ring of mushrooms",
      description:
        "A perfect circle of red-capped mushrooms. They seem to glow faintly.",
      triggerVerbs: ["search"],
      triggerTarget: "mushrooms",
      successMessage:
        "You carefully search around the mushroom ring and discover a hidden cache beneath a nearby tree root!",
      revealsContainerId: "container-hidden-cache",
      isHidden: false,
      isDiscovered: false,
    },
    {
      id: "feature-fireplace",
      roomId: tavernId,
      name: "crackling fireplace",
      description:
        "A large stone fireplace with a roaring fire. The warmth is comforting.",
      triggerVerbs: ["warm", "rest"],
      triggerTarget: "fireplace",
      successMessage:
        "You warm yourself by the fire. The heat soothes your tired muscles.",
      successEffects: [{ type: "heal" as const, amount: 3 }],
      isHidden: false,
      isDiscovered: false,
    },
    {
      id: "feature-oak-counter",
      roomId: tavernId,
      name: "oak counter",
      description:
        "A long counter of polished oak, scarred by years of use. Behind it, shelves hold an impressive array of bottles, tankards, and mysterious jars. A chalkboard lists the day's offerings.",
      triggerVerbs: ["read"],
      triggerTarget: "counter",
      successMessage:
        "You squint at the chalkboard menu: 'Ale - 2 copper. Stew - 5 copper. Mystery Meat - 3 copper (don't ask). Rooms - 1 silver/night.' Someone has added in smaller writing: 'No credit. No exceptions. Yes, that means you, Bjorn.'",
      isHidden: false,
      isDiscovered: false,
    },
    {
      id: "feature-mounted-trophy",
      roomId: tavernId,
      name: "mounted trophy",
      description:
        "The massive head of a dire wolf hangs above the bar, its glass eyes gleaming in the firelight. The beast's jaws are frozen in a permanent snarl, revealing yellowed fangs as long as daggers.",
      triggerVerbs: ["read"],
      triggerTarget: "trophy",
      successMessage:
        "A brass plaque beneath the trophy reads: 'Shadowfang - Terror of the Darkwood. Slain by Grimjaw the Barkeep, Winter of the Red Moon.' You glance at the barkeep with newfound respect.",
      isHidden: false,
      isDiscovered: false,
    },
    {
      id: "feature-dartboard",
      roomId: tavernId,
      name: "dartboard",
      description:
        "A circular dartboard hangs on the wall, its surface pockmarked from countless throws. A few darts are embedded in the board, and several more lie scattered on the floor beneath it.",
      triggerVerbs: ["play", "throw"],
      triggerTarget: "darts",
      successMessage:
        "You grab a dart and take aim. The throw goes wide, thunking into the wall a good foot from the board. A nearby patron chuckles. 'Don't quit your day job, friend.'",
      isHidden: false,
      isDiscovered: false,
    },
    // Village Market features
    {
      id: "feature-merchant-stalls",
      roomId: marketId,
      name: "merchant stalls",
      description:
        "Wooden stalls draped with colorful awnings display an array of goods: polished daggers, leather pouches, bundles of herbs, and curious trinkets. One stall catches your eye - its owner seems to have stepped away, leaving the wares unattended.",
      triggerVerbs: ["search"],
      triggerTarget: "stalls",
      successMessage:
        "You casually browse the unattended stall. Behind a stack of cloth, you notice a loose board...",
      revealsFeatureId: "feature-loose-board",
      isHidden: false,
      isDiscovered: false,
    },
    {
      id: "feature-loose-board",
      roomId: marketId,
      name: "loose board",
      description:
        "A weathered board at the back of the stall sits slightly askew. It looks like it could be pried up.",
      triggerVerbs: ["pry", "lift", "open", "move"],
      triggerTarget: "board",
      successMessage:
        "You carefully lift the loose board, revealing a small hidden compartment beneath!",
      revealsContainerId: "container-market-stash",
      isHidden: true,
      isDiscovered: false,
    },
    {
      id: "feature-spice-barrels",
      roomId: marketId,
      name: "spice barrels",
      description:
        "Large wooden barrels line one side of the market, each filled with exotic spices from distant lands. Labels in faded ink read: Saffron, Cardamom, Star Anise, Dragon Pepper.",
      triggerVerbs: ["smell", "sniff"],
      triggerTarget: "barrels",
      successMessage:
        "You lean in and inhale deeply. The heady mix of cinnamon, pepper, and something floral fills your senses. For a moment, you imagine yourself in a far-off bazaar under a blazing sun.",
      isHidden: false,
      isDiscovered: false,
    },
    {
      id: "feature-notice-board",
      roomId: marketId,
      name: "notice board",
      description:
        "A weathered wooden board mounted on a post, covered in old nail holes and faded paper scraps. A few tattered notices flutter in the breeze.",
      triggerVerbs: ["read"],
      triggerTarget: "board",
      successMessage:
        "You scan the notice board. Most postings are old and illegible, but one newer notice catches your eye: 'ADVENTURERS WANTED - Inquire at the Rusty Tankard.' Below it, someone has scrawled: 'No epic quests today. Check back later.'",
      isHidden: false,
      isDiscovered: false,
    },
    // Town Square features
    {
      id: "feature-statue-moss",
      roomId: townSquareId,
      name: "moss",
      description:
        "Thick green moss clings to the statue, softening its features. It's the kind that thrives in damp, shaded places - the fountain's mist must keep it well-watered.",
      isHidden: false,
      isDiscovered: false,
    },
    {
      id: "feature-weathered-statue",
      roomId: townSquareId,
      name: "weathered statue",
      description:
        "A moss-covered statue of a warrior in ancient armor stands on a low pedestal. Time has worn away most of the details, but you can still make out a stern face and a sword held aloft. A bronze plaque is mounted at the base.",
      triggerVerbs: ["read"],
      triggerTarget: "statue",
      successMessage:
        "The plaque reads: 'Sir Aldric the Steadfast - Founder of Millbrook. He who stood against the darkness when all others fled.' The date is too weathered to read.",
      isHidden: false,
      isDiscovered: false,
    },
    {
      id: "feature-cobblestones",
      roomId: townSquareId,
      name: "worn cobblestones",
      description:
        "The cobblestones here have been worn smooth by generations of footsteps. Gaps between the stones have collected dirt, leaves, and the occasional glint of something metallic.",
      triggerVerbs: ["search", "rummage"],
      triggerTarget: "cobblestones",
      successMessage:
        "You crouch down and sift through the debris between the stones. Your fingers close around a tarnished copper coin that someone must have dropped long ago!",
      successEffects: [
        {
          type: "give_item" as const,
          itemId: "item-copper-coin",
          quantity: 1,
        },
      ],
      isHidden: false,
      isDiscovered: false,
    },
    // Forest Path features
    {
      id: "feature-ancient-oaks",
      roomId: forestPathId,
      name: "ancient oak trees",
      description:
        "These massive oaks have stood for centuries, their gnarled trunks wider than a man's armspan. Strange symbols are carved into the bark of the largest one - old druidic marks, perhaps, or warnings from a forgotten age.",
      triggerVerbs: ["touch", "feel"],
      triggerTarget: "oaks",
      successMessage:
        "You place your hand on the rough bark. For a moment, you feel a faint pulse, as if the tree itself were breathing. The forest seems to watch you with ancient eyes.",
      isHidden: false,
      isDiscovered: false,
    },
    {
      id: "feature-undergrowth",
      roomId: forestPathId,
      name: "rustling undergrowth",
      description:
        "Dense ferns and brambles crowd the edges of the path. Something small moves within, disturbing the leaves.",
      triggerVerbs: ["search", "rummage"],
      triggerTarget: "undergrowth",
      successMessage:
        "You carefully part the ferns and peer into the undergrowth. A startled bird bursts out, leaving behind a brilliant blue feather!",
      successEffects: [
        {
          type: "give_item" as const,
          itemId: "item-blue-feather",
          quantity: 1,
        },
      ],
      isHidden: false,
      isDiscovered: false,
    },
    {
      id: "feature-trail-markers",
      roomId: forestPathId,
      name: "trail markers",
      description:
        "Weathered wooden posts mark the path at intervals. Faded paint indicates directions: an arrow pointing north is labeled 'Village', while the southern arrow reads 'Darkwood - Beware'.",
      triggerVerbs: ["read"],
      triggerTarget: "markers",
      successMessage:
        "You study the markers more closely. Someone has scratched additional notes: 'Mushroom ring - don't step inside' and 'Wolves at dusk'. Helpful, if a bit ominous.",
      isHidden: false,
      isDiscovered: false,
    },
    // Forest Clearing features
    {
      id: "feature-gnarled-tree",
      roomId: forestClearingId,
      name: "gnarled tree",
      description:
        "An ancient tree dominates one edge of the clearing, its trunk twisted into impossible shapes. Deep grooves in the bark form patterns that almost look like faces - or perhaps that's just a trick of the light.",
      triggerVerbs: ["touch", "feel"],
      triggerTarget: "tree",
      successMessage:
        "You press your palm against the rough bark. The wood is warm, almost feverishly so. For a heartbeat, you could swear you feel it pulse beneath your hand.",
      isHidden: false,
      isDiscovered: false,
    },
    {
      id: "feature-soft-moss",
      roomId: forestClearingId,
      name: "soft moss",
      description:
        "A thick carpet of emerald moss covers much of the clearing floor. It looks impossibly soft and inviting.",
      triggerVerbs: ["rest", "sit"],
      triggerTarget: "moss",
      successMessage:
        "You settle onto the moss. It's softer than any bed you've slept in. The forest seems to hum a quiet lullaby, and you feel your aches begin to fade.",
      successEffects: [{ type: "heal" as const, amount: 2 }],
      isHidden: false,
      isDiscovered: false,
    },
    {
      id: "feature-strange-sounds",
      roomId: forestClearingId,
      name: "strange sounds",
      description:
        "Odd noises drift from deeper in the forest - creaking branches, distant howls, and something that might be whispered voices.",
      triggerVerbs: ["listen"],
      triggerTarget: "sounds",
      successMessage:
        "You stand perfectly still and listen. Beneath the rustle of leaves, you hear it: a low, rhythmic chanting from somewhere to the south. It stops abruptly, as if aware of your attention.",
      isHidden: false,
      isDiscovered: false,
    },
    // Debug feature - summon wolf for testing combat
    {
      id: "feature-howl",
      roomId: forestClearingId,
      name: "howl",
      description: "You can howl to summon a wolf.",
      triggerVerbs: ["howl"],
      triggerTarget: "wolf",
      successMessage: "You let out a howl...",
      successEffects: [
        { type: "spawn_monster" as const, monsterId: "monster-wolf" },
      ],
      isHidden: false,
      isDiscovered: false,
    },
  ];

  for (const feature of featuresData) {
    await db.insert(schema.features).values(feature).onConflictDoNothing();
  }
  console.log(`  ✓ Created ${featuresData.length} interactive features\n`);

  // ============================================
  // FEATS - Character abilities from Pathfinder
  // ============================================
  await seedFeats(db);

  // Give Djim the Dodge feat (must be after feats are seeded)
  await db
    .insert(schema.playerFeats)
    .values({
      id: randomUUID(),
      playerId: testPlayerId,
      featId: "feat-dodge",
      acquiredAt: new Date(),
    })
    .onConflictDoNothing();

  console.log("✅ Database seeding complete!");
  console.log("\nStarting room: Town Square (room-town-square)");
  console.log(
    "Try exploring: north to tavern, east to market, south to forest\n",
  );
}

seed()
  .catch((error) => {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  })
  .finally(() => {
    sqlite.close();
  });
