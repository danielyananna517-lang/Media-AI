import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '20mb' }));

// In-Memory տվյալների պահպանում
let historyStore = [];

// 1. ԻՐԱԿԱՆ AI ENDPOINT (/api/ai)
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

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${activeApiKey}`;
        
        const response = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: `Դուք Novessa E-Commerce AI խորհրդատուն եք։ Պատասխանեք հարցին․ ${prompt}` }] }]
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({ 
                success: false, 
                error: data.error?.message || 'AI API-ն վերադարձրեց սխալ պատասխան:' 
            });
        }

        const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'AI-ն պատասխան չգնահատեց։';
        return res.json({ success: true, text: aiText });

    } catch (err) {
        console.error("AI Error:", err);
        return res.status(500).json({ success: false, error: 'Սերվերային սխալ AI հարցումը մշակելիս:' });
    }
});

// 2. ՀԻՇՈՂՈՒԹՅԱՆ ԲԱՆԿ (SAVE & HISTORY)
app.get('/api/history', (req, res) => {
    res.json({ success: true, history: historyStore });
});

app.post('/api/save', (req, res) => {
    const calculation = req.body;
    if (!calculation || !calculation.title) {
        return res.status(400).json({ success: false, error: 'Անվավեր տվյալներ:' });
    }

    const record = {
        id: Date.now(),
        ...calculation,
        createdAt: new Date().toISOString()
    };

    historyStore.unshift(record);
    res.json({ success: true, message: 'Հաշվարկը պահպանվել է հիշողության բանկում:', record });
});

// 3. FRONTEND INTERFACE
app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="hy">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Novessa Pro Max | Enterprise Suite</title>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root { --bg-base: #0c0916; --bg-card: #151126; --border-color: #3f326b; --accent-purple: #c084fc; --text-main: #f9fafb; --text-muted: #9ca3af; }
        body { font-family: 'Plus Jakarta Sans', sans-serif; background: var(--bg-base); color: var(--text-main); margin: 0; display: flex; min-height: 100vh; }
        .sidebar { width: 280px; background: var(--bg-card); border-right: 1px solid var(--border-color); padding: 24px 16px; display: flex; flex-direction: column; gap: 8px; }
        .nav-btn { padding: 12px 16px; border-radius: 10px; color: var(--text-muted); font-size: 14px; cursor: pointer; border: none; background: transparent; text-align: left; }
        .nav-btn.active, .nav-btn:hover { background: rgba(192, 132, 252, 0.15); color: var(--accent-purple); border: 1px solid var(--accent-purple); }
        .content { flex: 1; padding: 35px; }
        .page { display: none; }
        .page.active { display: block; }
        .card { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 16px; padding: 24px; margin-bottom: 20px; }
        input, select, textarea { width: 100%; padding: 12px; margin: 6px 0 12px 0; border-radius: 8px; border: 1px solid var(--border-color); background: #1e1938; color: white; box-sizing: border-box; }
        button.action-btn { width: 100%; padding: 14px; border-radius: 10px; border: none; background: linear-gradient(135deg, #7c3aed, #2563eb); color: white; font-weight: 600; cursor: pointer; }
        .result-box { margin-top: 15px; padding: 18px; background: #090612; border: 1px solid var(--border-color); border-radius: 10px; color: #c084fc; white-space: pre-wrap; }
    </style>
</head>
<body>
    <div class="sidebar">
        <h2 style="color:var(--accent-purple);">🚀 Novessa Core</h2>
        <button class="nav-btn active" data-page="calc">📊 Յունիթ-Էկոնոմիկա</button>
        <button class="nav-btn" data-page="ai">🤖 Իրական AI Copilot</button>
        <button class="nav-btn" data-page="history">🧠 Հիշողության Բանկ</button>
    </div>

    <div class="content">
        <div id="calc" class="page active">
            <div class="card">
                <h2>📊 Յունիթ-Էկոնոմիկա</h2>
                <input type="text" id="title" placeholder="Ապրանքի անվանում">
                <input type="number" id="price" placeholder="Վաճառքի գին (֏)">
                <input type="number" id="cost" placeholder="Ինքնարժեք (֏)">
                <button class="action-btn" id="runCalc">Հաշվարկել և Պահպանել</button>
                <div id="calcRes" class="result-box" style="display:none;"></div>
            </div>
        </div>

        <div id="ai" class="page">
            <div class="card">
                <h2>🤖 Իրական Gemini AI Copilot</h2>
                <textarea id="aiPrompt" placeholder="Գրեք ձեր հարցը AI-ին..."></textarea>
                <button class="action-btn" id="runAi">Ուղարկել AI-ին</button>
                <div id="aiRes" class="result-box" style="display:none;"></div>
            </div>
        </div>

        <div id="history" class="page">
            <div class="card">
                <h2>🧠 Հիշողության Բանկ</h2>
                <button class="action-btn" id="loadHist">Թարմացնել Պատմությունը</button>
                <div id="histRes" class="result-box" style="display:none;"></div>
            </div>
        </div>
    </div>

    <script>
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const page = btn.getAttribute('data-page');
                document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
                document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
                document.getElementById(page).classList.add('active');
                btn.classList.add('active');
            });
        });

        document.getElementById('runCalc').addEventListener('click', async () => {
            const title = document.getElementById('title').value || 'Ապրանք';
            const price = Number(document.getElementById('price').value) || 0;
            const cost = Number(document.getElementById('cost').value) || 0;
            const netProfit = price - cost;

            const data = { title, price, cost, netProfit };
            document.getElementById('calcRes').style.display = 'block';
            document.getElementById('calcRes').textContent = \`Շահույթ: \${netProfit} ֏\`;

            await fetch('/api/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        });

        document.getElementById('runAi').addEventListener('click', async () => {
            const prompt = document.getElementById('aiPrompt').value;
            const resBox = document.getElementById('aiRes');
            resBox.style.display = 'block';
            resBox.textContent = '⌛ Ուղարկվում է հարցումը Gemini API-ին...';

            try {
                const res = await fetch('/api/ai', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt })
                });
                const data = await res.json();
                if (data.success) {
                    resBox.textContent = data.text;
                } else {
                    resBox.textContent = '❌ Սխալ: ' + data.error;
                }
            } catch (err) {
                resBox.textContent = '❌ Սերվերի հետ կապի սխալ։';
            }
        });

        document.getElementById('loadHist').addEventListener('click', async () => {
            const resBox = document.getElementById('histRes');
            resBox.style.display = 'block';
            const res = await fetch('/api/history');
            const data = await res.json();
            resBox.textContent = JSON.stringify(data.history, null, 2);
        });
    </script>
</body>
</html>`);
});

app.listen(PORT, () => console.log(`🚀 Novessa Server running on port ${PORT}`));
