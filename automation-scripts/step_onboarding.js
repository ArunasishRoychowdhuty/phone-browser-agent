const puppeteer = require("puppeteer-core");

(async () => {
  try {
    const b = await puppeteer.connect({browserURL: "http://127.0.0.1:9224", defaultViewport: null});
    const page = (await b.pages()).find(p => p.url().includes("seller_onboarding"));
    await page.bringToFront();

    // Inspect buttons and radio options
    const elements = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll("button, a, input, [role=button], [role=radio], label"));
      return all.map(el => ({
        tag: el.tagName,
        text: (el.innerText || el.value || "").trim(),
        type: el.type || null,
        className: el.className
      })).filter(x => x.text || x.type);
    });

    console.log("ONBOARDING ELEMENTS:", JSON.stringify(elements, null, 2));

    // Let's click "Continue" button
    const clickedBtn = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const continueBtn = btns.find(b => b.innerText.includes("Continue"));
      if (continueBtn) {
        continueBtn.click();
        return "Clicked Continue";
      }
      return "No Continue button";
    });

    console.log("Click result:", clickedBtn);
    await new Promise(r => setTimeout(r, 4000));

    console.log("New URL:", page.url());
    console.log("New Title:", await page.title());
    console.log("New Page Text:\n", (await page.evaluate(() => document.body.innerText)).slice(0, 2000));

    await b.disconnect();
  } catch (e) {
    console.error("Error:", e);
  }
})();
