const puppeteer = require("puppeteer-core");

(async () => {
  try {
    const b = await puppeteer.connect({browserURL: "http://127.0.0.1:9224", defaultViewport: null});
    const page = (await b.pages()).find(p => p.url().includes("seller_onboarding"));
    await page.bringToFront();

    console.log("--- 1. Setting Display Name and Title ---");
    await page.evaluate(() => {
      const nameInput = document.querySelector('input[placeholder*="display name"]');
      if (nameInput) {
        nameInput.focus();
        nameInput.value = "Arunasish R";
        nameInput.dispatchEvent(new Event("input", {bubbles: true}));
        nameInput.dispatchEvent(new Event("change", {bubbles: true}));
        nameInput.blur();
      }

      const titleInput = document.querySelector('input[placeholder*="title"]');
      if (titleInput) {
        titleInput.focus();
        titleInput.value = "AI Automation & Web Developer";
        titleInput.dispatchEvent(new Event("input", {bubbles: true}));
        titleInput.dispatchEvent(new Event("change", {bubbles: true}));
        titleInput.blur();
      }
    });

    console.log("--- 2. Setting About Description ---");
    const aboutText = "I build practical AI-powered automation workflows and modern web solutions for businesses. Specializing in n8n automations, OpenAI API integration, AI customer support chatbots, webhook connections, and custom WordPress development. I focus on creating reliable, scalable, and well-documented solutions to optimize your business operations.";
    
    await page.evaluate((text) => {
      const ta = document.querySelector("textarea");
      if (ta) {
        ta.focus();
        ta.value = text;
        ta.dispatchEvent(new Event("input", {bubbles: true}));
        ta.dispatchEvent(new Event("change", {bubbles: true}));
        ta.blur();
      }
    }, aboutText);

    await new Promise(r => setTimeout(r, 1500));

    // Cancel current education modal if open or fill it
    console.log("--- 3. Checking Education Section ---");
    await page.evaluate(() => {
      const cancelBtns = Array.from(document.querySelectorAll("button")).filter(b => b.innerText.trim() === "Cancel");
      if (cancelBtns.length > 0) {
        cancelBtns[0].click();
      }
    });

    await new Promise(r => setTimeout(r, 1500));

    // Check status of fields
    const status = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll("input, textarea")).map(i => ({
        placeholder: i.placeholder,
        value: i.value
      })).filter(x => x.value && x.value !== "Add display name" && x.value !== "Add title");

      return {
        inputs,
        textSnippet: document.body.innerText.slice(0, 1500)
      };
    });

    console.log("STATUS AFTER BASIC FILL:", JSON.stringify(status, null, 2));

    await b.disconnect();
  } catch (e) {
    console.error("Error:", e);
  }
})();
