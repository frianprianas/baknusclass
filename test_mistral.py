import requests
import json

url = "https://api.mistral.ai/v1/chat/completions"
headers = {
    "Content-Type": "application/json",
    "Authorization": "Bearer ZxLIg6l2lF6mh8T17Je84V9joZw4pgk6"
}
data = {
    "model": "mistral-large-latest",
    "messages": [
        {"role": "user", "content": "Halo, tolong konfirmasi apakah Anda siap membantu menilai essay siswa di BaknusBelajar."}
    ],
    "temperature": 0.3
}

try:
    response = requests.post(url, headers=headers, data=json.dumps(data))
    if response.status_code == 200:
        content = response.json()['choices'][0]['message']['content']
        print("MISTRAL RESPONSE:")
        print(content)
    else:
        print(f"ERROR {response.status_code}: {response.text}")
except Exception as e:
    print(f"EXCEPTION: {str(e)}")
