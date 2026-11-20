const puppeteer = require("puppeteer-core");

(async () => {
  try {
    const b = await puppeteer.connect({browserURL: "http://127.0.0.1:9224", defaultViewport: null});
    const page = (await b.pages()).find(p => p.url().includes("contra.com"));
    await page.bringToFront();

    console.log("Selecting 'Get hired and get paid' on Contra...");
    const selected = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll("div, label, span, button"));
      const target = all.find(el => el.innerText && el.innerText.includes("Get hired and get paid"));
      if (target) {
        target.click();
        return true;
      }
      return false;
    });

    console.log("Selected target:", selected);
    await new Promise(r => setTimeout(r, 1000));

    // Click Continue
    const clickedContinue = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const c = btns.find(b => b.innerText && b.innerText.trim() === "Continue" && !b.disabled);
      if (c) {
        c.click();
        return true;
      }
      return false;
    });

    console.log("Clicked Continue:", clickedContinue);
    await new Promise(r => setTimeout(r, 4000));

    console.log("URL after step 2:", page.url());
    const step3Text = await page.evaluate(() => document.body.innerText.slice(0, 1500));
    console.log("Text after step 2:\n", step3Text);

    // Save updated cookies
    const cookies = await page.cookies();
    const fs = require("fs");
    fs.writeFileSync("/data/data/com.termux/files/home/phone-browser-agent/saved-sessions/cookies/contra.json", JSON.stringify(cookies, null, 2));

    await b.disconnect();
  } catch (err) {
    console.error("Error:", err);
  }
})();
