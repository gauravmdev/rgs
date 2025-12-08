import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL!;

const sql = postgres(connectionString, { max: 1 });
const db = drizzle(sql);

async function runMigrations() {
    console.log('⏳ Running migrations...');

    await migrate(db, { migrationsFolder: './drizzle' });

    console.log('✅ Migrations completed!');
    await sql.end();
    process.exit(0);
}

runMigrations().catch((err) => {
    console.error('❌ Migration failed!');
    console.error(err);
    process.exit(1);
});
