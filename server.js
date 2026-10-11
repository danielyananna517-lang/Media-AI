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
        
        /* Funnel & Card Preview Styles */
        .funnel-step { background: #1e293b; padding: 10px; margin: 5px 0; border-radius: 6px; border-left: 5px solid #0284c7; }
        .card-preview { background: #0284c7; padding: 20px; border-radius: 10px; text-align: center; color: white; margin-top: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.3); }
        .badge { background: #ef4444; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; display: inline-block; margin-bottom: 8px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Novessa Pro Max</h1>
        <div class="subtitle">E-Commerce & WB Pro Suite: Sales Funnel Analytics, Card Infographics & Gemini AI</div>
        
        <!-- 1. Funnel Analytics (Որտե՞ղ են կորչում փողերը) -->
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

        <!-- 2. Card Design & Infographics Mockup -->
        <div class="section">
            <h2>🎨 2. Ապրանքային Քարտի Դիզայն և Ինֆոգրաֆիկայի Գեներատոր</h2>
            <input type="text" id="cardTitle" placeholder="Ապրանքի անուն (օր.՝ Կանացի Կաշվե Պայուսակ)">
            <div class="grid-2">
                <input type="text" id="cardBadge" placeholder="Բեջ (օր.՝ Хит продаж / 100% Кожа)">
                <input type="text" id="cardFeature" placeholder="Գլխավոր առավելություն (օր.՝ Водонепроницаемый)">
            </div>
            <button onclick="generateCard()">Ստեղծել Քարտի Նախադիտում (Infographic Card Preview)</button>
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

        <!-- 4. Memory / History -->
        <div class="section">
            <h2>🧠 4. Հիշողության Բանկ</h2>
            <button onclick="loadHistory()">🔄 Թարմացնել պատմությունը</button>
            <div id="historyList" class="result-box">Սեղմեք թարմացնելու համար...</div>
        </div>

        <!-- 5. Gemini AI E-Commerce Copilot -->
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

        // 1. Funnel Analysis
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
            if (ctr < 3) advice += "⚠️ **Ցածր CTR (\${ctr}%)**: Ապրանքի գլխավոր նկարը կամ վերնագիրը գրավիչ չէ։ Փոխեք ինֆոգրաֆիկան։\n";
            if (clickToCart < 10) advice += "⚠️ **Ցածր Զամբյուղ Լցնելու % (\${clickToCart}%)**: Գինը բարձր է կամ քարտի մեջ չկան բավարար լուսանկարներ/ակնարկներ։\n";
            if (buyoutRate < 60) advice += "⚠️ **Ցածր Քավում / Выкуп (\${buyoutRate}%)**: Ապրանքի որակը կամ չափսային ցանցը չի համապատասխանում նկարագրությանը։\n";
            if (!advice) advice = "✅ Ձեր ձագարի ցուցանիշները գտնվում են լավ տիրույթում։";

            let resDiv = document.getElementById('funnelResult');
            resDiv.style.display = 'block';
            resDiv.innerHTML = \`📊 **Ձագարի Փուլային Կոնվերսիա:**
• CTR (Դիտում ➔ Քլիք): \${ctr}%
• Քլիք ➔ Զամբյուղ: \${clickToCart}%
• Զամբյուղ ➔ Պատվեր: \${cartToOrder}%
• Պատվեր ➔ Քավում (Выкуп): \${buyoutRate}%

🚨 **Վերլուծություն և Փողերի Կորստի Աղբյուրը:**
\${advice}\`;
        }

        // 2. Card Generator
        function generateCard() {
            let title = document.getElementById('cardTitle').value || 'Ապրանքի Անվանում';
            let badge = document.getElementById('cardBadge').value || 'ХИТ ПРОДАЖ';
            let feature = document.getElementById('cardFeature').value || 'Премиум Качество';

            let resDiv = document.getElementById('cardResult');
            resDiv.style.display = 'block';
            resDiv.innerHTML = \`
                <div class="card-preview">
                    <div class="badge">\${badge}</div>
                    <h3 style="margin:5px 0; font-size:20px;">\${title}</h3>
                    <p style="font-size:14px; opacity:0.9;">⭐ 100% Օպտիմիզացված Ինֆոգրաֆիկա | \${feature}</p>
                    <div style="background:rgba(255,255,255,0.2); padding:10px; border-radius:6px; margin-top:10px; font-size:12px;">
                        📸 AI Վիզուալ հայեցակարգը պատրաստ է WB / Ozon քարտի համար
                    </div>
                </div>
            \`;
        }

        // 3. Calculator
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
            resDiv.
