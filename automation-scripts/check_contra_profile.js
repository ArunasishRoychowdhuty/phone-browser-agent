const puppeteer = require("puppeteer-core");

(async () => {
  try {
    const b = await puppeteer.connect({browserURL: "http://127.0.0.1:9224", defaultViewport: null});
    const page = (await b.pages()).find(p => p.url().includes("contra.com"));
    await page.bringToFront();

    console.log("Navigating to Contra Profile edit...");
    await page.goto("https://contra.com/w/arunasish_roychowdhury_y2b2c1kt/profile", {waitUntil: "domcontentloaded", timeout: 20000});
    await new Promise(r => setTimeout(r, 4000));

    console.log("Profile URL:", page.url());
    console.log("Profile Title:", await page.title());
    console.log("Profile text snippet:\n", (await page.evaluate(() => document.body.innerText)).slice(0, 1000));

    await b.disconnect();
  } catch (err) {
    console.error("Error:", err);
  }
})();
