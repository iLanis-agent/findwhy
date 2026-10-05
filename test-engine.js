// Usage: node test-engine.js SEED N   (compares engine to GNU find via oracle.py)
var F=require('./engine.js'),cp=require('child_process');
var seed=+process.argv[2]||1,N=+process.argv[3]||2000;
function rnd(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
function pick(a){return a[Math.floor(rnd()*a.length)];}
var names=['*.c','*.md','*.log*','node_modules','.*','README*','[a-m]*','?ib.?','*','util.?','src','docs','Debug*','*.txt','a*','*.[ch]','[!.]*','vendor','build.sh','x'];
var inames=['*.MD','readme*','DEBUG.log','*.C','SRC'];
var paths=['./src/*','*/vendor/*','./docs/*.md','*node_modules*','./src','*.c','./logs/*','./.git*','./docs/old'];
function leaf(){
  var r=rnd();
  if(r<.34)return ['-name',pick(names)];
  if(r<.42)return ['-iname',pick(inames)];
  if(r<.55)return ['-path',pick(paths)];
  if(r<.67)return ['-type',pick(['f','d','f','d','l'])];
  if(r<.75)return ['-empty'];
  if(r<.82)return ['-prune'];
  if(r<.90)return ['-print'];
  if(r<.93)return ['-true'];
  if(r<.95)return ['-false'];
  if(r<.97)return ['-maxdepth',String(Math.floor(rnd()*4))];
  return ['-mindepth',String(Math.floor(rnd()*3))];
}
function expr(d){
  var n=1+Math.floor(rnd()*4),out=[];
  for(var i=0;i<n;i++){
    if(i>0){var r=rnd();if(r<.4)out.push('-o');else if(r<.55)out.push('-a');}
    var u=rnd(),part;
    if(d<2&&u<.18)part=['(' ].concat(expr(d+1),[')']);
    else part=leaf();
    if(rnd()<.12)part=['!'].concat(part);
    out=out.concat(part);
  }
  return out;
}
var cases=[];
for(var i=0;i<N;i++){var t=expr(0);if(rnd()<.03)t=t.slice(0,-1);cases.push(t);}
var res=JSON.parse(cp.execSync('python3 oracle.py',{input:JSON.stringify(cases),maxBuffer:1<<28}));
var ok=0,errOk=0,bad=0,shown=0,engErr=0,G={plain:{n:0,bad:0},explicit:{n:0,bad:0}};
cases.forEach(function(t,i){
  var s=t.map(F.quote).join(' '),mine,e=null;
  try{mine=F.run(s);}catch(x){e=x;}
  var o=res[i];var grp=/(^| )(-print|-prune)( |$)/.test(s)?'explicit':'plain';
  if(e){engErr++;if(o.rc!==0)errOk++;else{bad++;if(shown++<8)console.log('ENGINE ERR but find ok:',s,e.message);}return;}
  if(o.rc!==0){bad++;if(shown++<8)console.log('find error but engine ok:',s,o.err.trim());return;}
  G[grp].n++;
  var a=mine.printed.slice().sort().join('\n'),b=o.out.join('\n');
  if(a===b)ok++;else{bad++;G[grp].bad++;if(grp==='plain'&&shown++<8)console.log('DIFF:',s,'\nmine',mine.printed.length,'find',o.out.length);}
});
console.log(JSON.stringify({seed:+process.argv[2],cases:N,outputMatch:ok,bothErrored:errOk,mismatches:bad,groups:G,engineRejected:engErr}));
