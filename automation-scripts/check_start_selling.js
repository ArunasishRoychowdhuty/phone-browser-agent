const puppeteer = require("puppeteer-core");

(async () => {
  try {
    const b = await puppeteer.connect({browserURL: "http://127.0.0.1:9224", defaultViewport: null});
    const pages = await b.pages();
    let page = pages.find(p => p.url().includes("fiverr.com"));
    await page.bringToFront();

    // Check start_selling first
    console.log("Navigating to https://www.fiverr.com/start_selling...");
    await page.goto("https://www.fiverr.com/start_selling", {waitUntil: "domcontentloaded", timeout: 15000});
    await new Promise(r => setTimeout(r, 4000));

    console.log("After start_selling URL:", page.url());
    console.log("Title:", await page.title());
    console.log("Text:\n", (await page.evaluate(() => document.body.innerText)).slice(0, 1500));

    await b.disconnect();
  } catch (e) {
    console.error("Error:", e);
  }
})();
