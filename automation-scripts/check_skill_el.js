const puppeteer = require("puppeteer-core");

(async () => {
  try {
    const b = await puppeteer.connect({browserURL: "http://127.0.0.1:9224", defaultViewport: null});
    const page = (await b.pages()).find(p => p.url().includes("seller_onboarding"));
    await page.bringToFront();

    // 1. Set title properly
    const titleInput = await page.$('input[placeholder*="title"]');
    if (titleInput) {
      await titleInput.click();
      await page.evaluate(el => {
        el.value = "AI Automation & Web Developer";
        el.dispatchEvent(new Event("input", {bubbles: true}));
        el.dispatchEvent(new Event("change", {bubbles: true}));
      }, titleInput);
      await titleInput.type(" ");
      await page.keyboard.press("Backspace");
    }

    // Inspect skills element
    const skillEl = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll("*"));
      const match = all.filter(el => (el.innerText || "").includes("Add skills and expertise"));
      return match.map(el => ({
        tag: el.tagName,
        className: el.className,
        rect: el.getBoundingClientRect()
      }));
    });

    console.log("Skill elements:", JSON.stringify(skillEl, null, 2));

    await b.disconnect();
  } catch (e) {
    console.error("Error:", e);
  }
})();
