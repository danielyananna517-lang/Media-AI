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
    <title>Novessa Pro Max | E-Commerce & WB Super Suite</title>
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
            width: 270px;
            background: var(--bg-card);
            border-right: 1px solid var(--border-color);
            padding: 24px 16px;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .logo {
            font-size: 22px;
            font-weight: 700;
            background: linear-gradient(135deg, #c084fc, #38bdf8);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 24px;
            padding-left: 12px;
        }

        .nav-btn {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 16px;
            border-radius: 10px;
            color: var(--text-muted);
            text-decoration: none;
            font-size: 14px;
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
            transition: transform 0.2s ease, border-color 0.2s ease;
        }

        .card:hover { border-color: rgba(192, 132, 252, 0.5); }

        h2 { font-size: 20px; margin-top: 0; color: var(--text-main); }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }

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
        }

        input:focus, select:focus, textarea:focus {
            border-color: var(--accent-purple);
            box-shadow: 0 0 0 3px var(--accent-glow);
        }

        button.action-btn {
            width: 100%;
            padding: 13px;
            margin-top: 10px;
            border-radius: 10px;
            border: none;
            background: linear-gradient(135deg, #7c3aed, #2563eb);
            color: white;
            font-weight: 600;
            font-size: 15px;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(124, 58, 237, 0.35);
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

        .img-card {
            width: 100%;
            height: 160px;
            object-fit: cover;
            border-radius: 12px;
            margin-bottom: 14px;
            border: 1px solid var(--border-color);
        }

        /* WB Card Mockup Preview */
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
        <div class="logo">🚀 Novessa Pro</div>
        <button class="nav-btn active" onclick="switchPage('home')">🏠 Գլխավոր (Home)</button>
        <button class="nav-btn" onclick="switchPage('cardStudio')">🎨 Card Studio & Infographics</button>
        <button class="nav-btn" onclick="switchPage('seoStudio')">✍️ SEO & Keywords Generator</button>
        <button class="nav-btn" onclick="switchPage('painSolver')">💡 Բիզնես-Ցավերի Դիագնոստիկ</button>
        <button class="nav-btn" onclick="switchPage('funnel')">📉 Վաճառքի Ձագար</button>
        <button class="nav-btn" onclick="switchPage('unitEcon')">📊 Յունիթ Էկոնոմիկա</button>
        <button class="nav-btn" onclick="switchPage('history')">🧠 Հիշողության Բանկ</button>
        <button class="nav-btn" onclick="switchPage('aiCopilot')">🤖 Gemini AI Copilot</button>
    </div>

    <!-- Main Content -->
    <div class="content">

        <!-- PAGE 1: HOME DASHBOARD -->
        <div id="home" class="page active">
            <div class="hero-banner">
                <h1 style="color:white; margin:0 0 10px 0;">Novessa Pro Max — E-Commerce SaaS</h1>
                <p style="color:#e2e8f0; font-size:16px; margin:0;">Ամեն ինչ WB/Ozon/E-commerce վաճառքները մասշտաբավորելու և շահույթը ավելացնելու համար</p>
            </div>
            
            <div class="grid-3" style="margin-bottom: 20px;">
                <div class="card" onclick="switchPage('cardStudio')" style="cursor:pointer;">
                    <img src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=80" class="img-card">
                    <h3>🎨 Card Studio & Infographics</h3>
                    <p style="color:var(--text-muted); font-size:13px;">Ստեղծեք պատրաստի WB/Ozon քարտեր՝ ինֆոգրաֆիկայով ու բեջերով։</p>
                </div>
                <div class="card" onclick="switchPage('seoStudio')" style="cursor:pointer;">
                    <img src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=400&q=80" class="img-card">
                    <h3>✍️ SEO & Keywords Studio</h3>
                    <p style="color:var(--text-muted); font-size:13px;">Վաճառող SEO վերնագրեր և որոնողական նկարագրություններ։</p>
                </div>
                <div class="card" onclick="switchPage('unitEcon')" style="cursor:pointer;">
                    <img src="https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=400&q=80" class="img-card">
                    <h3>📊 Յունիթ-Էկոնոմիկա</h3>
                    <p style="color:var(--text-muted); font-size:13px;">Ճշգրիտ հաշվարկեք մաքուր շահույթը, ROI-ն և հարկերը։</p>
                </div>
            </div>

            <div class="card" onclick="switchPage('painSolver')" style="cursor:pointer; border-color:#c084fc;">
                <h3>💡 Բիզնես-Ցավերի Դիագնոստիկ (Pain Solver)</h3>
                <p style="color:var(--text-muted); font-size:13px;">Ընտրեք ձեր խնդիրը (բարձր ДРР, ցածր CTR, վերադարձներ) և ստացեք անհապաղ բուժումը։</p>
            </div>
        </div>

        <!-- PAGE 2: CARD STUDIO & INFOGRAPHICS -->
        <div id="cardStudio" class="page">
            <div class="card">
                <h2>🎨 WB/Ozon Քարտերի Դիզայն և Ինֆոգրաֆիկա</h2>
                <p style="color:var(--text-muted); font-size:14px;">Մուտքագրեք ապրանքի տվյալները կամ տեղադրեք նկարի URL հղումը՝ պատրաստի քարտ ստանալու համար։</p>
                
                <input type="text" id="cardProduct" placeholder="Ապրանքի անուն (օր.՝ Կանացի Ջինսեր, Բարձր Գոտկատեղով)">
                <div class="grid-2">
                    <input type="text" id="cardBadge" placeholder="Բեջ (օր.՝ ХИТ ПРОДАЖ / 100% ХЛОПОК)">
                    <input type="text" id="cardBenefit" placeholder="Գլխավոր առավելություն (օր.՝ Идеальная посадка)">
                </div>
                <input type="text" id="cardImgUrl" placeholder="Ապրանքի նկարի հղում (URL) (կամ թողեք դատարկ ստանդարտի համար)">
                
                <button class="action-btn" onclick="generateWBCard()">Գեներացնել WB/Ozon Քարտը</button>
                
                <div id="cardPreviewArea" style="display:none;">
                    <div id="wbCard" class="wb-card-container">
                        <div id="wbBadge" class="wb-badge-top">ХИТ ПРОДАЖ</div>
                        <div class="wb-details-bottom">
                            <h4 id="wbTitle" style="margin:0 0 4px 0; font-size:15px; color:white;">Կանացի Ջինսեր</h4>
                            <p id="wbFeature" style="margin:0; font-size:12px; color:#c084fc; font-weight:600;">⭐ Идеальная посадка</p>
                            <div style="margin-top:6px; font-size:11px; color:#9ca3af;">✅ Պատրաստ է WB/Ozon-ում տեղադրելու համար</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- PAGE 3: SEO & KEYWORDS STUDIO -->
        <div id="seoStudio" class="page">
            <div class="card">
                <h2>✍️ SEO Վերնագրերի և Նկարագրությունների Գեներատոր</h2>
                <input type="text" id="seoInput" placeholder="Ապրանքի անվանումը կամ կատեգորիան (օր.՝ Կանացի տաբատ)">
                <button class="action-btn" onclick="generateSEOText()">Գեներացնել SEO Տեքստեր և Թեգեր</button>
                <div id="seoResult" class="result-box" style="display:none;"></div>
            </div>
        </div>

        <!-- PAGE 4: PAIN SOLVER -->
        <div id="painSolver" class="page">
            <div class="card">
                <h2>💡 Սելլերի Ցավերի Ավտոմատ Դիագնոստիկ և Լուծումներ</h2>
                <div class="pain-card" onclick="solvePain(1)">
                    <b>1. 💸 «Գովազդի վրա շատ փող եմ ծախսում (ДРР-ը բարձր է), բայց վաճառքներ չկան»</b>
                </div>
                <div class="pain-card" onclick="solvePain(2)">
                    <b>2. 👀 «Ապրանքը դիտում են (Views կան), բայց զամբյուղ չեն դնում»</b>
                </div>
                <div class="pain-card" onclick="solvePain(3)">
                    <b>3. 🔄 «Վերադարձները (Выкуп) շատ են, և լոգիստիկան ուտում է ամբողջ շահույթս»</b>
                </div>
                <div class="pain-card" onclick="solvePain(4)">
                    <b>4. 📉 «Չեմ հասկանում՝ ինչպես ճիշտ հաշվեմ միջնորդավճարները, որ վնաս չտամ»</b>
                </div>
                <div id="painSolutionResult" class="result-box" style="display:none;"></div>
            </div>
        </div>

        <!-- PAGE 5: FUNNEL -->
        <div id="funnel" class="page">
            <div class="card">
                <h2>📉 Վաճառքների Ձագար (Sales Funnel Leak Analytics)</h2>
                <div class="grid-3">
                    <input type="number" id="views" placeholder="Ցուցադրումներ (Views)">
                    <input type="number" id="clicks" placeholder="Քարտի բացումներ (Clicks)">
                    <input type="number" id="carts" placeholder="Զամբյուղ (Add to Cart)">
                </div>
                <div class="grid-2">
                    <input type="number" id="orders" placeholder="Պատվերներ (Orders)">
                    <input type="number" id="buyouts" placeholder="Քավումներ / Выкуп (Buyouts)">
                </div>
                <button class="action-btn" onclick="analyzeFunnel()">Վերլուծել Ձագարը</button>
                <div id="funnelResult" class="result-box" style="display:none;"></div>
            </div>
        </div>

        <!-- PAGE 6: UNIT ECONOMICS -->
        <div id="unitEcon" class="page">
            <div class="card">
                <h2>📊 Ունիվերսալ Յունիթ-Էկոնոմիկա</h2>
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
                <button class="action-btn" onclick="calculate()">Հաշվարկել Մաքուր Շահույթը</button>
                <div id="result" class="result-box" style="display:none;"></div>
                <button id="saveBtn" class="action-btn" style="display:none; background: linear-gradient(135deg, #059669, #047857);" onclick="saveCalculation()">💾 Պահպանել հիշողության մեջ</button>
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
                <h2>🤖 Gemini AI E-Commerce & WB Խորհրդատու</h2>
                <input type="password" id="geminiKey" placeholder="Gemini API Key (ըստ ցանկության)">
                <textarea id="aiPrompt" placeholder="Հարցրեք վաճառքների, գովազդի կամ SEO-ի մասին..."></textarea>
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

        function generateWBCard() {
            let title = document.getElementById('cardProduct').value || 'Կանացի Ջինսեր';
            let badge = document.getElementById('cardBadge').value || 'ХИТ ПРОДАЖ';
            let feature = document.getElementById('cardBenefit').value || 'Идеальная посадка';
            let imgUrl = document.getElementById('cardImgUrl').value || 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=600&q=80';

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
            resDiv.innerHTML = "📌 **SEO Վերնագիր (WB/Ozon):**\\n" + input + " - Բարձր որակի, թրենդային մոդել 2026\\n\\n" +
                "📝 **SEO Նկարագրություն:**\\n" + input + "-ն պատրաստված է բարձրորակ նյութերից, որոնք ապահովում են առավելագույն հարմարավետություն։ Իդեալական է ամենօրյա կրման համար։\\n\\n" +
                "🏷️ **Բանալի Բառեր (Keywords / Tags):**\\n#" + input.replace(/\s+/g, '_') + " #թրենդային #որակյալ #wb_хит #женская_одежда";
        }

        function solvePain(painId) {
            let resDiv = document.getElementById('painSolutionResult');
            resDiv.style.display = 'block';
            
            if (painId === 1) {
                resDiv.innerHTML = "🎯 **Բուժում (Բարձր ДРР & Գովազդային ծախսեր):**\\n1. Կանգնեցրեք ավտոգովազդը, անցեք ֆիքսված հարցումներով գովազդի։\\n2. Ստուգեք SEO վերնագիրը (հնարավոր է գովազդվում եք սխալ keyword-ներով)։";
            } else if (painId === 2) {
                resDiv.innerHTML = "🎯 **Բուժում (Ցածր Կոնվերսիա Զամբյուղ):**\\n1. Փոխեք գլխավոր ինֆոգրաֆիկան (ավելացրեք բեջեր)։\\n2. Ստուգեք մրցակիցների գնային առաջարկները MPSTATS-ով։";
            } else if (painId === 3) {
                resDiv.innerHTML = "🎯 **Բուժում (Բարձր Վերադարձներ / Выкуп):**\\n1. Ճշգրտեք չափսային ցանցը (размерная сетка)։\\n2. Ամրացրեք փաթեթավորումը (пупырка/տուփ)։";
            } else if (painId === 4) {
                resDiv.innerHTML = "🎯 **Բուժում (Ֆինանսական Ճշգրտություն):**\\n1. Օգտագործեք Novessa Յունիթ-Էկոնոմիկան։\\n2. Ավելացրեք 5-10% ռիսկային բուֆեր հաշվարկների մեջ։";
            }
        }

        let currentCalc = null;

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

        function calculate() {
            let title = document.getElementById('productTitle').value || 'Ապրանք';
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
                resDiv.innerHTML = '⚠️ Սխալ Gemini API հարցման ժամանակ։';
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
