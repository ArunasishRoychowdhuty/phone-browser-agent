const puppeteer = require("puppeteer-core");

(async () => {
  try {
    const b = await puppeteer.connect({browserURL: "http://127.0.0.1:9224", defaultViewport: null});
    const page = (await b.pages()).find(p => p.url().includes("truelancer.com"));
    await page.bringToFront();

    const info = await page.evaluate(() => {
      const skillEl = document.querySelector("#skill");
      const yearsEl = document.querySelector('input[name="experienceYears"]');
      const monthsEl = document.querySelector('input[name="experienceMonths"]');
      return {
        skill: skillEl ? { tag: skillEl.tagName, type: skillEl.type, id: skillEl.id, class: skillEl.className } : null,
        years: yearsEl ? { tag: yearsEl.tagName, type: yearsEl.type, class: yearsEl.className } : null,
        months: monthsEl ? { tag: monthsEl.tagName, type: monthsEl.type, class: monthsEl.className } : null
      };
    });

    console.log("ELEMENTS:", JSON.stringify(info, null, 2));

    // Click skill input and type
    const sInput = await page.$("#skill");
    if (sInput) {
      await sInput.click();
      await page.keyboard.type("Python");
      await new Promise(r => setTimeout(r, 1500));
      const dropdownItems = await page.evaluate(() => {
        return Array.from(document.querySelectorAll("li, div[role=option], .MuiAutocomplete-option")).map(el => el.innerText);
      });
      console.log("SKILL DROPDOWN:", dropdownItems);
      // Click first dropdown item
      await page.evaluate(() => {
        const opt = document.querySelector("li, div[role=option], .MuiAutocomplete-option");
        if (opt) opt.click();
      });
    }

    await new Promise(r => setTimeout(r, 1000));

    // Click years input
    const yInput = await page.$('input[name="experienceYears"]');
    if (yInput) {
      await yInput.click();
      await new Promise(r => setTimeout(r, 1000));
      const yearOpts = await page.evaluate(() => {
        return Array.from(document.querySelectorAll("li, div[role=option]")).map(el => el.innerText);
      });
      console.log("YEAR OPTS:", yearOpts);
      await page.evaluate(() => {
        const opt = Array.from(document.querySelectorAll("li, div[role=option]")).find(el => el.innerText.trim() === "1" || el.innerText.trim() === "2");
        if (opt) opt.click();
      });
    }

    await new Promise(r => setTimeout(r, 1000));

    // Submit
    const submitBtn = await page.$('button[type="submit"]');
    if (submitBtn) {
      await submitBtn.click();
      console.log("Submitted!");
    }

    await new Promise(r => setTimeout(r, 4000));
    console.log("New URL:", page.url());
    console.log("New Title:", await page.title());
    console.log("New Page Text:\n", (await page.evaluate(() => document.body.innerText)).slice(0, 1000));

    await b.disconnect();
  } catch (err) {
    console.error("Error:", err);
  }
})();
