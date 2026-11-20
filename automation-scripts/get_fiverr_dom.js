const puppeteer = require("puppeteer-core");

(async () => {
  try {
    const b = await puppeteer.connect({browserURL: "http://127.0.0.1:9224", defaultViewport: null});
    const pages = await b.pages();
    let page = pages.find(p => p.url().includes("fiverr.com"));
    if (!page) {
      console.log("No fiverr page");
      process.exit(1);
    }
    await page.bringToFront();
    console.log("Current URL:", page.url());

    // Check if we can navigate to profile using window.location.href
    const currentUrl = page.url();
    if (!currentUrl.includes("/arunasishboshro")) {
      await page.evaluate(() => {
        window.location.href = "https://www.fiverr.com/arunasishboshro";
      });
      console.log("Triggered navigation to https://www.fiverr.com/arunasishboshro");
      await new Promise(r => setTimeout(r, 6000));
    }

    console.log("Active URL:", page.url());
    console.log("Active Title:", await page.title());

    const pageContent = await page.evaluate(() => {
      return {
        url: window.location.href,
        title: document.title,
        text: document.body.innerText.slice(0, 4000),
        editableElements: Array.from(document.querySelectorAll("button, a, input, textarea, [role=button]")).map(el => ({
          tag: el.tagName,
          text: (el.innerText || el.value || el.getAttribute("aria-label") || "").trim(),
          className: el.className,
          href: el.href || null
        })).filter(x => x.text && x.text.length < 50)
      };
    });

    console.log("PAGE TEXT:\n", pageContent.text);
    console.log("\nBUTTONS/LINKS:\n", JSON.stringify(pageContent.editableElements.slice(0, 40), null, 2));

    await b.disconnect();
  } catch (e) {
    console.error("Script error:", e);
  }
})();
