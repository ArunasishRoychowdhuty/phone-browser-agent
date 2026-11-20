const puppeteer = require("puppeteer-core");

(async () => {
  try {
    const b = await puppeteer.connect({browserURL: "http://127.0.0.1:9224", defaultViewport: null});
    const page = (await b.pages()).find(p => p.url().includes("truelancer.com"));
    await page.bringToFront();

    console.log("Filling Step 3: About You...");

    // 1. Gender: Male
    await page.evaluate(() => {
      const maleRadio = Array.from(document.querySelectorAll("label, input, span")).find(el => el.innerText && el.innerText.trim() === "Male");
      if (maleRadio) maleRadio.click();
    });

    // 2. Date of Birth
    const dobInput = await page.$('input[placeholder*="Date of Birth"]');
    if (dobInput) {
      await dobInput.click({clickCount: 3});
      await dobInput.type("03/12/2007", {delay: 20});
      console.log("Set DOB");
    }

    // 3. Professional Title
    const titleInput = await page.$('input[placeholder*="Professional Title"]');
    if (titleInput) {
      await titleInput.click({clickCount: 3});
      await titleInput.type("AI Automation & Web Developer", {delay: 20});
      console.log("Set Professional Title");
    }

    // 4. Hourly Rate
    const rateInput = await page.$('input[placeholder*="Hourly Rate"]');
    if (rateInput) {
      await rateInput.click({clickCount: 3});
      await rateInput.type("1000", {delay: 20});
      console.log("Set Hourly Rate");
    }

    // 5. About Yourself
    const aboutInput = await page.$('textarea[placeholder*="About Yourself"]');
    if (aboutInput) {
      await aboutInput.click({clickCount: 3});
      const aboutText = "I build practical AI-powered automation workflows and modern web solutions for businesses. Specializing in n8n automations, OpenAI API integration, AI customer support chatbots, webhook connections, and custom WordPress development. I focus on creating reliable, scalable, and well-documented solutions to optimize your business operations.";
      await page.evaluate((el, text) => {
        el.focus();
        el.value = text;
        el.dispatchEvent(new Event("input", {bubbles: true}));
        el.dispatchEvent(new Event("change", {bubbles: true}));
      }, aboutInput, aboutText);
      console.log("Set About Yourself");
    }

    // 6. City
    const cityInput = await page.$('input[placeholder*="City"]');
    if (cityInput) {
      await cityInput.click({clickCount: 3});
      await cityInput.type("Kolkata", {delay: 20});
      await new Promise(r => setTimeout(r, 1000));
      // Click autocomplete item if exists
      await page.evaluate(() => {
        const item = Array.from(document.querySelectorAll("li, div[role=option], span")).find(el => /kolkata/i.test(el.innerText));
        if (item) item.click();
      });
      console.log("Set City");
    }

    await new Promise(r => setTimeout(r, 1000));

    // 7. Click SAVE
    const clickedSave = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button, input[type=submit]"));
      const saveBtn = btns.find(b => (b.innerText || b.value || "").trim() === "SAVE");
      if (saveBtn) {
        saveBtn.click();
        return true;
      }
      return false;
    });

    console.log("Clicked SAVE:", clickedSave);
    await new Promise(r => setTimeout(r, 4000));

    console.log("URL after Save:", page.url());
    console.log("Page text after Save:\n", (await page.evaluate(() => document.body.innerText)).slice(0, 1000));

    await b.disconnect();
  } catch (err) {
    console.error("Error:", err);
  }
})();
