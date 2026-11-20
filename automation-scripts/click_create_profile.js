const puppeteer = require("puppeteer-core");

(async () => {
  try {
    const b = await puppeteer.connect({browserURL: "http://127.0.0.1:9224", defaultViewport: null});
    const page = (await b.pages()).find(p => p.url().includes("start_selling"));
    await page.bringToFront();

    // Click "Create your profile" or "Get started"
    const clicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button, a"));
      const btn = btns.find(b => /create your profile|get started/i.test(b.innerText));
      if (btn) {
        btn.click();
        return btn.innerText;
      }
      return null;
    });

    console.log("Clicked:", clicked);
    await new Promise(r => setTimeout(r, 4000));

    console.log("Current URL after click:", page.url());
    console.log("Current Title:", await page.title());

    const pageText = await page.evaluate(() => document.body.innerText.slice(0, 2000));
    console.log("Page Text:\n", pageText);

    await b.disconnect();
  } catch (e) {
    console.error("Error:", e);
  }
})();
