const puppeteer = require("puppeteer-core");

(async () => {
  try {
    const b = await puppeteer.connect({browserURL: "http://127.0.0.1:9224", defaultViewport: null});
    const page = (await b.pages()).find(p => p.url().includes("peopleperhour.com"));
    await page.bringToFront();

    const formDetails = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll("input, textarea, select, button")).map(el => ({
        tag: el.tagName,
        type: el.type,
        placeholder: el.placeholder,
        name: el.name,
        id: el.id,
        className: el.className,
        text: (el.innerText || el.value || "").trim().slice(0, 40)
      })).filter(x => x.name || x.placeholder || x.id);
      return inputs;
    });

    console.log("PPH FORM INPUTS:\n", JSON.stringify(formDetails, null, 2));

    await b.disconnect();
  } catch (err) {
    console.error("Error:", err);
  }
})();
