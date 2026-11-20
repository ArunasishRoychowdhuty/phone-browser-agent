const puppeteer = require("puppeteer-core");
const fs = require("fs");

(async () => {
  const browser = await puppeteer.connect({ browserURL: "http://127.0.0.1:9224", defaultViewport: null });
  const targets = browser.targets();
  const flTarget = targets.find(t => t.url().includes("freelancer.com"));
  const page = await flTarget.page();
  
  await page.goto("https://www.freelancer.com/u/arunasishr2", { waitUntil: "domcontentloaded" });
  await new Promise(r => setTimeout(r, 4000));
  
  console.log("On profile page:", page.url());
  
  // 1. Click "Add experience"
  const clickExp = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("fl-button[fltrackinglabel=\"UserProfileAddExperience\"], button"));
    const exp = btns.find(b => b.innerText && b.innerText.includes("Add experience"));
    if (exp) {
      exp.click();
      return { clicked: true };
    }
    return { error: "Add experience not found" };
  });
  console.log("Click Add experience:", clickExp);
  await new Promise(r => setTimeout(r, 2000));
  
  // Fill BSNL Experience Modal
  const fillRes = await page.evaluate(() => {
    function setSelectByText(selectEl, text) {
      if (!selectEl) return false;
      const opt = Array.from(selectEl.options).find(o => o.text.trim().toLowerCase() === text.trim().toLowerCase());
      if (opt) {
        selectEl.value = opt.value;
        selectEl.dispatchEvent(new Event("change", { bubbles: true }));
        return opt.value;
      }
      return null;
    }
    
    function setField(placeholder, val) {
      const el = document.querySelector(`input[placeholder*="${placeholder}"]`);
      if (!el) return false;
      el.focus();
      const desc = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
      desc.set.call(el, val);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }
    
    function setSummary(placeholder, val) {
      const el = document.querySelector(`textarea[placeholder*="${placeholder}"]`);
      if (!el) return false;
      el.focus();
      const desc = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value");
      desc.set.call(el, val);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }
    
    const p = setField("Enter your position or title", "Technical Intern");
    const c = setField("Enter company name", "BSNL (Bharat Sanchar Nigam Limited)");
    const city = setField("Enter city", "Kolkata");
    const s = setSummary("Describe your work experience", "Telecommunications infrastructure, IP routing, enterprise networking fundamentals, and communications systems.");
    
    const selects = Array.from(document.querySelectorAll("fl-modal select"));
    const country = setSelectByText(selects[0], "India");
    const startMonth = setSelectByText(selects[1], "January");
    const startYear = setSelectByText(selects[2], "2023");
    const endMonth = setSelectByText(selects[3], "June");
    const endYear = setSelectByText(selects[4], "2023");
    
    return { p, c, city, s, country, startMonth, startYear, endMonth, endYear };
  });
  console.log("BSNL fill result:", fillRes);
  await new Promise(r => setTimeout(r, 1000));
  
  // Click Save in modal
  const saveClick = await page.evaluate(() => {
    const modal = document.querySelector("fl-modal");
    if (!modal) return { error: "modal not found" };
    const btns = Array.from(modal.querySelectorAll("button"));
    const save = btns.find(b => b.innerText && b.innerText.trim().toLowerCase() === "save");
    if (save) {
      save.click();
      return { clicked: true };
    }
    return { error: "save btn not found" };
  });
  console.log("Save BSNL experience:", saveClick);
  await new Promise(r => setTimeout(r, 4000));
  
  const hasBSNL = await page.evaluate(() => document.body.innerText.includes("BSNL"));
  console.log("BSNL experience visible in profile:", hasBSNL);
  
  await browser.disconnect();
})().catch(console.error);
