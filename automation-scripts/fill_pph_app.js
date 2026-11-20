const puppeteer = require("puppeteer-core");

(async () => {
  try {
    const b = await puppeteer.connect({browserURL: "http://127.0.0.1:9224", defaultViewport: null});
    const page = (await b.pages()).find(p => p.url().includes("peopleperhour.com"));
    await page.bringToFront();

    console.log("Filling PeoplePerHour Application...");

    // 1. Job Title
    const jobTitle = await page.$("#MemberProfile_job_title");
    if (jobTitle) {
      await jobTitle.click({clickCount: 3});
      await jobTitle.type("Junior AI Automation & Web Developer", {delay: 20});
      console.log("Set Job Title");
    }

    // 2. About
    const about = await page.$("#MemberProfile_about");
    if (about) {
      await about.click({clickCount: 3});
      const text = "I build practical AI-powered automation workflows and modern web solutions for businesses. Specializing in n8n automations, OpenAI API integration, AI customer support chatbots, webhook connections, and custom WordPress development. I focus on creating reliable, scalable, and well-documented solutions.";
      await about.type(text, {delay: 5});
      console.log("Set About");
    }

    // 3. Hourly Rate
    const rate = await page.$("#MemberProfile_real_hour_rate");
    if (rate) {
      await rate.click({clickCount: 3});
      await rate.type("15", {delay: 20});
      console.log("Set Rate");
    }

    // 4. Skills
    const skillInput = await page.$("#s2id_autogen1");
    if (skillInput) {
      const skills = ["Python", "WordPress", "Web Development", "Artificial Intelligence"];
      for (const s of skills) {
        await skillInput.click();
        await skillInput.type(s, {delay: 20});
        await new Promise(r => setTimeout(r, 800));
        await page.keyboard.press("Enter");
        await new Promise(r => setTimeout(r, 500));
      }
      console.log("Added Skills");
    }

    // 5. Languages
    const langInput = await page.$("#s2id_autogen2");
    if (langInput) {
      const langs = ["English", "Bengali"];
      for (const l of langs) {
        await langInput.click();
        await langInput.type(l, {delay: 20});
        await new Promise(r => setTimeout(r, 800));
        await page.keyboard.press("Enter");
        await new Promise(r => setTimeout(r, 500));
      }
      console.log("Added Languages");
    }

    await new Promise(r => setTimeout(r, 1500));

    // 6. Submit Application
    console.log("Submitting Application...");
    const clickedSubmit = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button, input[type=submit]"));
      const btn = btns.find(b => (b.innerText || b.value || "").trim().includes("SUBMIT APPLICATION"));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });

    console.log("Clicked Submit Application:", clickedSubmit);
    await new Promise(r => setTimeout(r, 6000));

    console.log("URL after submit:", page.url());
    console.log("Title after submit:", await page.title());
    console.log("Text after submit:\n", (await page.evaluate(() => document.body.innerText)).slice(0, 1000));

    // Save final PPH cookies
    const cookies = await page.cookies();
    const fs = require("fs");
    fs.writeFileSync("/data/data/com.termux/files/home/phone-browser-agent/saved-sessions/cookies/peopleperhour_app.json", JSON.stringify(cookies, null, 2));
    console.log("Saved PPH app cookies!");

    await b.disconnect();
  } catch (err) {
    console.error("Error:", err);
  }
})();
