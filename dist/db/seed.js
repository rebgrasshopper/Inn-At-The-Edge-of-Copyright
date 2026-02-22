import Database from "better-sqlite3";
import { randomUUID } from "crypto";
import * as dotenv from "dotenv";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";
dotenv.config();
const sqlite = new Database(process.env.DATABASE_URL || "game.db");
const db = drizzle(sqlite, { schema });
async function seed() {
    console.log("🌱 Seeding database...\n");
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
            description: "You stand in the heart of a small village. A weathered stone fountain bubbles quietly in the center, surrounded by cobblestones worn smooth by countless footsteps. To the north, the warm glow of a tavern beckons. An open-air market lies to the east, and a dirt path leads south into a dark forest.",
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
            description: "The tavern is warm and inviting, filled with the smell of roasting meat and spilled ale. A crackling fireplace dominates one wall, casting dancing shadows across rough wooden tables. A grizzled barkeep polishes mugs behind a long oak counter. The exit to the town square lies to the south.",
            region: "village",
            exits: { south: { roomId: townSquareId } },
        },
        {
            id: marketId,
            name: "Village Market",
            description: "Colorful stalls line this bustling marketplace. Merchants hawk their wares - fresh bread, gleaming weapons, mysterious potions, and bolts of fine cloth. The air is thick with the mingled scents of spices and leather. The town square is to the west.",
            region: "village",
            exits: { west: { roomId: townSquareId } },
        },
        {
            id: forestPathId,
            name: "Forest Path",
            description: "A narrow dirt path winds between ancient oak trees. Dappled sunlight filters through the canopy above, and the sounds of the village fade behind you. The undergrowth rustles with unseen creatures. The path continues deeper into the forest to the south, or you can return north to the village.",
            region: "darkwood",
            exits: {
                north: { roomId: townSquareId },
                south: { roomId: forestClearingId },
            },
        },
        {
            id: forestClearingId,
            name: "Forest Clearing",
            description: "You emerge into a small clearing carpeted with soft moss. Shafts of golden light pierce the canopy, illuminating a ring of mushrooms at the clearing's center. The forest feels ancient here, watchful. Strange sounds echo from deeper in the woods. The path back to the village lies to the north.",
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
    const itemsData = [
        {
            id: "item-rusty-sword",
            name: "rusty sword",
            pluralName: "rusty swords",
            description: "A battered old sword, its blade pitted with rust. Despite its poor condition, it still has a sharp edge.",
            category: "weapon",
            strEffect: 2,
            isBulk: false,
        },
        {
            id: "item-leather-cap",
            name: "leather cap",
            pluralName: "leather caps",
            description: "A simple cap made of boiled leather. It offers modest protection.",
            category: "armor",
            conEffect: 1,
            isBulk: false,
        },
        {
            id: "item-healing-potion",
            name: "healing potion",
            pluralName: "healing potions",
            description: "A small vial filled with a glowing red liquid. It smells faintly of cherries.",
            category: "consumable",
            hpEffect: 10,
            isBulk: false,
        },
        {
            id: "item-torch",
            name: "torch",
            pluralName: "torches",
            description: "A wooden torch wrapped in oil-soaked rags. It provides light in dark places.",
            category: "tool",
            isBulk: false,
        },
        {
            id: "item-gold-coin",
            name: "gold coin",
            pluralName: "gold coins",
            description: "A shiny gold coin stamped with the image of a long-forgotten king.",
            category: "currency",
            isBulk: true,
        },
        {
            id: "item-stale-bread",
            name: "stale bread",
            pluralName: "stale bread",
            description: "A hard loaf of bread, several days old. Still edible, if not appetizing.",
            category: "food",
            hpEffect: 2,
            isBulk: false,
        },
    ];
    for (const item of itemsData) {
        await db.insert(schema.items).values(item).onConflictDoNothing();
    }
    console.log(`  ✓ Created ${itemsData.length} items\n`);
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
            description: "A small, green-skinned creature with pointed ears and sharp teeth. It clutches a crude wooden club.",
            str: 8,
            dex: 14,
            con: 10,
            int: 6,
            wis: 8,
            cha: 6,
            maxHp: 8,
            xpReward: 25,
        },
        {
            id: "monster-wolf",
            name: "wolf",
            description: "A large grey wolf with matted fur and hungry yellow eyes. It growls menacingly.",
            str: 12,
            dex: 15,
            con: 12,
            int: 3,
            wis: 12,
            cha: 6,
            maxHp: 12,
            xpReward: 50,
        },
        {
            id: "monster-giant-spider",
            name: "giant spider",
            description: "A spider the size of a large dog, its eight legs clicking against the ground. Venom drips from its fangs.",
            str: 10,
            dex: 16,
            con: 10,
            int: 2,
            wis: 10,
            cha: 2,
            maxHp: 10,
            xpReward: 40,
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
            description: "A burly man with a thick grey beard and arms like tree trunks. Despite his intimidating appearance, his eyes are kind.",
            roomId: tavernId,
        },
        {
            id: "npc-merchant",
            name: "Elara the Merchant",
            description: "A sharp-eyed woman in colorful robes. She watches potential customers with a calculating gaze.",
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
    const containersData = [
        {
            id: "container-tavern-chest",
            roomId: tavernId,
            name: "old chest",
            description: "A dusty wooden chest sits in the corner, half-hidden behind some barrels.",
            isHidden: false,
        },
        {
            id: "container-hidden-cache",
            roomId: forestClearingId,
            name: "hidden cache",
            description: "A small hollow beneath a gnarled tree root contains a leather pouch.",
            isHidden: true,
            revealCommand: "search mushrooms",
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
            description: "The fountain's water is crystal clear. Coins glitter at the bottom.",
            triggerVerbs: ["drink", "taste"],
            triggerTarget: "fountain",
            successMessage: "You drink from the fountain. The water is refreshingly cool and seems to invigorate you.",
            successEffects: [{ type: "heal", amount: 5 }],
            isHidden: false,
            isDiscovered: false,
        },
        {
            id: "feature-mushroom-ring",
            roomId: forestClearingId,
            name: "ring of mushrooms",
            description: "A perfect circle of red-capped mushrooms. They seem to glow faintly.",
            triggerVerbs: ["search", "examine", "inspect"],
            triggerTarget: "mushrooms",
            successMessage: "You carefully search around the mushroom ring and discover a hidden cache beneath a nearby tree root!",
            revealsContainerId: "container-hidden-cache",
            isHidden: false,
            isDiscovered: false,
        },
        {
            id: "feature-fireplace",
            roomId: tavernId,
            name: "crackling fireplace",
            description: "A large stone fireplace with a roaring fire. The warmth is comforting.",
            triggerVerbs: ["warm", "rest"],
            triggerTarget: "fireplace",
            successMessage: "You warm yourself by the fire. The heat soothes your tired muscles.",
            successEffects: [{ type: "heal", amount: 3 }],
            isHidden: false,
            isDiscovered: false,
        },
    ];
    for (const feature of featuresData) {
        await db.insert(schema.features).values(feature).onConflictDoNothing();
    }
    console.log(`  ✓ Created ${featuresData.length} interactive features\n`);
    console.log("✅ Database seeding complete!");
    console.log("\nStarting room: Town Square (room-town-square)");
    console.log("Try exploring: north to tavern, east to market, south to forest\n");
}
seed()
    .catch((error) => {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
})
    .finally(() => {
    sqlite.close();
});
//# sourceMappingURL=seed.js.map