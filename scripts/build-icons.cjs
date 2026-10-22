// Usage: node scripts/build-icons.cjs (requires sharp).
const fs=require('node:fs');
const path=require('node:path');
const sharp=require('sharp');
const root=path.resolve(__dirname,'..');
const svg=fs.readFileSync(path.join(root,'icons/icon.svg'));
const output=path.join(root,'icons/v2');
async function main(){
  fs.mkdirSync(output,{recursive:true});
  fs.writeFileSync(path.join(output,'icon.svg'),svg);
  await Promise.all([180,192,512].map(size=>sharp(svg).resize(size,size).png().toFile(path.join(output,`icon-${size}.png`))).concat([
    sharp({create:{width:512,height:512,channels:4,background:'#111318'}})
      .composite([{input:svg,left:0,top:0}]).png().toFile(path.join(output,'icon-maskable-512.png'))
  ]));
  // iOS's Add to Home Screen sheet may fail to fetch a network-backed icon.
  // Embed the opaque PNG in the initial HTML so no separate fetch is needed.
  const apple=await sharp(svg).resize(180,180).flatten({background:'#111318'}).removeAlpha().png().toBuffer();
  fs.writeFileSync(path.join(output,'apple-touch-icon-180.png'),apple);
  const file=path.join(root,'index.html');
  const html=fs.readFileSync(file,'utf8');
  const tag=/<link rel="apple-touch-icon"[^>]*>/g;
  if((html.match(tag)||[]).length!==1)throw new Error('Expected exactly one apple-touch-icon link');
  fs.writeFileSync(file,html.replace(tag,`<link rel="apple-touch-icon" type="image/png" sizes="180x180" href="data:image/png;base64,${apple.toString('base64')}">`));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
