const puppeteer = require("puppeteer-core");

(async () => {
  try {
    const b = await puppeteer.connect({browserURL: "http://127.0.0.1:9224", defaultViewport: null});
    const page = (await b.pages()).find(p => p.url().includes("peopleperhour.com"));
    await page.bringToFront();

    // Check provider radio
    await page.evaluate(() => {
      const p = document.querySelector("#provider");
      if (p) p.click();
    });

    await new Promise(r => setTimeout(r, 1000));

    // Click SIGN UP WITH EMAIL
    const res = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find(b => b.innerText.includes("SIGN UP WITH EMAIL"));
      if (btn) {
        btn.click();
        return "Clicked SIGN UP WITH EMAIL";
      }
      return "Not found";
    });
    console.log("Result:", res);

    await new Promise(r => setTimeout(r, 3000));

    console.log("PPH URL after:", page.url());
    console.log("PPH Title:", await page.title());

    const fields = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll("input, button")).map(el => ({
        tag: el.tagName,
        type: el.type,
        placeholder: el.placeholder,
        name: el.name,
        id: el.id,
        text: (el.innerText || el.value || "").trim().slice(0, 40)
      })).filter(x => x.placeholder || x.name || x.text);
      return {
        inputs,
        textSnippet: document.body.innerText.slice(0, 1000)
      };
    });

    console.log("FIELDS:\n", JSON.stringify(fields, null, 2));

    await b.disconnect();
  } catch (err) {
    console.error("Error:", err);
  }
})();
