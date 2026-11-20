const puppeteer = require("puppeteer-core");
const http = require("http");

function activateTab(id) {
  return new Promise((resolve) => {
    http.get(`http://127.0.0.1:9224/json/activate/${id}`, () => resolve());
  });
}

(async () => {
  await activateTab("453");
  await new Promise(r => setTimeout(r, 1000));
  
  const browser = await puppeteer.connect({ browserURL: "http://127.0.0.1:9224", defaultViewport: null });
  const targets = browser.targets();
  const flTarget = targets.find(t => t.url().includes("freelancer.com"));
  if (!flTarget) {
    console.error("Freelancer target not found among targets:", targets.map(t => t.url()));
    process.exit(1);
  }
  
  const page = await flTarget.page();
  console.log("Navigating to projects search...");
  await page.goto("https://www.freelancer.com/search/projects?q=n8n%20AI%20automation", { waitUntil: "domcontentloaded", timeout: 20000 });
  await new Promise(r => setTimeout(r, 4000));
  
  console.log("Search Page URL:", page.url());
  const projectList = await page.evaluate(() => {
    const list = [];
    const elements = document.querySelectorAll("app-project-card, .search-result-link, [fltrackinglabel=\"SearchResultCard\"], fl-card");
    for (const el of elements) {
      const titleEl = el.querySelector("a[href*=\"/projects/\"], h2, h3, .ProjectCard-title");
      const descEl = el.querySelector(".ProjectCard-description, p, .search-result-description");
      const priceEl = el.querySelector(".ProjectCard-price, .ProjectCard-avgBid, [class*=\"price\"], [class*=\"bid\"]");
      if (titleEl && titleEl.innerText.trim()) {
        list.push({
          title: titleEl.innerText.trim(),
          url: titleEl.href || (titleEl.closest("a") ? titleEl.closest("a").href : null),
          desc: descEl ? descEl.innerText.trim().slice(0, 200) : "",
          price: priceEl ? priceEl.innerText.trim() : ""
        });
      }
    }
    // If empty, extract all project links
    if (list.length === 0) {
      const allLinks = Array.from(document.querySelectorAll("a[href*=\"/projects/\"]"));
      for (const a of allLinks) {
        if (a.innerText.trim().length > 10 && !list.find(x => x.title === a.innerText.trim())) {
          list.push({
            title: a.innerText.trim(),
            url: a.href,
            desc: "",
            price: ""
          });
        }
      }
    }
    return list;
  });
  
  console.log("Found Projects Count:", projectList.length);
  console.log("Projects:\n", JSON.stringify(projectList.slice(0, 10), null, 2));
  
  await browser.disconnect();
})().catch(console.error);
