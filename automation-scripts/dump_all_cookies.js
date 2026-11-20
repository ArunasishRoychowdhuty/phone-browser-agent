const puppeteer = require("puppeteer-core");
const fs = require("fs");

(async () => {
  try {
    const b = await puppeteer.connect({browserURL: "http://127.0.0.1:9224", defaultViewport: null});
    const pages = await b.pages();
    const cookieDir = "/data/data/com.termux/files/home/phone-browser-agent/saved-sessions/cookies";
    fs.mkdirSync(cookieDir, {recursive: true});

    const allSessionData = [];

    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      const url = p.url();
      if (!url.startsWith("http")) continue;
      try {
        const title = await p.title();
        const cookies = await p.cookies();
        const domain = new URL(url).hostname;
        
        allSessionData.push({
          tabIndex: i,
          title,
          url,
          domain,
          cookieCount: cookies.length,
          cookies
        });

        // Save platform-specific cookie file
        const cleanName = domain.replace(/[^a-zA-Z0-9.-]/g, "_");
        fs.writeFileSync(`${cookieDir}/${cleanName}.json`, JSON.stringify(cookies, null, 2));
        console.log(`Saved ${cookies.length} cookies for ${domain}`);
      } catch (err) {
        console.log(`Error on page ${url}:`, err.message);
      }
    }

    fs.writeFileSync(`${cookieDir}/all_sessions_manifest.json`, JSON.stringify(allSessionData, null, 2));
    console.log("All session cookies manifest created successfully!");

    await b.disconnect();
  } catch (e) {
    console.error("Cookie dump error:", e);
  }
})();
