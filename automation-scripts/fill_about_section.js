const puppeteer = require("puppeteer-core");

(async () => {
  try {
    const b = await puppeteer.connect({browserURL: "http://127.0.0.1:9224", defaultViewport: null});
    const page = (await b.pages()).find(p => p.url().includes("seller_onboarding"));
    await page.bringToFront();

    console.log("--- Clicking Add details ---");
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button, a, div"));
      const btn = btns.find(b => b.innerText.trim() === "Add details");
      if (btn) btn.click();
    });

    await new Promise(r => setTimeout(r, 2000));

    const aboutInfo = await page.evaluate(() => {
      const ta = document.querySelector("textarea");
      const btns = Array.from(document.querySelectorAll("button")).map(b => ({
        text: b.innerText.trim(),
        ariaLabel: b.getAttribute("aria-label"),
        disabled: b.disabled
      })).filter(x => x.text || x.ariaLabel);

      return {
        hasTextarea: !!ta,
        taValue: ta ? ta.value : null,
        buttons: btns,
        visibleText: document.body.innerText.slice(0, 1500)
      };
    });

    console.log("ABOUT INFO:", JSON.stringify(aboutInfo, null, 2));

    const desc = "I build practical AI-powered automation workflows and modern web solutions for businesses. Specializing in n8n automations, OpenAI API integration, AI customer support chatbots, webhook connections, and custom WordPress development. I focus on creating reliable, scalable, and well-documented solutions to optimize your business operations.";

    // Fill textarea and click its submit/save button
    await page.evaluate((text) => {
      const ta = document.querySelector("textarea");
      if (ta) {
        ta.focus();
        const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
        setter.call(ta, text);
        ta.dispatchEvent(new Event("input", {bubbles: true}));
        ta.dispatchEvent(new Event("change", {bubbles: true}));
        ta.blur();
      }
    }, desc);

    await new Promise(r => setTimeout(r, 1000));

    // Look for save/done button for About
    const saveAbout = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      // Buttons usually right after or near textarea
      const ta = document.querySelector("textarea");
      if (!ta) return "no ta";
      const container = ta.closest("div");
      const saveBtn = btns.find(b => /save|done|add|apply/i.test(b.innerText) && !/education|experience|certifications|skills/i.test(b.innerText));
      if (saveBtn) {
        saveBtn.click();
        return saveBtn.innerText;
      }
      return "no save btn found";
    });

    console.log("Save about result:", saveAbout);
    await new Promise(r => setTimeout(r, 2000));

    console.log("Visible text after about:\n", (await page.evaluate(() => document.body.innerText)).slice(0, 1200));

    await b.disconnect();
  } catch (e) {
    console.error("Error:", e);
  }
})();
