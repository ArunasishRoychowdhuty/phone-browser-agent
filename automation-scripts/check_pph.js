const puppeteer = require("puppeteer-core");

(async () => {
  try {
    const b = await puppeteer.connect({browserURL: "http://127.0.0.1:9224", defaultViewport: null});
    const page = await b.newPage();
    console.log("Navigating to PeoplePerHour...");
    await page.goto("https://www.peopleperhour.com/site/register", {waitUntil: "domcontentloaded", timeout: 25000});
    await new Promise(r => setTimeout(r, 4000));

    console.log("PPH URL:", page.url());
    console.log("PPH Title:", await page.title());

    const pphData = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll("input, button, a")).map(el => ({
        tag: el.tagName,
        type: el.type,
        placeholder: el.placeholder,
        name: el.name,
        id: el.id,
        text: (el.innerText || el.value || "").trim().slice(0, 50),
        href: el.href || null
      })).filter(x => x.text || x.name || x.placeholder);
      return {
        inputs: inputs.slice(0, 25),
        snippet: document.body.innerText.slice(0, 1000)
      };
    });

    console.log("PPH DATA:\n", JSON.stringify(pphData, null, 2));

    await b.disconnect();
  } catch (err) {
    console.error("Error:", err);
  }
})();
