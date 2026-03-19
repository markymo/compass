const { chromium } = require("playwright");
(async () => {
    try {
        const browser = await chromium.launch({ headless: true });
        const context = await browser.newContext();
        await context.addCookies([
            {
                name: "session",
                value: "mock_session",
                domain: "localhost",
                path: "/",
            }
        ]);
        const page = await context.newPage();
        const logs = [];
        page.on("console", msg => logs.push(`[${msg.type()}] ${msg.text()}`));
        page.on("pageerror", err => logs.push(`[PAGE ERROR] ${err.message}`));
        page.on("response", res => {
            if (res.status() >= 400) logs.push(`[HTTP ${res.status()}] ${res.url()}`);
        });
        
        console.log("Navigating to URL...");
        await page.goto("http://localhost:3000/app/admin/master-data/fields", { waitUntil: "networkidle" });
        console.log("---- BROWSER LOGS ----");
        console.log(logs.join("\n"));
        await browser.close();
    } catch(e) {
        console.error(e);
    }
})();
