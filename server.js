const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// Frontend (AI Chat + Unit Economics + SEO Generator Pro Max)
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="hy">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>NOVESSA AI Platform Pro Max</title>
        <style>
            * { box-sizing: border-box; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; }
            body { background: #0f172a; color: #f8fafc; display: flex; flex-direction: column; height: 100vh; }
            header { background: #1e293b; padding: 15px 20px; text-align: center; border-bottom: 1px solid #334155; }
            header h1 { color: #38bdf8; font-size: 22px; }
            header p { color: #94a3b8; font-size: 13px; margin-top: 3px; }
            
            .nav-tabs { display: flex; background: #1e293b; border-bottom: 1px solid #334155; justify-content: center; flex-wrap: wrap; }
            .tab-btn { padding: 12px 20px; background: none; border: none; color: #94a3b8; font-size: 14px; font-weight: bold; cursor: pointer; border-bottom: 3px solid transparent; transition: 0.2s; }
            .tab-btn.active { color: #38bdf8; border-bottom-color: #38bdf8; background: #0f172a; }

            .content-section { display: none; flex: 1; flex-direction: column; overflow: hidden; }
            .content-section.active { display: flex; }

            #chat-container { flex: 1; padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 15px; }
            .message { max-width: 80%; padding: 12px 16px; border-radius: 12px; font-size: 15px; line-height: 1.5; white-space: pre-wrap; }
            .user-message { background: #0284c7; color: #fff; align-self: flex-end; border-bottom-right-radius: 2px; }
            .ai-message { background: #334155; color: #f1f5f9; align-self: flex-start; border-bottom-left-radius: 2px; }

            #input-container { padding: 15px; background: #1e293b; display: flex; gap: 10px; border-top: 1px solid #334155; }
            input, select, textarea { flex: 1; padding: 12px; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: #fff; font-size: 15px; outline: none; }
            button.send-btn, .action-btn { padding: 12px 24px; border-radius: 8px; border: none; background: #0284c7; color: #fff; font-weight: bold; cursor: pointer; transition: 0.2s; }
            button.send-btn:hover, .action-btn:hover { background: #0369a1; }

            /* Calculator & SEO Styles */
            .panel-container { padding: 25px; overflow-y: auto; max-width: 650px; margin: 0 auto; width: 100%; display: flex; flex-direction: column; gap: 15px; }
            .form-group { display: flex; flex-direction: column; gap: 5px; }
            .form-group label { font-size: 14px; color: #94a3b8; }
            .result-box { background: #1e293b; padding: 20px; border-radius: 12px; border: 1px solid #334155; margin-top: 5px; white-space: pre-wrap; font-size: 14px; line-height: 1.6; }
            .result-row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 16px; }
            .result-row span:last-child { font-weight: bold; color: #38bdf8; }
        </style>
    </head>
    <body>
        <header>
            <h1>✨ NOVESSA AI Platform Pro Max</h1>
            <p>Անվճար ամպային AI օգնական, Յունիտ Էկոնոմիկա և SEO Քարտերի Գեներատոր</p>
        </header>

        <div class="nav-tabs">
            <button class="tab-btn active" onclick="switchTab('chat')">💬 AI Զրույց</button>
            <button class="tab-btn" onclick="switchTab('calc')">📊 Unit Economics</button>
            <button class="tab-btn" onclick="switchTab('seo')">🔍 SEO & Քարտ Գեներատոր</button>
        </div>

        <!-- Chat Section -->
        <div id="chat-section" class="content-section active">
            <div id="chat-container">
                <div class="message ai-message">Ողջույն, Սյուզաննա ջան։ NOVESSA Pro Max-ը պատրաստ է աշխատանքի։ Ինչո՞վ կարող եմ օգնել։</div>
            </div>
            <div id="input-container">
                <input type="text" id="userInput" placeholder="Գրեք Ձեր հարցը այստեղ..." onkeydown="if(event.key==='Enter') sendMessage()">
                <button class="send-btn" onclick="sendMessage()">Ուղարկել</button>
            </div>
        </div>

        <!-- Calculator Section -->
        <div id="calc-section" class="content-section">
            <div class="panel-container">
                <h3 style="color: #38bdf8; margin-bottom: 5px;">Մարքեթփլեյսի Յունիտ Էկոնոմիկա</h3>
                
                <div class="form-group"><label>Ապրանքի վաճառքի գինը (Retail Price):</label><input type="number" id="price" value="5000"></div>
                <div class="form-group"><label>Ապրանքի ինքնարժեք (COGS):</label><input type="number" id="cogs" value="1500"></div>
                <div class="form-group"><label>Հանձնաժողով (Commission %):</label><input type="number" id="commission" value="15"></div>
                <div class="form-group"><label>Լոգիստիկա և փաթեթավորում (Logistics):</label><input type="number" id="logistics" value="400"></div>
                <div class="form-group"><label>Գովազդ և Հարկեր (%):</label><input type="number" id="adsTax" value="10"></div>

                <button class="action-btn" onclick="calculateUnit()">🧮 Հաշվել Շահույթը</button>

                <div class="result-box">
                    <h4 style="margin-bottom: 15px; color: #f1f5f9; border-bottom: 1px solid #334155; padding-bottom: 8px;">Հաշվարկի Արդյունքներ</h4>
                    <div class="result-row"><span>Ընդհանուր Ծախսեր:</span> <span id="resTotalCost">0 AMD</span></div>
                    <div class="result-row"><span>Զուտ Շահույթ (Net Profit):</span> <span id="resProfit" style="color: #4ade80;">0 AMD</span></div>
                    <div class="result-row"><span>Շահութաբերության Մարժա (Margin):</span> <span id="resMargin">0.0%</span></div>
                    <div class="result-row"><span>ROI (Եկամտաբերություն):</span> <span id="resRoi">0.0%</span></div>
                </div>
            </div>
        </div>

        <!-- SEO Generator Section -->
        <div id="seo-section" class="content-section">
            <div class="panel-container">
                <h3 style="color: #38bdf8; margin-bottom: 5px;">Wildberries / Ozon SEO Քարտի Գեներատոր</h3>
                
                <div class="form-group"><label>Ապրանքի անվանումը կամ կատեգորիան:</label><input type="text" id="prodName" placeholder="Օրինակ՝ Կանացի պայուսակ, տաք գիշերազգեստ..."></div>
                <div class="form-group"><label>Հիմնական հատկանիշներ և առավելություններ:</label><textarea id="prodFeatures" rows="3" placeholder="Օրինակ՝ էկոկաշի, ջրակայուն, մեծ տարողություն, շատ գույներ..."></textarea></div>

                <button class="action-btn" onclick="generateSeoCard()">✨ Գեներատոր SEO Տեքստ և Բանալի Բառեր</button>

                <div class="result-box" id="seoResult">
                    Այստեղ կհայտնվի գեներացված SEO վերնագիրը, բանալի բառերը և նկարագրությունը...
                </div>
            </div>
        </div>

        <script>
            function switchTab(tab) {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
                if(tab === 'chat') {
                    document.querySelectorAll('.tab-btn')[0].classList.add('active');
                    document.getElementById('chat-section').classList.add('active');
                } else if(tab === 'calc') {
                    document.querySelectorAll('.tab-btn')[1].classList.add('active');
                    document.getElementById('calc-section').classList.add('active');
                    calculateUnit();
                } else {
                    document.querySelectorAll('.tab-btn')[2].classList.add('active');
                    document.getElementById('seo-section').classList.add('active');
                }
            }

            function calculateUnit() {
                const price = parseFloat(document.getElementById('price').value) || 0;
                const cogs = parseFloat(document.getElementById('cogs').value) || 0;
                const commRate = parseFloat(document.getElementById('commission').value) || 0;
                const logistics = parseFloat(document.getElementById('logistics').value) || 0;
                const adsTaxRate = parseFloat(document.getElementById('adsTax').value) || 0;

                const commission = price * (commRate / 100);
                const adsTax = price * (adsTaxRate / 100);
                const totalCost = cogs + commission + logistics + adsTax;
                const profit = price - totalCost;
                const margin = price > 0 ? (profit / price) * 100 : 0;
                const roi = cogs > 0 ? (profit / cogs) * 100 : 0;

                document.getElementById('resTotalCost').textContent = totalCost.toFixed(0) + ' AMD';
                document.getElementById('resProfit').textContent = profit.toFixed(0) + ' AMD';
                document.getElementById('resMargin').textContent = margin.toFixed(1) + '%';
                document.getElementById('resRoi').textContent = roi.toFixed(1) + '%';
            }

            window.onload = calculateUnit;

            async function generateSeoCard() {
                const name = document.getElementById('prodName').value.trim();
                const features = document.getElementById('prodFeatures').value.trim();
                const resultBox = document.getElementById('seoResult');

                if (!name) {
                    resultBox.textContent = 'Խնդրում ենք լրացնել ապրանքի անվանումը։';
                    return;
                }

                resultBox.textContent = 'Նովեսսան մշակում է SEO օպտիմիզացված քարտը...';

                try {
                    const response = await fetch('/api/v1/chat', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            message: "Ստեղծիր Wildberries և Ozon մարքեթփլեյսների համար իդեալական SEO ապրանքային քարտ հետևյալ տվյալներով:\\nԱպրանք: " + name + "\\nՀատկանիշներ: " + features + "\\n\\nՏրամադրիր հետևյալ կառուցվածքով՝\\n1. SEO վերնագիր (առավելագույնը 60 նշան, հարուստ բանալի բառերով)\\n2. Բանալի բառեր (Keywords / Search tags - 10-15 հատ)\\n3. Գրավիչ վաճառող նկարագրություն (Bullet points-ով և նկարագրական տեքստով)"
                        })
                    });
                    const data = await response.json();
                    resultBox.textContent = data.reply;
                } catch (err) {
                    resultBox.textContent = 'Սխալ՝ հնարավոր չեղավ կապվել AI սերվերի հետ։';
                }
            }

            async function sendMessage() {
                const input = document.getElementById('userInput');
                const message = input.value.trim();
                if (!message) return;

                const chatContainer = document.getElementById('chat-container');

                const userDiv = document.createElement('div');
                userDiv.className = 'message user-message';
                userDiv.textContent = message;
                chatContainer.appendChild(userDiv);

                input.value = '';
                chatContainer.scrollTop = chatContainer.scrollHeight;

                const loadingDiv = document.createElement('div');
                loadingDiv.className = 'message ai-message';
                loadingDiv.textContent = 'NOVESSA-ն մտածում է...';
                chatContainer.appendChild(loadingDiv);
                chatContainer.scrollTop = chatContainer.scrollHeight;

                try {
                    const response = await fetch('/api/v1/chat', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message })
                    });
                    const data = await response.json();
                    loadingDiv.textContent = data.reply;
                } catch (err) {
                    loadingDiv.textContent = 'Կապի սխալ ամպային սերվերի հետ։';
                }
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }
        </script>
    </body>
    </html>
  `);
});

// Health Check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'online', 
    service: 'NOVESSA Cloud Pro Max API', 
    geminiReady: !!process.env.GEMINI_API_KEY,
    timestamp: new Date() 
  });
});

// AI API Router (Gemini 3.8 Flash)
app.post('/api/v1/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.json({ success: true, reply: "GEMINI_API_KEY-ը բացակայում է Render-ում:" });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;
    const aiResponse = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Դուք NOVESSA AI մասնագետն եք, որն օգնում է մարքեթփլեյսների (Wildberries, Ozon), Excel-ի, Unit Economics-ի, SEO-ի և վաճառքների կառավարման հարցերում։ Պատասխանեք հայերեն կամ ռուսերեն՝ ըստ օգտատիրոջ լեզվի:\n\nՕգտատիրոջ հարցը: ${message}`
          }]
        }]
      })
    });

    const aiData = await aiResponse.json();
    if (aiData.error) return res.json({ success: true, reply: `Google Gemini Սխալ: ${aiData.error.message}` });

    if (aiData.candidates && aiData.candidates.length > 0 && aiData.candidates[0].content) {
      return res.json({ success: true, reply: aiData.candidates[0].content.parts[0].text });
    } else {
      return res.json({ success: true, reply: "AI պատասխանի սխալ ձևաչափ:" });
    }
  } catch (err) {
    return res.json({ success: true, reply: "Ցանցային սխալ: " + err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 NOVESSA Cloud Pro Max Backend live on port ${PORT}`);
});

