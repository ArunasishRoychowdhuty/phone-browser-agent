const puppeteer = require("puppeteer-core");
const fs = require("fs");

(async () => {
  const browser = await puppeteer.connect({ browserURL: "http://127.0.0.1:9224", defaultViewport: null });
  const targets = browser.targets();
  const flTarget = targets.find(t => t.url().includes("freelancer.com"));
  const page = await flTarget.page();
  
  const proposalText = `Hi there,

I am an AI Automation Developer specializing in n8n and Telegram bot integration with OpenAI / ChatGPT. I can deliver a clean, reliable, and production-ready n8n Telegram AI chatbot for your users.

My Implementation Plan:
1. Telegram Bot Trigger: Seamless webhook setup using Telegram Trigger node to capture incoming messages, user IDs, and command context instantly.
2. Context-Grounded AI Logic:
   - Your custom Q&A knowledge set will be connected via a structured retrieval node or OpenAI Assistant API.
   - The AI will craft accurate, brand-aligned answers based exclusively on your knowledge base without hallucinations.
3. Node Architecture & Handover:
   - Clean, modular n8n workflow JSON ready for one-click import into self-hosted or n8n cloud.
   - Comprehensive README detailing environment variable configuration (TELEGRAM_BOT_TOKEN, OPENAI_API_KEY).
   - Video walkthrough demonstrating real-time testing and showing how easily you can add or edit Q&A entries.

Turnaround Time: 3 to 4 days.
Bid Quote: $450 USD.

Ready to start right away. Let's discuss your Q&A document format on chat!

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
    setField("input#bidAmountInput", "450");
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
  
  const postUrl = page.url();
  console.log("Post submit URL:", postUrl);
  const text = await page.evaluate(() => document.body.innerText);
  const retractIdx = text.indexOf("Retract");
  console.log("Bid placed successfully (Retract visible):", retractIdx !== -1);
  
  const cookies = await page.cookies();
  fs.writeFileSync("/data/data/com.termux/files/home/phone-browser-agent/saved-sessions/cookies/freelancer.com.json", JSON.stringify(cookies, null, 2));
  console.log("Saved cookies!");
  
  await browser.disconnect();
})().catch(console.error);
