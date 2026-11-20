const puppeteer = require("puppeteer-core");

(async () => {
  const browser = await puppeteer.connect({ browserURL: "http://127.0.0.1:9224", defaultViewport: null });
  const targets = browser.targets();
  const flTarget = targets.find(t => t.url().includes("freelancer.com"));
  const page = await flTarget.page();
  
  const skillToAdd = "OpenAI";
  console.log(`Adding skill: ${skillToAdd}`);
  
  // Type in input
  const res = await page.evaluate(async (skill) => {
    const input = document.querySelector("input[placeholder*=\"Enter skills\"]");
    if (!input) return { error: "input not found" };
    input.focus();
    const desc = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
    desc.set.call(input, skill);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return { typed: true };
  }, skillToAdd);
  console.log("Type result:", res);
  await new Promise(r => setTimeout(r, 1500));
  
  // Inspect suggestions
  const suggestions = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll("fl-dropdown-item, .DropdownItem, [role=\"option\"], li, .SuggestItem"));
    return items.map(el => el.innerText.trim()).filter(Boolean).slice(0, 10);
  });
  console.log("Suggestions for OpenAI:\n", suggestions);
  
  // If suggestion exists, click the exact or first match
  const clickMatch = await page.evaluate((skill) => {
    const items = Array.from(document.querySelectorAll("fl-dropdown-item, .DropdownItem, [role=\"option\"], li, .SuggestItem, span"));
    const match = items.find(el => el.innerText && el.innerText.trim().toLowerCase() === skill.toLowerCase());
    if (match) {
      match.click();
      return { clicked: true, text: match.innerText };
    }
    return { notFound: true };
  }, skillToAdd);
  console.log("Click suggestion result:", clickMatch);
  
  await browser.disconnect();
})().catch(console.error);
