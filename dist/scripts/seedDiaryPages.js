"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Standalone script to seed diary pages into the database.
 * Run: npx ts-node src/scripts/seedDiaryPages.ts
 */
const Dbconnetion_1 = require("../config/Dbconnetion");
const diaryPages_seed_1 = require("../seeders/diaryPages.seed");
async function main() {
    console.log('Connecting to database...');
    await (0, Dbconnetion_1.initializeDatabase)();
    console.log('Seeding diary pages...');
    const count = await (0, diaryPages_seed_1.seedDiaryPages)();
    console.log(`Done! Seeded ${count} new diary pages.`);
    process.exit(0);
}
main().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
});
