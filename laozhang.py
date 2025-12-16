# 多图参考示例（Python）
import requests
import base64

API_KEY = "sk-dwI0wRUeibzNWZYMDeA400D567354d85BdF3A8BfCeBc0aD3"
API_URL = "https://api.laozhang.ai/v1beta/models/gemini-3-pro-image-preview:generateContent"

# 准备多张参考图片
image_paths = ["选择的参考图jpg文件"]
parts = [{"text": prompt}]

for path in image_paths:
    with open(path, "rb") as f:
        image_data = base64.b64encode(f.read()).decode("utf-8")
    parts.append({
        "inline_data": {
            "mime_type": "image/jpeg",
            "data": image_data
        }
    })

# 发送请求
response = requests.post(
    API_URL,
    headers={
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    },
    json={
        "contents": [{"parts": parts}],
        "generationConfig": {
            "responseModalities": ["IMAGE"],
            "imageConfig": {
                "aspectRatio": "16:9",
                "imageSize": "1K"
            }
        }
    }
)

response = requests.post(API_URL, headers=headers, json=payload, timeout=180)
result = response.json()

# 保存图片
image_data = result["candidates"][0]["content"]["parts"][0]["inlineData"]["data"]
with open("output.png", "wb") as f:
    f.write(base64.b64decode(image_data))

print("✅ 图片已保存: output.png")