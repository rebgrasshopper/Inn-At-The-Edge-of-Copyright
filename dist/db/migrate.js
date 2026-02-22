import Database from "better-sqlite3";
import * as dotenv from "dotenv";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
dotenv.config();
const sqlite = new Database(process.env.DATABASE_URL || "game.db");
const db = drizzle(sqlite);
console.log("Running migrations...");
migrate(db, { migrationsFolder: "./drizzle" });
console.log("Migrations complete!");
sqlite.close();
//# sourceMappingURL=migrate.js.map