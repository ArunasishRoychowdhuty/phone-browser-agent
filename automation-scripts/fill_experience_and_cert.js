const puppeteer = require("puppeteer-core");

(async () => {
  try {
    const b = await puppeteer.connect({browserURL: "http://127.0.0.1:9224", defaultViewport: null});
    const page = (await b.pages()).find(p => p.url().includes("seller_onboarding"));
    await page.bringToFront();

    console.log("--- Filling Work Experience ---");
    // Title
    const jobTitleInput = await page.$('input[placeholder="Title"]');
    if (jobTitleInput) {
      await jobTitleInput.click({clickCount: 3});
      await jobTitleInput.type("Cyber Security Intern", {delay: 25});
      console.log("Set Job Title");
    }

    // Company name
    const companyInput = await page.$('input[placeholder="Company name"]');
    if (companyInput) {
      await companyInput.click({clickCount: 3});
      await companyInput.type("Cudafix Private Limited", {delay: 25});
      console.log("Set Company Name");
    }

    // Checkbox: I currently work here
    await page.evaluate(() => {
      const cb = document.querySelector('input[type="checkbox"]');
      if (cb && !cb.checked) {
        cb.click();
      }
    });

    // Start date if present
    const startDateInput = await page.$('input[placeholder*="Start date"]');
    if (startDateInput) {
      await startDateInput.click();
      await startDateInput.type("2024", {delay: 25});
      console.log("Set Start Date");
    }

    // Description textarea inside work experience
    const descTa = await page.$('textarea[placeholder*="job history"]');
    if (descTa) {
      await descTa.click();
      const expText = "Assisting with security audits, network security monitoring, system vulnerability scanning, and cybersecurity protocol documentation.";
      await page.evaluate((el, text) => {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
        setter.call(el, text);
        el.dispatchEvent(new Event("input", {bubbles: true}));
        el.dispatchEvent(new Event("change", {bubbles: true}));
      }, descTa, expText);
      console.log("Set Exp Description");
    }

    await new Promise(r => setTimeout(r, 1000));

    // Click Add button inside work experience form
    const clickedAddExp = await page.evaluate(() => {
      const cancelBtns = Array.from(document.querySelectorAll("button")).filter(b => b.innerText.trim() === "Cancel");
      if (cancelBtns.length > 0) {
        const parent = cancelBtns[0].closest("div[class*=container], form, div");
        const addBtn = Array.from(parent ? parent.querySelectorAll("button") : []).find(b => b.innerText.trim() === "Add" && !b.disabled);
        if (addBtn) {
          addBtn.click();
          return "Clicked Add in container";
        }
      }
      const btns = Array.from(document.querySelectorAll("button"));
      const addBtn = btns.find(b => b.innerText.trim() === "Add" && !b.disabled);
      if (addBtn) {
        addBtn.click();
        return "Clicked fallback Add";
      }
      return "No Add button enabled";
    });

    console.log("Add Exp result:", clickedAddExp);
    await new Promise(r => setTimeout(r, 2000));

    // Now inspect Certifications
    console.log("--- Checking Add Certifications ---");
    const clickedCertOpen = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button, div[role=button]"));
      const b = btns.find(x => x.innerText.includes("Add certifications"));
      if (b) {
        b.click();
        return true;
      }
      return false;
    });
    console.log("Clicked Cert Open:", clickedCertOpen);
    await new Promise(r => setTimeout(r, 1500));

    const certInputs = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll("input")).map(i => ({
        placeholder: i.placeholder,
        value: i.value,
        type: i.type
      })).filter(x => x.placeholder || x.value);
      return inputs;
    });

    console.log("CERT INPUTS:", JSON.stringify(certInputs, null, 2));

    await b.disconnect();
  } catch (e) {
    console.error("Error:", e);
  }
})();
