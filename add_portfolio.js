const puppeteer = require('puppeteer-core');

const projects = [
  {
    title: 'AI Multi-Channel Support Bot',
    desc: 'Enterprise-grade multi-channel AI customer support system connecting Website Live Chat, WhatsApp Cloud API, and Telegram with n8n orchestration and OpenAI GPT-4o embeddings.',
    img: '/sdcard/Download/project1_ai_support.png'
  },
  {
    title: 'AI Lead Qualification & CRM',
    desc: 'Automated inbound lead qualification and dispatch system powered by n8n, OpenAI API, and CRM/Google Sheets with real-time multi-tier sales team notifications.',
    img: '/sdcard/Download/project2_lead_crm.png'
  },
  {
    title: 'Web Portal & CMS Automation',
    desc: 'High-performance responsive business web portal with automated form workflows, OpenAI SEO generation, and custom REST API integrations.',
    img: '/sdcard/Download/project3_web_portal.png'
  }
];

async function addSingleProject(page, p) {
  console.log(`\n========================================`);
  console.log(`Starting: ${p.title}`);
  console.log(`========================================`);

  await page.goto('https://www.freelancer.com/discover/publish', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(r => setTimeout(r, 4000));

  // 1. Upload File
  const fileInput = await page.$('input[type="file"]');
  if (fileInput) {
    console.log(`Uploading file from ${p.img}...`);
    await fileInput.uploadFile(p.img);
    await new Promise(r => setTimeout(r, 4000));
  } else {
    console.log('Error: input[type="file"] not found!');
  }

  // 2. Set Title & Description with Angular events
  const validity = await page.evaluate((titleVal, descVal) => {
    const tInput = document.querySelector('input[placeholder*="Geometric logo design"]');
    if (tInput) {
      tInput.value = titleVal;
      tInput.dispatchEvent(new Event('input', { bubbles: true }));
      tInput.dispatchEvent(new Event('change', { bubbles: true }));
      tInput.dispatchEvent(new Event('blur', { bubbles: true }));
    }

    const dInput = document.querySelector('textarea[placeholder*="Tell us what makes your work special"]');
    if (dInput) {
      dInput.value = descVal;
      dInput.dispatchEvent(new Event('input', { bubbles: true }));
      dInput.dispatchEvent(new Event('change', { bubbles: true }));
      dInput.dispatchEvent(new Event('blur', { bubbles: true }));
    }

    return {
      tValid: tInput ? tInput.className.includes('ng-valid') : false,
      tVal: tInput ? tInput.value : '',
      dValid: dInput ? dInput.className.includes('ng-valid') : false,
      dVal: dInput ? dInput.value : '',
      filesCount: document.querySelector('input[type="file"]')?.files?.length || 0
    };
  }, p.title, p.desc);

  console.log('Input validation state:', validity);

  // 3. Click Next button
  await page.evaluate(() => {
    const nextBtn = Array.from(document.querySelectorAll('fl-button')).find(b => b.innerText.trim() === 'Next');
    if (nextBtn) {
      const btn = nextBtn.querySelector('button') || nextBtn;
      btn.click();
    }
  });

  console.log('Clicked Next. Waiting for step transition...');
  await new Promise(r => setTimeout(r, 5000));

  // 4. Check page state after Next
  const afterNext = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button, fl-button')).map(b => b.innerText.trim()).filter(Boolean);
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, fl-heading')).map(h => h.innerText);
    const errors = Array.from(document.querySelectorAll('.is-invalid, .has-error, fl-callout, [data-color="error"]')).map(e => e.innerText);
    return {
      url: window.location.href,
      btns,
      headings,
      errors
    };
  });
  console.log('After Next State:', JSON.stringify(afterNext, null, 2));

  // 5. Look for Publish / Finish / Save button and click it
  const published = await page.evaluate(() => {
    const pub = Array.from(document.querySelectorAll('button, fl-button')).find(b => {
      const t = b.innerText.trim().toLowerCase();
      return t === 'publish' || t === 'finish' || t === 'save item' || t === 'save and finish' || t === 'publish item';
    });
    if (pub) {
      const btn = pub.querySelector('button') || pub;
      btn.click();
      return pub.innerText.trim();
    }
    return null;
  });

  if (published) {
    console.log(`Clicked final publish button: ${published}`);
    await new Promise(r => setTimeout(r, 5000));
    console.log(`Current URL after publish: ${page.url()}`);
  } else {
    console.log('No final publish button found, checking if URL changed or if already published.');
  }
}

(async () => {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9224' });
  const page = (await browser.pages()).find(p => p.url().includes('freelancer.com'));

  for (const p of projects) {
    try {
      await addSingleProject(page, p);
      await new Promise(r => setTimeout(r, 2000));
    } catch (e) {
      console.error(`Error adding ${p.title}:`, e);
    }
  }

  await browser.disconnect();
  console.log('All portfolio items processed.');
})();
