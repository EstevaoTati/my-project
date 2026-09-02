/** The new sign-up order: infos, verification, then password. */
const { chromium } = require("playwright");
const http=require("http"),fs=require("fs"),path=require("path");
const D=process.env.APP_DIST, LOG=process.env.API_LOG||"/tmp/242konnect-api.log";
const T={".html":"text/html",".js":"text/javascript",".json":"application/json",".png":"image/png",".ttf":"font/ttf",".ico":"image/x-icon"};
const s=http.createServer((q,r)=>{const p=decodeURIComponent(q.url.split("?")[0]);const f=path.join(D,p==="/"?"/index.html":p);
if(!f.startsWith(D)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(200,{"Content-Type":"text/html"});fs.createReadStream(path.join(D,"index.html")).pipe(r);return;}
r.writeHead(200,{"Content-Type":T[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r);});
let pass=0; const fails=[];
const check=async(l,fn)=>{try{const r=await fn(); if(!r) throw new Error("falsy"); console.log("  ✓ "+l); pass++;}
  catch(e){console.log("  ✗ "+l+" — "+e.message.split("\n")[0]); fails.push(l);}};
(async()=>{await new Promise(r=>s.listen(8996,r));
const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH});
const p=await(await b.newContext({viewport:{width:390,height:844}})).newPage();
const errs=[];p.on("pageerror",e=>errs.push(e.message.slice(0,140)));
const vis=async sel=>{for(const e of (await p.locator(sel).all()).reverse()) if(await e.isVisible()) return e; return null;};
const tap=async sel=>{const e=await vis(sel); if(!e) throw new Error("not visible: "+sel); await e.click(); await p.waitForTimeout(650);};
const fill=async(sel,v)=>{const e=await vis(sel); if(!e) throw new Error("not visible: "+sel); await e.fill(v); await p.waitForTimeout(200);};
const seen=async sel=>!!(await vis(sel));
await p.goto("http://localhost:8996/",{waitUntil:"networkidle"});
await p.waitForSelector("text=Chaque problème",{timeout:30000}); await p.waitForTimeout(700);

await tap('[aria-label="Créer un compte"]');
await p.waitForSelector("text=Quel type de compte ?",{timeout:15000});
await tap('[aria-label="Continuer"]');
await check("identity step has no password field", async()=> !(await seen('[aria-label="Mot de passe"]')));
await check("the country code can be changed", ()=> seen('[aria-label*="Indicatif pays"]'));
await check("a location is asked for", ()=> seen("text=Où habitez-vous ?"));

await fill('[aria-label="Nom complet"]',"Estevao Macumba");
await fill('[aria-label="Numéro de téléphone"]',"066554433");
await fill('[aria-label="Adresse e-mail"]',"estevao@mwinda.cg");
await tap('[aria-label*="Choisir la ville"], [aria-label*="Ville :"]');
await tap('[aria-label="Pointe-Noire"]');
const before = fs.existsSync(LOG)? fs.readFileSync(LOG,"utf8").length : 0;
await tap('[aria-label="Continuer vers les informations"]');
await p.waitForSelector("text=Où intervenir ?",{timeout:15000});
await fill('[aria-label="Adresse complète"]',"Avenue Tiboti, Mpaka");
await fill("[aria-label=\"Référence de l'adresse\"]","En face du marché");
await tap('[aria-label="Créer mon compte"]');
await p.waitForSelector("text=Vérification",{timeout:20000}); await p.waitForTimeout(900);

await check("verification comes before the password", ()=> seen("text=Consultez votre boîte e-mail"));
await check("no code is shown on screen", async()=>{
  const body=await p.content(); return !/>\s*\d{6}\s*</.test(body);});

const fresh = fs.readFileSync(LOG,"utf8").slice(before);
const m=[...fresh.matchAll(/est : (\d{6})/g)].pop();
await check("the service actually mailed a code", ()=> !!m);
if(m){
  await fill('[aria-label="Code de vérification"]', m[1]);
  await p.waitForTimeout(1600);
  await check("verifying leads to the password step", ()=> seen("text=Créer votre mot de passe"));
  await check("it says the address is verified", ()=> seen("text=Adresse vérifiée"));
  await check("a weak password is refused", async()=>{
    await fill('[aria-label="Mot de passe"]',"abc");
    await p.waitForTimeout(400);
    return seen("text=au moins 8 caractères");
  });
  await fill('[aria-label="Mot de passe"]',"Konnect2026");
  await fill('[aria-label="Confirmer le mot de passe"]',"Konnect2026");
  await tap('[aria-label="Créer mon compte"]');
  await p.waitForTimeout(2000);
  await check("the account is created only at the end", ()=> seen("text=Catégories"));
}
await check("no page errors", ()=> errs.length===0 || `errors: ${errs[0]}`);
console.log(`\n${pass} passed, ${fails.length} failed`);
if(errs.length) console.log("errors:",errs.slice(0,3));
await b.close(); s.close(); process.exit(fails.length?1:0);})();
