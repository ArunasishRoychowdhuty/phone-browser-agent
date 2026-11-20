const puppeteer = require("puppeteer-core");

(async () => {
  try {
    const b = await puppeteer.connect({browserURL: "http://127.0.0.1:9224", defaultViewport: null});
    const page = (await b.pages()).find(p => p.url().includes("seller_onboarding"));
    await page.bringToFront();

    // 1. Display name
    const nameInput = await page.$('input[placeholder*="display name"]');
    if (nameInput) {
      await nameInput.click({clickCount: 3});
      await page.keyboard.press('Backspace');
      await nameInput.type("Arunasish R", {delay: 50});
      console.log("Typed name");
    }

    // 2. Title
    const titleInput = await page.$('input[placeholder*="title"]');
    if (titleInput) {
      await titleInput.click({clickCount: 3});
      await page.keyboard.press('Backspace');
      await titleInput.type("AI Automation & Web Developer", {delay: 50});
      console.log("Typed title");
    }

    // 3. About
    // Click "Add details"
    const addDetailsBtn = await page.evaluateHandle(() => {
      return Array.from(document.querySelectorAll("button")).find(b => b.innerText.includes("Add details"));
    });
    if (addDetailsBtn.asElement()) {
      await addDetailsBtn.asElement().click();
      console.log("Clicked Add details");
      await new Promise(r => setTimeout(r, 1000));
    }

    const ta = await page.$("textarea");
    if (ta) {
      await ta.click();
      const aboutText = "I build practical AI automation workflows and web solutions for businesses. Specializing in n8n automations, OpenAI API integrations, AI support chatbots, and custom WordPress development. I focus on reliable, scalable, and well-documented solutions to optimize operations.";
      // Use native setter + input event so it is fast and sets React state
      await page.evaluate((el, val) => {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
        setter.call(el, val);
        el.dispatchEvent(new Event("input", {bubbles: true}));
        el.dispatchEvent(new Event("change", {bubbles: true}));
      }, ta, aboutText);
      // Type a space and backspace to trigger real React keydown/input
      await page.keyboard.press("Space");
      await page.keyboard.press("Backspace");
      console.log("Set textarea value");
    }

    await new Promise(r => setTimeout(r, 1500));

    // Check if there is an Add / Save button specifically for About
    const aboutButtons = await page.evaluate(() => {
      const ta = document.querySelector("textarea");
      if (!ta) return "no textarea";
      const container = ta.closest("div[class*=container], form, section, div");
      const btns = Array.from(document.querySelectorAll("button")).map(b => ({
        text: b.innerText.trim(),
        rect: b.getBoundingClientRect()
      })).filter(x => x.text);
      return btns;
    });

    console.log("Buttons present:", aboutButtons);

    await b.disconnect();
  } catch (e) {
    console.error("Error:", e);
  }
})();
