#!/usr/bin/env python3
# Builds the demo tree in a temp dir and runs GNU find on a token list (JSON on argv[1]).
import sys,os,json,subprocess,tempfile
sys.path.insert(0,'.')
TREE=json.load(open('tree.json'))
def build(root):
    for p,t,e in TREE:
        full=os.path.join(root,p)
        if p=='.':continue
        if t=='d':os.makedirs(full,exist_ok=True)
        else:
            os.makedirs(os.path.dirname(full),exist_ok=True)
            open(full,'w').write('' if e else 'x\n')
if __name__=='__main__':
    d=tempfile.mkdtemp();build(d);os.chdir(d)
    reqs=json.load(sys.stdin);out=[]
    for toks in reqs:
        r=subprocess.run(['find','.']+toks,capture_output=True,text=True)
        out.append({'rc':r.returncode,'out':sorted(r.stdout.split('\n')[:-1]) if r.stdout else [],'err':r.stderr})
    json.dump(out,sys.stdout)
