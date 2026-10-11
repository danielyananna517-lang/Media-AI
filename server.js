import express from 'express';

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="hy">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Novessa Pro Max | Marketplace Dashboard</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 20px; }
        .container { max-width: 900px; margin: 0 auto; background: #1e293b; padding: 30px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
        h1 { color: #38bdf8; text-align: center; margin-bottom: 5px; }
        .subtitle { text-align: center; color: #94a3b8; margin-bottom: 30px; font-size: 14px; }
        .section { margin-top: 25px; padding: 20px; background: #334155; border-radius: 8px; border-left: 4px solid #38bdf8; }
        h2 { font-size: 18px; margin-top: 0; color: #f1f5f9; }
        input, textarea, button { padding: 12px; margin: 8px 0; width: 100%; border-radius: 6px; border: 1px solid #475569; background: #1e293b; color: white; box-sizing: border-box; font-size: 14px; }
        textarea { resize: vertical; height: 80px; }
        button { background: #0284c7; cursor: pointer; font-weight: bold; transition: background 0.2s; }
        button:hover { background: #0ea5e9; }
        .result-box { margin-top: 12px; padding: 12px; background: #0f172a; border-radius: 6px; color: #38bdf8; font-weight: bold; white-space: pre-wrap; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Novessa Pro Max</h1>
        <div class="subtitle">Wildberries & Ozon Analytics, Unit Economics, SEO & Gemini AI Platform</div>
        
        <!-- 1. Unit Economics -->
        <div class="section">
            <h2>📊 Յունիթ Էկոնոմիկայի Հաշվիչ</h2>
            <input type="number" id="price" placeholder="Վաճառքի գին (₽)">
            <input type="number" id="cost" placeholder="Ապրանքի ինքնարժեք (₽)">
            <input type="number" id="logistics" placeholder="Հանձնաժողով և լոգիստիկա (%) (օր.՝ 30)">
            <button onclick="calculate()">Հաշվարկել Մաքուր Շահույթը</button>
            <div id="result" class="result-box" style="display:none;"></div>
        </div>

        <!-- 2. SEO Generator -->
        <div class="section">
            <h2>✨ SEO Վերնագրերի Գեներատոր</h2>
            <input type="text" id="productName" placeholder="Մուտքագրեք ապրանքի անունը (օր.՝ կանացի ամառային շորտեր)">
            <button onclick="generateSEO()">Գեներատոր SEO Վերնագիր</button>
            <div id="seoResult" class="result-box" style="display:none;"></div>
        </div>

        <!-- 3. Gemini AI Assistant -->
        <div class="section">
            <h2>🤖 Gemini AI Վաճառքների Խորհրդատու</h2>
            <input type="password" id="geminiKey" placeholder="Մուտքագրեք Gemini API Key (կամ թողեք դատարկ ստանդարտ պատասխանի համար)">
            <textarea id="aiPrompt" placeholder="Հարցրեք AI-ին (օր.՝ Ինչպե՞ս բարձրացնել Wildberries-ի վաճառքները սեզոնի ավարտին)"></textarea>
            <button onclick="askAI()">Ուղղել հարցը Gemini AI-ին</button>
            <div id="aiResult" class="result-box" style="display:none;">Սպասում եմ հարցի...</div>
        </div>
    </div>

    <script>
        function calculate() {
            let p = parseFloat(document.getElementById('price').value) || 0;
            let c = parseFloat(document.getElementById('cost').value) || 0;
            let l = parseFloat(document.getElementById('logistics').value) || 0;
            
            let commissionAndLog = p * (l / 100);
            let profit = p - c - commissionAndLog;
            let roi = c > 0 ? ((profit / c) * 100).toFixed(1) : 0;
            
            let resDiv = document.getElementById('result');
            resDiv.style.display = 'block';
            resDiv.innerHTML = \`Մաքուր շահույթ: \${profit.toFixed(1)} ₽ | ROI: \${roi}%\`;
        }

        function generateSEO() {
            let name = document.getElementById('productName').value;
            if(!name) return;
            let resDiv = document.getElementById('seoResult');
            resDiv.style.display = 'block';
            resDiv.innerHTML = \`Օպտիմիզացված Վերնագիր: \${name} - թրենդային, նորաոճ, բարձր որակի, հարմարավետ WB և Ozon-ի համար\`;
        }

        async function askAI() {
            let prompt = document.getElementById('aiPrompt').value;
            let apiKey = document.getElementById('geminiKey').value;
            let resDiv = document.getElementById('aiResult');
            
            if(!prompt) {
                alert('Խնդրում ենք գրել հարցը։');
                return;
            }

            resDiv.style.display = 'block';
            resDiv.innerHTML = '🤖 Gemini AI-ը մշակում է պատասխանը...';

            try {
                const response = await fetch('/api/ai', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt, apiKey })
                });
                const data = await response.json();
                resDiv.innerHTML = data.reply || 'Պատասխան չստացվեց։';
            } catch (err) {
                resDiv.innerHTML = '⚠️ Սխալ տեղի ունեցավ AI-ի հետ կապ հաստատելիս։';
            }
        }
    </script>
</body>
</html>`);
});

// AI Backend Endpoint
app.post('/api/ai', async (req, res) => {
  const { prompt, apiKey } = req.body;
  const key = apiKey || process.env.GEMINI_API_KEY;

  if (!key) {
    return res.json({ 
      reply: `[Demo AI պատասխան]: Ձեր հարցն է՝ "${prompt}"\n\nMarketplace-ի խորհուրդ. Wildberries-ում տեսանելիությունը բարձրացնելու համար անհրաժեշտ է օպտիմիզացնել բանալի բառերը վերնագրում և ակտիվորեն աշխատել գովազդայինարշավների (Реклама в поиске) հետ:\n\n(AI API Key ավելացնելու դեպքում պատասխանները կգեներացվեն ուղղակիորեն Gemini-ի կողմից):` 
    });
  }

  try {
    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });
    
    const data = await geminiRes.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Պատասխան չստացվեց Gemini-ից:';
    res.json({ reply });
  } catch (error) {
    res.json({ reply: '⚠️ Սխալ Gemini API հարցման ժամանակ:' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
