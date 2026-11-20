const puppeteer=require('puppeteer-core'); const say=(...a)=>console.log(...a);
(async()=>{let b,p;try{
b=await puppeteer.connect({browserURL:'http://127.0.0.1:9224',protocolTimeout:20000});
const pages=await b.pages(); p=pages.find(x=>x.url()==='chrome-native://newtab/'); if(!p)throw new Error('No blank test tab');
await p.bringToFront();
const html='<meta name="viewport" content="width=device-width,initial-scale=1"><input id="f"><button id="b" onclick="document.body.dataset.clicked=\'yes\'">CLICK</button>';
await p.goto('data:text/html;charset=utf-8,'+encodeURIComponent(html),{waitUntil:'domcontentloaded',timeout:15000}); say('LOCAL_PAGE_READY');
await p.focus('#f'); await p.keyboard.type('REMOTE_TYPE_OK'); say('KEYBOARD_OK');
await p.click('#b',{timeout:15000}); say('MOUSE_CLICK_OK');
const result=await p.evaluate(()=>({typed:document.querySelector('#f').value,clicked:document.body.dataset.clicked||''}));
say('RESULT',JSON.stringify(result));
if(result.typed!=='REMOTE_TYPE_OK'||result.clicked!=='yes')throw new Error('Assertions failed');
await p.goto('chrome-native://newtab/').catch(()=>{}); say('BROWSER_CLICK_TYPE_PASS');
}catch(e){console.error('TEST_FAIL',e.message);process.exitCode=1;}finally{if(b)b.disconnect();}})();