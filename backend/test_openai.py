
import urllib.request
import json
import ssl

url = "https://api.openai.com/v1/chat/completions"

data = {
    "model": "gpt-4o-mini",
    "messages": [
        {"role": "user", "content": "Anda adalah asisten guru profesional..."}
    ],
    "temperature": 0.3,
    "max_tokens": 500
}

req = urllib.request.Request(url, data=json.dumps(data).encode("utf-8"), headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_OPENAI_API_KEY"
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

