const puppeteer = require("puppeteer-core");

(async () => {
  try {
    const b = await puppeteer.connect({browserURL: "http://127.0.0.1:9224", defaultViewport: null});
    const page = (await b.pages()).find(p => p.url().includes("seller_onboarding"));
    await page.bringToFront();

    // Make sure title is set
    const titleInput = await page.$("input[placeholder=\"Add title\"]");
    if (titleInput) {
      const cur = await page.evaluate(el => el.value, titleInput);
      if (!cur || cur === "Add title") {
        await titleInput.click({clickCount: 3});
        await page.keyboard.type("AI Automation & Web Developer", {delay: 20});
        console.log("Retyped title");
      } else {
        console.log("Title is already:", cur);
      }
    }

    async function addOneSkill(name, level = "PRO") {
      console.log(`Starting add skill: ${name}`);
      // Find and click the Add skills button or Add new button
      const clickedOpen = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button, div[role=button]"));
        const b = btns.find(x => x.innerText.includes("Add skills and expertise") || x.innerText.trim() === "Add new");
        if (b) {
          b.click();
          return true;
        }
        return false;
      });
      console.log("Clicked open skill modal:", clickedOpen);
      await new Promise(r => setTimeout(r, 1500));

      const input = await page.$("input[placeholder*=\"Add skill\"]");
      if (!input) {
        console.log("Skill input not found for:", name);
        return false;
      }

      await input.click({clickCount: 3});
      await page.keyboard.type(name, {delay: 30});
      await new Promise(r => setTimeout(r, 1000));

      // Check if autocomplete dropdown options appeared
      const picked = await page.evaluate((skillName) => {
        const options = Array.from(document.querySelectorAll("li, div[role=option], span, div")).filter(el => {
          const t = el.innerText ? el.innerText.trim() : "";
          return t.toLowerCase() === skillName.toLowerCase() && el.children.length === 0;
        });
        if (options.length > 0) {
          options[0].click();
          return "Clicked option: " + options[0].innerText;
        }
        return "No exact option";
      }, name);
      console.log("Autocomplete result:", picked);

      // Select Level radio
      await page.evaluate((lvl) => {
        const r = document.querySelector(`input[value="${lvl}"]`);
        if (r) r.click();
      }, level);

      await new Promise(r => setTimeout(r, 500));

      // Click Add button
      const clickedAdd = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        const addBtn = btns.find(b => b.innerText.trim() === "Add" && !b.disabled);
        if (addBtn) {
          addBtn.click();
          return true;
        }
        return false;
      });
      console.log("Clicked Add button:", clickedAdd);
      await new Promise(r => setTimeout(r, 2000));
      return true;
    }

    await addOneSkill("Python", "PRO");
    await addOneSkill("WordPress", "PRO");
    await addOneSkill("Web Development", "PRO");

    const fullPageText = await page.evaluate(() => document.body.innerText);
    console.log("FULL PAGE TEXT:\n", fullPageText);

    await b.disconnect();
  } catch (e) {
    console.error("Error:", e);
  }
})();
