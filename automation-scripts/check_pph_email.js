const puppeteer = require("puppeteer-core");

(async () => {
  try {
    const b = await puppeteer.connect({browserURL: "http://127.0.0.1:9224", defaultViewport: null});
    const page = (await b.pages()).find(p => p.url().includes("peopleperhour.com"));
    await page.bringToFront();

    console.log("Clicking 'I WANT TO WORK AS A FREELANCER'...");
    await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll("div, button, a, span"));
      const btn = all.find(el => el.innerText && el.innerText.includes("WORK AS A FREELANCER"));
      if (btn) btn.click();
    });

    await new Promise(r => setTimeout(r, 1500));

    console.log("Clicking 'SIGN UP WITH EMAIL'...");
    await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll("div, button, a, span"));
      const btn = all.find(el => el.innerText && el.innerText.trim() === "SIGN UP WITH EMAIL");
      if (btn) btn.click();
    });

    await new Promise(r => setTimeout(r, 2000));

    const emailForm = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll("input, button")).map(el => ({
        tag: el.tagName,
        type: el.type,
        placeholder: el.placeholder,
        name: el.name,
        id: el.id,
        text: (el.innerText || el.value || "").trim().slice(0, 40)
      })).filter(x => x.placeholder || x.name || x.text);
      return {
        inputs,
        snippet: document.body.innerText.slice(0, 1000)
      };
    });

    console.log("PPH EMAIL FORM:\n", JSON.stringify(emailForm, null, 2));

    await b.disconnect();
  } catch (err) {
    console.error("Error:", err);
  }
})();
