
import app from './app';

async function verify() {
    console.log("🧪 Testing CORS Headers...");

    // Simulate a request from the Admin Dashboard
    const req = new Request('http://localhost/health', {
        headers: {
            'Origin': 'https://admin.rakhangi.shop'
        }
    });

    const res = await app.fetch(req);
    const originHeader = res.headers.get('Access-Control-Allow-Origin');

    console.log(`📡 Status: ${res.status}`);
    console.log(`🎯 Origin Header: ${originHeader || 'MISSING'}`);

    if (originHeader === 'https://admin.rakhangi.shop') {
        console.log("✅ CORS Verification: PASSED");
        process.exit(0);
    } else {
        console.error("❌ CORS Verification: FAILED");
        process.exit(1);
    }
}

verify().catch(console.error);
