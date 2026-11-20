const puppeteer = require("puppeteer-core");

(async () => {
  try {
    const b = await puppeteer.connect({browserURL: "http://127.0.0.1:9224", defaultViewport: null});
    const page = (await b.pages()).find(p => p.url().includes("seller_onboarding"));
    await page.bringToFront();

    // Click "Add languages"
    console.log("Clicking Add languages...");
    await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll("a, button, div"));
      const btn = all.find(el => el.innerText.trim() === "Add languages");
      if (btn) btn.click();
    });

    await new Promise(r => setTimeout(r, 2000));

    const langInfo = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll("input, select")).map(el => ({
        tag: el.tagName,
        type: el.type,
        placeholder: el.placeholder,
        value: el.value,
        options: el.tagName === "SELECT" ? Array.from(el.options).map(o => o.text) : []
      }));
      const buttons = Array.from(document.querySelectorAll("button")).map(el => ({
        text: (el.innerText || "").trim(),
        disabled: el.disabled
      })).filter(x => x.text);

      return {
        inputs,
        buttons,
        visibleText: document.body.innerText.slice(0, 1500)
      };
    });

    console.log("LANG INFO:", JSON.stringify(langInfo, null, 2));
    await b.disconnect();
  } catch (e) {
    console.error("Error:", e);
  }
})();
