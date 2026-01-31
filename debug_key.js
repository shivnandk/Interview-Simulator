const https = require('https');
require('dotenv').config();

const API_KEY = process.env.GEMINI_API_KEY;
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;

console.log("Querying:", `https://generativelanguage.googleapis.com/v1beta/models?key=HIDDEN`);

https.get(url, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log(`Status Code: ${res.statusCode}`);
        try {
            const json = JSON.parse(data);
            if (json.error) {
                console.error("API Error:", JSON.stringify(json.error, null, 2));
            } else if (json.models) {
                console.log("Available Models:");
                json.models.forEach(m => console.log(` - ${m.name}`));
            } else {
                console.log("Response:", data);
            }
        } catch (e) {
            console.error("Parse Error:", e);
            console.log("Raw Data:", data);
        }
    });

}).on("error", (err) => {
    console.error("Network Error:", err.message);
});
