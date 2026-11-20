const puppeteer = require("puppeteer-core");

(async () => {
  try {
    const b = await puppeteer.connect({browserURL: "http://127.0.0.1:9224", defaultViewport: null});
    const page = (await b.pages()).find(p => p.url().includes("seller_onboarding"));
    await page.bringToFront();

    const fields = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll("input, textarea")).map(el => ({
        tag: el.tagName,
        type: el.type,
        placeholder: el.placeholder,
        value: el.value,
        name: el.name,
        id: el.id
      }));
      const buttons = Array.from(document.querySelectorAll("button")).map(el => ({
        text: (el.innerText || "").trim(),
        ariaLabel: el.getAttribute("aria-label"),
        disabled: el.disabled
      })).filter(x => x.text || x.ariaLabel);

      return { inputs, buttons };
    });

    console.log("FIELDS:", JSON.stringify(fields, null, 2));
    await b.disconnect();
  } catch (e) {
    console.error("Error:", e);
  }
})();
