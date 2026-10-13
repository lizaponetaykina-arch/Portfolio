// Exact crops and conservative 2x resampling. Never synthesize screenshot text.
const sharp = require('sharp');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'assets/prepared');
fs.mkdirSync(output, {recursive:true});
const crops = [
 ['reels', 'assets/auto-result.png', 149,411,500,825],
 ['auto-views', 'assets/auto-stats.png', 1725,292,450,910],
 ['auto-followers', 'assets/auto-result.png', 1460,850,970,348],
 ['pub-views', 'assets/pub-stats.png', 1764,194,490,1014],
 ['vr-before', 'assets/originals/IMG_6335.JPG',287,140,464,824],
 ['vr-after', 'assets/originals/IMG_6335.JPG',1174,128,464,824],
 ['auto-before', 'assets/originals/IMG_6336.JPG',295,198,444,733],
 ['auto-after', 'assets/originals/IMG_6336.JPG',1178,198,444,733],
 ['restaurant-before', 'assets/originals/IMG_6337.JPG',273,211,450,817],
 ['restaurant-after', 'assets/originals/IMG_6337.JPG',1176,211,450,817],
];
(async()=>{
 const manifest={method:'Exact source crop, Lanczos3 2x and mild sharpening; no generative restoration',files:{}};
 for(const [name,source,left,top,width,height] of crops){
  await sharp(path.join(root,source)).extract({left,top,width,height}).resize(width*2,height*2,{kernel:'lanczos3'}).sharpen({sigma:.55,m1:.4,m2:1}).webp({quality:96,smartSubsample:true}).toFile(path.join(output,name+'.webp'));
  manifest.files[name+'.webp']={source,crop:{left,top,width,height},width:width*2,height:height*2};
 }
 await sharp(path.join(root,'assets/work/contact-restored.png')).resize({width:960,withoutEnlargement:true}).webp({quality:90}).toFile(path.join(output,'contact.webp'));
 fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2));
 console.log('Prepared '+crops.length+' exact crops and optimized contact image');
})();
