const puppeteer = require("puppeteer-core");
const fs = require("fs");

(async () => {
  const browser = await puppeteer.connect({ browserURL: "http://127.0.0.1:9224", defaultViewport: null });
  const targets = browser.targets();
  const flTarget = targets.find(t => t.url().includes("freelancer.com"));
  const page = await flTarget.page();
  
  const skills = [
    "n8n",
    "Python",
    "WordPress",
    "Artificial Intelligence",
    "Web Development",
    "Workflow Automation",
    "API",
    "JavaScript",
    "Chatbot"
  ];
  
  for (const skill of skills) {
    const input = await page.$("input[placeholder*=\"Enter skills\"]");
    if (input) {
      await page.evaluate((val) => {
        const inp = document.querySelector("input[placeholder*=\"Enter skills\"]");
        if (inp) {
          inp.focus();
          const desc = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
          desc.set.call(inp, val);
          inp.dispatchEvent(new Event("input", { bubbles: true }));
          inp.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }, skill);
      await new Promise(r => setTimeout(r, 400));
      await page.keyboard.press("Enter");
      await new Promise(r => setTimeout(r, 400));
    }
  }
  
  // Verify all tags
  const tags = await page.evaluate(() => {
    const skillTags = Array.from(document.querySelectorAll("fl-tag, [fltrackinglabel=\"SkillTag\"]"));
    return skillTags.map(s => s.innerText.trim()).filter(Boolean);
  });
  console.log("Total skills added:", tags);
  
  // Click Save changes
  const saveRes = await page.evaluate(() => {
    const btn = document.querySelector("fl-button[fltrackinglabel=\"SaveButtonClick\"] button");
    if (btn) {
      btn.click();
      return { clicked: true };
    }
    return { notFound: true };
  });
  console.log("Save changes clicked:", saveRes);
  await new Promise(r => setTimeout(r, 4000));
  
  const cookies = await page.cookies();
  fs.writeFileSync("/data/data/com.termux/files/home/phone-browser-agent/saved-sessions/cookies/freelancer.com.json", JSON.stringify(cookies, null, 2));
  console.log("Updated cookies saved!");
  await browser.disconnect();
})().catch(console.error);
