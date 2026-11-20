const puppeteer = require("puppeteer-core");

(async () => {
  try {
    const b = await puppeteer.connect({browserURL: "http://127.0.0.1:9224", defaultViewport: null});
    const page = (await b.pages()).find(p => p.url().includes("truelancer.com"));
    await page.bringToFront();

    // Click Category dropdown
    const catInput = await page.$('input[name="category"]');
    if (catInput) {
      await catInput.click();
      await new Promise(r => setTimeout(r, 1000));
      const catOptions = await page.evaluate(() => {
        return Array.from(document.querySelectorAll("li, div[role=option], [class*=option]")).map(o => o.innerText.trim()).filter(Boolean);
      });
      console.log("CATEGORY OPTIONS:", catOptions);
      // Click IT & Programming if exists
      await page.evaluate(() => {
        const item = Array.from(document.querySelectorAll("li, div[role=option]")).find(o => /it|program|software|web/i.test(o.innerText));
        if (item) item.click();
      });
    }

    await new Promise(r => setTimeout(r, 1000));

    // Click Availability dropdown
    const availInput = await page.$('input[name="availability"]');
    if (availInput) {
      await availInput.click();
      await new Promise(r => setTimeout(r, 1000));
      await page.evaluate(() => {
        const item = Array.from(document.querySelectorAll("li, div[role=option]")).find(o => /full|part/i.test(o.innerText));
        if (item) item.click();
      });
    }

    await new Promise(r => setTimeout(r, 1000));

    // Primary skill
    const skillInput = await page.$('#skill');
    if (skillInput) {
      await skillInput.click();
      await skillInput.type("Python", {delay: 30});
      await new Promise(r => setTimeout(r, 1000));
      await page.evaluate(() => {
        const item = Array.from(document.querySelectorAll("li, div[role=option]")).find(o => /python/i.test(o.innerText));
        if (item) item.click();
      });
    }

    await new Promise(r => setTimeout(r, 1000));

    // Experience Years
    const expYears = await page.$('input[name="experienceYears"]');
    if (expYears) {
      await expYears.click();
      await expYears.type("2");
    }

    // Submit step 1
    const submitBtn = await page.$('button[type="submit"]');
    if (submitBtn) {
      await submitBtn.click();
      console.log("Clicked Update My Profile");
    }

    await new Promise(r => setTimeout(r, 4000));
    console.log("URL after step 1:", page.url());
    console.log("Page text after step 1:\n", (await page.evaluate(() => document.body.innerText)).slice(0, 1000));

    await b.disconnect();
  } catch (err) {
    console.error("Error:", err);
  }
})();
