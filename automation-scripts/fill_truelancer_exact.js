const puppeteer = require("puppeteer-core");

(async () => {
  try {
    const b = await puppeteer.connect({browserURL: "http://127.0.0.1:9224", defaultViewport: null});
    const page = (await b.pages()).find(p => p.url().includes("truelancer.com"));
    await page.bringToFront();

    // 1. Gender
    await page.evaluate(() => {
      const g = document.querySelector('input[name="gender"][value="1"]');
      if (g) g.click();
    });

    // 2. Date of birth
    const dob = await page.$('input[id=":r40:"]') || await page.$('input[placeholder*="Date of Birth"]');
    if (dob) {
      await dob.click({clickCount: 3});
      await page.keyboard.type("03/12/2007", {delay: 20});
      console.log("Set DOB");
    }

    // 3. Headline
    const headline = await page.$('#headline');
    if (headline) {
      await headline.click({clickCount: 3});
      await page.keyboard.type("AI Automation & Web Developer", {delay: 20});
      console.log("Set Headline");
    }

    // 4. Rate
    const rate = await page.$('#rate');
    if (rate) {
      await rate.click({clickCount: 3});
      await page.keyboard.type("1000", {delay: 20});
      console.log("Set Rate");
    }

    // 5. Bio
    const bio = await page.$('#bio');
    if (bio) {
      await bio.click({clickCount: 3});
      const bioText = "I build practical AI-powered automation workflows and modern web solutions for businesses. Specializing in n8n automations, OpenAI API integration, AI customer support chatbots, webhook connections, and custom WordPress development. I focus on creating reliable, scalable, and well-documented solutions to optimize your business operations.";
      await page.keyboard.type(bioText, {delay: 5});
      console.log("Set Bio");
    }

    await new Promise(r => setTimeout(r, 1000));

    // 6. Click SAVE
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

    console.log("URL after Save:", page.url());
    console.log("Title after Save:", await page.title());
    console.log("Page text after Save:\n", (await page.evaluate(() => document.body.innerText)).slice(0, 1000));

    await b.disconnect();
  } catch (err) {
    console.error("Error:", err);
  }
})();
