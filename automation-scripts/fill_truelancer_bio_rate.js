const puppeteer = require("puppeteer-core");

(async () => {
  try {
    const b = await puppeteer.connect({browserURL: "http://127.0.0.1:9224", defaultViewport: null});
    const page = (await b.pages()).find(p => p.url().includes("truelancer.com"));
    await page.bringToFront();

    // 1. Rate input
    const rateInput = await page.$('input[name="rate"]');
    if (rateInput) {
      await rateInput.click({clickCount: 3});
      await rateInput.type("1000", {delay: 20});
      console.log("Set rate input");
    }

    // 2. Bio textarea
    const bioTextarea = await page.$('textarea[name="bio"]');
    if (bioTextarea) {
      await bioTextarea.click({clickCount: 3});
      const bioText = "I build practical AI-powered automation workflows and modern web solutions for businesses. Specializing in n8n automations, OpenAI API integration, AI customer support chatbots, webhook connections, and custom WordPress development. Reliable and maintainable solutions.";
      await bioTextarea.type(bioText, {delay: 10});
      console.log("Set bio textarea");
    }

    await new Promise(r => setTimeout(r, 1000));

    // Verify counters
    const textStatus = await page.evaluate(() => {
      return {
        headline: document.querySelector('textarea[name="headline"]')?.value,
        bio: document.querySelector('textarea[name="bio"]')?.value,
        rate: document.querySelector('input[name="rate"]')?.value,
        snippet: document.body.innerText.slice(0, 1000)
      };
    });

    console.log("STATUS:\n", JSON.stringify(textStatus, null, 2));

    // 3. Click SAVE button
    const clickedSave = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button, input[type=submit]"));
      const saveBtn = btns.find(b => (b.innerText || b.value || "").trim().toUpperCase() === "SAVE");
      if (saveBtn) {
        saveBtn.click();
        return true;
      }
      return false;
    });

    console.log("Clicked SAVE:", clickedSave);
    await new Promise(r => setTimeout(r, 5000));

    console.log("URL after save:", page.url());
    console.log("Text after save:\n", (await page.evaluate(() => document.body.innerText)).slice(0, 1000));

    await b.disconnect();
  } catch (err) {
    console.error("Error:", err);
  }
})();
