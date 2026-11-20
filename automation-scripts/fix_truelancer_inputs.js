const puppeteer = require("puppeteer-core");

(async () => {
  try {
    const b = await puppeteer.connect({browserURL: "http://127.0.0.1:9224", defaultViewport: null});
    const page = (await b.pages()).find(p => p.url().includes("truelancer.com"));
    await page.bringToFront();

    // 1. Press Escape to close any open dropdown
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await new Promise(r => setTimeout(r, 1000));

    // 2. Fix Rate (clear and set to 1000)
    const rateInput = await page.$('input[name="rate"]');
    if (rateInput) {
      await rateInput.click({clickCount: 3});
      await page.keyboard.press("Backspace");
      await page.keyboard.type("1000", {delay: 20});
      console.log("Fixed Rate to 1000");
    }

    await new Promise(r => setTimeout(r, 800));

    // 3. Fix Bio
    const bioTa = await page.$('textarea[name="bio"]');
    if (bioTa) {
      await bioTa.click({clickCount: 3});
      await page.keyboard.press("Backspace");
      const text = "I build practical AI-powered automation workflows and modern web solutions for businesses. Specializing in n8n automations, OpenAI API integration, AI customer support chatbots, webhook connections, and custom WordPress development. I focus on creating reliable, scalable, and well-documented solutions.";
      await page.keyboard.type(text, {delay: 10});
      console.log("Typed Bio");
    }

    await new Promise(r => setTimeout(r, 1000));

    // Check counters and errors
    const check = await page.evaluate(() => {
      return {
        headline: document.querySelector('textarea[name="headline"]')?.value,
        rate: document.querySelector('input[name="rate"]')?.value,
        rateError: document.querySelector('#rate-helper-text')?.innerText,
        bio: document.querySelector('textarea[name="bio"]')?.value?.slice(0, 50),
        bioHelper: document.querySelector('#bio-helper-text')?.innerText
      };
    });

    console.log("CHECK BEFORE SAVE:\n", JSON.stringify(check, null, 2));

    // 4. Click SAVE
    const saved = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button, input[type=submit]"));
      const saveBtn = btns.find(b => (b.innerText || b.value || "").trim().toUpperCase() === "SAVE");
      if (saveBtn) {
        saveBtn.click();
        return true;
      }
      return false;
    });

    console.log("Clicked SAVE:", saved);
    await new Promise(r => setTimeout(r, 5000));

    console.log("URL after Save:", page.url());
    console.log("Title after Save:", await page.title());
    console.log("Text after Save:\n", (await page.evaluate(() => document.body.innerText)).slice(0, 1000));

    await b.disconnect();
  } catch (err) {
    console.error("Error:", err);
  }
})();
