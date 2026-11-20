const puppeteer = require("puppeteer-core");

(async () => {
  try {
    const b = await puppeteer.connect({browserURL: "http://127.0.0.1:9224", defaultViewport: null});
    const page = (await b.pages()).find(p => p.url().includes("seller_onboarding"));
    await page.bringToFront();

    // Cancel open skills drawer if any
    await page.evaluate(() => {
      const cancelBtns = Array.from(document.querySelectorAll("button")).filter(b => b.innerText.trim() === "Cancel");
      if (cancelBtns.length > 0) {
        cancelBtns[0].click();
      }
    });

    await new Promise(r => setTimeout(r, 1000));

    // Click Continue
    console.log("Clicking Continue...");
    const clicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const continueBtn = btns.find(b => b.innerText.trim() === "Continue" && !b.disabled);
      if (continueBtn) {
        continueBtn.click();
        return true;
      }
      return false;
    });

    console.log("Clicked Continue:", clicked);
    await new Promise(r => setTimeout(r, 4000));

    console.log("URL after continue:", page.url());
    console.log("Title after continue:", await page.title());

    const pageText = await page.evaluate(() => document.body.innerText.slice(0, 2000));
    console.log("PAGE TEXT AFTER CONTINUE:\n", pageText);

    await b.disconnect();
  } catch (e) {
    console.error("Error:", e);
  }
})();
