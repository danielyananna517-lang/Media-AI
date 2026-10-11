import express from 'express';

const app = express();
app.use(express.json({ limit: '10mb' }));
const PORT = process.env.PORT || 3000;

let historyDB = [];

app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="hy">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Novessa Pro Max | E-Commerce Suite</title>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-base: #0c0916;
            --bg-card: #151126;
            --bg-input: #1e1938;
            --border-color: #3f326b;
            --accent-purple: #c084fc;
            --accent-blue: #38bdf8;
            --accent-glow: rgba(192, 132, 252, 0.25);
            --text-main: #f9fafb;
            --text-muted: #9ca3af;
            --success: #10b981;
        }

        body {
            font-family: 'Plus Jakarta Sans', sans-serif;
            background: var(--bg-base);
            color: var(--text-main);
            margin: 0;
            display: flex;
            min-height: 100vh;
        }

        .sidebar {
            width: 280px;
            background: var(--bg-card);
            border-right: 1px solid var(--border-color);
            padding: 24px 16px;
            display: flex;
            flex-direction: column;
            gap: 6px;
            position: sticky;
            top: 0;
            height: 100vh;
            overflow-y: auto;
            box-sizing: border-box;
        }

        .logo {
            font-size: 22px;
            font-weight: 700;
            background: linear-gradient(135deg, #c084fc, #38bdf8);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 20px;
            padding-left: 12px;
        }

        .nav-btn {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 11px 16px;
            border-radius: 10px;
            color: var(--text-muted);
            text-decoration: none;
            font-size: 13.5px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
            border: none;
            background: transparent;
            width: 100%;
            text-align: left;
        }

        .nav-btn:hover, .nav-btn.active {
            background: linear-gradient(135deg, rgba(124, 58, 237, 0.2), rgba(37, 99, 235, 0.2));
            color: var(--accent-purple);
            border: 1px solid rgba(192, 132, 252, 0.3);
        }

        .content {
            flex: 1;
            padding: 35px 40px;
            overflow-y: auto;
        }

        .page { display: none; }
        .page.active { display: block; animation: fadeIn 0.3s ease; }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(5px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .hero-banner {
            background: linear-gradient(135deg, rgba(46, 16, 101, 0.9), rgba(30, 58, 138, 0.9)), url('https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80');
            background-size: cover;
            background-position: center;
            border-radius: 16px;
            padding: 40px;
            border: 1px solid var(--border-color);
            margin-bottom: 30px;
        }

        .card {
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 16px;
            padding: 24px;
            margin-bottom: 24px;
            box-shadow: 0 12px 35px rgba(12, 9, 22, 0.6);
        }

        h2 { font-size: 20px; margin-top: 0; color: var(--text-main); }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }

        label { font-size: 12px; color: var(--text-muted); display: block; margin-top: 8px; font-weight: 600; }
        input, select, textarea {
            width: 100%;
            padding: 11px 14px;
            margin: 4px 0 8px 0;
            border-radius: 10px;
            border: 1px solid var(--border-color);
            background: var(--bg-input);
            color: var(--text-main);
            box-sizing: border-box;
            font-size: 14px;
            font-family: inherit;
            outline: none;
        }

        input:focus, select:focus, textarea:focus {
            border-color: var(--accent-purple);
            box-shadow: 0 0 0 3px var(--accent-glow);
        }

        button.action-btn {
            width: 100%;
            padding: 13px;
            margin-top: 12px;
            border-radius: 10px;
            border: none;
            background: linear-gradient(135deg, #7c3aed, #2563eb);
            color: white;
            font-weight: 600;
            font-size: 15px;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(124, 58, 237, 0.35);
        }

        .btn-export {
            background: linear-gradient(135deg, #059669, #047857) !important;
            box-shadow: 0 4px 12px rgba(5, 150, 105, 0.3) !important;
        }

        .result-box {
            margin-top: 16px;
            padding: 18px;
            background: #090612;
            border: 1px solid var(--border-color);
            border-radius: 10px;
            color: #c084fc;
            font-weight: 500;
            font-size: 14px;
            white-space: pre-wrap;
            line-height: 1.6;
        }

        .wb-card-container {
            position: relative;
            width: 280px;
            height: 380px;
            background: #1e1b4b;
            border-radius: 16px;
            overflow: hidden;
            border: 2px solid #a855f7;
            margin: 20px auto 0 auto;
            box-shadow: 0 10px 30px rgba(168, 85, 247, 0.3);
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            padding: 16px;
            box-sizing: border-box;
            background-size: cover;
            background-position: center;
        }

        .wb-badge-top {
            background: #ef4444;
            color: white;
            font-size: 11px;
            font-weight: 700;
            padding: 4px 10px;
            border-radius: 20px;
            align-self: flex-start;
            text-transform: uppercase;
        }

        .wb-details-bottom {
            background: rgba(12, 9, 22, 0.85);
            backdrop-filter: blur(8px);
            padding: 12px;
            border-radius: 10px;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .pain-card {
            background: #1e1938;
            border: 1px solid #3f326b;
            padding: 16px;
            border-radius: 12px;
            margin-bottom: 12px;
            cursor: pointer;
            transition: all 0.2s;
        }
        .pain-card:hover { border-color: #c084fc; transform: translateY(-2px); }
    </style>
</head>
<body>

    <!-- Sidebar Menu -->
    <div class="sidebar">
        <div class="logo">🚀 Novessa Pro Max</div>
        <button class="nav-btn active" onclick="switchPage('home')">🏠 Գլխավոր (Dashboard)</button>
        <button class="nav-btn" onclick="switchPage('masterCalc')">📊 Յունիթ, Լոգիստիկա & Պահեստ</button>
        <button class="nav-btn" onclick="switchPage('funnelAndAd')">📉 Վաճառքի Ձագար & AD Test</button>
        <button class="nav-btn" onclick="switchPage('cardStudio')">🎨 Card Studio & Upload</button>
        <button class="nav-btn" onclick="switchPage('seoStudio')">✍️ SEO & Keywords Suite</button>
        <button class="nav-btn" onclick="switchPage('painSolver')">💡 Բիզնես-Ցավերի Դիագնոստիկ</button>
        <button class="nav-btn" onclick="switchPage('history')">🧠 Հիշողության Բանկ</button>
        <button class="nav-btn" onclick="switchPage('aiCopilot')">🤖 Gemini AI Copilot</button>
    </div>

    <!-- Main Content -->
    <div class="content">

        <!-- PAGE 1: HOME DASHBOARD -->
        <div id="home" class="page active">
            <div class="hero-banner">
                <h1 style="color:white; margin:0 0 10px 0;">Novessa Pro Max — E-Commerce Suite</h1>
                <p style="color:#e2e8f0; font-size:16px; margin:0;">Ամեն ինչ լոգիստիկայի, պահեստավորման, ձագարի, գովազդի և քարտերի դիզայնի համար։</p>
            </div>
            
            <div class="grid-3">
                <div class="card" onclick="switchPage('masterCalc')" style="cursor:pointer;">
                    <h3>📊 Յունիթ & Լոգիստիկա</h3>
                    <p style="color:var(--text-muted); font-size:13px;">Ճշգրիտ հաշվարկեք շահույթը, լոգիստիկան և պահեստը (Хранение)։</p>
                </div>
                <div class="card" onclick="switchPage('cardStudio')" style="cursor:pointer;">
                    <h3>🎨 Card Studio & Upload</h3>
                    <p style="color:var(--text-muted); font-size:13px;">Բեռնեք ապրանքի նկարը և ստեղծեք պատրաստի WB/Ozon քարտ։</p>
                </div>
                <div class="card" onclick="switchPage('funnelAndAd')" style="cursor:pointer;">
                    <h3>📉 Ձագար & AD Test</h3>
                    <p style="color:var(--text-muted); font-size:13px;">Վերլուծեք կորուստները և գովազդի արդյունավետությունը (ДРР/ROAS)։</p>
                </div>
            </div>
        </div>

        <!-- PAGE 2: MASTER UNIT ECONOMICS -->
        <div id="masterCalc" class="page">
            <div class="card">
                <h2>📊 Ունիվերսալ Յունիթ-Էկոնոմիկա, Լոգիստիկա և Պահեստ</h2>
                <input type="text" id="productTitle" placeholder="Ապրանքի անվանում (օր.՝ Կանացի ջինսեր)">
                <select id="platform">
                    <option value="Wildberries">Wildberries</option>
                    <option value="Ozon">Ozon</option>
                    <option value="Shopify / Website">Shopify / Սեփական կայք</option>
                    <option value="Amazon">Amazon</option>
                </select>

                <div class="grid-2">
                    <div>
                        <label>Վաճառքի Գին</label>
                        <input type="number" id="price" placeholder="0">
                    </div>
                    <div>
                        <label>Ապրանքի Ինքնարժեք (COGS)</label>
                        <input type="number" id="cost" placeholder="0">
                    </div>
                </div>

                <div class="grid-3">
                    <div>
                        <label>Հարթակի Միջնորդավճար (%)</label>
                        <input type="number" id="commission" placeholder="15">
                    </div>
                    <div>
                        <label>Լոգիստիկա դեպի հաճախորդ</label>
                        <input type="number" id="logistics" placeholder="50">
                    </div>
                    <div>
                        <label>Հետադարձ Լոգիստիկա</label>
                        <input type="number" id="revLogistics" placeholder="33">
                    </div>
                </div>

                <div class="grid-3">
                    <div>
                        <label>Պահեստավորում օրական</label>
                        <input type="number" id="storagePerDay" placeholder="1.5">
                    </div>
                    <div>
                        <label>Միջին օրերը պահեստում</label>
                        <input type="number" id="avgDays" placeholder="30">
                    </div>
                    <div>
                        <label>Выкуп (Քավում %) Մոտավոր</label>
                        <input type="number" id="buyoutRate" placeholder="85">
                    </div>
                </div>

                <div class="grid-2">
                    <div>
                        <label>Գովազդ / ДРР (%)</label>
                        <input type="number" id="adCost" placeholder="10">
                    </div>
                    <div>
                        <label>Հարկ (%)</label>
                        <input type="number" id="tax" placeholder="5">
                    </div>
                </div>

                <button class="action-btn" onclick="calculateMaster()">Հաշվարկել Ամբողջական Շահույթը</button>
                <div id="masterResult" class="result-box" style="display:none;"></div>
                
                <div class="grid-2" style="margin-top:12px;">
                    <button id="saveBtn" class="action-btn" style="display:none; background: linear-gradient(135deg, #059669, #047857);" onclick="saveCalculation()">💾 Պահպանել Հիշողության Մեջ</button>
                    <button id="exportBtn" class="action-btn btn-export" style="display:none;" onclick="exportToText()">📄 Ներբեռնել Հաշվետվությունը (Text/CSV)</button>
                </div>
            </div>
        </div>

        <!-- PAGE 3: FUNNEL & AD TEST -->
        <div id="funnelAndAd" class="page">
            <div class="card">
                <h2>📉 1. Վաճառքների Ձագար (Funnel Leak Analytics)</h2>
                <div class="grid-3">
                    <input type="number" id="views" placeholder="Ցուցադրումներ (Views)">
                    <input type="number" id="clicks" placeholder="Քլիքներ (Clicks)">
                    <input type="number" id="carts" placeholder="Զամբյուղ (Carts)">
                </div>
                <div class="grid-2">
                    <input type="number" id="orders" placeholder="Պատվերներ (Orders)">
                    <input type="number" id="buyouts" placeholder="Քավումներ (Buyouts)">
                </div>
                <button class="action-btn" onclick="analyzeFunnel()">Վերլուծել Ձագարը</button>
                <div id="funnelResult" class="result-box" style="display:none;"></div>
            </div>

            <div class="card">
                <h2>🎯 2. Գովազդային Թեստ (AD Test / ДРР & ROAS)</h2>
                <div class="grid-3">
                    <input type="number" id="adBudget" placeholder="Գովազդային Ծախս">
                    <input type="number" id="adRevenue" placeholder="Վաճառքների Գումար">
                    <input type="number" id="adOrdersCount" placeholder="Պատվերների Քանակ">
                </div>
                <button class="action-btn" onclick="runAdTest()">Ստուգել Գովազդի Արդյունավետությունը</button>
                <div id="adTestResult" class="result-box" style="display:none;"></div>
            </div>
        </div>

        <!-- PAGE 4: CARD STUDIO & IMAGE UPLOAD -->
        <div id="cardStudio" class="page">
            <div class="card">
                <h2>🎨 WB/Ozon Քարտերի Դիզայն և Նկարի Upload</h2>
                <input type="text" id="cardProduct" placeholder="Ապրանքի անուն (օր.՝ Կանացի Ջինսեր)">
                <div class="grid-2">
                    <input type="text" id="cardBadge" placeholder="Բեջ (օր.՝ ХИТ ПРОДАЖ / 100% ХЛОПОК)">
                    <input type="text" id="cardBenefit" placeholder="Գլխավոր առավելություն (օր.՝ Идеальная посадка)">
                </div>
                
                <label>Բեռնեք ապրանքի լուսանկարը համակարգչից․</label>
                <input type="file" id="cardImgUpload" accept="image/*" onchange="previewUploadedImage(event)">

                <button class="action-btn" onclick="generateWBCard()">Գեներացնել WB/Ozon Քարտը</button>
                
                <div id="cardPreviewArea" style="display:none;">
                    <div id="wbCard" class="wb-card-container">
                        <div id="wbBadge" class="wb-badge-top">ХИТ ПРОДАЖ</div>
                        <div class="wb-details-bottom">
                            <h4 id="wbTitle" style="margin:0 0 4px 0; font-size:15px; color:white;">Կանացի Ջինսեր</h4>
                            <p id="wbFeature" style="margin:0; font-size:12px; color:#c084fc; font-weight:600;">⭐ Идеальная посадка</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- PAGE 5: SEO STUDIO -->
        <div id="seoStudio" class="page">
            <div class="card">
                <h2>✍️ SEO Վերնագրեր և Նկարագրություններ</h2>
                <input type="text" id="seoInput" placeholder="Ապրանքի անվանում (օր.՝ Կանացի տաբատ)">
                <button class="action-btn" onclick="generateSEOText()">Գեներացնել SEO Տեքստեր</button>
                <div id="seoResult" class="result-box" style="display:none;"></div>
            </div>
        </div>

        <!-- PAGE 6: PAIN SOLVER -->
        <div id="painSolver" class="page">
            <div class="card">
                <h2>💡 Սելլերի Ցավերի Դիագնոստիկ</h2>
                <div class="pain-card" onclick="solvePain(1)"><b>1. 💸 «Գովազդի վրա շատ փող եմ ծախսում (ДРР), բայց վաճառք չկա»</b></div>
                <div class="pain-card" onclick="solvePain(2)"><b>2. 👀 «Ապրանքը դիտում են, բայց զամբյուղ չեն դնում»</b></div>
                <div class="pain-card" onclick="solvePain(3)"><b>3. 🔄 «Վերադարձները (Выкуп) շատ են, լոգիստիկան ուտում է շահույթս»</b></div>
                <div id="painSolutionResult" class="result-box" style="display:none;"></div>
            </div>
        </div>

        <!-- PAGE 7: HISTORY -->
        <div id="history" class="page">
            <div class="card">
                <h2>🧠 Հիշողության Բանկ</h2>
                <button class="action-btn" onclick="loadHistory()" style="background: #3f326b;">🔄 Թարմացնել պատմությունը</button>
                <div id="historyList" class="result-box" style="margin-top:15px;">Սեղմեք թարմացնելու համար...</div>
            </div>
        </div>

        <!-- PAGE 8: AI COPILOT -->
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
            
            const btns = document.querySelectorAll('.nav-btn');
            btns.forEach(btn => {
                if (btn.getAttribute('onclick').includes(pageId)) {
                    btn.classList.add('active');
                }
            });
        }

        let uploadedImgData = null;
        let currentCalc = null;

        function previewUploadedImage(event) {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    uploadedImgData = e.target.result;
                };
                reader.readAsDataURL(file);
            }
        }

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

            currentCalc = { title, platform, price: p, cost: c, netProfit: netProfit.toFixed(2), roi, margin, date: new Date().toLocaleString() };

            let resDiv = document.getElementById('masterResult');
            resDiv.style.display = 'block';
            resDiv.innerHTML = "📊 <b>Հաշվարկի Արդյունքներ (" + platform + "):</b>\\n" +
                "• Մաքուր Շահույթ: <b>" + netProfit.toFixed(2) + " ֏/$</b>\\n" +
                "• Մարժա: <b>" + margin + "%</b> | ROI: <b>" + roi + "%</b>\\n" +
                "• Լոգիստիկա + Պահեստ: " + (effectiveLogistics + storageTotal).toFixed(2) + " | Գովազդ: " + adAmount.toFixed(2);
            
            document.getElementById('saveBtn').style.display = 'block';
            document.getElementById('exportBtn').style.display = 'block';
        }

        function exportToText() {
            if (!currentCalc) return;
            let textData = "Novessa Pro Max Report\\nProduct: " + currentCalc.title + "\\nPlatform: " + currentCalc.platform + "\\nPrice: " + currentCalc.price + "\\nNet Profit: " + currentCalc.netProfit + "\\nROI: " + currentCalc.roi + "%\\nDate: " + currentCalc.date;
            let blob = new Blob([textData], { type: 'text/plain' });
            let a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = currentCalc.title + '_Report.txt';
            a.click();
        }

        function analyzeFunnel() {
            let v = parseFloat(document.getElementById('views').value) || 0;
            let c = parseFloat(document.getElementById('clicks').value) || 0;
            let cart = parseFloat(document.getElementById('carts').value) || 0;
            let ord = parseFloat(document.getElementById('orders').value) || 0;
            let buy = parseFloat(document.getElementById('buyouts').value) || 0;

            let ctr = v > 0 ? ((c / v) * 100).toFixed(1) : 0;
            let clickToCart = c > 0 ? ((cart / c) * 100).toFixed(1) : 0;
            let buyoutRate = ord > 0 ? ((buy / ord) * 100).toFixed(1) : 0;

            let resDiv = document.getElementById('funnelResult');
            resDiv.style.display = 'block';
            resDiv.innerHTML = "📊 **Ձագարի Փուլային Կոնվերսիա:**\\n• CTR: " + ctr + "%\\n• Քլիք ➔ Զամբյուղ: " + clickToCart + "%\\n• Պատվեր ➔ Քավում: " + buyoutRate + "%";
        }

        function runAdTest() {
            let budget = parseFloat(document.getElementById('adBudget').value) || 0;
            let revenue = parseFloat(document.getElementById('adRevenue').value) || 0;
            let orders = parseFloat(document.getElementById('adOrdersCount').value) || 0;

            let drr = revenue > 0 ? ((budget / revenue) * 100).toFixed(1) : 0;
            let roas = budget > 0 ? (revenue / budget).toFixed(2) : 0;

            let resDiv = document.getElementById('adTestResult');
            resDiv.style.display = 'block';
            resDiv.innerHTML = "🎯 **AD Test:**\\n• ДРР: <b>" + drr + "%</b>\\n• ROAS: <b>" + roas + "x</b>";
        }

        function generateWBCard() {
            let title = document.getElementById('cardProduct').value || 'Կանացի Ջինսեր';
            let badge = document.getElementById('cardBadge').value || 'ХИТ ПРОДАЖ';
            let feature = document.getElementById('cardBenefit').value || 'Идеальная посадка';
            let imgUrl = uploadedImgData || 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=600&q=80';

            document.getElementById('wbTitle').innerText = title;
            document.getElementById('wbBadge').innerText = badge;
            document.getElementById('wbFeature').innerText = "⭐ " + feature;
            
            let cardElem = document.getElementById('wbCard');
            cardElem.style.backgroundImage = 'linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.7)), url(' + imgUrl + ')';

            document.getElementById('cardPreviewArea').style.display = 'block';
        }

        function generateSEOText() {
            let input = document.getElementById('seoInput').value || 'Ապրանք';
            let resDiv = document.getElementById('seoResult');
            resDiv.style.display = 'block';
            resDiv.innerHTML = "📌 **SEO Վերնագիր:** " + input + " - Բարձր որակի 2026\\n\\n🏷️ **Keywords:** #" + input.replace(/\s+/g, '_') + " #wb_хит";
        }

        function solvePain(painId) {
            let resDiv = document.getElementById('painSolutionResult');
            resDiv.style.display = 'block';
            if (painId === 1) resDiv.innerHTML = "🎯 **Բուժում:** Կանգնեցրեք ավտոգովազդը, անցեք ֆիքսված հարցումներով գովազդի։";
            else if (painId === 2) resDiv.innerHTML = "🎯 **Բուժում:** Փոխեք գլխավոր ինֆոգրաֆիկան և ստուգեք մրցակիցների գները։";
            else if (painId === 3) resDiv.innerHTML = "🎯 **Բուժում:** Ճշգրտեք չափսային ցանցը և ամրացրեք փաթեթավորումը։";
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
                    '<div style="background:#1e1938; padding:12px; margin-top:8px; border-radius:8px; border:1px solid #3f326b; font-size:13px;">' +
                    '<b>#' + (index + 1) + ' - ' + item.title + '</b> (' + item.platform + ')<br>' +
                    'Գինը՝ ' + item.price + ' | Շահույթ՝ <span style="color:#c084fc;">' + item.netProfit + '</span> | ROI՝ <b>' + item.roi + '%</b>' +
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
    </script>
</body>
</html>`);
});

app.post('/api/save', (req, res) => {
  const item = req.body;
  historyDB.unshift(item);
  if (historyDB.length > 20) historyDB.pop();
  res.json({ success: true, message: 'Հաշվարկը պահպանվեց! 🧠' });
});

app.get('/api/history', (req, res) => {
  res.json(historyDB);
});

app.post('/api/ai', async (req, res) => {
  const { prompt, apiKey } = req.body;
  const key = apiKey || process.env.GEMINI_API_KEY;

  if (!key) {
    return res.json({ 
      reply: `[Demo AI Խորհուրդ]: Ձեր հարցն է՝ "${prompt}"\n\nE-Commerce խորհուրդ. Վաճառքի ձագարը և գովազդը կառավարելիս միշտ հետևեք ROAS-ին և ДРР-ին:` 
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
