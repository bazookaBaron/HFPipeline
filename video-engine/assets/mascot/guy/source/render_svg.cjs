const path=require("path");const fs=require("fs");
const puppeteer=require(require.resolve("puppeteer",{paths:[path.resolve("C:/Repos/HFPipleine/carousel-engine")]}));
(async()=>{const [,,svgPath,out]=process.argv;const b=await puppeteer.launch({headless:"new"});const p=await b.newPage();
await p.setViewport({width:768,height:1376,deviceScaleFactor:2});
let svg=fs.readFileSync(svgPath,"utf-8").replace(/<path d="M0 0 C253\.44[^>]*\/>/,"");
await p.setContent(`<html><head><style>html,body{margin:0;background:transparent}</style></head><body>${svg}</body></html>`);
await p.screenshot({path:out,omitBackground:true});await b.close();})();
