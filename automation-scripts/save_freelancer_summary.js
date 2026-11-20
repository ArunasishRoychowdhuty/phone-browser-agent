const puppeteer = require("puppeteer-core");
const fs = require("fs");

(async () => {
  const browser = await puppeteer.connect({ browserURL: "http://127.0.0.1:9224", defaultViewport: null });
  const targets = browser.targets();
  const pageTarget = targets.find(t => t.url().includes("freelancer.com"));
  const page = await pageTarget.page();
  
  const headline = "Junior AI Automation & Web Developer";
  const rate = "1000";
  const summary = `I am focused on building practical AI-powered automation systems and modern web solutions for businesses.

My areas of development include:
- AI-powered chatbot and customer-support prototypes
- n8n workflow automation
- OpenAI API and third-party API integrations
- Webhook-based business process automation
- WordPress content and publishing workflows
- Responsive website and landing-page development

I focus on understanding business requirements, designing reliable workflows, testing integrations, and documenting solutions for maintainability.`;

  const fillRes = await page.evaluate((headline, rate, summary) => {
    function setVal(selector, val) {
      const el = document.querySelector(selector);
      if (!el) return null;
      el.focus();
      const proto = el instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      const desc = Object.getOwnPropertyDescriptor(proto, "value");
      if (desc && desc.set) {
        desc.set.call(el, val);
      } else {
        el.value = val;
      }
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return el.value;
    }
    
    const h = setVal("input#professionalHeadlineEdit", headline);
    const r = setVal("input#hourlyRateEdit", rate);
    const s = setVal("textarea#userSummaryEdit", summary);
    
    // Look for Save button on profile
    const btns = Array.from(document.querySelectorAll("button"));
    const saveBtn = btns.find(b => b.innerText && b.innerText.trim().toLowerCase() === "save");
    
    return {
      headlineSet: h,
      rateSet: r,
      summaryLength: s ? s.length : 0,
      saveBtnFound: !!saveBtn,
      saveBtnText: saveBtn ? saveBtn.innerText : null
    };
  }, headline, rate, summary);
  
  console.log("Fill res:", fillRes);
  await new Promise(r => setTimeout(r, 1000));
  
  // Click Save
  const saveClick = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button"));
    const saveBtn = btns.find(b => b.innerText && b.innerText.trim().toLowerCase() === "save");
    if (saveBtn) {
      saveBtn.click();
      return { clicked: true };
    }
    return { error: "save btn not found" };
  });
  console.log("Save click:", saveClick);
  await new Promise(r => setTimeout(r, 4000));
  
  const cookies = await page.cookies();
  fs.writeFileSync("/data/data/com.termux/files/home/phone-browser-agent/saved-sessions/cookies/freelancer.com.json", JSON.stringify(cookies, null, 2));
  console.log("Updated Freelancer.com cookies saved!");
  
  await browser.disconnect();
})().catch(console.error);
