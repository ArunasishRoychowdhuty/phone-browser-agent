const puppeteer = require("puppeteer-core");

(async () => {
  try {
    const b = await puppeteer.connect({browserURL: "http://127.0.0.1:9224", defaultViewport: null});
    const page = (await b.pages()).find(p => p.url().includes("truelancer.com"));
    await page.bringToFront();

    const info = await page.evaluate(() => {
      const chips = Array.from(document.querySelectorAll("div, button, span, label")).filter(el => {
        const t = (el.innerText || "").trim();
        return t === "Automation + NodeJs" || t === "AI/ML Backend" || t === "Python + Node";
      }).map(el => ({
        tag: el.tagName,
        text: el.innerText.trim(),
        className: el.className
      }));

      const submitBtn = Array.from(document.querySelectorAll("button, input[type=submit]")).map(b => ({
        text: b.innerText ? b.innerText.trim() : b.value,
        type: b.type
      }));

      return { chips, submitBtn };
    });

    console.log("STEP 2 INFO:", JSON.stringify(info, null, 2));

    // Click on relevant tech stacks
    await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll("*"));
      const targets = ["Automation + NodeJs", "AI/ML Backend", "Python + Node"];
      for (const t of targets) {
        const found = all.find(el => el.children.length === 0 && el.innerText && el.innerText.trim() === t);
        if (found) {
          found.click();
          console.log("Clicked:", t);
        }
      }
    });

    await new Promise(r => setTimeout(r, 1000));

    // Click Continue / Next / Update
    const clickedNext = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button, input[type=submit]"));
      const btn = btns.find(b => /next|continue|update|submit/i.test(b.innerText || b.value));
      if (btn) {
        btn.click();
        return btn.innerText || btn.value;
      }
      return "No next button";
    });

    console.log("Clicked next:", clickedNext);
    await new Promise(r => setTimeout(r, 4000));

    console.log("After Step 2 URL:", page.url());
    console.log("After Step 2 Title:", await page.title());
    console.log("After Step 2 Text:\n", (await page.evaluate(() => document.body.innerText)).slice(0, 1000));

    await b.disconnect();
  } catch (err) {
    console.error("Error:", err);
  }
})();
