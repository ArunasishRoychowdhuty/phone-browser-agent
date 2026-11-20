const puppeteer = require("puppeteer-core");

(async () => {
  try {
    const b = await puppeteer.connect({browserURL: "http://127.0.0.1:9224", defaultViewport: null});
    const page = (await b.pages()).find(p => p.url().includes("truelancer.com"));
    await page.bringToFront();

    // 1. Dismiss DatePicker if open
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const okBtn = btns.find(b => b.innerText.trim() === "OK" || b.innerText.trim() === "Cancel");
      if (okBtn) okBtn.click();
    });

    await new Promise(r => setTimeout(r, 1000));

    // 2. Headline
    const headline = await page.$('#headline');
    if (headline) {
      await headline.click({clickCount: 3});
      await headline.focus();
      await page.keyboard.type("AI Automation & Web Developer");
      console.log("Typed Headline");
    }

    // 3. Rate
    const rate = await page.$('#rate');
    if (rate) {
      await rate.click({clickCount: 3});
      await rate.focus();
      await page.keyboard.type("1000");
      console.log("Typed Rate");
    }

    // 4. Bio
    const bio = await page.$('#bio');
    if (bio) {
      await bio.click({clickCount: 3});
      await bio.focus();
      const bioText = "I build practical AI-powered automation workflows and modern web solutions for businesses. Specializing in n8n automations, OpenAI API integration, AI customer support chatbots, webhook connections, and custom WordPress development.";
      await page.keyboard.type(bioText, {delay: 5});
      console.log("Typed Bio");
    }

    await new Promise(r => setTimeout(r, 1000));

    // 5. Click SAVE
    const saved = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const saveBtn = btns.find(b => b.innerText.trim() === "SAVE");
      if (saveBtn) {
        saveBtn.click();
        return true;
      }
      return false;
    });

    console.log("Clicked SAVE:", saved);
    await new Promise(r => setTimeout(r, 4000));

    console.log("URL after save:", page.url());
    console.log("Text:\n", (await page.evaluate(() => document.body.innerText)).slice(0, 1000));

    await b.disconnect();
  } catch (err) {
    console.error("Error:", err);
  }
})();
