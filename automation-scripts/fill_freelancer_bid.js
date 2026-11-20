const puppeteer = require("puppeteer-core");

(async () => {
  const browser = await puppeteer.connect({ browserURL: "http://127.0.0.1:9224", defaultViewport: null });
  const targets = browser.targets();
  const flTarget = targets.find(t => t.url().includes("freelancer.com"));
  const page = await flTarget.page();
  
  const proposalText = `Hi there,

I specialize in building production-ready AI automation workflows using n8n and the OpenAI API. Your requirement for deflecting repetitive support tickets across Website Live Chat, Email (IMAP/SMTP), and WhatsApp is a project I can deliver with precision.

Here is my technical roadmap for your project:
1. n8n Workflow Architecture:
   - Webhook & Polling Triggers: Dedicated n8n trigger nodes for your live chat platform, IMAP/SMTP listener for incoming emails, and Twilio/Meta API webhooks for WhatsApp.
   - Text Sanitation & Context Retrieval: Pre-process incoming queries and match them against your historical support database (using vector embeddings or structured retrieval) to pull the most accurate context snippets.
   - Grounded LLM Response Generation: Feed the retrieved context and question into OpenAI GPT-4 with a strict system prompt to ensure precise, helpful answers without hallucinations.
   - Direct Dispatch: Route the generated answer straight back to the originating channel with zero delay.
   - Centralized Logging: Archive every incoming query, retrieved context, and generated response into a single accessible dashboard (Google Sheets or Supabase) for your ongoing review and fine-tuning.

2. Deliverables You Will Receive:
   - 3 clean, modular, and fully tested n8n workflow JSON files (Live Chat, Email, WhatsApp).
   - Knowledge-retrieval / prompt setup anchored to your past transcripts and email records.
   - Step-by-step environment documentation and handover notes.
   - A video walkthrough demonstrating test messages on all 3 channels responding accurately in real time.

I am ready to start immediately. Let's discuss your preferred live chat provider and transcript format on chat!

Best regards,
Arunasish Roy Chowdhury
Junior AI Automation & Web Developer`;

  const fillRes = await page.evaluate((proposal) => {
    function setField(selector, val) {
      const el = document.querySelector(selector);
      if (!el) return null;
      el.focus();
      const proto = el instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      const desc = Object.getOwnPropertyDescriptor(proto, "value");
      if (desc && desc.set) {
        desc.set.call(el, val);
      } else {
        el.value = val;
      }
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return el.value;
    }
    
    const b = setField("input#bidAmountInput", "450");
    const p = setField("input#periodInput", "5");
    const d = setField("textarea#descriptionTextArea", proposal);
    
    return {
      bidAmount: b,
      period: p,
      descLength: d ? d.length : 0
    };
  }, proposalText);
  console.log("Proposal filled successfully:\n", fillRes);
  
  await browser.disconnect();
})().catch(console.error);
