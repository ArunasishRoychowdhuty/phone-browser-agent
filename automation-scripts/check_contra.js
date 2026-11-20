const puppeteer = require("puppeteer-core");

(async () => {
  try {
    const b = await puppeteer.connect({browserURL: "http://127.0.0.1:9224", defaultViewport: null});
    const page = await b.newPage();
    console.log("Navigating to Contra signup...");
    await page.goto("https://contra.com/join", {waitUntil: "domcontentloaded", timeout: 25000});
    await new Promise(r => setTimeout(r, 4000));

    console.log("Contra URL:", page.url());
    console.log("Contra Title:", await page.title());

    const contraData = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button, a, input")).map(el => ({
        tag: el.tagName,
        type: el.type,
        text: (el.innerText || el.value || "").trim().slice(0, 50),
        href: el.href || null
      })).filter(x => x.text);
      return {
        url: window.location.href,
        title: document.title,
        elements: btns.slice(0, 20),
        textSnippet: document.body.innerText.slice(0, 1000)
      };
    });

    console.log("CONTRA DATA:", JSON.stringify(contraData, null, 2));

    await b.disconnect();
  } catch (err) {
    console.error("Error:", err);
  }
})();
