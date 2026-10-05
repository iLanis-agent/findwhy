(function(root){
'use strict';
// Fixed demo tree. t: f=file, d=dir, e=empty (file of size 0 or dir with no entries)
var TREE=[
['.','d'],['./.git','d'],['./.git/config','f'],['./.hidden','f'],['./Makefile','f'],['./README.md','f'],['./build.sh','f'],
['./docs','d'],['./docs/guide.md','f'],['./docs/notes.txt','f'],['./docs/old','d'],
['./empty.txt','f',1],
['./logs','d'],['./logs/Debug.log','f'],['./logs/app.log','f'],['./logs/app.log.1','f'],
['./node_modules','d'],['./node_modules/pkg','d'],['./node_modules/pkg/README.md','f'],['./node_modules/pkg/index.js','f'],
['./src','d'],['./src/main.c','f'],['./src/util.c','f'],['./src/util.h','f'],['./src/vendor','d'],['./src/vendor/lib.c','f'],['./src/vendor/lib.h','f']
].map(function(x){return {path:x[0],type:x[1],emptyFile:!!x[2]};});
function cmpBytes(a,b){return a<b?-1:a>b?1:0;}
function depthOf(p){return p==='.'?0:p.split('/').length-1;}
function base(p){return p==='.'?'.':p.slice(p.lastIndexOf('/')+1);}
function children(p){
  return TREE.filter(function(e){return e.path!==p&&e.path.lastIndexOf('/')===p.length&&e.path.indexOf(p+'/')===0&&p!==e.path;}).map(function(e){return e;});
}
function isEmpty(e){return e.type==='d'?children(e.path).length===0:e.emptyFile;}

function tokenize(s){
  var out=[],cur=null,i=0,q=null;
  function add(c){cur=(cur===null?'':cur)+c;}
  for(i=0;i<s.length;i++){
    var c=s[i];
    if(q==="'"){ if(c==="'")q=null; else add(c); continue;}
    if(q==='"'){
      if(c==='"')q=null;
      else if(c==='\\'&&i+1<s.length&&'"\\$`'.indexOf(s[i+1])>=0){add(s[++i]);}
      else add(c);
      continue;
    }
    if(c==="'"||c==='"'){q=c;if(cur===null)cur='';continue;}
    if(c==='\\'){ if(i+1<s.length){add(s[++i]);} else add('\\'); continue;}
    if(/\s/.test(c)){ if(cur!==null){out.push(cur);cur=null;} continue;}
    add(c);
  }
  if(q) throw new Error('unmatched '+q+' quote');
  if(cur!==null)out.push(cur);
  return out;
}

function globToRegex(pat,ci){
  var re='',i=0;
  while(i<pat.length){
    var c=pat[i];
    if(c==='*'){re+='[\\s\\S]*';i++;}
    else if(c==='?'){re+='[\\s\\S]';i++;}
    else if(c==='\\'){ if(i+1<pat.length){re+=esc(pat[i+1]);i+=2;} else {re+='\\\\';i++;} }
    else if(c==='['){
      var j=i+1,neg=false;
      if(pat[j]==='!'||pat[j]==='^'){neg=true;j++;}
      var start=j,set='';
      if(pat[j]===']'){set+='\\]';j++;}
      while(j<pat.length&&pat[j]!==']'){
        if(pat[j]==='\\'&&j+1<pat.length){set+=esc(pat[j+1]);j+=2;continue;}
        if(pat[j]==='-'&&j>start&&j+1<pat.length&&pat[j+1]!==']'){set+='-';j++;continue;}
        set+=esc(pat[j]);j++;
      }
      if(j>=pat.length){re+='\\[';i++;}
      else {re+='['+(neg?'^':'')+set+']';i=j+1;}
    } else {re+=esc(c);i++;}
  }
  return new RegExp('^'+re+'$',ci?'i':'');
}
function esc(c){return /[\\^$.*+?()[\]{}|\-\/]/.test(c)?'\\'+c:c;}

var TESTS={'-name':'name','-iname':'iname','-path':'path','-wholename':'path','-ipath':'ipath','-iwholename':'ipath','-type':'type'};
var NOARG={'-empty':1,'-true':1,'-false':1,'-print':1,'-print0':1,'-prune':1};
var OPTS={'-maxdepth':1,'-mindepth':1};

function parse(tokens){
  var pos=0,opts={maxdepth:Infinity,mindepth:0},hasAction=false;
  function peek(){return tokens[pos];}
  function parseOr(){
    var kids=[parseAnd()];
    while(peek()==='-o'||peek()==='-or'){pos++;
      if(pos>=tokens.length||peek()===')')throw new Error('expression ends after -o: missing operand');
      kids.push(parseAnd());}
    return kids.length===1?kids[0]:{k:'or',kids:kids};
  }
  function parseAnd(){
    var kids=[parseNot()];
    for(;;){
      var t=peek();
      if(t===undefined||t==='-o'||t==='-or'||t===')')break;
      if(t==='-a'||t==='-and'){pos++;
        if(pos>=tokens.length||peek()===')'||peek()==='-o'||peek()==='-or')throw new Error('missing operand after '+t);}
      kids.push(parseNot());
    }
    return kids.length===1?kids[0]:{k:'and',kids:kids};
  }
  function parseNot(){
    var t=peek();
    if(t==='!'||t==='-not'){pos++;
      if(pos>=tokens.length)throw new Error('missing operand after '+t);
      return {k:'not',kid:parseNot()};}
    return parsePrimary();
  }
  function parsePrimary(){
    var t=peek();
    if(t===undefined)throw new Error('missing expression');
    pos++;
    if(t==='('){
      if(peek()===')')throw new Error('empty parentheses');
      var e=parseOr();
      if(peek()!==')')throw new Error('unmatched ( : missing )');
      pos++;return {k:'group',kid:e};
    }
    if(t===')')throw new Error('unexpected )');
    if(t==='-a'||t==='-and'||t==='-o'||t==='-or')throw new Error('operator '+t+' has no left operand');
    if(TESTS[t]){
      if(pos>=tokens.length)throw new Error('missing argument to '+t);
      var arg=tokens[pos++];
      if(TESTS[t]==='type'){
        if(!/^[fdlbcps]$/.test(arg))throw new Error('unknown argument to -type: '+arg+' (use f or d here)');
        return {k:'test',op:'type',arg:arg,text:'-type '+arg};
      }
      var ci=TESTS[t]==='iname'||TESTS[t]==='ipath';
      var isName=TESTS[t]==='name'||TESTS[t]==='iname';
      return {k:'test',op:TESTS[t],arg:arg,re:globToRegex(arg,ci),slash:isName&&arg.indexOf('/')>=0,text:t+' '+quote(arg)};
    }
    if(OPTS[t]){
      if(pos>=tokens.length)throw new Error('missing argument to '+t);
      var n=tokens[pos++];
      if(!/^[0-9]+$/.test(n))throw new Error('invalid argument '+quote(n)+' to '+t);
      if(t==='-maxdepth')opts.maxdepth=+n;else opts.mindepth=+n;
      return {k:'opt',text:t+' '+n};
    }
    if(NOARG[t]){
      if(t==='-print'||t==='-print0')hasAction=true;
      return {k:t==='-prune'?'prune':(t==='-print'||t==='-print0')?'print':'test',op:t.slice(1),text:t};
    }
    throw new Error('unknown predicate '+quote(t));
  }
  var ast=null;
  if(tokens.length){ast=parseOr();if(pos<tokens.length)throw new Error('unexpected '+quote(tokens[pos]));}
  return {ast:ast,opts:opts,hasAction:hasAction};
}
function quote(s){return /^[A-Za-z0-9_.\/,:+=@%-]+$/.test(s)?s:"'"+s.replace(/'/g,"'\\''")+"'";}

function show(n){
  switch(n.k){
    case 'or':return n.kids.map(show).join(' -o ');
    case 'and':return n.kids.map(show).join(' -a ');
    case 'not':return '! '+show(n.kid);
    case 'group':return '( '+show(n.kid)+' )';
    default:return n.text;
  }
}
// fully parenthesized: every and/or node explicit
function full(n){
  switch(n.k){
    case 'or':return '( '+n.kids.map(full).join(' -o ')+' )';
    case 'and':return '( '+n.kids.map(full).join(' -a ')+' )';
    case 'not':return '! '+full(n.kid);
    case 'group':return full(n.kid);
    default:return n.text;
  }
}

function run(input){
  var tokens=tokenize(input),P=parse(tokens);
  var ast=P.ast,opts=P.opts;
  var implicit=!P.hasAction;
  var root=ast?(implicit?{k:'and',kids:[ast,{k:'print',text:'-print',implicit:true}]}:ast):{k:'print',text:'-print',implicit:true};
  var results=[],printed=[];
  var ctx;
  function ev(n){
    switch(n.k){
      case 'group':return ev(n.kid);
      case 'not':{var r=!ev(n.kid);return r;}
      case 'and':{for(var i=0;i<n.kids.length;i++){if(!ev(n.kids[i])){return false;}}return true;}
      case 'or':{for(var j=0;j<n.kids.length;j++){if(ev(n.kids[j]))return true;}return false;}
      case 'opt':return true;
      case 'prune':ctx.pruned=true;ctx.trace.push([n.text,true]);return true;
      case 'print':ctx.printed++;ctx.trace.push([n.implicit?'-print (implicit)':n.text,true]);return true;
      case 'test':{
        var e=ctx.e,r2;
        switch(n.op){
          case 'name':case 'iname':r2=n.slash?false:n.re.test(base(e.path));break;
          case 'path':case 'ipath':r2=n.re.test(e.path);break;
          case 'type':r2=(n.arg==='f'&&e.type==='f')||(n.arg==='d'&&e.type==='d');break;
          case 'empty':r2=isEmpty(e);break;
          case 'true':r2=true;break;
          case 'false':r2=false;break;
        }
        ctx.trace.push([n.text,r2]);return r2;
      }
    }
  }
  function visit(e){
    var d=depthOf(e.path);
    if(d>opts.maxdepth)return;
    ctx={e:e,trace:[],pruned:false,printed:0};
    if(d>=opts.mindepth)ev(root);
    var rec={path:e.path,type:e.type,trace:ctx.trace,printed:ctx.printed>0,prints:ctx.printed,pruned:ctx.pruned&&e.type==='d'};
    results.push(rec);for(var pi=0;pi<ctx.printed;pi++)printed.push(e.path);
    if(e.type==='d'&&!(ctx.pruned)&&d<opts.maxdepth){
      var kids=children(e.path).slice().sort(function(a,b){return cmpBytes(a.path,b.path);});
      kids.forEach(visit);
    }
  }
  visit(TREE[0]);
  return {tokens:tokens,shown:ast?show(ast):'',full:ast?full(ast):'',implicitPrint:implicit,
    effective:ast?(implicit?full(ast)+' -a -print':full(ast)):'-print',
    results:results,printed:printed,opts:opts,ast:ast,hasAction:P.hasAction};
}
var api={TREE:TREE,tokenize:tokenize,run:run,quote:quote};
if(typeof module!=='undefined')module.exports=api;else root.FindWhy=api;
})(this);
