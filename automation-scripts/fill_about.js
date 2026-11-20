const puppeteer = require("puppeteer-core");

(async () => {
  try {
    const b = await puppeteer.connect({browserURL: "http://127.0.0.1:9224", defaultViewport: null});
    const page = (await b.pages()).find(p => p.url().includes("seller_onboarding"));
    await page.bringToFront();

    // Click "Add details"
    const clicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const btn = btns.find(b => b.innerText.includes("Add details"));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });

    console.log("Clicked Add details:", clicked);
    await new Promise(r => setTimeout(r, 2000));

    // Inspect inputs/textareas and buttons inside the modal/dialog/drawer
    const modalInfo = await page.evaluate(() => {
      const textareas = Array.from(document.querySelectorAll("textarea")).map(t => ({
        placeholder: t.placeholder,
        value: t.value,
        id: t.id,
        className: t.className
      }));
      const inputs = Array.from(document.querySelectorAll("input")).map(i => ({
        type: i.type,
        placeholder: i.placeholder,
        value: i.value,
        id: i.id
      }));
      const buttons = Array.from(document.querySelectorAll("button")).map(b => ({
        text: b.innerText.trim(),
        disabled: b.disabled
      })).filter(x => x.text);

      return {
        textareas,
        inputs,
        buttons,
        visibleText: document.body.innerText.slice(0, 1500)
      };
    });

    console.log("MODAL INFO:", JSON.stringify(modalInfo, null, 2));

    // If textarea exists, fill it in!
    const aboutText = `I am an AI Automation & Web Developer focused on building practical automation workflows and modern web solutions for businesses.\n\nMy core capabilities:\n- AI-powered chatbot and customer support prototypes\n- n8n workflow automation and webhook integrations\n- OpenAI API and third-party REST API integrations\n- WordPress custom website design and automation\n- Modern responsive web development (HTML, CSS, JavaScript, Python, FastAPI)\n\nI deliver reliable, well-documented, and business-focused solutions.`;

    const filled = await page.evaluate((text) => {
      const ta = document.querySelector("textarea");
      if (ta) {
        ta.focus();
        ta.value = text;
        ta.dispatchEvent(new Event("input", {bubbles: true}));
        ta.dispatchEvent(new Event("change", {bubbles: true}));
        return true;
      }
      return false;
    }, aboutText);

    console.log("Filled textarea:", filled);
    await new Promise(r => setTimeout(r, 1000));

    // Click Save / Done in the modal if available
    const saveClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const saveBtn = btns.find(b => /save|done|add|apply/i.test(b.innerText) && !b.innerText.includes("Add work") && !b.innerText.includes("Add skills"));
      if (saveBtn) {
        saveBtn.click();
        return saveBtn.innerText;
      }
      return null;
    });

    console.log("Save clicked:", saveClicked);
    await new Promise(r => setTimeout(r, 3000));

    console.log("After save text snippet:\n", (await page.evaluate(() => document.body.innerText)).slice(0, 1500));

    await b.disconnect();
  } catch (e) {
    console.error("Error:", e);
  }
})();
