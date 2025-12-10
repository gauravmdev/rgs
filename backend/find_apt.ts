import { db } from './src/config/database'; import { customers, users } from './src/db/schema'; import { ilike, eq } from 'drizzle-orm'; async function main() { 
const c = await db.select().from(customers).where(ilike(customers.apartment, '%508%')); 
console.log('Customers with 508:', c);
if (c.length > 0) {
     const u = await db.select().from(users).where(eq(users.id, c[0].userId));
     console.log('User details:', u);
}
process.exit(0); } main();
