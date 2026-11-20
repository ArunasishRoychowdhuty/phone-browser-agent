const puppeteer = require("puppeteer-core");

(async () => {
  try {
    const b = await puppeteer.connect({browserURL: "http://127.0.0.1:9224", defaultViewport: null});
    const pages = await b.pages();
    let page = pages.find(p => p.url().includes("fiverr.com"));
    if (!page) {
      console.log("No fiverr page open, opening one...");
      page = await b.newPage();
      await page.goto("https://www.fiverr.com/users/arunasishboshro", {waitUntil: "networkidle2", timeout: 20000});
    }

    await page.bringToFront();
    console.log("URL before:", page.url());

    // Navigate directly to profile
    if (!page.url().includes("/users/arunasishboshro")) {
      await page.goto("https://www.fiverr.com/users/arunasishboshro", {waitUntil: "domcontentloaded", timeout: 15000}).catch(e => console.log("goto error:", e.message));
      await new Promise(r => setTimeout(r, 4000));
    }

    console.log("URL after:", page.url());
    console.log("Title:", await page.title());

    const result = await page.evaluate(() => {
      const text = document.body.innerText;
      const links = Array.from(document.querySelectorAll("a")).map(a => ({href: a.href, text: a.innerText.trim()})).filter(x => x.text || x.href.includes("user"));
      const buttons = Array.from(document.querySelectorAll("button")).map(b => b.innerText.trim()).filter(Boolean);
      return {
        url: window.location.href,
        title: document.title,
        textSample: text.slice(0, 3000),
        links: links.slice(0, 30),
        buttons: buttons.slice(0, 20)
      };
    });

    console.log("RESULT JSON:", JSON.stringify(result, null, 2));
    await b.disconnect();
  } catch (err) {
    console.error("ERROR:", err);
  }
})();
