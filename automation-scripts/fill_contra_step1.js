const puppeteer = require("puppeteer-core");

(async () => {
  try {
    const b = await puppeteer.connect({browserURL: "http://127.0.0.1:9224", defaultViewport: null});
    const page = (await b.pages()).find(p => p.url().includes("contra.com"));
    await page.bringToFront();

    console.log("Filling Contra Step 1 of 3...");

    // First Name
    const fn = await page.$('input[name="firstName"]');
    if (fn) {
      await fn.click({clickCount: 3});
      await fn.type("Arunasish", {delay: 20});
    }

    // Last Name
    const ln = await page.$('input[name="lastName"]');
    if (ln) {
      await ln.click({clickCount: 3});
      await ln.type("Roy Chowdhury", {delay: 20});
    }

    // Personal one-liner
    const oneLiner = await page.$('input[name="title"]') || 
                     await page.$('textarea[name="title"]') || 
                     await page.$('input[placeholder*="brand and product"]') ||
                     await page.$('input[maxlength="60"]') ||
                     (await page.$$('input[type="text"]'))[2];

    if (oneLiner) {
      await oneLiner.click({clickCount: 3});
      await oneLiner.type("Junior AI Automation & Web Developer", {delay: 20});
      console.log("Set Personal one-liner");
    }

    await new Promise(r => setTimeout(r, 1000));

    // Click Continue
    const clickedContinue = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button, input[type=submit]"));
      const c = btns.find(b => b.innerText && b.innerText.trim() === "Continue" && !b.disabled);
      if (c) {
        c.click();
        return true;
      }
      return false;
    });

    console.log("Clicked Continue:", clickedContinue);
    await new Promise(r => setTimeout(r, 4000));

    console.log("URL after step 1:", page.url());
    console.log("Text after step 1:\n", (await page.evaluate(() => document.body.innerText)).slice(0, 1000));

    // Save Contra cookies
    const cookies = await page.cookies();
    const fs = require("fs");
    fs.writeFileSync("/data/data/com.termux/files/home/phone-browser-agent/saved-sessions/cookies/contra.json", JSON.stringify(cookies, null, 2));
    console.log("Saved Contra cookies!");

    await b.disconnect();
  } catch (err) {
    console.error("Error:", err);
  }
})();
