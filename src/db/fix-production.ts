/**
 * Production database fix script
 * Run with: node dist/db/fix-production.js
 *
 * Add new fixes here as needed, then remove them after they've been applied.
 */
import Database from "better-sqlite3";
import * as dotenv from "dotenv";

dotenv.config();

const dbPath = process.env.DATABASE_URL || "game.db";
const sqlite = new Database(dbPath);

console.log("🔧 Running production database fixes...\n");

// === ADD NEW FIXES HERE ===
// (Remove after they've been applied to production)

// Fix: Add perception_dc and perception_hint columns if they don't exist
console.log("Checking for perception columns...");

// Check if columns exist
const featuresInfo = sqlite.prepare("PRAGMA table_info(features)").all() as {
  name: string;
}[];
const containersInfo = sqlite
  .prepare("PRAGMA table_info(containers)")
  .all() as { name: string }[];

const featuresHasPerceptionDC = featuresInfo.some(
  (col) => col.name === "perception_dc",
);
const featuresHasPerceptionHint = featuresInfo.some(
  (col) => col.name === "perception_hint",
);
const containersHasPerceptionDC = containersInfo.some(
  (col) => col.name === "perception_dc",
);
const containersHasPerceptionHint = containersInfo.some(
  (col) => col.name === "perception_hint",
);

// Add missing columns
if (!featuresHasPerceptionDC) {
  console.log("  Adding perception_dc to features...");
  sqlite.exec("ALTER TABLE features ADD COLUMN perception_dc INTEGER");
}
if (!featuresHasPerceptionHint) {
  console.log("  Adding perception_hint to features...");
  sqlite.exec("ALTER TABLE features ADD COLUMN perception_hint TEXT");
}
if (!containersHasPerceptionDC) {
  console.log("  Adding perception_dc to containers...");
  sqlite.exec("ALTER TABLE containers ADD COLUMN perception_dc INTEGER");
}
if (!containersHasPerceptionHint) {
  console.log("  Adding perception_hint to containers...");
  sqlite.exec("ALTER TABLE containers ADD COLUMN perception_hint TEXT");
}

console.log("  ✓ Perception columns ready\n");

// Fix: Add perceptionDC and perceptionHint to existing features
console.log("Adding perceptionDC and perceptionHint to features...");

const featureUpdates = [
  {
    id: "feature-mushroom-ring",
    perceptionDC: 10,
    perceptionHint:
      "Something about the mushroom ring catches your eye - the ground nearby looks disturbed.",
    failureMessage:
      "You look around the mushroom ring but don't notice anything unusual.",
  },
  {
    id: "feature-merchant-stalls",
    perceptionDC: 12,
    perceptionHint:
      "One of the merchant stalls seems hastily arranged - something might be hidden behind the goods.",
    failureMessage:
      "You browse the stalls but nothing catches your attention beyond the usual wares.",
  },
  {
    id: "feature-cobblestones",
    perceptionDC: 8,
    perceptionHint:
      "Something glints between the worn cobblestones - could be worth a closer look.",
    failureMessage:
      "You search between the cobblestones but find only dirt and pebbles.",
  },
  {
    id: "feature-undergrowth",
    perceptionDC: 12,
    perceptionHint:
      "You notice a small nest tucked among the ferns - something might be hidden there.",
    failureMessage:
      "You push through the undergrowth but find nothing of interest - just more ferns and brambles.",
  },
  {
    id: "feature-search-underwater",
    perceptionDC: 14,
    perceptionHint:
      "The way the light bends in the water suggests there might be something hidden in the depths.",
    failureMessage:
      "You peer into the water but the glittering surface makes it hard to see anything below.",
  },
  {
    id: "feature-search-stream",
    perceptionDC: 14,
    perceptionHint: null, // Only one hint needed for the water features
    failureMessage:
      "You peer into the water but the glittering surface makes it hard to see anything below.",
  },
  {
    id: "feature-search-depths",
    perceptionDC: 14,
    perceptionHint: null,
    failureMessage:
      "You peer into the water but the glittering surface makes it hard to see anything below.",
  },
  {
    id: "feature-dive-standalone",
    perceptionDC: 14,
    perceptionHint: null,
    failureMessage:
      "You dive beneath the surface but the glittering water makes it hard to see anything clearly.",
  },
];

const updateFeatureStmt = sqlite.prepare(`
  UPDATE features 
  SET perception_dc = ?, perception_hint = ?, failure_message = COALESCE(?, failure_message)
  WHERE id = ?
`);

for (const update of featureUpdates) {
  const result = updateFeatureStmt.run(
    update.perceptionDC,
    update.perceptionHint,
    update.failureMessage,
    update.id,
  );
  if (result.changes > 0) {
    console.log(
      `  ✓ Updated ${update.id} with perceptionDC=${update.perceptionDC}`,
    );
  } else {
    console.log(`  - ${update.id} not found (may not exist yet)`);
  }
}

console.log("");

// Fix: Add trigger_aliases to mushroom ring feature
console.log("Adding trigger aliases to mushroom ring...");
const mushroomAliases = JSON.stringify([
  "mushroom ring",
  "ring",
  "ring of mushrooms",
]);
const aliasResult = sqlite
  .prepare("UPDATE features SET trigger_aliases = ? WHERE id = ?")
  .run(mushroomAliases, "feature-mushroom-ring");
if (aliasResult.changes > 0) {
  console.log("  ✓ Added trigger aliases to mushroom ring");
} else {
  console.log("  - feature-mushroom-ring not found");
}

console.log("");

// === END FIXES ===

// Verification: Show current state
console.log("Current monster instances:");
const monsters = sqlite
  .prepare(
    `SELECT mi.id, m.name, mi.room_id, mi.current_hp, mi.killed_at, mi.permanent 
     FROM monster_instances mi 
     JOIN monsters m ON mi.monster_id = m.id`,
  )
  .all() as {
  id: string;
  name: string;
  room_id: string;
  current_hp: number;
  killed_at: string | null;
  permanent: number;
}[];
for (const m of monsters) {
  console.log(
    `  - ${m.name} (${m.id}) in ${m.room_id}: HP=${m.current_hp}, killed=${m.killed_at}, permanent=${m.permanent}`,
  );
}

console.log("\nCurrent spawn rules:");
const spawns = sqlite
  .prepare(
    `SELECT ms.id, m.name, ms.room_id, ms.max_count
     FROM monster_spawns ms
     JOIN monsters m ON ms.monster_id = m.id
     ORDER BY ms.room_id`,
  )
  .all() as { id: string; name: string; room_id: string; max_count: number }[];
for (const s of spawns) {
  console.log(`  - ${s.name} in ${s.room_id}: max ${s.max_count}`);
}

console.log("\n✅ Done!");
sqlite.close();
