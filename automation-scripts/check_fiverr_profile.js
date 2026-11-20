const puppeteer = require("puppeteer-core");

(async () => {
  try {
    const b = await puppeteer.connect({browserURL: "http://127.0.0.1:9224", defaultViewport: null});
    const pages = await b.pages();
    let page = pages.find(p => p.url().includes("fiverr.com"));
    if (!page) {
      console.log("No fiverr page open, opening one...");
      page = await b.newPage();
    }

    await page.bringToFront();
    await page.goto("https://www.fiverr.com/arunasishboshro", {waitUntil: "networkidle2", timeout: 20000});
    await new Promise(r => setTimeout(r, 4000));

    console.log("Profile URL:", page.url());
    console.log("Profile Title:", await page.title());

    const profileData = await page.evaluate(() => {
      return {
        url: window.location.href,
        title: document.title,
        bodyText: document.body.innerText
      };
    });

    console.log("=== PROFILE BODY TEXT ===");
    console.log(profileData.bodyText.slice(0, 3000));
    await b.disconnect();
  } catch (err) {
    console.error("ERROR:", err);
  }
})();
