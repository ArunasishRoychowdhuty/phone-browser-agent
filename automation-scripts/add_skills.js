const puppeteer = require("puppeteer-core");

(async () => {
  try {
    const b = await puppeteer.connect({browserURL: "http://127.0.0.1:9224", defaultViewport: null});
    const page = (await b.pages()).find(p => p.url().includes("seller_onboarding"));
    await page.bringToFront();

    // 1. Set title
    const titleInput = await page.$('input[placeholder*="title"]');
    if (titleInput) {
      await titleInput.click();
      await titleInput.type("AI Automation & Web Developer", {delay: 30});
      await page.keyboard.press("Enter");
      console.log("Set Title");
    }

    // 2. Add skills function
    async function addSkill(skillName, level = "PRO") {
      console.log(`Adding skill: ${skillName}...`);
      // Find skill input
      let skillInput = await page.$('input[placeholder*="Add skill or expertise"]');
      if (!skillInput) {
        // Maybe need to click "Add new" or "Add skills"
        const addBtn = await page.evaluateHandle(() => {
          return Array.from(document.querySelectorAll("button, a, div")).find(b => b.innerText.trim() === "Add new" || b.innerText.includes("Add skills"));
        });
        if (addBtn.asElement()) {
          await addBtn.asElement().click();
          await new Promise(r => setTimeout(r, 1000));
          skillInput = await page.$('input[placeholder*="Add skill or expertise"]');
        }
      }

      if (!skillInput) {
        console.log("Could not find skill input for", skillName);
        return;
      }

      await skillInput.click({clickCount: 3});
      await skillInput.type(skillName, {delay: 30});
      await new Promise(r => setTimeout(r, 1000));

      // Check if autocomplete dropdown appeared, click first option if available
      await page.evaluate(() => {
        const option = document.querySelector('ul[role="listbox"] li, div[role="listbox"] div, div[class*="dropdown"] [role="option"]');
        if (option) option.click();
      });

      // Select Level (PRO or INTERMEDIATE)
      await page.evaluate((lvl) => {
        const radio = document.querySelector(`input[value="${lvl}"]`);
        if (radio) radio.click();
      }, level);

      await new Promise(r => setTimeout(r, 800));

      // Click Add
      const added = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        const addBtn = btns.find(b => b.innerText.trim() === "Add" && !b.disabled);
        if (addBtn) {
          addBtn.click();
          return true;
        }
        return false;
      });

      console.log(`Add skill ${skillName} result:`, added);
      await new Promise(r => setTimeout(r, 2000));
    }

    const skillsToAdd = ["Python", "WordPress", "Web Development", "API Integration", "Artificial Intelligence"];
    for (const s of skillsToAdd) {
      await addSkill(s, "PRO");
    }

    const pageState = await page.evaluate(() => {
      return document.body.innerText.slice(0, 1500);
    });

    console.log("PAGE STATE AFTER SKILLS:\n", pageState);

    await b.disconnect();
  } catch (e) {
    console.error("Error:", e);
  }
})();
