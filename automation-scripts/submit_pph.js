const puppeteer = require("puppeteer-core");

(async () => {
  try {
    const b = await puppeteer.connect({browserURL: "http://127.0.0.1:9224", defaultViewport: null});
    const page = (await b.pages()).find(p => p.url().includes("peopleperhour.com"));
    await page.bringToFront();

    console.log("Filling PeoplePerHour signup form...");

    // First Name
    const fname = await page.$("#registration_fname");
    if (fname) {
      await fname.click({clickCount: 3});
      await fname.type("Arunasish", {delay: 30});
      console.log("Set fname");
    }

    // Last Name
    const lname = await page.$("#registration_lname");
    if (lname) {
      await lname.click({clickCount: 3});
      await lname.type("Roy Chowdhury", {delay: 30});
      console.log("Set lname");
    }

    // Email
    const email = await page.$("#registration_email");
    if (email) {
      await email.click({clickCount: 3});
      await email.type("roychowdhuryarunasish33@gmail.com", {delay: 30});
      console.log("Set email");
    }

    // Password
    const pw = await page.$("#registration_password");
    if (pw) {
      await pw.click({clickCount: 3});
      await pw.type("Roychoodarunvuso@973", {delay: 30});
      console.log("Set password");
    }

    await new Promise(r => setTimeout(r, 1000));

    // Submit SIGN UP
    console.log("Clicking SIGN UP button...");
    const clicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const btn = btns.find(b => b.innerText.trim() === "SIGN UP");
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });

    console.log("Submit clicked:", clicked);
    await new Promise(r => setTimeout(r, 6000));

    console.log("URL after submit:", page.url());
    console.log("Title after submit:", await page.title());

    const result = await page.evaluate(() => {
      return {
        url: window.location.href,
        title: document.title,
        textSnippet: document.body.innerText.slice(0, 1500)
      };
    });

    console.log("PPH RESULT:\n", JSON.stringify(result, null, 2));

    // Save PPH cookies
    const cookies = await page.cookies();
    const fs = require("fs");
    fs.writeFileSync("/data/data/com.termux/files/home/phone-browser-agent/saved-sessions/cookies/peopleperhour.json", JSON.stringify(cookies, null, 2));
    console.log("Saved PPH cookies!");

    await b.disconnect();
  } catch (err) {
    console.error("Error:", err);
  }
})();
