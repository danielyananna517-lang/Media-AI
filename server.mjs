import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Հիշողության պահեստ
let historyDB = [];

// AI Endpoint
app.post('/api/ai', async (req, res) => {
    try {
        const { prompt, apiKey } = req.body;
        const activeApiKey = process.env.GEMINI_API_KEY || apiKey;

        if (!prompt) {
            return res.status(400).json({ success: false, error: 'Հարցը բացակայում է:' });
        }
        if (!activeApiKey) {
            return res.status(400).json({ success: false, error: 'GEMINI_API_KEY-ն կարգավորված չէ:' });
        }

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${activeApiKey}`;
        
        const response = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: `Դուք Novessa Pro Max e-commerce խորհրդատուն եք։ Պատասխանեք պրոֆեսիոնալ և հստակ՝ հայերեն․ ${prompt}` }] }]
            })
        });

        const data = await response.json();
        if (!response.ok) {
            return res.status(response.status).json({ success: false, error: data.error?.message || 'AI սխալ:' });
        }

        const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Պատասխան չստացվեց։';
        return res.json({ success: true, text: aiText });

    } catch (err) {
        console.error("AI Error:", err);
        return res.status(500).json({ success: false, error: 'Սերվերային սխալ:' });
    }
});

// Պատմություն և պահպանում
app.get('/api/history', (req, res) => {
    res.json({ success: true, history: historyDB });
});

app.post('/api/save', (req, res) => {
    const data = req.body;
    if (!data) return res.status(400).json({ success: false, error: 'Տվյալներ չկան:' });
    historyDB.unshift({ ...data, date: new Date().toLocaleDateString(), id: Date.now() });
    res.json({ success: true, message: "Հաջողությամբ պահպանվեց:" });
});

// Հիմնական UI (Novessa Pro Dashboard)
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
            --bg-base: #0c0916; --bg-card: #151126; --bg-input: #1e1938;
            --border-color: #3f326b; --accent-purple: #c084fc; --accent-blue: #38bdf8;
            --text-main: #f9fafb; --text-muted: #9ca3af;
        }
        body { font-family: 'Plus Jakarta Sans', sans-serif; background: var(--bg-base); color: var(--text-main); margin: 0; padding: 30px; display: flex; justify-content: center; }
        .container { width: 100%; max-width: 650px; }
        .logo { font-size: 24px; font-weight: 700; background: linear-gradient(135deg, #c084fc, #38bdf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 24px; text-align: center; }
        .card { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 16px; padding: 24px; margin-bottom: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        h2 { font-size: 18px; margin-top: 0; color: var(--accent-purple); }
        label { font-size: 12px; color: var(--text-muted); display: block; margin-top: 10px; font-weight: 600; }
        input, select, textarea { width: 100%; padding: 12px; margin-top: 5px; border-radius: 10px; border: 1px solid var(--border-color); background: var(--bg-input); color: var(--text-main); box-sizing: border-box; font-size: 14px; outline: none; }
        input:focus, select:focus, textarea:focus { border-color: var(--accent-purple); }
        button { width: 100%; padding: 14px; margin-top: 15px; border-radius: 10px; border: none; background: linear-gradient(135deg, #7c3aed, #2563eb); color: white; font-weight: 600; font-size: 15px; cursor: pointer; transition: opacity 0.2s; }
        button:hover { opacity: 0.9; }
        .result { margin-top: 15px; padding: 15px; background: #090612; border: 1px solid var(--border-color); border-radius: 10px; color: #c084fc; font-weight: 500; font-size: 14px; white-space: pre-wrap; line-height: 1.5; display: none; }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">🚀 Novessa Pro Max Enterprise Suite</div>

        <!-- Յունիթ Հաշվիչ -->
        <div class="card">
            <h2>📊 Մաստեր Յունիթ-Էկոնոմիկա</h2>
            <label>Ապրանքի Անվանում</label>
            <input type="text" id="productTitle" placeholder="օր.՝ Կանացի պայուսակ">
            <div style="display: flex; gap: 10px;">
                <div style="flex:1;"><label>Վաճառքի Գին (֏)</label><input type="number" id="price" placeholder="10000"></div>
                <div style="flex:1;"><label>Ինքնարժեք (֏)</label><input type="number" id="cost" placeholder="3000"></div>
            </div>
            <button onclick="calculateUnit()">Հաշվարկել Շահույթը</button>
            <div id="unitResult" class="result"></div>
        </div>

        <!-- AI Copilot -->
        <div class="card">
            <h2>🤖 Gemini AI Copilot</h2>
            <textarea id="aiPrompt" rows="3" placeholder="Հարցրեք վաճառքների, SEO-ի կամ ռազմավարության մասին..."></textarea>
            <button onclick="askAI()">Ուղարկել AI-ին</button>
            <div id="aiResult" class="result"></div>
        </div>
    </div>

    <script>
        function calculateUnit() {
            let title = document.getElementById('productTitle').value || 'Ապրանք';
            let p = Number(document.getElementById('price').value) || 0;
            let c = Number(document.getElementById('cost').value) || 0;
            let profit = p - c;
            let margin = p > 0 ? ((profit / p) * 100).toFixed(1) : 0;

            let res = document.getElementById('unitResult');
            res.style.display = 'block';
            res.textContent = "Ապրանք: " + title + "\\n• Մաքուր շահույթ: " + profit + " ֏\\n• Մարժա: " + margin + "%";

            // Պահպանում ենք բանկում
            fetch('/api/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, netProfit: profit, margin })
            });
        }

        async function askAI() {
            let prompt = document.getElementById('aiPrompt').value;
            let res = document.getElementById('aiResult');
            if (!prompt) return;
            res.style.display = 'block';
            res.textContent = "⌛ Մտածում է...";

            try {
                let response = await fetch('/api/ai', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt })
                });
                let data = await response.json();
                res.textContent = data.text || data.error || 'Պատասխան չկա։';
            } catch (err) {
                res.textContent = '❌ Սխալ կապի ժամանակ։';
            }
        }
    </script>
</body>
</html>`);
});

app.listen(PORT, () => {
    console.log(`🚀 Novessa Server running on port ${PORT}`);
});
