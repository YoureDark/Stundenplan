// Usage: node scripts/build-icons.cjs (requires sharp).
const fs=require('node:fs');
const path=require('node:path');
const sharp=require('sharp');
const root=path.resolve(__dirname,'..');
const svg=fs.readFileSync(path.join(root,'icons/icon.svg'));
const output=path.join(root,'icons/v2');
fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(path.join(output,'icon.svg'),svg);
Promise.all([180,192,512].map(size=>sharp(svg).resize(size,size).png().toFile(path.join(output,`icon-${size}.png`))).concat([
  // Full-bleed maskable background; the calendar stays inside the safe circle.
  sharp({create:{width:512,height:512,channels:4,background:'#111318'}})
    .composite([{input:svg,left:0,top:0}]).png().toFile(path.join(output,'icon-maskable-512.png'))
])).catch(e=>{console.error(e);process.exitCode=1;});
