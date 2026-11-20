const puppeteer = require("puppeteer-core");
const fs = require("fs");

(async () => {
  const browser = await puppeteer.connect({ browserURL: "http://127.0.0.1:9224", defaultViewport: null });
  const targets = browser.targets();
  const pageTarget = targets.find(t => t.url().includes("freelancer.com"));
  const page = await pageTarget.page();
  
  await page.goto("https://www.freelancer.com/u/arunasishr2", { waitUntil: "domcontentloaded" });
  await new Promise(r => setTimeout(r, 4000));
  
  // Find Edit Profile button
  const clickRes = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("fl-button[fltrackinglabel=\"EditProfileButtonClick\"] button, button"));
    const edit = btns.find(b => b.innerText && b.innerText.toLowerCase().includes("edit profile"));
    if (edit) {
      edit.click();
      return { clicked: true, text: edit.innerText };
    }
    return { error: "edit button not found" };
  });
  console.log("Edit button click result:", clickRes);
  await new Promise(r => setTimeout(r, 3000));
  
  const formElements = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("input, textarea, select")).map(el => ({
      tag: el.tagName,
      placeholder: el.placeholder || "",
      value: el.value || "",
      className: el.className || "",
      id: el.id || ""
    }));
  });
  console.log("Form elements:\n", JSON.stringify(formElements, null, 2));
  
  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 1500));
  console.log("Page snippet:\n", bodyText);
  
  await browser.disconnect();
})().catch(console.error);
