import { db } from './src/config/database'; import { customers, users, stores } from './src/db/schema'; import { eq } from 'drizzle-orm'; async function main() { 
const c = await db.select().from(customers).where(eq(customers.id, 6)); 
console.log('Customer:', c);
if (c.length > 0) {
    const u = await db.select().from(users).where(eq(users.id, c[0].userId));
    console.log('User:', u);
    const s = await db.select().from(stores).where(eq(stores.id, c[0].storeId));
    console.log('Store:', s);
}
process.exit(0); } main();
