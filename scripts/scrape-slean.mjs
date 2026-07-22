import { writeFileSync, readFileSync } from 'node:fs';
import { parseImport } from '../src/lib/import-parse.ts';
const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const artistPage='https://www.ultimate-guitar.com/artist/sarah_slean_11340';
async function get(u){for(let a=0;a<3;a++){try{const r=await fetch(u,{redirect:'follow',headers:{'User-Agent':UA,'Accept-Language':'en'}});if(r.status===429){await sleep(2500);continue}if(!r.ok)return null;return await r.text()}catch{await sleep(700)}}return null}
const idx=await get(artistPage);
const urls=[...new Set([...idx.matchAll(/tabs\.ultimate-guitar\.com\\?\/tab\\?\/sarah-slean\\?\/[a-z0-9-]+-(?:chords|tabs)-\d+/g)].map(m=>m[0].replace(/\\\//g,'/')))].map(u=>'https://'+u);
const songs=[];let i=0;
for(const u of urls){
  const html=await get(u);
  process.stderr.write(html?'.':'x');
  if(!html){await sleep(200);continue}
  const r=parseImport(html);
  if(!r.body.trim()){await sleep(200);continue}
  songs.push({id:`slean-${i++}`,title:r.title||slug(u),artist:r.artist||'Sarah Slean',key:r.key||'',capo:r.capo||0,body:r.body,sourceUrl:u,tags:['sarah-slean'],collection:'Sarah Slean'});
  await sleep(250);
}
function slug(u){return (u.match(/sarah-slean\/([a-z0-9-]+)-chords/)||[,''])[1].replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}
writeFileSync(new URL('../public/collections/slean.json',import.meta.url).pathname,JSON.stringify(songs));
// update manifest
const mp=new URL('../public/collections/index.json',import.meta.url).pathname;
const man=JSON.parse(readFileSync(mp));
if(!man.find(m=>m.id==='slean')) man.push({id:'slean',name:'Sarah Slean',file:'slean.json',count:songs.length});
else man.find(m=>m.id==='slean').count=songs.length;
writeFileSync(mp,JSON.stringify(man,null,2));
console.error(`\nSarah Slean: ${songs.length} songs`);
