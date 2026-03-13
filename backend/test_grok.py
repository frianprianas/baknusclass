
import urllib.request
import json
import ssl

url = "https://api.x.ai/v1/chat/completions"

data = {
    "model": "grok-beta",
    "messages": [
        {"role": "user", "content": "Hai"}
    ],
    "max_tokens": 10
}

req = urllib.request.Request(url, data=json.dumps(data).encode("utf-8"), headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_GROK_API_KEY"
})
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

try:
    with urllib.request.urlopen(req, context=ctx) as response:
        print(response.read().decode())
except urllib.error.HTTPError as e:
    print(f"HTTP Error: {e.code}")
    print(e.read().decode())

