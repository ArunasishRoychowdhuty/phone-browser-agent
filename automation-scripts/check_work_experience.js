const puppeteer = require("puppeteer-core");

(async () => {
  try {
    const b = await puppeteer.connect({browserURL: "http://127.0.0.1:9224", defaultViewport: null});
    const page = (await b.pages()).find(p => p.url().includes("seller_onboarding"));
    await page.bringToFront();

    // Click "Add work experience"
    console.log("Clicking Add work experience...");
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button, div[role=button]"));
      const b = btns.find(x => x.innerText.includes("Add work experience"));
      if (b) b.click();
    });

    await new Promise(r => setTimeout(r, 1500));

    const workInputs = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll("input, textarea")).map(i => ({
        tag: i.tagName,
        placeholder: i.placeholder,
        value: i.value,
        type: i.type,
        name: i.name
      }));
      const btns = Array.from(document.querySelectorAll("button")).map(b => b.innerText.trim()).filter(Boolean);
      return { inputs, btns, textSnippet: document.body.innerText.slice(0, 1500) };
    });

    console.log("WORK EXPERIENCE INFO:", JSON.stringify(workInputs, null, 2));

    await b.disconnect();
  } catch (e) {
    console.error("Error:", e);
  }
})();
