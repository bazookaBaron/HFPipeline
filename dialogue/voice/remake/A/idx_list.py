import json,sys
pk=json.load(open('remake/A/picks.json'))['picks']; T=[3,8,9,13,17,18]
L=['clone_bakeoff/refs/Young-Man_prompt.wav','clone_bakeoff/refs/Women_prompt.wav']
for t in T: L+=[f'remake/A/idx_proof/ref_t{t:02d}.wav','remake/A/takes/'+pk[str(t)]['take'],f'remake/A/idx_proof/t{t:02d}_b.wav',f'remake/A/idx_proof/t{t:02d}_c.wav']
json.dump(L,open('remake/A/idx_proof/list.json','w'))
