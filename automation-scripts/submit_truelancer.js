const puppeteer = require("puppeteer-core");

(async () => {
  try {
    const b = await puppeteer.connect({browserURL: "http://127.0.0.1:9224", defaultViewport: null});
    const pages = await b.pages();
    let page = pages.find(p => p.url().includes("truelancer.com"));
    if (!page) {
      page = await b.newPage();
      await page.goto("https://www.truelancer.com/signup", {waitUntil: "domcontentloaded", timeout: 20000});
    }
    await page.bringToFront();

    console.log("Filling Truelancer signup form...");
    // 1. First Name
    const fname = await page.$("#fname");
    if (fname) {
      await fname.click({clickCount: 3});
      await fname.type("Arunasish", {delay: 30});
      console.log("Set fname");
    }

    // 2. Last Name
    const lname = await page.$("#lname");
    if (lname) {
      await lname.click({clickCount: 3});
      await lname.type("Roy Chowdhury", {delay: 30});
      console.log("Set lname");
    }

    // 3. Email
    const email = await page.$("#email");
    if (email) {
      await email.click({clickCount: 3});
      await email.type("roychowdhuryarunasish33@gmail.com", {delay: 30});
      console.log("Set email");
    }

    // 4. Password
    const pw = await page.$("#password");
    if (pw) {
      await pw.click({clickCount: 3});
      await pw.type("Roychoodarunvuso@973", {delay: 30});
      console.log("Set password");
    }

    // 5. Confirm Password
    const cpw = await page.$("#confirmPassword");
    if (cpw) {
      await cpw.click({clickCount: 3});
      await cpw.type("Roychoodarunvuso@973", {delay: 30});
      console.log("Set confirmPassword");
    }

    await new Promise(r => setTimeout(r, 1000));

    // 6. Submit Create Account
    console.log("Clicking Create Account...");
    const clicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const btn = btns.find(b => b.innerText.includes("Create Account"));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });
    console.log("Clicked submit:", clicked);

    await new Promise(r => setTimeout(r, 5000));

    console.log("After submit URL:", page.url());
    console.log("After submit Title:", await page.title());
    const resultText = await page.evaluate(() => document.body.innerText.slice(0, 1500));
    console.log("Result text:\n", resultText);

    // Get and save cookies
    const cookies = await page.cookies();
    console.log("Cookies count:", cookies.length);

    await b.disconnect();
  } catch (err) {
    console.error("Error:", err);
  }
})();
