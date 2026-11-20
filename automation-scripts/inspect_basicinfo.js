const puppeteer = require("puppeteer-core");

(async () => {
  try {
    const b = await puppeteer.connect({browserURL: "http://127.0.0.1:9224", defaultViewport: null});
    const page = (await b.pages()).find(p => p.url().includes("truelancer.com"));
    await page.bringToFront();

    const inputs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("input, textarea")).map(el => ({
        tag: el.tagName,
        name: el.name,
        id: el.id,
        placeholder: el.placeholder,
        value: el.value,
        type: el.type
      }));
    });

    console.log("ALL BASICINFO INPUTS:", JSON.stringify(inputs, null, 2));
    await b.disconnect();
  } catch (err) {
    console.error("Error:", err);
  }
})();
