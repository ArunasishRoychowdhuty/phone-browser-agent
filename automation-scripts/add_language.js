const puppeteer = require("puppeteer-core");

(async () => {
  try {
    const b = await puppeteer.connect({browserURL: "http://127.0.0.1:9224", defaultViewport: null});
    const page = (await b.pages()).find(p => p.url().includes("seller_onboarding"));
    await page.bringToFront();

    // Select EN
    await page.evaluate(() => {
      const enRadio = document.querySelector('input[value="EN"]');
      if (enRadio) {
        enRadio.click();
        console.log("Selected EN");
      }
      const fluentRadio = document.querySelector('input[value="FLUENT"]');
      if (fluentRadio) {
        fluentRadio.click();
        console.log("Selected FLUENT");
      }
    });

    await new Promise(r => setTimeout(r, 1000));

    // Click "Add languages" button
    const addClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const btn = btns.find(b => b.innerText.trim() === "Add languages" && !b.disabled);
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });

    console.log("Clicked Add languages:", addClicked);
    await new Promise(r => setTimeout(r, 2000));

    console.log("Page text after adding language:\n", (await page.evaluate(() => document.body.innerText)).slice(0, 1200));

    await b.disconnect();
  } catch (e) {
    console.error("Error:", e);
  }
})();
