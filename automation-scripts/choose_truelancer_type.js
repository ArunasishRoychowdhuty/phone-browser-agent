const puppeteer = require("puppeteer-core");

(async () => {
  try {
    const b = await puppeteer.connect({browserURL: "http://127.0.0.1:9224", defaultViewport: null});
    const pages = await b.pages();
    let page = pages.find(p => p.url().includes("truelancer.com"));
    await page.bringToFront();

    console.log("Current URL:", page.url());
    console.log("Current Title:", await page.title());

    // Inspect options
    const options = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll("input, button, a, div[role=button], label")).map(el => ({
        tag: el.tagName,
        type: el.type,
        text: (el.innerText || "").trim(),
        value: el.value,
        name: el.name,
        className: el.className
      })).filter(x => x.text || x.name || x.value);
      return {
        options: all,
        bodyText: document.body.innerText
      };
    });

    console.log("OPTIONS:", JSON.stringify(options.options.slice(0, 20), null, 2));
    console.log("BODY TEXT:\n", options.bodyText);

    // Select "An Individual"
    const clickedIndividual = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll("label, div, button, input"));
      const ind = els.find(el => el.innerText && el.innerText.trim() === "An Individual");
      if (ind) {
        ind.click();
        return "Clicked An Individual";
      }
      return "Not found";
    });
    console.log("Select result:", clickedIndividual);

    await new Promise(r => setTimeout(r, 1000));

    // Click "Join Truelancer" or submit button
    const clickedJoin = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button, input[type=submit], a"));
      const joinBtn = btns.find(b => /join truelancer|continue|next|submit/i.test(b.innerText || b.value));
      if (joinBtn) {
        joinBtn.click();
        return "Clicked Join button";
      }
      return "No join btn";
    });

    console.log("Join click:", clickedJoin);
    await new Promise(r => setTimeout(r, 4000));

    console.log("After Join URL:", page.url());
    console.log("After Join Title:", await page.title());
    console.log("After Join Text:\n", (await page.evaluate(() => document.body.innerText)).slice(0, 1500));

    // Save cookies
    const cookies = await page.cookies();
    const fs = require("fs");
    fs.mkdirSync("/data/data/com.termux/files/home/phone-browser-agent/saved-sessions/cookies", {recursive: true});
    fs.writeFileSync("/data/data/com.termux/files/home/phone-browser-agent/saved-sessions/cookies/truelancer.json", JSON.stringify(cookies, null, 2));
    console.log("Saved Truelancer cookies!");

    await b.disconnect();
  } catch (err) {
    console.error("Error:", err);
  }
})();
