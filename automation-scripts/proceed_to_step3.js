const puppeteer = require("puppeteer-core");

(async () => {
  try {
    const b = await puppeteer.connect({browserURL: "http://127.0.0.1:9224", defaultViewport: null});
    const page = (await b.pages()).find(p => p.url().includes("truelancer.com"));
    await page.bringToFront();

    console.log("Clicking Save Demand Stack...");
    const clicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const btn = btns.find(b => b.innerText && b.innerText.includes("Save Demand Stack"));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });

    console.log("Clicked:", clicked);
    await new Promise(r => setTimeout(r, 4000));

    console.log("URL after Save Demand Stack:", page.url());
    console.log("Title after Save Demand Stack:", await page.title());

    // Inspect Step 3 form elements
    const step3Info = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll("input, textarea, select, button")).map(el => ({
        tag: el.tagName,
        type: el.type,
        placeholder: el.placeholder,
        name: el.name,
        id: el.id,
        text: (el.innerText || "").trim().slice(0, 50)
      })).filter(x => x.placeholder || x.text || x.name);
      return {
        inputs,
        bodySnippet: document.body.innerText.slice(0, 1500)
      };
    });

    console.log("STEP 3 FORM INFO:", JSON.stringify(step3Info, null, 2));

    await b.disconnect();
  } catch (err) {
    console.error("Error:", err);
  }
})();
