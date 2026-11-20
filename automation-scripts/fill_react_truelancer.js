const puppeteer = require("puppeteer-core");

(async () => {
  try {
    const b = await puppeteer.connect({browserURL: "http://127.0.0.1:9224", defaultViewport: null});
    const page = (await b.pages()).find(p => p.url().includes("truelancer.com"));
    await page.bringToFront();

    const result = await page.evaluate(() => {
      function setVal(selector, val) {
        const el = document.querySelector(selector);
        if (!el) return false;
        el.focus();
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set || 
                             Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
        if (el.tagName === "TEXTAREA") {
          const taSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
          taSetter.call(el, val);
        } else {
          const inpSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
          inpSetter.call(el, val);
        }
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        el.blur();
        return true;
      }

      // Gender male
      const male = document.querySelector('input[name="gender"][value="1"]');
      if (male && !male.checked) male.click();

      // Headline
      setVal('#headline', 'Junior AI Automation & Web Developer');

      // Rate
      setVal('#rate', '1000');

      // Bio
      const bioText = `I am focused on building practical AI-powered automation systems and modern web solutions for businesses.

My areas of development include:
- AI-powered chatbot and customer-support prototypes
- n8n workflow automation
- OpenAI API and third-party API integrations
- Webhook-based business process automation
- WordPress content and publishing workflows
- Responsive website and landing-page development

I focus on understanding business requirements, designing reliable workflows, testing integrations, and documenting solutions for maintainability.

Technical Stack:
Automation: n8n, webhooks, workflow design
AI: OpenAI API, LLM integrations, chatbot workflows
Web: HTML, CSS, JavaScript, WordPress
Backend: Python, FastAPI
Tools: Git, GitHub, REST APIs`;

      setVal('#bio', bioText);

      return {
        headlineVal: document.querySelector('#headline')?.value,
        rateVal: document.querySelector('#rate')?.value,
        bioVal: document.querySelector('#bio')?.value?.slice(0, 50)
      };
    });

    console.log("VALUES SET:", JSON.stringify(result, null, 2));

    await new Promise(r => setTimeout(r, 1500));

    // Click SAVE
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
    await new Promise(r => setTimeout(r, 4000));

    console.log("URL after save:", page.url());
    console.log("Page text snippet:\n", (await page.evaluate(() => document.body.innerText)).slice(0, 1000));

    await b.disconnect();
  } catch (err) {
    console.error("Error:", err);
  }
})();
