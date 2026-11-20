const puppeteer = require("puppeteer-core");

(async () => {
  try {
    const b = await puppeteer.connect({browserURL: "http://127.0.0.1:9224", defaultViewport: null});
    const page = (await b.pages()).find(p => p.url().includes("seller_onboarding"));
    await page.bringToFront();

    const clicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const btn = btns.find(b => b.innerText.includes("Add skills and expertise"));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });

    console.log("Clicked button:", clicked);
    await new Promise(r => setTimeout(r, 2000));

    const pageState = await page.evaluate(() => {
      return {
        inputs: Array.from(document.querySelectorAll("input")).map(i => ({
          placeholder: i.placeholder,
          value: i.value,
          type: i.type
        })),
        buttons: Array.from(document.querySelectorAll("button")).map(b => b.innerText.trim()).filter(Boolean),
        text: document.body.innerText.slice(0, 1500)
      };
    });

    console.log("PAGE STATE:", JSON.stringify(pageState, null, 2));

    await b.disconnect();
  } catch (e) {
    console.error("Error:", e);
  }
})();
