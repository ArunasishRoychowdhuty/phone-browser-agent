const puppeteer = require("puppeteer-core");

(async () => {
  try {
    const b = await puppeteer.connect({browserURL: "http://127.0.0.1:9224", defaultViewport: null});
    const pages = await b.pages();
    let page = pages.find(p => p.url().includes("fiverr.com"));
    await page.bringToFront();

    const targets = await page.evaluate(() => {
      const allEls = Array.from(document.querySelectorAll("a, button, div, span, p"));
      const matches = [];
      for (const el of allEls) {
        const t = (el.innerText || "").trim();
        if (t.includes("35%") || t.includes("Complete it") || t === "My Profile" || t.includes("Become a Seller")) {
          matches.push({
            tag: el.tagName,
            text: t.slice(0, 80),
            href: el.href || el.closest("a")?.href || null,
            className: el.className
          });
        }
      }
      return matches;
    });

    console.log("MATCHES:", JSON.stringify(targets, null, 2));
    await b.disconnect();
  } catch (e) {
    console.error("Error:", e);
  }
})();
