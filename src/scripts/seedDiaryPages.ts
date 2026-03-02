/**
 * Standalone script to seed diary pages into the database.
 * Run: npx ts-node src/scripts/seedDiaryPages.ts
 */
import { initializeDatabase } from '../config/Dbconnetion';
import { seedDiaryPages } from '../seeders/diaryPages.seed';

async function main() {
  console.log('Connecting to database...');
  await initializeDatabase();

  console.log('Seeding diary pages...');
  const count = await seedDiaryPages();
  console.log(`Done! Seeded ${count} new diary pages.`);

  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
