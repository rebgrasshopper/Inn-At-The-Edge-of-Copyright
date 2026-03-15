/**
 * Diagnostic script to inspect database state
 * Run with: node dist/db/diagnose.js
 */
import Database from "better-sqlite3";
import * as dotenv from "dotenv";

dotenv.config();

const dbPath = process.env.DATABASE_URL || "game.db";
const sqlite = new Database(dbPath);

console.log("🔍 Database Diagnostic Report\n");
console.log(`Database: ${dbPath}\n`);

// 1. All monster instances
console.log("=== MONSTER INSTANCES ===");
const monsters = sqlite
  .prepare(
    `SELECT mi.id, m.name, mi.room_id, mi.current_hp, mi.killed_at, mi.permanent, mi.spawned_at
     FROM monster_instances mi 
     JOIN monsters m ON mi.monster_id = m.id
     ORDER BY mi.room_id, m.name`,
  )
  .all() as {
  id: string;
  name: string;
  room_id: string;
  current_hp: number;
  killed_at: string | null;
  permanent: number;
  spawned_at: number;
}[];

console.log(`Total: ${monsters.length} monster instance(s)\n`);
for (const m of monsters) {
  const status = m.current_hp <= 0 ? "DEAD" : "ALIVE";
  const perm = m.permanent ? "permanent" : "temporary";
  console.log(`  [${status}] ${m.name} (${perm}) in ${m.room_id}`);
  console.log(`    ID: ${m.id}`);
  console.log(
    `    HP: ${m.current_hp}, killed_at: ${m.killed_at}, spawned: ${new Date(m.spawned_at).toISOString()}`,
  );
  console.log();
}

// 2. Monster spawn rules
console.log("\n=== MONSTER SPAWN RULES ===");
const spawns = sqlite
  .prepare(
    `SELECT ms.id, m.name, ms.room_id, ms.max_count
     FROM monster_spawns ms
     JOIN monsters m ON ms.monster_id = m.id
     ORDER BY ms.room_id`,
  )
  .all() as {
  id: string;
  name: string;
  room_id: string;
  max_count: number;
}[];

for (const s of spawns) {
  console.log(`  ${s.name} in ${s.room_id}: max ${s.max_count}`);
}

// 3. Count instances per room vs spawn rules
console.log("\n=== INSTANCE COUNT VS SPAWN RULES ===");
const instanceCounts = sqlite
  .prepare(
    `SELECT mi.room_id, m.name, COUNT(*) as count
     FROM monster_instances mi
     JOIN monsters m ON mi.monster_id = m.id
     GROUP BY mi.room_id, mi.monster_id`,
  )
  .all() as { room_id: string; name: string; count: number }[];

for (const ic of instanceCounts) {
  const spawn = spawns.find(
    (s) => s.room_id === ic.room_id && s.name === ic.name,
  );
  const maxCount = spawn?.max_count ?? "no rule";
  const status = spawn && ic.count > spawn.max_count ? "⚠️ OVER LIMIT" : "✓";
  console.log(
    `  ${status} ${ic.name} in ${ic.room_id}: ${ic.count} instances (max: ${maxCount})`,
  );
}

console.log("\n✅ Diagnostic complete");
sqlite.close();
