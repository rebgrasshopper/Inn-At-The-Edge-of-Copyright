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
