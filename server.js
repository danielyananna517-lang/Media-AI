import express from 'express';

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;

let historyDB = [];

app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="hy">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Novessa Pro Max | E-Commerce Suite</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 20px; }
        .container { max-width: 1000px; margin: 0 auto; background: #1e293b; padding: 30px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
        h1 { color: #38bdf8; text-align: center; margin-bottom: 5px; }
        .subtitle { text-align: center; color: #94a3b8; margin-bottom: 30px; font-size: 14px; }
        .section { margin-top: 25px; padding: 20px; background: #334155; border-radius: 8px; border-left: 4px solid #38bdf8; }
        h2 { font-size: 18px; margin-top: 0; color: #f1f5f9; }
        input, select, textarea, button { padding: 12px; margin: 8px 0; width: 100%; border-radius: 6px; border: 1px solid #475569; background: #1e293b; color: white; box-sizing: border-box; font-size: 14px; }
        textarea { resize: vertical; height: 80px; }
        button { background: #0284c7; cursor: pointer; font-weight: bold; transition: background 0.2s; }
        button:hover { background: #0ea5e9; }
        .btn-save { background: #10b981; }
        .btn-save:hover { background: #059669; }
        .result-box { margin-top: 12px; padding: 15px; background: #0f172a; border-radius: 6px; color: #38bdf8; font-weight: bold; white-space: pre-wrap; line-height: 1.6; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
        .card-preview { background: #0284c7; padding: 20px; border-radius: 10px; text-align: center; color: white; margin-top: 10px; }
        .badge { background: #ef4444; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; display: inline-block; margin-bottom: 8px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Novessa Pro Max</h1>
        <div class="subtitle">E-Commerce & WB Pro Suite: Sales Funnel Analytics, Card Infographics & AI</div>
        
        <!-- 1. Funnel Analytics -->
        <div class="section">
            <h2>📉 1. Վաճառքների Ձագար (Sales Funnel Leak Analytics)</h2>
            <div class="grid-3">
                <input type="number" id="views" placeholder="Ցուցադրումներ (Views)">
                <input type="number" id="clicks" placeholder="Քարտի բացումներ (Clicks)">
                <input type="number" id="carts" placeholder="Զամբյուղ (Add to Cart)">
            </div>
            <div class="grid-2">
                <input type="number" id="orders" placeholder="Պատվերներ (Orders)">
                <input type="number" id="buyouts" placeholder="Քավումներ / Выкуп (Buyouts)">
            </div>
            <button onclick="analyzeFunnel()">Վերլուծել Ձագարը և Գտնել Կորուստները</button>
            <div id="funnelResult" class="result-box" style="display:none;"></div>
        </div>

        <!-- 2. Card Infographics Mockup -->
        <div class="section">
            <h2>🎨 2. Ապրանքային Քարտի Դիզայն և Ինֆոգրաֆիկա</h2>
            <input type="text" id="cardTitle" placeholder="Ապրանքի անուն (օր.՝ Կանացի Կաշվե Պայուսակ)">
            <div class="grid-2">
                <input type="text" id="cardBadge" placeholder="Բեջ (օր.՝ Хит продаж / 100% Кожа)">
                <input type="text" id="cardFeature" placeholder="Գլխավոր առավելություն (օր.՝ Водонепроницаемый)">
            </div>
            <button onclick="generateCard()">Ստեղծել Քարտի Նախադիտում</button>
            <div id="cardResult" style="display:none;"></div>
        </div>

        <!-- 3. Universal Unit Economics -->
        <div class="section">
            <h2>📊 3. Ունիվերսալ Յունիթ-Էկոնոմիկա</h2>
            <input type="text" id="productTitle" placeholder="Ապրանքի անվանում">
            <select id="platform">
                <option value="Wildberries">Wildberries</option>
                <option value="Ozon">Ozon</option>
                <option value="Shopify / Website">Shopify / Online Store</option>
                <option value="Amazon">Amazon</option>
            </select>
            <div class="grid-2">
                <input type="number" id="price" placeholder="Վաճառքի գին">
                <input type="number" id="cost" placeholder="Ապրանքի ինքնարժեք (COGS)">
            </div>
            <div class="grid-2">
                <input type="number" id="commission" placeholder="Միջնորդավճար (%)">
                <input type="number" id="logistics" placeholder="Լոգիստիկա">
            </div>
            <div class="grid-2">
                <input type="number" id="adCost" placeholder="Գովազդ (%) (CAC / ДРР)">
                <input type="number" id="tax" placeholder="Հարկ (%)">
            </div>
            <button onclick="calculate()">Հաշվարկել Շահույթը</button>
            <div id="result" class="result-box" style="display:none;"></div>
            <button id="saveBtn" class="btn-save" style="display:none;" onclick="saveCalculation()">💾 Պահպանել հիշողության մեջ</button>
        </div>

        <!-- 4. Memory Bank -->
        <div class="section">
            <h2>🧠 4. Հիշողության Բանկ</h2>
            <button onclick="loadHistory()">🔄 Թարմացնել պատմությունը</button>
            <div id="historyList" class="result-box">Սեղմեք թարմացնելու համար...</div>
        </div>

        <!-- 5. Gemini AI Copilot -->
        <div class="section">
            <h2>🤖 5. Gemini AI E-Commerce & WB Խորհրդատու</h2>
            <input type="password" id="geminiKey" placeholder="Gemini API Key (ըստ ցանկության)">
            <textarea id="aiPrompt" placeholder="Հարցրեք վաճառքների, գովազդի կամ SEO-ի մասին..."></textarea>
            <button onclick="askAI()">Ուղղել հարցը AI-ին</button>
            <div id="aiResult" class="result-box" style="display:none;">Սպասում եմ հարցի...</div>
        </div>
    </div>

    <script>
        let currentCalc = null;

        function analyzeFunnel() {
            let v = parseFloat(document.getElementById('views').value) || 0;
            let c = parseFloat(document.getElementById('clicks').value) || 0;
            let cart = parseFloat(document.getElementById('carts').value) || 0;
            let ord = parseFloat(document.getElementById('orders').value) || 0;
            let buy = parseFloat(document.getElementById('buyouts').value) || 0;

            let ctr = v > 0 ? ((c / v) * 100).toFixed(1) : 0;
            let clickToCart = c > 0 ? ((cart / c) * 100).toFixed(1) : 0;
            let cartToOrder = cart > 0 ? ((ord / cart) * 100).toFixed(1) : 0;
            let buyoutRate = ord > 0 ? ((buy / ord) * 100).toFixed(1) : 0;

            let advice = "";
            if (ctr < 3) advice += "⚠️ Ցածր CTR (" + ctr + "%): Ապրանքի գլխավոր նկարը գրավիչ չէ։ Փոխեք ինֆոգրաֆիկան։\\n";
            if (clickToCart < 10) advice += "⚠️ Ցածր Զամբյուղ Լցնելու % (" + clickToCart + "%): Գինը բարձր է կամ քարտի մեջ չկան բավարար լուսանկարներ։\\n";
            if (buyoutRate < 60) advice += "⚠️ Ցածր Քավում / Выкуп (" + buyoutRate + "%): Ապրանքի որակը կամ չափսային ցանցը չի համապատասխանում։\\n";
            if (!advice) advice = "✅ Ձեր ձագարի ցուցանիշները գտնվում են լավ տիրույթում։";

            let resDiv = document.getElementById('funnelResult');
            resDiv.style.display = 'block';
            resDiv.innerHTML = "📊 Ձագարի Փուլային Կոնվերսիա:\\n• CTR (Դիտում ➔ Քլիք): " + ctr + "%\\n• Քլիք ➔ Զամբյուղ: " + clickToCart + "%\\n• Զամբյուղ ➔ Պատվեր: " + cartToOrder + "%\\n• Պատվեր ➔ Քավում (Выкуп): " + buyoutRate + "%\\n\\n🚨 Վերլուծություն:\\n" + advice;
        }

        function generateCard() {
            let title = document.getElementById('cardTitle').value || 'Ապրանքի Անվանում';
            let badge = document.getElementById('cardBadge').value || 'ХИТ ПРОДАЖ';
            let feature = document.getElementById('cardFeature').value || 'Премиум Качество';

            let resDiv = document.getElementById('cardResult');
            resDiv.style.display = 'block';
            resDiv.innerHTML = '<div class="card-preview"><div class="badge">' + badge + '</div><h3 style="margin:5px 0;">' + title + '</h3><p style="font-size:14px;">⭐ 100% Օպտիմիզացված Ինֆոգրաֆիկա | ' + feature + '</p></div>';
        }

        function calculate() {
            let title = document.getElementById('productTitle').value || 'Անհայտ ապրանք';
            let platform = document.getElementById('platform').value;
            let p = parseFloat(document.getElementById('price').value) || 0;
            let c = parseFloat(document.getElementById('cost').value) || 0;
            let comm = parseFloat(document.getElementById('commission').value) || 0;
            let log = parseFloat(document.getElementById('logistics').value) || 0;
            let ad = parseFloat(document.getElementById('adCost').value) || 0;
            let tax = parseFloat(document.getElementById('tax').value) || 0;

            let commAmount = p * (comm / 100);
            let adAmount = p * (ad / 100);
            let taxAmount = p * (tax / 100);
            
            let totalExpenses = c + commAmount + log + adAmount + taxAmount;
            let netProfit = p - totalExpenses;
            let roi = c > 0 ? ((netProfit / c) * 100).toFixed(1) : 0;
            let margin = p > 0 ? ((netProfit / p) * 100).toFixed(1) : 0;

            currentCalc = { title, platform, price: p, cost: c, netProfit: netProfit.toFixed(2), roi, margin, date: new Date().toLocaleString() };

            let resDiv = document.getElementById('result');
            resDiv.style.display = 'block';
            resDiv.innerHTML = "Հարթակ: " + platform + " | Մաքուր շահույթ: " + netProfit.toFixed(2) + " | Մարժա: " + margin + "% | ROI: " + roi + "%";
            
            document.getElementById('saveBtn').style.display = 'block';
        }

        async function saveCalculation() {
            if (!currentCalc) return;
            try {
                const res = await fetch('/api/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(currentCalc)
                });
                const data = await res.json();
                alert(data.message || 'Պահպանված է!');
                loadHistory();
            } catch (err) {
                alert('⚠️ Չհաջողվեց պահպանել։');
            }
        }

        async function loadHistory() {
            try {
                const res = await fetch('/api/history');
                const data = await res.json();
                let listDiv = document.getElementById('historyList');
                if (data.length === 0) {
                    listDiv.innerHTML = 'Հիշողությունը դատարկ է։';
                    return;
                }
                listDiv.innerHTML = data.map((item, index) => 
                    '<div style="background:#1e293b; padding:10px; margin-top:8px; border-radius:6px; border:1px solid #475569; font-size:13px;">' +
                    '<b>#' + (index + 1) + ' - ' + item.title + '</b> (' + item.platform + ')<br>' +
                    'Գինը՝ ' + item.price + ' | Շահույթ՝ <span style="color:#38bdf8;">' + item.netProfit + '</span> | ROI՝ <b>' + item.roi + '%</b><br>' +
                    '<small style="color:#94a3b8;">' + item.date + '</small>' +
                    '</div>'
                ).join('');
            } catch (err) {
                document.getElementById('historyList').innerHTML = '⚠️ Սխալ պատմությունը բեռնելիս։';
            }
        }

        async function askAI() {
            let prompt = document.getElementById('aiPrompt').value;
            let apiKey = document.getElementById('geminiKey').value;
            let resDiv = document.getElementById('aiResult');
            
            if(!prompt) { alert('Գրեք հարցը։'); return; }
            resDiv.style.display = 'block';
            resDiv.innerHTML = '🤖 Մշակվում է...';

            try {
                const response = await fetch('/api/ai', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt, apiKey })
                });
                const data = await response.json();
                resDiv.innerHTML = data.reply || 'Պատասխան չստացվեց։';
            } catch (err) {
                resDiv.innerHTML = '⚠️ Սխալ AI-ի հետ կապում։';
            }
        }

        window.onload = loadHistory;
    </script>
</body>
</html>`);
});

app.post('/api/save', (req, res) => {
  const item = req.body;
  historyDB.unshift(item);
  if (historyDB.length > 20) historyDB.pop();
  res.json({ success: true, message: 'Հաշվարկը պահպանվեց հիշողության մեջ! 🧠' });
});

app.get('/api/history', (req, res) => {
  res.json(historyDB);
});

app.post('/api/ai', async (req, res) => {
  const { prompt, apiKey } = req.body;
  const key = apiKey || process.env.GEMINI_API_KEY;

  if (!key) {
    return res.json({ 
      reply: `[Demo AI Խորհուրդ]: Ձեր հարցն է՝ "${prompt}"\n\nE-Commerce խորհուրդ. Վաճառքի ձագարը բարելավելու համար առաջին հերթին ուշադրություն դարձրեք CTR-ին և գլխավոր ինֆոգրաֆիկային:` 
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
    const reply = data.candidates?.[0]?.content?.[0]?.text || 'Պատասխան չստացվեց Gemini-ից:';
    res.json({ reply });
  } catch (error) {
    res.json({ reply: '⚠️ Սխալ Gemini API հարցման ժամանակ:' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
