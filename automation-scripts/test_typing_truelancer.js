const puppeteer = require("puppeteer-core");

(async () => {
  try {
    const b = await puppeteer.connect({browserURL: "http://127.0.0.1:9224", defaultViewport: null});
    const page = (await b.pages()).find(p => p.url().includes("truelancer.com"));
    await page.bringToFront();

    // 1. Gender Male
    await page.evaluate(() => {
      const male = document.querySelector('input[name="gender"][value="1"]');
      if (male && !male.checked) male.click();
    });

    // 2. Headline
    const headline = await page.$('#headline');
    if (headline) {
      await headline.click({clickCount: 3});
      await headline.type("Junior AI Automation & Web Developer", {delay: 20});
      console.log("Typed headline");
    }

    // 3. Rate
    const rate = await page.$('#rate');
    if (rate) {
      await rate.click({clickCount: 3});
      await rate.type("1000", {delay: 20});
      console.log("Typed rate");
    }

    // 4. Bio
    const bio = await page.$('#bio');
    if (bio) {
      await bio.click({clickCount: 3});
      const bioText = "Focused on building practical AI-powered automation workflows and web solutions for businesses. Specializing in n8n automations, OpenAI API integration, AI customer support chatbots, webhook connections, and custom WordPress development. Reliable and scalable solutions.";
      await bio.type(bioText, {delay: 10});
      console.log("Typed bio");
    }

    await new Promise(r => setTimeout(r, 1000));

    // Inspect values and counters
    const status = await page.evaluate(() => {
      return {
        headlineVal: document.querySelector('#headline')?.value,
        rateVal: document.querySelector('#rate')?.value,
        bioVal: document.querySelector('#bio')?.value?.slice(0, 40),
        text: document.body.innerText.slice(0, 800)
      };
    });

    console.log("STATUS:\n", JSON.stringify(status, null, 2));

    await b.disconnect();
  } catch (err) {
    console.error("Error:", err);
  }
})();
