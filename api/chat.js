// API 路由：代理 AI 请求，保护 API Key
// 支持：DeepSeek、豆包、智谱、月之暗面、通义千问

const API_CONFIGS = {
  deepseek: {
    url: 'https://api.deepseek.com/v1/chat/completions',
    model: 'deepseek-chat',
    envKey: 'DEEPSEEK_API_KEY'
  },
  doubao: {
    url: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
    model: 'doubao-1.5-pro-32k-250115',
    envKey: 'DOUBAO_API_KEY'
  },
  zhipu: {
    url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    model: 'glm-4-flash',
    envKey: 'ZHIPU_API_KEY'
  },
  moonshot: {
    url: 'https://api.moonshot.cn/v1/chat/completions',
    model: 'moonshot-v1-8k',
    envKey: 'MOONSHOT_API_KEY'
  },
  qwen: {
    url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    model: 'qwen-plus',
    envKey: 'DASHSCOPE_API_KEY'
  }
};

module.exports = async (req, res) => {
  // 设置 CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { provider, messages, temperature = 0.7, max_tokens = 3000 } = req.body;
    
    if (!provider || !API_CONFIGS[provider]) {
      res.status(400).json({ error: 'Invalid or missing provider' });
      return;
    }

    const config = API_CONFIGS[provider];
    const apiKey = process.env[config.envKey];

    if (!apiKey) {
      res.status(500).json({ error: `API Key for ${provider} not configured` });
      return;
    }

    // 发起请求到 AI 服务商
    const response = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        stream: true,
        temperature,
        max_tokens
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      res.status(response.status).json({ 
        error: `AI API error: ${response.status}`, 
        details: errorText 
      });
      return;
    }

    // 流式转发响应
    const reader = response.body.getReader();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }

    res.end();

  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
};
