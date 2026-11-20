const puppeteer = require("puppeteer-core");

(async () => {
  try {
    const b = await puppeteer.connect({browserURL: "http://127.0.0.1:9224", defaultViewport: null});
    const page = (await b.pages()).find(p => p.url().includes("seller_onboarding"));
    await page.bringToFront();

    const sections = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll("button, a, [role=button]")).map((el, i) => ({
        index: i,
        tag: el.tagName,
        text: (el.innerText || "").trim(),
        role: el.getAttribute("role"),
        ariaLabel: el.getAttribute("aria-label")
      })).filter(x => x.text);
      return items;
    });

    console.log("SECTIONS ON PAGE:", JSON.stringify(sections, null, 2));
    await b.disconnect();
  } catch (e) {
    console.error("Error:", e);
  }
})();
