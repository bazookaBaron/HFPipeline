"""Print Fish API credit balance (key never printed)."""
import json, urllib.request, fishkey
r=urllib.request.Request("https://api.fish.audio/wallet/self/api-credit",headers={"Authorization":"Bearer "+fishkey.key()})
print(json.loads(urllib.request.urlopen(r,timeout=60).read()).get("credit"))
