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
    <title>Novessa Pro Max | E-Commerce & WB Suite</title>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-base: #0b0f19;
            --bg-card: #111827;
            --bg-input: #1f2937;
            --border-color: #374151;
            --accent-primary: #38bdf8;
            --accent-glow: rgba(56, 189, 248, 0.15);
            --success: #10b981;
            --text-main: #f9fafb;
            --text-muted: #9ca3af;
        }

        body {
            font-family: 'Plus Jakarta Sans', sans-serif;
            background: var(--bg-base);
            color: var(--text-main);
            margin: 0;
            padding: 30px 20px;
            min-height: 100vh;
        }

        .container {
            max-width: 1000px;
            margin: 0 auto;
        }

        header {
            text-align: center;
            margin-bottom: 40px;
        }

        h1 {
            font-size: 32px;
            background: linear-gradient(135deg, #38bdf8, #818cf8);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin: 0 0 8px 0;
        }

        .subtitle {
            color: var(--text-muted);
            font-size: 15px;
        }

        .card {
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 16px;
            padding: 24px;
            margin-bottom: 24px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            transition: transform 0.2s ease, border-color 0.2s ease;
        }

        .card:hover {
            border-color: rgba(56, 189, 248, 0.4);
        }

        h2 {
            font-size: 18px;
            margin-top: 0;
            margin-bottom: 20px;
            color: var(--text-main);
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }

        input, select, textarea {
            width: 100%;
            padding: 12px 16px;
            margin: 6px 0;
            border-radius: 10px;
            border: 1px solid var(--border-color);
            background: var(--bg-input);
            color: var(--text-main);
            box-sizing: border-box;
            font-size: 14px;
            font-family: inherit;
            outline: none;
            transition: border-color 0.2s, box-shadow 0.2s;
        }

        input:focus, select:focus, textarea:focus {
            border-color: var(--accent-primary);
            box-shadow: 0 0 0 3px var(--accent-glow);
        }

        textarea { resize: vertical; height: 90px; }

        button {
            width: 100%;
            padding: 13px;
            margin-top: 10px;
            border-radius: 10px;
            border: none;
            background: linear-gradient(135deg, #0284c7, #0369a1);
            color: white;
            font-weight: 600;
            font-size: 15px;
            cursor: pointer;
            transition: opacity 0.2s, transform 0.1s;
            font-family: inherit;
            box-shadow: 0 4px 12px rgba(2, 132, 199, 0.3);
        }

        button:hover { opacity: 0.95; transform: translateY(-1px); }
        button:active { transform: translateY(0); }

        .btn-save {
            background: linear-gradient(135deg, #059669, #047857);
            box-shadow: 0 4px 12px rgba(5, 150, 105, 0.3);
        }

        .result-box {
            margin-top: 16px;
            padding: 16px;
            background: var(--bg-base);
            border: 1px solid var(--border-color);
            border-radius: 10px;
            color: var(--accent-primary);
            font-weight: 500;
            font-size: 14px;
            white-space: pre-wrap;
            line-height: 1.6;
        }

        /* Card Preview Mockup */
        .preview-box {
            background: linear-gradient(135deg, #1e1b4b, #312e81);
            border: 2px dashed #6366f1;
            padding: 24px;
            border-radius: 12px;
            text-align: center;
            color: white;
            margin-top: 16px;
            box-shadow: 0 8px 25px rgba(99, 102, 241, 0.2);
        }

        .badge-pill {
            background: #ef4444;
            color: white;
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 700;
            display: inline-block;
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .history-card {
            background: var(--bg-input);
            padding: 14px 18px;
            margin-top: 10px;
            border-radius: 10px;
            border: 1px solid var(--border-color);
            font-size: 13px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        @media (max-width: 768px) {
            .grid-2, .grid-3 { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>🚀 Novessa Pro Max</h1>
            <div class="subtitle">Universal E-Commerce, Wildberries/Ozon Suite & AI Analytics</div>
        </header>
        
        <!-- 1. Funnel Analytics -->
        <div class="card">
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
        <div class="card">
            <h2>🎨 2. Ապրանքային Քարտի Դիզայն և Ինֆոգրաֆիկա</h2>
            <input type="text" id="cardTitle" placeholder="Ապրանքի անուն (օր.՝ Կանացի Կաշվե Պայուսակ)">
            <div class="grid-2">
                <input type="text" id="cardBadge" placeholder="Բեջ (օր.՝ Хит продаж / 100% Кожа)">
                <input type="text" id="cardFeature" placeholder="Գլխավոր առավելություն (օր.՝ Водонепроницаемый)">
            </div>
            <button onclick="generateCard()">Ստեղծել Քարտի Պրեմիում Նախադիտում</button>
            <div id="cardResult" style="display:none;"></div>
        </div>

        <!-- 3. Universal Unit Economics -->
        <div class="card">
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
            <button onclick="calculate()">Հաշվարկել Մաքուր Շահույթը</button>
            <div id="result" class="result-box" style="display:none;"></div>
            <button id="saveBtn" class="btn-save" style="display:none; margin-top:12px;" onclick="saveCalculation()">💾 Պահպանել հիշողության մեջ</button>
        </div>

        <!-- 4. Memory Bank -->
        <div class="card">
            <h2>🧠 4. Հիշողության Բանկ</h2>
            <button onclick="loadHistory()" style="background: #374151;">🔄 Թարմացնել պատմությունը</button>
            <div id="historyList" class="result-box">Սեղմեք թարմացնելու համար...</div>
        </div>

        <!-- 5. Gemini AI Copilot -->
        <div class="card">
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
            resDiv.innerHTML = '<div class="preview-box"><div class="badge-pill">' + badge + '</div><h3 style="margin:8px 0; font-size:22px;">' + title + '</h3><p style="font-size:14px; opacity:0.9; margin:4px 0;">⭐ 100% Օպտիմիզացված Ինֆոգրաֆիկա | ' + feature + '</p><div style="font-size:12px; margin-top:12px; color:#38bdf8;">✨ Պատրաստ է Canva / AI գեներացիայի համար</div></div>';
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
            resDiv.innerHTML = "հարթակ: " + platform + " | Մաքուր շահույթ: " + netProfit.toFixed(2) + " | Մարժա: " + margin + "% | ROI: " + roi + "%";
            
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
                    '<div class="history-card"><div>' +
                    '<b>#' + (index + 1) + ' - ' + item.title + '</b> <span style="color:#9ca3af;">(' + item.platform + ')</span><br>' +
                    'Գինը՝ ' + item.price + ' | Շահույթ՝ <span style="color:#38bdf8; font-weight:600;">' + item.netProfit + '</span> | ROI՝ <b>' + item.roi + '%</b>' +
                    '</div><small style="color:#9ca3af;">' + item.date + '</small></div>'
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
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Պատասխան չստացվեց Gemini-ից:';
    res.json({ reply });
  } catch (error) {
    res.json({ reply: '⚠️ Սխալ Gemini API հարցման ժամանակ:' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
