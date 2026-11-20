const puppeteer = require("puppeteer-core");
const fs = require("fs");

(async () => {
  const browser = await puppeteer.connect({ browserURL: "http://127.0.0.1:9224", defaultViewport: null });
  const targets = browser.targets();
  const flTarget = targets.find(t => t.url().includes("freelancer.com"));
  const page = await flTarget.page();
  
  const proposalText = `Hi there,

I specialize in building production-ready AI automation workflows using n8n and OpenAI API. Your requirement for deflecting repetitive support tickets across Website Live Chat, Email (IMAP/SMTP), and WhatsApp matches my exact technical background.

Technical Approach:
1. n8n Multi-Channel Ingestion:
   - Dedicated webhook nodes for Live Chat and WhatsApp (Twilio/Meta API).
   - IMAP/SMTP listener node for direct email automation.
2. Context Retrieval & AI Grounding:
   - Historical conversations and FAQ transcripts will be pre-processed and indexed into vector embeddings.
   - When a user query arrives, relevant knowledge snippets are retrieved and passed to OpenAI GPT-4 with a strict system prompt to ensure accurate, friendly replies with zero hallucinations.
3. Direct Response & Centralized Logging:
   - Instant replies posted directly back to the original channel.
   - Every exchange is automatically archived in a central dashboard (Google Sheets or Supabase) for your ongoing review and fine-tuning.

Deliverables:
- 3 tested, production-ready n8n workflow JSONs (Chat, Email, WhatsApp).
- Context retrieval / prompt engineering setup.
- Step-by-step handover documentation.
- Video walkthrough showing real-time multi-channel testing.

Ready to start immediately. Let's discuss your details on chat!

Best regards,
Arunasish Roy Chowdhury`;

  console.log("Proposal length:", proposalText.length);
  
  const taEl = await page.$("textarea#descriptionTextArea");
  if (!taEl) {
    console.error("Textarea not found");
    process.exit(1);
  }
  
  await taEl.click();
  await page.evaluate((text) => {
    const ta = document.querySelector("textarea#descriptionTextArea");
    ta.focus();
    ta.select();
    document.execCommand("selectAll", false, null);
    document.execCommand("insertText", false, text);
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    ta.dispatchEvent(new Event("change", { bubbles: true }));
  }, proposalText);
  
  await new Promise(r => setTimeout(r, 1000));
  
  // Submit bid
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
  
  const postText = await page.evaluate(() => document.body.innerText.slice(1500, 3200));
  console.log("Post submission snippet:\n", postText);
  
  const cookies = await page.cookies();
  fs.writeFileSync("/data/data/com.termux/files/home/phone-browser-agent/saved-sessions/cookies/freelancer.com.json", JSON.stringify(cookies, null, 2));
  console.log("Saved cookies!");
  
  await browser.disconnect();
})().catch(console.error);
