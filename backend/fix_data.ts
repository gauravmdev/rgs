import { db } from './src/config/database'; import { customers } from './src/db/schema'; import { eq } from 'drizzle-orm'; async function main() { 
await db.update(customers).set({ apartment: '508' }).where(eq(customers.id, 6)); 
console.log('Updated Customer 6 apartment to 508');
process.exit(0); } main();
