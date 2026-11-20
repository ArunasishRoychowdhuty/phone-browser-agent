const puppeteer = require("puppeteer-core");

(async () => {
  try {
    const b = await puppeteer.connect({browserURL: "http://127.0.0.1:9224", defaultViewport: null});
    const pages = await b.pages();
    let page = pages.find(p => p.url().includes("truelancer.com"));
    await page.bringToFront();

    console.log("Navigating to https://www.truelancer.com/onboarding/profile...");
    await page.goto("https://www.truelancer.com/onboarding/profile", {waitUntil: "domcontentloaded", timeout: 20000});
    await new Promise(r => setTimeout(r, 4000));

    console.log("Onboarding URL:", page.url());
    console.log("Onboarding Title:", await page.title());

    const profileForm = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll("input, textarea, select, button")).map(el => ({
        tag: el.tagName,
        type: el.type,
        placeholder: el.placeholder,
        name: el.name,
        id: el.id,
        text: (el.innerText || "").trim().slice(0, 50)
      })).filter(x => x.placeholder || x.text || x.name);
      return {
        inputs,
        textSnippet: document.body.innerText.slice(0, 1500)
      };
    });

    console.log("TRUELANCER PROFILE FORM:", JSON.stringify(profileForm, null, 2));

    await b.disconnect();
  } catch (err) {
    console.error("Error:", err);
  }
})();
