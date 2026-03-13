/**
 * One-time fix script for production database
 * Run with: node dist/db/fix-production.js
 */
import Database from "better-sqlite3";
import * as dotenv from "dotenv";

dotenv.config();

const dbPath = process.env.DATABASE_URL || "game.db";
const sqlite = new Database(dbPath);

console.log("🔧 Fixing production database...\n");

// 1. Rename "bookshelves" to "shelves" to avoid matching conflict with "books"
console.log("1. Renaming bookshelves to shelves...");
const shelvesResult = sqlite
  .prepare(
    "UPDATE features SET name = 'shelves' WHERE id = 'feature-library-shelves'",
  )
  .run();
console.log(`   Updated ${shelvesResult.changes} row(s)`);

// 2. Insert the "books" feature if it doesn't exist
console.log("\n2. Adding 'books' feature to library...");
const booksFeature = {
  id: "feature-library-books",
  room_id: "room-library",
  name: "books",
  description:
    "The library's collection includes:\n\nSpell Books (on the special shelf):\n  • Missile spellbook - A guide to arcane projection\n  • Mend spellbook - The healer's first steps\n\nUse 'read <book name>' or 'study <book name>' to read a book.",
  trigger_aliases: JSON.stringify(["spellbooks", "tomes", "volumes"]),
  is_hidden: 0,
  is_discovered: 0,
};

const insertResult = sqlite
  .prepare(
    `INSERT OR IGNORE INTO features (id, room_id, name, description, trigger_aliases, is_hidden, is_discovered)
     VALUES (@id, @room_id, @name, @description, @trigger_aliases, @is_hidden, @is_discovered)`,
  )
  .run(booksFeature);
console.log(`   Inserted ${insertResult.changes} row(s)`);

// 3. Clean up duplicate room inventory (from old randomUUID seeds)
console.log("\n3. Cleaning up duplicate room inventory...");
const roomInvDupes = sqlite
  .prepare(
    `DELETE FROM room_inventory WHERE id NOT IN (
       SELECT MIN(id) FROM room_inventory GROUP BY room_id, item_id
     )`,
  )
  .run();
console.log(`   Deleted ${roomInvDupes.changes} duplicate row(s)`);

// 4. Clean up duplicate monster instances
console.log("\n4. Cleaning up duplicate monster instances...");
const monsterDupes = sqlite
  .prepare(
    `DELETE FROM monster_instances WHERE id NOT IN (
       SELECT MIN(id) FROM monster_instances GROUP BY room_id, monster_id
     )`,
  )
  .run();
console.log(`   Deleted ${monsterDupes.changes} duplicate row(s)`);

// 5. Clean up duplicate monster spawns
console.log("\n5. Cleaning up duplicate monster spawns...");
const spawnDupes = sqlite
  .prepare(
    `DELETE FROM monster_spawns WHERE id NOT IN (
       SELECT MIN(id) FROM monster_spawns GROUP BY room_id, monster_id
     )`,
  )
  .run();
console.log(`   Deleted ${spawnDupes.changes} duplicate row(s)`);

// 6. Clean up duplicate container inventory
console.log("\n6. Cleaning up duplicate container inventory...");
const containerInvDupes = sqlite
  .prepare(
    `DELETE FROM container_inventory WHERE id NOT IN (
       SELECT MIN(id) FROM container_inventory GROUP BY container_id, item_id
     )`,
  )
  .run();
console.log(`   Deleted ${containerInvDupes.changes} duplicate row(s)`);

// 7. Verify library features
console.log("\n7. Verifying library features...");
const features = sqlite
  .prepare("SELECT id, name FROM features WHERE room_id = 'room-library'")
  .all() as { id: string; name: string }[];
for (const feature of features) {
  console.log(`   - ${feature.name} (${feature.id})`);
}

console.log("\n✅ Fix complete!");
sqlite.close();
