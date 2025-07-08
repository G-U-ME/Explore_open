curl --request POST \
  --url https://api.siliconflow.cn/v1/chat/completions \
  --header 'Authorization: Bearer sk-tzulrdynothppbacsorfjfoaoacmyogbjwawywnulbtwkqhx' \
  --header 'Content-Type: application/json' \
  --data '{
  "model": "deepseek-ai/DeepSeek-R1-0528-Qwen3-8B",
  "stream": true,
  "max_tokens": 10000,
  "enable_thinking": true,
  "thinking_budget": 10000,
  "min_p": 0.05,
  "temperature": 0.7,
  "top_p": 0.7,
  "top_k": 50,
  "frequency_penalty": 0.5,
  "n": 1,
  "stop": []
}'