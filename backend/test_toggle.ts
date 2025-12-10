
import { db } from './src/config/database';
import { users } from './src/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
    try {
        const loginRes = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@delivery.com', password: 'password123' })
        });

        if (!loginRes.ok) {
            console.error('Login failed:', await loginRes.text());
            return;
        }

        const loginData = await loginRes.json();
        const token = loginData.token;
        console.log('Got token:', !!token);

        // Find a staff member
        const staffRes = await fetch('http://localhost:3000/api/staff?limit=1', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const staffData = await staffRes.json();
        const staffId = staffData.staff[0]?.id;
        console.log('Testing/Toggling staff ID:', staffId);

        if (staffId) {
            const toggleRes = await fetch('http://localhost:3000/api/staff/' + staffId + '/status', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify({ isActive: false })
            });
            console.log('Toggle status:', toggleRes.status);
            const text = await toggleRes.text();
            console.log('Toggle response:', text);
        }
    } catch (e) {
        console.error(e);
    }
}

main();
