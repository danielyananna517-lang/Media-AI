import express from 'express';

const app = express();
app.use(express.json({ limit: '15mb' }));
const PORT = process.env.PORT || 3000;

let historyDB = [];

app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="hy">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Novessa Pro Max | Enterprise E-Commerce Suite</title>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Noto+Sans+Armenian:wght@400;700&display=swap" rel="stylesheet">
    <!-- SheetJS for real .xlsx export -->
    <script src="https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js"></script>
    <!-- jsPDF for professional PDF reports -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
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
            --danger: #ef4444;
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
            width: 290px;
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

        .btn-excel { background: linear-gradient(135deg, #059669, #047857) !important; }
        .btn-pdf { background: linear-gradient(135deg, #dc2626, #991b1b) !important; }

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
        <button class="nav-btn" onclick="switchPage('masterCalc')">📊 Յունիթ, Լոգիստիկա & Export</button>
        <button class="nav-btn" onclick="switchPage('stockPredictor')">📦 Stock-Out Predictor</button>
        <button class="nav-btn" onclick="switchPage('cardStudio')">🎨 Card Studio & Background</button>
        <button class="nav-btn" onclick="switchPage('funnelAndAd')">📉 Վաճառքի Ձագար & AD Test</button>
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
                <h1 style="color:white; margin:0 0 10px 0;">Novessa Pro Max — Enterprise Suite</h1>
                <p style="color:#e2e8f0; font-size:16px; margin:0;">Պրոֆեսիոնալ E-commerce հարթակ՝ Յունիթ-էկոնոմիկայով, Stock-Out կանխատեսմամբ, PDF/Excel արտահանումներով և նկարների մշակմամբ։</p>
            </div>
            
            <div class="grid-3">
                <div class="card" onclick="switchPage('masterCalc')" style="cursor:pointer;">
                    <h3>📊 Յունիթ & Export</h3>
                    <p style="color:var(--text-muted); font-size:13px;">Հաշվարկեք շահույթը և արտահանեք իրական .xlsx կամ PDF հաշվետվություններ։</p>
                </div>
                <div class="card" onclick="switchPage('stockPredictor')" style="cursor:pointer;">
                    <h3>📦 Stock-Out Predictor</h3>
                    <p style="color:var(--text-muted); font-size:13px;">Կանխատեսեք ապրանքի պահեստային մնացորդն ու վերապատվիրման օրը։</p>
                </div>
                <div class="card" onclick="switchPage('cardStudio')" style="cursor:pointer;">
                    <h3>🎨 Card Studio & Background</h3>
                    <p style="color:var(--text-muted); font-size:13px;">Բեռնեք նկարը, հեռացրեք ֆոնը և ստեղծեք ինֆոգրաֆիկա։</p>
                </div>
            </div>
        </div>

        <!-- PAGE 2: MASTER UNIT ECONOMICS + PDF/EXCEL EXPORT -->
        <div id="masterCalc" class="page">
            <div class="card">
                <h2>📊 Ունիվերսալ Յունիթ-Էկոնոմիկա և Պրոֆեսիոնալ Արտահանում (Export)</h2>
                <input type="text" id="productTitle" placeholder="Ապրանքի անվանում (օր.՝ Կանացի ջինսեր)">
                <select id="platform">
                    <option value="Wildberries">Wildberries</option>
                    <option value="Ozon">Ozon</option>
                    <option value="Shopify">Shopify / Սեփական կայք</option>
                    <option value="Amazon">Amazon</option>
                </select>

                <div class="grid-2">
                    <div>
                        <label>Վաճառքի Գին</label>
                        <input type="number" id="price" placeholder="10000">
                    </div>
                    <div>
                        <label>Ապրանքի Ինքնարժեք (COGS)</label>
                        <input type="number" id="cost" placeholder="3000">
                    </div>
                </div>

                <div class="grid-3">
                    <div>
                        <label>Միջնորդավճար (%)</label>
                        <input type="number" id="commission" value="15">
                    </div>
                    <div>
                        <label>Լոգիստիկա</label>
                        <input type="number" id="logistics" value="50">
                    </div>
                    <div>
                        <label>Հետադարձ Լոգիստիկա</label>
                        <input type="number" id="revLogistics" value="33">
                    </div>
                </div>

                <div class="grid-3">
                    <div>
                        <label>Պահեստավորում օրական</label>
                        <input type="number" id="storagePerDay" value="1.5">
                    </div>
                    <div>
                        <label>Օրերը պահեստում</label>
                        <input type="number" id="avgDays" value="30">
                    </div>
                    <div>
                        <label>Выкуп (Քավում %) Mոտավոր</label>
                        <input type="number" id="buyoutRate" value="85">
                    </div>
                </div>

                <div class="grid-2">
                    <div>
                        <label>Գովազդ / ДРР (%)</label>
                        <input type="number" id="adCost" value="10">
                    </div>
                    <div>
                        <label>Հարկ (%)</label>
                        <input type="number" id="tax" value="5">
                    </div>
                </div>

                <button class="action-btn" onclick="calculateMaster()">Հաշվարկել Ամբողջական Շահույթը</button>
                <div id="masterResult" class="result-box" style="display:none;"></div>
                
                <div class="grid-3" style="margin-top:15px;">
                    <button id="exportExcelBtn" class="action-btn btn-excel" style="display:none;" onclick="exportToExcel()">📊 Ներբեռնել Excel (.xlsx)</button>
                    <button id="exportPdfBtn" class="action-btn btn-pdf" style="display:none;" onclick="exportToPDF()">📄 Ներբեռնել PDF Հաշվետվություն</button>
                    <button id="saveCalcBtn" class="action-btn" style="display:none;background:linear-gradient(135deg,#059669,#047857);" onclick="saveCalculation()">💾 Պահպանել այս բրաուզերում</button>
                </div>
            </div>
        </div>

        <!-- PAGE 3: STOCK-OUT PREDICTOR -->
        <div id="stockPredictor" class="page">
            <div class="card">
                <h2>📦 Stock-Out Predictor — Պահեստի Մնացորդի Կանխատեսում</h2>
                <p style="color:var(--text-muted); font-size:13.5px;">Հաշվարկեք, թե երբ կսպառվի ապրանքը պահեստում և քանակն ու ամսաթիվը վերապատվիրելու համար։</p>
                
                <div class="grid-2">
                    <div>
                        <label>Ապրանքի SKU / Անվանում</label>
                        <input type="text" id="stockSku" placeholder="SKU-777 (Կանացի ջինսեր)">
                    </div>
                    <div>
                        <label>Ներկա Պահեստային Մնացորդ (шт)</label>
                        <input type="number" id="currentStock" placeholder="500">
                    </div>
                </div>

                <div class="grid-3">
                    <div>
                        <label>Միջին օրական վաճառք</label>
                        <input type="number" id="dailySales" placeholder="15">
                    </div>
                    <div>
                        <label>Մատակարարման ժամկետ (օր)</label>
                        <input type="number" id="leadTime" placeholder="14">
                    </div>
                    <div>
                        <label>Safety Stock (Անվտանգության պաշար)</label>
                        <input type="number" id="safetyStock" placeholder="50">
                    </div>
                </div>

                <button class="action-btn" onclick="calculateStockPredictor()">Կանխատեսել պաշարների սպառումը</button>
                <div id="stockResult" class="result-box" style="display:none;"></div>
            </div>
        </div>

        <!-- PAGE 4: CARD STUDIO & BACKGROUND REMOVAL -->
        <div id="cardStudio" class="page">
            <div class="card">
                <h2>🎨 Card Studio & Ֆոնի Ավտոմատ Մաքրում</h2>
                <input type="text" id="cardProduct" placeholder="Ապրանքի անուն (օր.՝ Կանացի Ջինսեր)">
                <div class="grid-2">
                    <input type="text" id="cardBadge" placeholder="Բեջ (օր.՝ ХИТ ПРОДАЖ / 100% ХЛОПОК)">
                    <input type="text" id="cardBenefit" placeholder="Առավելություն (օր.՝ Идеальная посадка)">
                </div>
                
                <label>Բեռնեք ապրանքի լուսանկարը համակարգչից կամ հեռախոսից․</label>
                <input type="file" id="cardImgUpload" accept="image/png,image/jpeg" onchange="handleImageUpload(event)">
                
                <div id="processingStatus" style="font-size:13px; color:#38bdf8; margin-top:8px; display:none;">⚙️ Մշակվում է նկարը և մաքրվում ֆոնը...</div>

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

        <!-- PAGE 5: FUNNEL & AD TEST -->
        <div id="funnelAndAd" class="page">
            <div class="card">
                <h2>📉 1. Վաճառքների Ձագար (Funnel Leak Analytics)</h2>
                <div class="grid-3">
                    <input type="number" id="views" placeholder="Ցուցադրումներ">
                    <input type="number" id="clicks" placeholder="Քլիքներ">
                    <input type="number" id="carts" placeholder="Զամբյուղ">
                </div>
                <div class="grid-2">
                    <input type="number" id="orders" placeholder="Պատվերներ">
                    <input type="number" id="buyouts" placeholder="Քավումներ">
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
                <button class="action-btn" onclick="runAdTest()">Ստուգել Գովազդը</button>
                <div id="adTestResult" class="result-box" style="display:none;"></div>
            </div>
        </div>

        <!-- PAGE 6: SEO STUDIO -->
        <div id="seoStudio" class="page">
            <div class="card">
                <h2>✍️ SEO Վերնագրեր և Նկարագրություններ</h2>
                <input type="text" id="seoInput" placeholder="Ապրանքի անվանում">
                <button class="action-btn" onclick="generateSEOText()">Գեներացնել SEO Տեքստեր</button>
                <div id="seoResult" class="result-box" style="display:none;"></div>
            </div>
        </div>

        <!-- PAGE 7: PAIN SOLVER -->
        <div id="painSolver" class="page">
            <div class="card">
                <h2>💡 Բիզնես-Ցավերի Դիագնոստիկ</h2>
                <div class="pain-card" onclick="solvePain(1)"><b>1. 💸 «Գովազդի վրա շատ փող եմ ծախսում (ДРР), բայց վաճառք չկա»</b></div>
                <div class="pain-card" onclick="solvePain(2)"><b>2. 👀 «Ապրանքը դիտում են, բայց զամբյուղ չեն դնում»</b></div>
                <div class="pain-card" onclick="solvePain(3)"><b>3. 🔄 «Վերադարձները (Выкуп) շատ են, լոգիստիկան ուտում է շահույթս»</b></div>
                <div id="painSolutionResult" class="result-box" style="display:none;"></div>
            </div>
        </div>

        <!-- PAGE 8: HISTORY -->
        <div id="history" class="page">
            <div class="card">
                <h2>🧠 Հիշողության Բանկ (այս բրաուզերում)</h2>
                <button class="action-btn" onclick="loadHistory()" style="background: #3f326b;">🔄 Թարմացնել պատմությունը</button>
                <div id="historyList" class="result-box" style="margin-top:15px;">Սեղմեք թարմացնելու համար...</div>
            </div>
        </div>

        <!-- PAGE 9: AI COPILOT -->
        <div id="aiCopilot" class="page">
            <div class="card">
                <h2>🤖 Gemini AI E-Commerce Խորհրդատու</h2>
                <label for="geminiKey">Gemini API Key (պարտադիր չէ, եթե Render-ում արդեն կարգավորված է)</label>
                <input type="password" id="geminiKey" autocomplete="off" spellcheck="false" placeholder="Մուտքագրեք Gemini API Key-ը">
                <p style="font-size:12px;color:var(--text-muted);margin:0 0 12px;">Բանալին չի պահվում NOVESSA-ի տվյալներում․ այն փոխանցվում է միայն HTTPS հարցման ժամանակ։ Հանրային/օտար համակարգչում մի՛ մուտքագրեք։</p>
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

        async function handleImageUpload(event) {
            const file = event?.target?.files?.[0];
            if (!file) return;
            const statusElem = document.getElementById('processingStatus');
            if (!['image/png', 'image/jpeg'].includes(file.type)) {
                statusElem.style.display = 'block';
                statusElem.style.color = '#ef4444';
                statusElem.textContent = 'Ընդունվում են միայն PNG կամ JPEG նկարներ։';
                event.target.value = '';
                return;
            }
            if (file.size > 10 * 1024 * 1024) {
                statusElem.style.display = 'block';
                statusElem.style.color = '#ef4444';
                statusElem.textContent = 'Ֆայլը գերազանցում է 10 ՄԲ սահմանաչափը։';
                event.target.value = '';
                return;
            }
            statusElem.style.display = 'block';
            statusElem.style.color = '#38bdf8';
            statusElem.textContent = 'Նկարը բեռնվում է…';
            const reader = new FileReader();
            reader.onerror = function () {
                statusElem.style.color = '#ef4444';
                statusElem.textContent = 'Չհաջողվեց կարդալ նկարը։';
            };
            reader.onload = async function (e) {
                uploadedImgData = String(e.target.result || '');
                statusElem.textContent = 'Նկարը բեռնված է։ Ստուգվում է ֆոնի իրական հեռացումը…';
                try {
                    const response = await fetch('/api/remove-background', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ imageData: uploadedImgData, fileName: file.name })
                    });
                    const data = await response.json().catch(() => ({}));
                    if (response.ok && data.success && typeof data.imageData === 'string' && data.imageData.startsWith('data:image/png;base64,')) {
                        uploadedImgData = data.imageData;
                        statusElem.style.color = '#10b981';
                        statusElem.textContent = 'Ֆոնը հեռացվել է իրական մշակմամբ։ Մշակված PNG-ն պատրաստ է Card Studio-ի համար։';
                    } else {
                        statusElem.style.color = '#f59e0b';
                        statusElem.textContent = data.error
                            ? 'Նկարը բեռնված է, բայց ֆոնի հեռացումը հասանելի չէ. ' + data.error
                            : 'Նկարը բեռնված է, բայց ֆոնի հեռացումը չի հաստատվել։ Կօգտագործվի սկզբնական նկարը։';
                    }
                } catch (error) {
                    statusElem.style.color = '#f59e0b';
                    statusElem.textContent = 'Նկարը բեռնված է, բայց ֆոնի հեռացման ծառայությանը միանալ չհաջողվեց։ Կօգտագործվի սկզբնական նկարը։';
                }
            };
            reader.readAsDataURL(file);
        }

        function readNumberInput(id, fallback) {
            const element = document.getElementById(id);
            if (!element) return NaN;
            const raw = String(element.value ?? '').trim();
            if (raw === '') return fallback;
            const value = Number(raw);
            return Number.isFinite(value) ? value : NaN;
        }

        function calculateMaster() {
            const title = (document.getElementById('productTitle').value || 'Ապրանք').trim().slice(0, 120);
            const platform = document.getElementById('platform').value;
            const p = readNumberInput('price', NaN);
            const c = readNumberInput('cost', NaN);
            const comm = readNumberInput('commission', 15);
            const log = readNumberInput('logistics', 50);
            const revLog = readNumberInput('revLogistics', 33);
            const storagePerDay = readNumberInput('storagePerDay', 1);
            const avgDays = readNumberInput('avgDays', 30);
            const buyoutRate = readNumberInput('buyoutRate', 85);
            const ad = readNumberInput('adCost', 10);
            const tax = readNumberInput('tax', 5);

            const values = [p, c, comm, log, revLog, storagePerDay, avgDays, buyoutRate, ad, tax];
            if (!values.every(Number.isFinite)) {
                alert('Լրացրեք պարտադիր թվային դաշտերը վավեր թվերով։');
                return;
            }
            if (p <= 0 || c < 0 || log < 0 || revLog < 0 || storagePerDay < 0 || avgDays < 0) {
                alert('Գինը պետք է լինի 0-ից բարձր, իսկ ինքնարժեքն ու ծախսերը՝ 0 կամ ավելի։');
                return;
            }
            if ([comm, buyoutRate, ad, tax].some(v => v < 0 || v > 100)) {
                alert('Միջնորդավճարը, buyout-ը, գովազդն ու հարկը պետք է լինեն 0–100% միջակայքում։');
                return;
            }

            const commAmount = p * (comm / 100);
            const adAmount = p * (ad / 100);
            const taxAmount = p * (tax / 100);
            const storageTotal = storagePerDay * avgDays;
            const unboughtPercent = (100 - buyoutRate) / 100;
            const effectiveLogistics = log + (revLog * unboughtPercent);
            const totalExpenses = c + commAmount + effectiveLogistics + storageTotal + adAmount + taxAmount;
            const netProfit = p - totalExpenses;
            const roi = c > 0 ? ((netProfit / c) * 100).toFixed(1) : 'N/A';
            const margin = ((netProfit / p) * 100).toFixed(1);

            currentCalc = {
                title, platform, price: p, cost: c, commission: commAmount,
                logistics: effectiveLogistics, storage: storageTotal, ad: adAmount,
                tax: taxAmount, totalExpenses, netProfit: Number(netProfit.toFixed(2)),
                roi, margin, date: new Date().toISOString()
            };

            const resDiv = document.getElementById('masterResult');
            resDiv.style.display = 'block';
            resDiv.textContent = [
                'Հաշվարկի արդյունքներ (' + platform + ')',
                'Մաքուր շահույթ՝ ' + netProfit.toFixed(2),
                'Մարժա՝ ' + margin + '%',
                'ROI՝ ' + (roi === 'N/A' ? roi : roi + '%'),
                'Ընդհանուր ծախսեր՝ ' + totalExpenses.toFixed(2),
                'Նշում․ գնահատումը հիմնված է մուտքագրված ենթադրությունների վրա։'
            ].join('\n');

            document.getElementById('exportExcelBtn').style.display = 'block';
            document.getElementById('exportPdfBtn').style.display = 'block';
            const saveButton = document.getElementById('saveCalcBtn');
            if (saveButton) saveButton.style.display = 'block';
        }

        function exportToExcel() {
            if (!currentCalc) { alert('Նախ կատարեք հաշվարկ։'); return; }
            if (!window.XLSX) { alert('Excel արտահանման գրադարանը չի բեռնվել։ Թարմացրեք էջը և փորձեք կրկին։'); return; }

            const wb = XLSX.utils.book_new();

            const unitData = [
                ["Novessa Pro Max - Unit Economics Report"],
                ["Ապրանք", currentCalc.title],
                ["Հարթակ", currentCalc.platform],
                ["Վաճառքի գին", currentCalc.price],
                ["Ինքնարժեք (COGS)", currentCalc.cost],
                ["Մաքուր շահույթ", currentCalc.netProfit],
                ["Մարժա (%)", currentCalc.margin],
                ["ROI (%)", currentCalc.roi]
            ];
            const ws1 = XLSX.utils.aoa_to_sheet(unitData);
            XLSX.utils.book_append_sheet(wb, ws1, "Unit Economics");

            const costData = [
                ["Ծախսային մաս", "Գումար"],
                ["Միջնորդավճար", currentCalc.commission],
                ["Լոգիստիկա + Հետադարձ", currentCalc.logistics],
                ["Պահեստավորում", currentCalc.storage],
                ["Գովազդ (ДРР)", currentCalc.ad],
                ["Հարկեր", currentCalc.tax]
            ];
            const ws2 = XLSX.utils.aoa_to_sheet(costData);
            XLSX.utils.book_append_sheet(wb, ws2, "Ծախսեր և շահույթ");

            const safeName = String(currentCalc.title || 'Novessa').replace(/[<>:"|?*\u0000-\u001F]/g, '_').replace(/[\\/]/g, '_').slice(0, 80);
            XLSX.writeFile(wb, safeName + "_Novessa_Report.xlsx");
        }

        async function exportToPDF() {
            if (!currentCalc) { alert('Նախ կատարեք հաշվարկ։'); return; }
            if (!window.jspdf || !window.html2canvas) {
                alert('PDF գրադարանները չեն բեռնվել։ Թարմացրեք էջը և փորձեք կրկին։');
                return;
            }

            const report = document.createElement('section');
            report.lang = 'hy';
            report.style.cssText = 'position:fixed;left:-10000px;top:0;width:760px;padding:32px;background:#fff;color:#171717;font-family:"Noto Sans Armenian",Arial,sans-serif;box-sizing:border-box;';
            const heading = document.createElement('h1');
            heading.textContent = 'NOVESSA — Յունիթ-էկոնոմիկայի հաշվետվություն';
            heading.style.cssText = 'font-size:24px;margin:0 0 8px;';
            report.appendChild(heading);

            const meta = document.createElement('p');
            meta.textContent = 'Ամսաթիվ՝ ' + new Date(currentCalc.date).toLocaleString() + ' | Հարթակ՝ ' + currentCalc.platform;
            meta.style.cssText = 'font-size:13px;color:#555;margin:0 0 20px;';
            report.appendChild(meta);

            const productHeading = document.createElement('h2');
            productHeading.textContent = 'Ապրանք՝ ' + currentCalc.title;
            productHeading.style.cssText = 'font-size:18px;margin:0 0 14px;';
            report.appendChild(productHeading);

            const table = document.createElement('table');
            table.style.cssText = 'width:100%;border-collapse:collapse;font-size:14px;';
            const rows = [
                ['Վաճառքի գին', currentCalc.price],
                ['Ապրանքի ինքնարժեք', currentCalc.cost],
                ['Միջնորդավճար', currentCalc.commission],
                ['Լոգիստիկա և վերադարձի գնահատված ծախս', currentCalc.logistics],
                ['Պահեստավորում', currentCalc.storage],
                ['Գովազդ', currentCalc.ad],
                ['Հարկեր', currentCalc.tax],
                ['Ընդհանուր ծախսեր', currentCalc.totalExpenses],
                ['Մաքուր շահույթ', currentCalc.netProfit],
                ['Մարժա', currentCalc.margin + '%'],
                ['ROI', currentCalc.roi === 'N/A' ? 'N/A' : currentCalc.roi + '%']
            ];
            rows.forEach((item, index) => {
                const tr = document.createElement('tr');
                [item[0], typeof item[1] === 'number' ? item[1].toFixed(2) : String(item[1])].forEach(value => {
                    const td = document.createElement('td');
                    td.textContent = value;
                    td.style.cssText = 'border:1px solid #ddd;padding:9px;' + (index >= 7 ? 'font-weight:700;background:#f3f4f6;' : '');
                    tr.appendChild(td);
                });
                table.appendChild(tr);
            });
            report.appendChild(table);

            const note = document.createElement('p');
            note.textContent = 'Նշում․ արդյունքները հիմնված են մուտքագրված ենթադրությունների վրա և չեն հաստատում marketplace-ի իրական սակագները։';
            note.style.cssText = 'font-size:11px;color:#666;margin-top:18px;';
            report.appendChild(note);

            document.body.appendChild(report);
            try {
                if (document.fonts && document.fonts.ready) await document.fonts.ready;
                const canvas = await window.html2canvas(report, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF('p', 'mm', 'a4');
                const width = 190;
                const height = width * canvas.height / canvas.width;
                if (height > 277) {
                    alert('Հաշվետվությունը մեկ էջի համար չափազանց երկար է։ Կրճատեք ապրանքի անվանումը կամ հաշվետվության բովանդակությունը։');
                    return;
                }
                doc.addImage(canvas.toDataURL('image/png'), 'PNG', 10, 10, width, height);
                const safeName = String(currentCalc.title || 'Novessa').replace(/[<>:"|?*\u0000-\u001F]/g, '_').replace(/[\\/]/g, '_').slice(0, 80);
                doc.save(safeName + '_Novessa_Report.pdf');
            } catch (error) {
                alert('PDF ստեղծել չհաջողվեց։ Ստուգեք՝ արդյոք PDF գրադարանները հասանելի են։');
            } finally {
                report.remove();
            }
        }

        function calculateStockPredictor() {
            const sku = String(document.getElementById('stockSku').value || 'SKU').trim().slice(0, 80);
            const stock = readNumberInput('currentStock', NaN);
            const dailySales = readNumberInput('dailySales', NaN);
            const leadTime = readNumberInput('leadTime', NaN);
            const safetyStock = readNumberInput('safetyStock', NaN);

            if (![stock, dailySales, leadTime, safetyStock].every(Number.isFinite) ||
                stock < 0 || dailySales <= 0 || leadTime < 0 || safetyStock < 0) {
                alert('Մուտքագրեք վավեր տվյալներ․ մնացորդը, մատակարարման ժամկետը և անվտանգության պաշարը չեն կարող բացասական լինել, իսկ օրական վաճառքը պետք է լինի 0-ից բարձր։');
                return;
            }

            const targetCoverDays = 30;
            const daysLeft = stock / dailySales;
            const reorderPoint = (dailySales * leadTime) + safetyStock;
            const daysUntilReorder = stock <= reorderPoint ? 0 : (stock - reorderPoint) / dailySales;
            const recommendedQty = Math.max(0, (dailySales * (leadTime + targetCoverDays)) + safetyStock - stock);
            const today = new Date();
            const stockOutDate = new Date(today.getTime() + Math.ceil(daysLeft) * 86400000);
            const reorderDate = new Date(today.getTime() + Math.ceil(daysUntilReorder) * 86400000);
            const dateFormat = value => value.toLocaleDateString('hy-AM');

            const lines = [
                'Stock-Out կանխատեսում — ' + sku,
                'Միջին օրական պահանջարկ՝ ' + dailySales.toFixed(2) + ' հատ/օր',
                'Մոտավոր օրեր մինչև պաշարի սպառումը՝ ' + daysLeft.toFixed(1),
                'Կանխատեսվող սպառման ամսաթիվ՝ ' + dateFormat(stockOutDate),
                'Վերապատվիրման շեմ՝ ' + Math.ceil(reorderPoint) + ' հատ',
                'Վերապատվիրման առաջարկվող ամսաթիվ՝ ' + dateFormat(reorderDate),
                'Առաջարկվող պատվերի քանակ՝ ' + Math.ceil(recommendedQty) + ' հատ',
                'Ենթադրություն՝ պահանջարկը կայուն է․ մատակարարման ուշացումները և սեզոնայնությունը ներառված չեն։'
            ];
            const resDiv = document.getElementById('stockResult');
            resDiv.style.display = 'block';
            resDiv.textContent = lines.join('\n');
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

        function currentGeminiKey() {
            const field = document.getElementById('geminiKey');
            return String(field?.value || '').trim();
        }

        async function generateSEOText() {
            const input = String(document.getElementById('seoInput').value || '').trim().slice(0, 300);
            const resDiv = document.getElementById('seoResult');
            resDiv.style.display = 'block';
            if (!input) {
                resDiv.textContent = 'Նախ մուտքագրեք ապրանքի անունը կամ կատեգորիան։';
                return;
            }
            resDiv.textContent = 'AI-ն պատրաստում է SEO առաջարկները…';
            const prompt = 'Դու e-commerce SEO մասնագետ ես։ Ապրանք՝ ' + input +
                '. Պատասխանիր հայերենով՝ բաժիններով. SEO վերնագիր, ապրանքի նկարագրության նախագիծ, 8 համապատասխան բանալի բառ, լրացուցիչ տվյալներ, որոնք պետք է ճշտել։ Մի՛ հորինիր նյութ, չափս, բաղադրություն, սերտիֆիկատ, որոնման հաճախականություն կամ վաճառքի վիճակագրություն։ Եթե տվյալները բավարար չեն, ասա դա։';
            try {
                const response = await fetch('/api/ai', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(currentGeminiKey() ? { prompt, apiKey: currentGeminiKey() } : { prompt })
                });
                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                    resDiv.textContent = data.error || 'SEO գեներացիան հասանելի չէ։ Ստուգեք AI ծառայության կարգավորումները։';
                    return;
                }
                resDiv.textContent = data.reply || 'AI-ն դատարկ պատասխան է վերադարձրել։';
            } catch (error) {
                resDiv.textContent = 'AI SEO ծառայությանը միանալ չհաջողվեց։';
            }
        }

        function solvePain(painId) {
            let resDiv = document.getElementById('painSolutionResult');
            resDiv.style.display = 'block';
            if (painId === 1) resDiv.innerHTML = "🎯 **Բուժում:** Կանգնեցրեք ավտոգովազդը, անցեք ֆիքսված հարցումներով գովազդի։";
            else if (painId === 2) resDiv.innerHTML = "🎯 **Բուժում:** Փոխեք գլխավոր ինֆոգրաֆիկան և ստուգեք մրցակիցների գները։";
            else if (painId === 3) resDiv.innerHTML = "🎯 **Բուժում:** Ճշգրտեք չափսային ցանցը և ամրացրեք փաթեթավորումը։";
        }

        function saveCalculation() {
            if (!currentCalc) {
                alert('Նախ կատարեք հաշվարկ։');
                return;
            }
            try {
                const saved = JSON.parse(localStorage.getItem('novessaHistory') || '[]');
                const history = Array.isArray(saved) ? saved : [];
                history.unshift({ ...currentCalc, savedAt: new Date().toISOString() });
                localStorage.setItem('novessaHistory', JSON.stringify(history.slice(0, 20)));
                loadHistory();
                alert('Հաշվարկը պահպանվել է այս բրաուզերում։ Այն ավտոմատ չի համաժամացվում այլ սարքերի հետ։');
            } catch (error) {
                alert('Հնարավոր չէ պահպանել հաշվարկը բրաուզերի հիշողության մեջ։');
            }
        }

        function loadHistory() {
            const listDiv = document.getElementById('historyList');
            listDiv.replaceChildren();
            try {
                const saved = JSON.parse(localStorage.getItem('novessaHistory') || '[]');
                const history = Array.isArray(saved) ? saved : [];
                if (!history.length) {
                    listDiv.textContent = 'Այս բրաուզերում պահպանված հաշվարկներ դեռ չկան։';
                    return;
                }
                history.forEach((item, index) => {
                    const card = document.createElement('div');
                    card.style.cssText = 'background:#1e1938;padding:12px;margin-top:8px;border-radius:8px;border:1px solid #3f326b;font-size:13px;';
                    const title = document.createElement('b');
                    title.textContent = '#' + (index + 1) + ' — ' + String(item.title || 'Ապրանք') + ' (' + String(item.platform || '') + ')';
                    const details = document.createElement('p');
                    details.textContent = 'Գինը՝ ' + String(item.price ?? '') + ' | Շահույթ՝ ' + String(item.netProfit ?? '') + ' | ROI՝ ' + String(item.roi ?? '');
                    details.style.margin = '8px 0 0';
                    card.append(title, details);
                    listDiv.appendChild(card);
                });
            } catch (error) {
                listDiv.textContent = 'Չհաջողվեց կարդալ այս բրաուզերի պատմությունը։';
            }
        }

        async function askAI() {
            const prompt = String(document.getElementById('aiPrompt').value || '').trim();
            const resDiv = document.getElementById('aiResult');
            if (!prompt) {
                alert('Գրեք հարցը։');
                return;
            }
            if (prompt.length > 12000) {
                alert('Հարցը չափազանց երկար է։ Խնդրում ենք կրճատել։');
                return;
            }
            resDiv.style.display = 'block';
            resDiv.textContent = 'AI-ն մշակում է հարցը…';
            try {
                const response = await fetch('/api/ai', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(currentGeminiKey() ? { prompt, apiKey: currentGeminiKey() } : { prompt })
                });
                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                    resDiv.textContent = data.error || 'AI ծառայությունը հասանելի չէ։';
                    return;
                }
                resDiv.textContent = data.reply || 'AI-ն դատարկ պատասխան է վերադարձրել։';
            } catch (error) {
                resDiv.textContent = 'AI ծառայության հետ կապը չհաջողվեց։';
            }
        }
    

        </script>
</body>
</html>`);
});

app.post('/api/save', (req, res) => {
  const item = req.body;
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return res.status(400).json({ success: false, error: 'Հաշվարկի տվյալները անվավեր են։' });
  }
  historyDB.unshift(item);
  if (historyDB.length > 20) historyDB.pop();
  return res.json({
    success: true,
    storage: 'process-memory',
    message: 'Հաշվարկը պահպանվել է ժամանակավոր սերվերային հիշողության մեջ և կարող է կորչել վերագործարկման ժամանակ։'
  });
});

app.get('/api/history', (_req, res) => {
  return res.json(historyDB);
});

app.post('/api/remove-background', async (req, res) => {
  const apiKey = String(process.env.REMOVE_BG_API_KEY || '').trim();
  if (!apiKey) {
    return res.status(503).json({
      success: false,
      code: 'BACKGROUND_REMOVAL_NOT_CONFIGURED',
      error: 'Ֆոնի հեռացման ծառայությունը կարգավորված չէ․ պահանջվում է REMOVE_BG_API_KEY։'
    });
  }

  const imageData = typeof req.body?.imageData === 'string' ? req.body.imageData : '';
  const match = imageData.match(/^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return res.status(400).json({ success: false, error: 'Օգտագործեք վավեր PNG կամ JPEG նկար։' });

  const imageBuffer = Buffer.from(match[2], 'base64');
  if (!imageBuffer.length || imageBuffer.length > 10 * 1024 * 1024) {
    return res.status(413).json({ success: false, error: 'Նկարի չափը թույլատրելի միջակայքից դուրս է։' });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const form = new FormData();
    form.set('image_file', new Blob([imageBuffer], { type: match[1] }), match[1] === 'image/png' ? 'upload.png' : 'upload.jpg');
    form.set('size', 'auto');
    const upstream = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: { 'X-Api-Key': apiKey },
      body: form,
      signal: controller.signal
    });
    if (!upstream.ok) {
      const status = upstream.status === 429 ? 429 : 502;
      return res.status(status).json({
        success: false,
        code: status === 429 ? 'BACKGROUND_RATE_LIMIT' : 'BACKGROUND_PROVIDER_ERROR',
        error: 'Ֆոնի հեռացման ծառայությունը վերադարձրել է սխալ (HTTP ' + upstream.status + ')։'
      });
    }
    const output = Buffer.from(await upstream.arrayBuffer());
    if (!output.length || output.length > 15 * 1024 * 1024) {
      return res.status(502).json({ success: false, error: 'Մշակման արդյունքը դատարկ է կամ չափազանց մեծ։' });
    }
    return res.json({ success: true, imageData: 'data:image/png;base64,' + output.toString('base64') });
  } catch (error) {
    return res.status(error.name === 'AbortError' ? 504 : 502).json({
      success: false,
      code: error.name === 'AbortError' ? 'BACKGROUND_PROVIDER_TIMEOUT' : 'BACKGROUND_PROVIDER_UNREACHABLE',
      error: 'Ֆոնի հեռացման ծառայությունը հասանելի չէ։'
    });
  } finally {
    clearTimeout(timer);
  }
});

app.post('/api/ai', async (req, res) => {
  const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
  if (!prompt) return res.status(400).json({ success: false, error: 'Հարցը պարտադիր է։' });
  if (prompt.length > 12000) return res.status(413).json({ success: false, error: 'Հարցը չափազանց երկար է։' });

  const requestKey = typeof req.body?.apiKey === 'string' ? req.body.apiKey.trim() : '';
  if (requestKey.length > 512) {
    return res.status(400).json({ success: false, code: 'AI_KEY_INVALID', error: 'Gemini API բանալու ձևաչափը անվավեր է։' });
  }
  const key = requestKey || String(process.env.GEMINI_API_KEY || '').trim();
  if (!key) {
    return res.status(503).json({
      success: false,
      code: 'AI_NOT_CONFIGURED',
      error: 'Իրական AI ծառայությունը կարգավորված չէ։ Ավելացրեք GEMINI_API_KEY-ը Render-ի գաղտնի կարգավորումներում։'
    });
  }
  const model = String(process.env.GEMINI_MODEL || 'gemini-3.8-flash').trim();
  if (!/^[A-Za-z0-9._-]+$/.test(model)) {
    return res.status(500).json({ success: false, error: 'GEMINI_MODEL կարգավորումն անվավեր է։' });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const geminiRes = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }),
      signal: controller.signal
    });
    const data = await geminiRes.json().catch(() => ({}));
    if (!geminiRes.ok) {
      const status = geminiRes.status === 429 ? 429 : (geminiRes.status >= 400 && geminiRes.status < 500 ? geminiRes.status : 502);
      return res.status(status).json({
        success: false,
        code: status === 429 ? 'AI_RATE_LIMIT' : 'AI_PROVIDER_ERROR',
        error: status === 429 ? 'AI ծառայության սահմանաչափը լրացել է։ Փորձեք ավելի ուշ։' :
          'AI ծառայությունը վերադարձրել է սխալ (HTTP ' + geminiRes.status + ')։'
      });
    }
    const reply = data.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('').trim();
    if (!reply) return res.status(502).json({ success: false, code: 'AI_EMPTY_RESPONSE', error: 'AI-ն դատարկ պատասխան է վերադարձրել։' });
    return res.json({ success: true, provider: 'Google Gemini', model, reply });
  } catch (error) {
    return res.status(error.name === 'AbortError' ? 504 : 502).json({
      success: false,
      code: error.name === 'AbortError' ? 'AI_TIMEOUT' : 'AI_PROVIDER_UNREACHABLE',
      error: error.name === 'AbortError' ? 'AI պատասխանի սպասման ժամանակը սպառվեց։' : 'AI ծառայությանը միանալ չհաջողվեց։'
    });
  } finally {
    clearTimeout(timer);
  }
});

        app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
