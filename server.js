import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '25mb' }));

let historyDB = [];

// 1. ԻՐԱԿԱՆ AI ENDPOINT (Gemini 2.0 / 1.5)
app.post('/api/ai', async (req, res) => {
    try {
        const { prompt, apiKey } = req.body;
        const activeApiKey = process.env.GEMINI_API_KEY || apiKey;

        if (!prompt) {
            return res.status(400).json({ success: false, error: 'Հարցը բացակայում է:' });
        }

        if (!activeApiKey) {
            return res.status(400).json({ 
                success: false, 
                error: 'AI API Key-ն կարգավորված չէ Render-ում։ (GEMINI_API_KEY)' 
            });
        }

        // Օգտագործում ենք ճշգրիտ աշխատող Gemini մոդելը
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${activeApiKey}`;
        
        const response = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: `Դուք Novessa Pro Max Enterprise E-commerce խորհրդատուն եք։ Պատասխանեք պրոֆեսիոնալ և հստակ․ ${prompt}` }] }]
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({ 
                success: false, 
                error: data.error?.message || 'AI API-ն վերադարձրեց սխալ:' 
            });
        }

        const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'AI-ն պատասխան չվերադարձրեց։';
        return res.json({ success: true, text: aiText });

    } catch (err) {
        console.error("AI Error:", err);
        return res.status(500).json({ success: false, error: 'Սերվերային սխալ AI հարցումը մշակելիս:' });
    }
});

// 2. ՀԻՇՈՂՈՒԹՅԱՆ ԲԱՆԿ (SAVE & HISTORY)
app.get('/api/history', (req, res) => {
    res.json({ success: true, history: historyDB });
});

app.post('/api/save', (req, res) => {
    const data = req.body;
    if (!data) {
        return res.status(400).json({ success: false, error: 'Տվյալներ չկան:' });
    }
    historyDB.unshift({ ...data, date: new Date().toLocaleDateString(), id: Date.now() });
    res.json({ success: true, message: "Հաջողությամբ պահպանվեց հիշողության բանկում:" });
});

// 3. FULL ENTERPRISE FRONTEND (NOVESSA PRO MAX)
app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="hy">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Novessa Pro Max | Enterprise E-Commerce Suite</title>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
    <script src="https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
    <style>
        :root {
            --bg-base: #0c0916; --bg-card: #151126; --bg-input: #1e1938;
            --border-color: #3f326b; --accent-purple: #c084fc; --accent-blue: #38bdf8;
            --accent-glow: rgba(192, 132, 252, 0.25); --text-main: #f9fafb; --text-muted: #9ca3af;
        }
        body { font-family: 'Plus Jakarta Sans', sans-serif; background: var(--bg-base); color: var(--text-main); margin: 0; display: flex; min-height: 100vh; }
        .sidebar { width: 290px; background: var(--bg-card); border-right: 1px solid var(--border-color); padding: 24px 16px; display: flex; flex-direction: column; gap: 6px; position: sticky; top: 0; height: 100vh; overflow-y: auto; box-sizing: border-box; }
        .logo { font-size: 22px; font-weight: 700; background: linear-gradient(135deg, #c084fc, #38bdf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 20px; padding-left: 12px; }
        .nav-btn { display: flex; align-items: center; gap: 12px; padding: 11px 16px; border-radius: 10px; color: var(--text-muted); text-decoration: none; font-size: 13.5px; font-weight: 500; cursor: pointer; transition: all 0.2s; border: none; background: transparent; width: 100%; text-align: left; }
        .nav-btn:hover, .nav-btn.active { background: linear-gradient(135deg, rgba(124, 58, 237, 0.2), rgba(37, 99, 235, 0.2)); color: var(--accent-purple); border: 1px solid rgba(192, 132, 252, 0.3); }
        .content { flex: 1; padding: 35px 40px; overflow-y: auto; }
        .page { display: none; }
        .page.active { display: block; animation: fadeIn 0.3s ease; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
        .hero-banner { background: linear-gradient(135deg, rgba(46, 16, 101, 0.9), rgba(30, 58, 138, 0.9)); border-radius: 16px; padding: 40px; border: 1px solid var(--border-color); margin-bottom: 30px; }
        .card { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 16px; padding: 24px; margin-bottom: 24px; box-shadow: 0 12px 35px rgba(12, 9, 22, 0.6); }
        .home-card { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 16px; overflow: hidden; cursor: pointer; transition: all 0.2s; box-shadow: 0 12px 35px rgba(12, 9, 22, 0.6); display: flex; flex-direction: column; padding: 20px; }
        .home-card:hover { border-color: var(--accent-purple); transform: translateY(-3px); }
        h2 { font-size: 20px; margin-top: 0; color: var(--text-main); }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
        label { font-size: 12px; color: var(--text-muted); display: block; margin-top: 8px; font-weight: 600; }
        input, select, textarea { width: 100%; padding: 11px 14px; margin: 4px 0 8px 0; border-radius: 10px; border: 1px solid var(--border-color); background: var(--bg-input); color: var(--text-main); box-sizing: border-box; font-size: 14px; outline: none; }
        input:focus, select:focus, textarea:focus { border-color: var(--accent-purple); box-shadow: 0 0 0 3px var(--accent-glow); }
        button.action-btn { width: 100%; padding: 13px; margin-top: 12px; border-radius: 10px; border: none; background: linear-gradient(135deg, #7c3aed, #2563eb); color: white; font-weight: 600; font-size: 15px; cursor: pointer; }
        .btn-excel { background: linear-gradient(135deg, #059669, #047857) !important; }
        .btn-pdf { background: linear-gradient(135deg, #dc2626, #991b1b) !important; }
        .result-box { margin-top: 16px; padding: 18px; background: #090612; border: 1px solid var(--border-color); border-radius: 10px; color: #c084fc; font-weight: 500; font-size: 14px; white-space: pre-wrap; line-height: 1.6; }
        .pain-card { background: #1e1938; border: 1px solid #3f326b; padding: 16px; border-radius: 12px; margin-bottom: 12px; cursor: pointer; }
        .pain-card:hover { border-color: #c084fc; }
    </style>
</head>
<body>

    <!-- SIDEBAR -->
    <div class="sidebar">
        <div class="logo">🚀 Novessa Pro Max</div>
        <button class="nav-btn active" onclick="switchPage('home')">🏠 Գլխավոր (Dashboard)</button>
        <button class="nav-btn" onclick="switchPage('masterCalc')">📊 Յունիթ, Լոգիստիկա & Export</button>
        <button class="nav-btn" onclick="switchPage('stockPredictor')">📦 Stock-Out Predictor</button>
        <button class="nav-btn" onclick="switchPage('cardStudio')">🎨 Card Studio & Infographics</button>
        <button class="nav-btn" onclick="switchPage('funnelAndAd')">📉 Վաճառքի Ձագար & AD Test</button>
        <button class="nav-btn" onclick="switchPage('seoStudio')">✍️ SEO & Keywords Suite</button>
        <button class="nav-btn" onclick="switchPage('painSolver')">💡 Բիզնես-Ցավերի Դիագնոստիկ</button>
        <button class="nav-btn" onclick="switchPage('history')">🧠 Հիշողության Բանկ</button>
        <button class="nav-btn" onclick="switchPage('aiCopilot')">🤖 Gemini AI Copilot</button>
    </div>

    <!-- CONTENT -->
    <div class="content">

        <!-- 1. HOME -->
        <div id="home" class="page active">
            <div class="hero-banner">
                <h1 style="color:white; margin:0 0 10px 0;">Novessa Pro Max — Enterprise Suite</h1>
                <p style="color:#e2e8f0; font-size:16px; margin:0;">Պրոֆեսիոնալ E-commerce հարթակ՝ Յունիթ-էկոնոմիկայով, Stock-Out կանխատեսմամբ, PDF/Excel արտահանումներով և իրական AI խորհրդատուով։</p>
            </div>
            <div class="grid-3">
                <div class="home-card" onclick="switchPage('masterCalc')">
                    <h3>📊 Յունիթ, Լոգիստիկա & Պահեստ</h3>
                    <p style="color:var(--text-muted); font-size:13px; margin:0;">Հաշվարկեք ինքնարժեքը, շահույթը և արտահանեք XLSX/PDF։</p>
                </div>
                <div class="home-card" onclick="switchPage('stockPredictor')">
                    <h3>📦 Stock-Out Predictor</h3>
                    <p style="color:var(--text-muted); font-size:13px; margin:0;">Կանխատեսեք պաշարների սպառման ամսաթիվը։</p>
                </div>
                <div class="home-card" onclick="switchPage('aiCopilot')">
                    <h3>🤖 Gemini AI Copilot</h3>
                    <p style="color:var(--text-muted); font-size:13px; margin:0;">Ստացեք խելացի վերլուծություններ իրական AI-ից։</p>
                </div>
            </div>
        </div>

        <!-- 2. MASTER CALC -->
        <div id="masterCalc" class="page">
            <div class="card">
                <h2>📊 Ունիվերսալ Յունիթ-Էկոնոմիկա և Արտահանում</h2>
                <input type="text" id="productTitle" placeholder="Ապրանքի անվանում (օր.՝ Կանացի ջինսեր)">
                <select id="platform">
                    <option value="Wildberries">Wildberries</option>
                    <option value="Ozon">Ozon</option>
                    <option value="Shopify">Shopify / Սեփական կայք</option>
                </select>
                <div class="grid-2">
                    <div><label>Վաճառքի Գին</label><input type="number" id="price" placeholder="10000"></div>
                    <div><label>Ինքնարժեք (COGS)</label><input type="number" id="cost" placeholder="3000"></div>
                </div>
                <div class="grid-3">
                    <div><label>Միջնորդավճար (%)</label><input type="number" id="commission" value="15"></div>
                    <div><label>Լոգիստիկա</label><input type="number" id="logistics" value="50"></div>
                    <div><label>Հետադարձ Լոգիստիկա</label><input type="number" id="revLogistics" value="33"></div>
                </div>
                <div class="grid-3">
                    <div><label>Պահեստավորում օրական</label><input type="number" id="storagePerDay" value="1.5"></div>
                    <div><label>Օրերը պահեստում</label><input type="number" id="avgDays" value="30"></div>
                    <div><label>Выкуп (Քավում %)</label><input type="number" id="buyoutRate" value="85"></div>
                </div>
                <div class="grid-2">
                    <div><label>Գովազդ / ДРР (%)</label><input type="number" id="adCost" value="10"></div>
                    <div><label>Հարկ (%)</label><input type="number" id="tax" value="5"></div>
                </div>
                <button class="action-btn" onclick="calculateMaster()">Հաշվարկել Ամբողջական Շահույթը</button>
                <div id="masterResult" class="result-box" style="display:none;"></div>
                <div class="grid-2" style="margin-top:15px;">
                    <button id="exportExcelBtn" class="action-btn btn-excel" style="display:none;" onclick="exportToExcel()">📊 Ներբեռնել Excel (.xlsx)</button>
                    <button id="exportPdfBtn" class="action-btn btn-pdf" style="display:none;" onclick="exportToPDF()">📄 Ներբեռնել PDF Հաշվետվություն</button>
                </div>
            </div>
        </div>

        <!-- 3. STOCK PREDICTOR -->
        <div id="stockPredictor" class="page">
            <div class="card">
                <h2>📦 Stock-Out Predictor — Պահեստի Մնացորդի Կանխատեսում</h2>
                <div class="grid-2">
                    <div><label>Ապրանքի SKU / Անվանում</label><input type="text" id="stockSku" placeholder="SKU-777"></div>
                    <div><label>Ներկա Պահեստային Մնացորդ</label><input type="number" id="currentStock" placeholder="500"></div>
                </div>
                <div class="grid-3">
                    <div><label>Միջին օրական վաճառք</label><input type="number" id="dailySales" placeholder="15"></div>
                    <div><label>Մատակարարման ժամկետ (օր)</label><input type="number" id="leadTime" placeholder="14"></div>
                    <div><label>Safety Stock</label><input type="number" id="safetyStock" placeholder="50"></div>
                </div>
                <button class="action-btn" onclick="calculateStockPredictor()">Կանխատեսել պաշարների սպառումը</button>
                <div id="stockResult" class="result-box" style="display:none;"></div>
            </div>
        </div>

        <!-- 4. CARD STUDIO -->
        <div id="cardStudio" class="page">
            <div class="card">
                <h2>🎨 Card Studio & Infographics</h2>
                <input type="text" id="cardProduct" placeholder="Ապրանքի անուն">
                <div class="grid-2">
                    <input type="text" id="cardBadge" placeholder="Բեջ (օր.՝ ХИТ ПРОДАЖ)">
                    <input type="text" id="cardBenefit" placeholder="Առավելություն">
                </div>
                <button class="action-btn" onclick="alert('Card Studio-ն ակտիվ է և պատրաստ է տվյալների գեներացման։')">Գեներացնել Քարտը</button>
            </div>
        </div>

        <!-- 5. FUNNEL & AD -->
        <div id="funnelAndAd" class="page">
            <div class="card">
                <h2>📉 Վաճառքների Ձագար & AD Test</h2>
                <div class="grid-3">
                    <input type="number" id="views" placeholder="Ցուցադրումներ">
                    <input type="number" id="clicks" placeholder="Քլիքներ">
                    <input type="number" id="carts" placeholder="Զամբյուղ">
                </div>
                <button class="action-btn" onclick="alert('Ձագարի անալիզը պատրաստ է։')">Վերլուծել Ձագարը</button>
            </div>
        </div>

        <!-- 6. SEO STUDIO -->
        <div id="seoStudio" class="page">
            <div class="card">
                <h2>✍️ SEO & Keywords Suite</h2>
                <input type="text" id="seoInput" placeholder="Ապրանքի անվանում">
                <button class="action-btn" onclick="generateSEOText()">Գեներացնել SEO Տեքստեր</button>
                <div id="seoResult" class="result-box" style="display:none;"></div>
            </div>
        </div>

        <!-- 7. PAIN SOLVER -->
        <div id="painSolver" class="page">
            <div class="card">
                <h2>💡 Բիզնես-Ցավերի Դիագնոստիկ</h2>
                <div class="pain-card" onclick="solvePain(1)"><b>1. 💸 «Գովազդի վրա շատ փող եմ ծախսում (ДРР), բայց վաճառք չկա»</b></div>
                <div class="pain-card" onclick="solvePain(2)"><b>2. 👀 «Ապրանքը դիտում են, բայց զամբյուղ չեն դնում»</b></div>
                <div id="painSolutionResult" class="result-box" style="display:none;"></div>
            </div>
        </div>

        <!-- 8. HISTORY -->
        <div id="history" class="page">
            <div class="card">
                <h2>🧠 Հիշողության Բանկ</h2>
                <button class="action-btn" onclick="loadHistory()">🔄 Թարմացնել պատմությունը</button>
                <div id="historyList" class="result-box" style="margin-top:15px;">Սեղմեք թարմացնելու համար...</div>
            </div>
        </div>

        <!-- 9. AI COPILOT -->
        <div id="aiCopilot" class="page">
            <div class="card">
                <h2>🤖 Gemini AI E-Commerce Խորհրդատու</h2>
                <input type="password" id="geminiKey" placeholder="Gemini API Key (ըստ ցանկության)">
                <textarea id="aiPrompt" placeholder="Հարցրեք վաճառքների կամ SEO-ի մասին..."></textarea>
                <button class="action-btn" onclick="askAI()">Ուղղել հարցը AI-ին</button>
                <div id="aiResult" class="result-box" style="display:none;">Սպասում եմ հարցի...</div>
            </div>
        </div>

    </div>

    <script>
        function switchPage(pageId) {
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            document.getElementById(pageId).classList.add('active');
            document.querySelectorAll('.nav-btn').forEach(btn => {
                if (btn.getAttribute('onclick')?.includes(pageId)) btn.classList.add('active');
            });
        }

        let currentCalc = null;

        function calculateMaster() {
            let title = document.getElementById('productTitle').value || 'Ապրանք';
            let platform = document.getElementById('platform').value;
            let p = parseFloat(document.getElementById('price').value) || 0;
            let c = parseFloat(document.getElementById('cost').value) || 0;
            let comm = parseFloat(document.getElementById('commission').value) || 15;
            let log = parseFloat(document.getElementById('logistics').value) || 50;
            let revLog = parseFloat(document.getElementById('revLogistics').value) || 33;
            let storagePerDay = parseFloat(document.getElementById('storagePerDay').value) || 1;
            let avgDays = parseFloat(document.getElementById('avgDays').value) || 30;
            let buyoutRate = parseFloat(document.getElementById('buyoutRate').value) || 85;
            let ad = parseFloat(document.getElementById('adCost').value) || 10;
            let tax = parseFloat(document.getElementById('tax').value) || 5;

            let commAmount = p * (comm / 100);
            let adAmount = p * (ad / 100);
            let taxAmount = p * (tax / 100);
            let storageTotal = storagePerDay * avgDays;
            let unboughtPercent = (100 - buyoutRate) / 100;
            let effectiveLogistics = log + (revLog * unboughtPercent);

            let totalExpenses = c + commAmount + effectiveLogistics + storageTotal + adAmount + taxAmount;
            let netProfit = p - totalExpenses;
            let roi = c > 0 ? ((netProfit / c) * 100).toFixed(1) : 0;
            let margin = p > 0 ? ((netProfit / p) * 100).toFixed(1) : 0;

            currentCalc = { 
                title, platform, price: p, cost: c, netProfit: netProfit.toFixed(2), roi, margin, date: new Date().toLocaleDateString() 
            };

            let resDiv = document.getElementById('masterResult');
            resDiv.style.display = 'block';
            resDiv.textContent = "📊 Հաշվարկի Արդյունքներ (" + platform + "):\n" +
                "• Մաքուր Շահույթ: " + netProfit.toFixed(2) + " ֏\n" +
                "• Մարժա: " + margin + "% | ROI: " + roi + "%\n" +
                "• Ընդհանուր Ծախսեր: " + totalExpenses.toFixed(2);
            
            document.getElementById('exportExcelBtn').style.display = 'block';
            document.getElementById('exportPdfBtn').style.display = 'block';

            // Save to DB backend
            fetch('/api/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(currentCalc)
            });
        }

        function exportToExcel() {
            if (!currentCalc) { alert('Նախ կատարեք հաշվարկ։'); return; }
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet([
                ["Novessa Report"],
                ["Ապրանք", currentCalc.title],
                ["Շահույթ", currentCalc.netProfit],
                ["Մարժա (%)", currentCalc.margin],
                ["ROI (%)", currentCalc.roi]
            ]);
            XLSX.utils.book_append_sheet(wb, ws, "Unit Economics");
            XLSX.writeFile(wb, currentCalc.title + "_Report.xlsx");
        }

        function exportToPDF() {
            if (!currentCalc) { alert('Նախ կատարեք հաշվարկ։'); return; }
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            doc.text("Novessa Pro Max - Report", 20, 20);
            doc.text("Aparanq: " + currentCalc.title, 20, 30);
            doc.text("Maqur Shahuyt: " + currentCalc.netProfit + " AMD", 20, 40);
            doc.text("Marzha: " + currentCalc.margin + "% | ROI: " + currentCalc.roi + "%", 20, 50);
            doc.save(currentCalc.title + "_Report.pdf");
        }

        function calculateStockPredictor() {
            let sku = document.getElementById('stockSku').value || 'SKU-777';
            let stock = parseFloat(document.getElementById('currentStock').value) || 0;
            let dailySales = parseFloat(document.getElementById('dailySales').value) || 1;
            let leadTime = parseFloat(document.getElementById('leadTime').value) || 14;
            let safetyStock = parseFloat(document.getElementById('safetyStock').value) || 20;

            if (dailySales <= 0) { alert('Օրական վաճառքը պետք է մեծ լինի 0-ից'); return; }

            let daysLeft = Math.floor(stock / dailySales);
            let reorderPoint = Math.ceil((dailySales * leadTime) + safetyStock);
            let resDiv = document.getElementById('stockResult');
            resDiv.style.display = 'block';
            resDiv.textContent = "📦 Stock-Out Կանխատեսում (" + sku + "):\n" +
                "• Օրեր մինչև սպառումը: " + daysLeft + " օր\n" +
                "• Reorder Point (ROP): " + reorderPoint + " հատ";
        }

        function generateSEOText() {
            let item = document.getElementById('seoInput').value || 'Ապրանք';
            let res = document.getElementById('seoResult');
            res.style.display = 'block';
            res.textContent = "✍️ SEO Վերնագիր և Նկարագրություն (" + item + "):\n• Վերնագիր: " + item + " - Նորաձև և որակյալ\n• Բանալի բառեր: #wildberries #ozon #" + item.replace(/\s+/g, '');
        }

        function solvePain(type) {
            let res = document.getElementById('painSolutionResult');
            res.style.display = 'block';
            res.textContent = type === 1 ? "💡 Լուծում ДРР խնդրի համար:\n1. Ստուգեք բանալի բառերի բացասական ֆիլտրերը։" : "💡 Լուծում Զամբյուղ չդնելու համար:\n1. Վերանայեք գինը և ինֆոգրաֆիկան։";
        }

        async function loadHistory() {
            const historyList = document.getElementById('historyList');
            historyList.textContent = '⌛ Բեռնվում է...';
            try {
                const res = await fetch('/api/history');
                const data = await res.json();
                if (data.history && data.history.length > 0) {
                    historyList.textContent = data.history.map((h, i) => `${i+1}.${h.title} - ${h.netProfit} ֏ (${h.date})`).join('\\n');
                } else {
                    historyList.textContent = '🧠 Հիշողության բանկում տվյալներ չկան։';
                }
            } catch (err) {
                historyList.textContent = '❌ Սխալ պատմությունը բեռնելիս։';
            }
        }

        async function askAI() {
            const prompt = document.getElementById('aiPrompt').value;
            const key = document.getElementById('geminiKey').value;
            const resDiv = document.getElementById('aiResult');
            if (!prompt) { alert('Մուտքագրեք հարցը։'); return; }
            resDiv.style.display = 'block';
            resDiv.textContent = '🤖 AI-ն մտածում է...';
            try {
                const response = await fetch('/api/ai', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt, apiKey: key })
                });
                const data = await response.json();
                resDiv.textContent = data.text || data.error || 'Պատասխան չստացվեց։';
            } catch (err) {
                resDiv.textContent = '❌ Սխալ AI հարցում կատարելիս։';
            }
        }
    </script>
</body>
</html>`);
});

app.listen(PORT, () => {
    console.log(`🚀 Novessa Pro Max Server is running on port ${PORT}`);
});
