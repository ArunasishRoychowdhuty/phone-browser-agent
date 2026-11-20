const puppeteer = require("puppeteer-core");

(async () => {
  const browser = await puppeteer.connect({ browserURL: "http://127.0.0.1:9224", defaultViewport: null });
  const targets = browser.targets();
  const flTarget = targets.find(t => t.url().includes("freelancer.com"));
  const page = await flTarget.page();
  
  const fillRes = await page.evaluate(() => {
    function setVal(selector, val) {
      const el = document.querySelector(selector);
      if (!el) return null;
      el.focus();
      const desc = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
      if (desc && desc.set) {
        desc.set.call(el, val);
      } else {
        el.value = val;
      }
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return el.value;
    }
    
    const fn = setVal("input#first-name", "Arunasish");
    const ln = setVal("input#last-name", "Roy Chowdhury");
    const hr = setVal("input#hourly-rate", "15");
    const addr = setVal("input[placeholder*=\"Enter your address\"]", "Shantipur, Nadia");
    
    return { fn, ln, hr, addr };
  });
  console.log("Filled inline fields:", fillRes);
  await new Promise(r => setTimeout(r, 1000));
  
  // Find Save button in that form and click it
  const saveClick = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button, fl-button"));
    const saveBtn = btns.find(b => b.innerText && b.innerText.trim().toLowerCase() === "save");
    if (saveBtn) {
      saveBtn.click();
      return { clicked: true, text: saveBtn.innerText };
    }
    return { notFound: true };
  });
  console.log("Save click:", saveClick);
  await new Promise(r => setTimeout(r, 4000));
  
  const text = await page.evaluate(() => document.body.innerText.slice(1500, 3000));
  console.log("Snippet after Save:\n", text);
  await browser.disconnect();
})().catch(console.error);
