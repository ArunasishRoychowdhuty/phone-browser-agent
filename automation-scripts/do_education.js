const puppeteer = require("puppeteer-core");

(async () => {
  try {
    const b = await puppeteer.connect({browserURL: "http://127.0.0.1:9224", defaultViewport: null});
    const page = (await b.pages()).find(p => p.url().includes("seller_onboarding"));
    await page.bringToFront();

    // 1. Click "Add education"
    console.log("Clicking Add education...");
    const clickedOpen = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button, div[role=button]"));
      const b = btns.find(x => x.innerText.includes("Add education") || x.innerText.trim() === "Add new");
      if (b) {
        b.click();
        return true;
      }
      return false;
    });
    console.log("Clicked open:", clickedOpen);
    await new Promise(r => setTimeout(r, 1500));

    // 2. Country
    const countryInput = await page.$('input[placeholder*="Country"]');
    if (countryInput) {
      await countryInput.click({clickCount: 3});
      await countryInput.type("India", {delay: 30});
      await new Promise(r => setTimeout(r, 800));
      // Click suggestion if any
      await page.evaluate(() => {
        const item = Array.from(document.querySelectorAll("li, div[role=option], span")).find(el => el.innerText && el.innerText.trim() === "India" && el.children.length === 0);
        if (item) item.click();
      });
      console.log("Set Country");
    }

    // 3. School
    const schoolInput = await page.$('input[placeholder*="School"]');
    if (schoolInput) {
      await schoolInput.click({clickCount: 3});
      await schoolInput.type("JIS College", {delay: 30});
      console.log("Set School");
    }

    // 4. Degree
    await page.evaluate(() => {
      const radio = document.querySelector('input[value="ASSOCIATE"]') || document.querySelector('input[value="BSC"]');
      if (radio) radio.click();
    });
    console.log("Selected Degree");

    // 5. Field of study
    const fieldInput = await page.$('input[placeholder*="Field of study"]');
    if (fieldInput) {
      await fieldInput.click({clickCount: 3});
      await fieldInput.type("Computer Science & AI", {delay: 30});
      console.log("Set Field of study");
    }

    // 6. Year
    await page.evaluate(() => {
      const yrRadio = document.querySelector('input[value="2026"]');
      if (yrRadio) yrRadio.click();
    });
    console.log("Selected Year");

    await new Promise(r => setTimeout(r, 800));

    // 7. Click Add
    const addedEdu = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const addBtn = btns.find(b => b.innerText.trim() === "Add" && !b.disabled);
      if (addBtn) {
        addBtn.click();
        return true;
      }
      return false;
    });
    console.log("Clicked Add Education:", addedEdu);

    await new Promise(r => setTimeout(r, 2000));

    const pageText = await page.evaluate(() => document.body.innerText.slice(0, 1600));
    console.log("PAGE TEXT AFTER EDU:\n", pageText);

    await b.disconnect();
  } catch (e) {
    console.error("Error:", e);
  }
})();
