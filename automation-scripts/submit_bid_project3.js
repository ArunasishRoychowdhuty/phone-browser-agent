const puppeteer = require("puppeteer-core");
const fs = require("fs");

(async () => {
  const browser = await puppeteer.connect({ browserURL: "http://127.0.0.1:9224", defaultViewport: null });
  const targets = browser.targets();
  const flTarget = targets.find(t => t.url().includes("freelancer.com"));
  const page = await flTarget.page();
  
  const projUrl = "https://www.freelancer.com/projects/ai-chatbot-development/Driven-Customer-Reply-Automation";
  console.log("Navigating to Project 3:", projUrl);
  await page.goto(projUrl, { waitUntil: "domcontentloaded" });
  await new Promise(r => setTimeout(r, 4000));
  
  // Check if "Select All" / "Next" or Escrow terms appear
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button, fl-button"));
    const selAll = btns.find(b => b.innerText && b.innerText.trim() === "Select All");
    if (selAll) selAll.click();
    
    const agree = btns.find(b => b.innerText && b.innerText.toLowerCase().includes("agree"));
    if (agree) agree.click();
  });
  await new Promise(r => setTimeout(r, 1000));
  
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button, fl-button"));
    const nextBtn = btns.find(b => b.innerText && b.innerText.trim() === "Next");
    if (nextBtn) nextBtn.click();
  });
  await new Promise(r => setTimeout(r, 2000));
  
  const proposalText = `Hi there,

I am an AI Automation specialist with extensive experience designing modular, enterprise-grade n8n workflows integrated with LLM APIs (OpenAI, Anthropic Claude, and Google Gemini).

Here is how I will architect your solution:
1. Dynamic Multi-Model Architecture:
   - A single Switch / Router node in n8n where you can toggle between Claude and Gemini via a single environment variable (e.g. DEFAULT_AI_PROVIDER=gemini).
   - Clean abstraction: API credentials and endpoints stored in environment variables with fallback error handling.
2. Tone & Persona Grounding:
   - Your tone-of-voice guidelines and sample conversations will be structured into a modular system prompt template.
   - Pre-processes incoming customer messages, sanitizes inputs, and delivers human-like, on-brand responses without delay.
3. Deliverables:
   - Complete, tested n8n workflow JSON ready for one-click import.
   - Clear setup documentation covering environment variables and model switching.
   - Loom / video walkthrough demonstrating real-time replies across 5 real test messages from your inbox.

Turnaround: 3 to 4 days.
Quote: $400 USD.

Ready to start immediately. Let's connect on chat to review your test inbox platform and style guide!

Best regards,
Arunasish Roy Chowdhury
Junior AI Automation & Web Developer`;

  console.log("Proposal length:", proposalText.length);
  
  // Set bid amount and period
  await page.evaluate(() => {
    function setField(selector, val) {
      const el = document.querySelector(selector);
      if (!el) return null;
      el.focus();
      const desc = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
      if (desc && desc.set) desc.set.call(el, val);
      else el.value = val;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return el.value;
    }
    setField("input#bidAmountInput", "400");
    setField("input#periodInput", "4");
  });
  
  const taEl = await page.$("textarea#descriptionTextArea");
  if (taEl) {
    await taEl.click();
    await page.evaluate((text) => {
      const ta = document.querySelector("textarea#descriptionTextArea");
      ta.focus();
      ta.select();
      document.execCommand("selectAll", false, null);
      document.execCommand("insertText", false, text);
      ta.dispatchEvent(new Event("input", { bubbles: true }));
      ta.dispatchEvent(new Event("change", { bubbles: true }));
      ta.blur();
    }, proposalText);
  }
  
  await new Promise(r => setTimeout(r, 1000));
  
  // Click Place Bid
  const submitRes = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button, fl-button"));
    const placeBtn = btns.find(b => b.innerText && b.innerText.trim().toLowerCase() === "place bid");
    if (placeBtn) {
      placeBtn.click();
      return { clicked: true };
    }
    return { error: "button not found" };
  });
  console.log("Submit result:", submitRes);
  await new Promise(r => setTimeout(r, 5000));
  
  console.log("Post submit URL:", page.url());
  const text = await page.evaluate(() => document.body.innerText);
  console.log("Bid placed successfully (Retract visible):", text.includes("Retract"));
  
  const cookies = await page.cookies();
  fs.writeFileSync("/data/data/com.termux/files/home/phone-browser-agent/saved-sessions/cookies/freelancer.com.json", JSON.stringify(cookies, null, 2));
  console.log("Saved cookies!");
  
  await browser.disconnect();
})().catch(console.error);
