const puppeteer = require("puppeteer-core");

(async () => {
  try {
    const b = await puppeteer.connect({browserURL: "http://127.0.0.1:9224", defaultViewport: null});
    const page = await b.newPage();
    console.log("Navigating to Truelancer signup...");
    await page.goto("https://www.truelancer.com/signup", {waitUntil: "domcontentloaded", timeout: 20000});
    await new Promise(r => setTimeout(r, 4000));

    console.log("Truelancer URL:", page.url());
    console.log("Title:", await page.title());

    const formDetails = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll("input, button, a")).map(el => ({
        tag: el.tagName,
        type: el.type || null,
        placeholder: el.placeholder || null,
        name: el.name || null,
        id: el.id || null,
        text: (el.innerText || "").trim().slice(0, 50),
        href: el.href || null
      })).filter(x => x.placeholder || x.text || x.name);
      return {
        url: window.location.href,
        title: document.title,
        inputs: inputs.slice(0, 30),
        bodySnippet: document.body.innerText.slice(0, 1000)
      };
    });

    console.log("FORM DETAILS:", JSON.stringify(formDetails, null, 2));
    await b.disconnect();
  } catch (err) {
    console.error("Error:", err);
  }
})();
