const puppeteer = require("puppeteer-core");

(async () => {
  try {
    const b = await puppeteer.connect({browserURL: "http://127.0.0.1:9224", defaultViewport: null});
    const page = (await b.pages()).find(p => p.url().includes("seller_onboarding"));
    await page.bringToFront();

    // 1. Click "Add education"
    console.log("Clicking Add education...");
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button, div[role=button]"));
      const b = btns.find(x => x.innerText.includes("Add education"));
      if (b) b.click();
    });

    await new Promise(r => setTimeout(r, 1500));

    // Inspect inputs in education modal
    const eduInfo = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll("input")).map(i => ({
        placeholder: i.placeholder,
        value: i.value,
        type: i.type
      }));
      return inputs;
    });

    console.log("EDUCATION INPUTS:", JSON.stringify(eduInfo.filter(x => x.placeholder || x.value), null, 2));

    await b.disconnect();
  } catch (e) {
    console.error("Error:", e);
  }
})();
