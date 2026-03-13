
import urllib.request
import json
import ssl

keys = ["YOUR_GEMINI_KEY_1", "YOUR_GEMINI_KEY_2"]
data = {"contents": [{"parts": [{"text": "Anda adalah asisten guru profesional..."}]}]}

for key in keys:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key={key}"
    req = urllib.request.Request(url, data=json.dumps(data).encode("utf-8"), headers={"Content-Type": "application/json"})
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    try:
        urllib.request.urlopen(req, context=ctx)
        print(f"Key {key[:10]}... is working!")
    except urllib.error.HTTPError as e:
        print(f"Key {key[:10]}... Failed with {e.code}")

