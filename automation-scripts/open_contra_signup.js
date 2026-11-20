const puppeteer = require("puppeteer-core");

(async () => {
  try {
    const b = await puppeteer.connect({browserURL: "http://127.0.0.1:9224", defaultViewport: null});
    const pages = await b.pages();
    let contraPage = pages.find(p => p.url().includes("contra.com"));
    if (!contraPage) {
      contraPage = await b.newPage();
      await contraPage.goto("https://contra.com/", {waitUntil: "domcontentloaded", timeout: 25000});
    }
    await contraPage.bringToFront();

    console.log("Contra Page:", contraPage.url());

    // Click "Sign up" button on Contra
    const clickedSignUp = await contraPage.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button, a"));
      const btn = btns.find(b => b.innerText && b.innerText.trim() === "Sign up");
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });

    console.log("Clicked Contra Sign up:", clickedSignUp);
    await new Promise(r => setTimeout(r, 4000));

    console.log("Contra URL after click:", contraPage.url());
    console.log("Contra Title:", await contraPage.title());

    const contraInputs = await contraPage.evaluate(() => {
      const all = Array.from(document.querySelectorAll("input, button, a")).map(el => ({
        tag: el.tagName,
        type: el.type,
        placeholder: el.placeholder,
        text: (el.innerText || el.value || "").trim().slice(0, 50)
      })).filter(x => x.text || x.placeholder);
      return {
        inputs: all,
        snippet: document.body.innerText.slice(0, 1000)
      };
    });

    console.log("CONTRA SIGNUP FLOW:\n", JSON.stringify(contraInputs, null, 2));

    await b.disconnect();
  } catch (e) {
    console.error("Error:", e);
  }
})();
