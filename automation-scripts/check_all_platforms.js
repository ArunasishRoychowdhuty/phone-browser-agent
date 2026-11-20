const puppeteer = require("puppeteer-core");

(async () => {
  try {
    const b = await puppeteer.connect({browserURL: "http://127.0.0.1:9224", defaultViewport: null});
    const sites = [
      { name: "Contra", url: "https://contra.com/" },
      { name: "PeoplePerHour", url: "https://www.peopleperhour.com/site/register" },
      { name: "WorknHire", url: "https://www.worknhire.com/signup" },
      { name: "Codeable", url: "https://www.codeable.io/freelancers/" }
    ];

    const results = [];

    for (const site of sites) {
      console.log(`Checking ${site.name} at ${site.url}...`);
      try {
        const page = await b.newPage();
        await page.goto(site.url, {waitUntil: "domcontentloaded", timeout: 25000});
        await new Promise(r => setTimeout(r, 4000));
        
        const info = await page.evaluate(() => {
          return {
            title: document.title,
            url: window.location.href,
            buttons: Array.from(document.querySelectorAll("button, a, input[type=submit]")).map(el => (el.innerText || el.value || "").trim()).filter(t => t && t.length < 40).slice(0, 15),
            textSnippet: document.body.innerText.slice(0, 500)
          };
        });

        results.push({ name: site.name, ...info });
        console.log(`Loaded ${site.name}:`, info.title);
      } catch (e) {
        console.log(`Failed ${site.name}:`, e.message);
        results.push({ name: site.name, error: e.message });
      }
    }

    console.log("ALL PLATFORMS REPORT:\n", JSON.stringify(results, null, 2));

    await b.disconnect();
  } catch (err) {
    console.error("Global error:", err);
  }
})();
