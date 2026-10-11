import express from 'express';

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="hy">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Novessa Pro Max | Marketplace Dashboard</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 20px; }
        .container { max-width: 900px; margin: 0 auto; background: #1e293b; padding: 30px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
        h1 { color: #38bdf8; text-align: center; margin-bottom: 5px; }
        .subtitle { text-align: center; color: #94a3b8; margin-bottom: 30px; font-size: 14px; }
        .section { margin-top: 25px; padding: 20px; background: #334155; border-radius: 8px; border-left: 4px solid #38bdf8; }
        h2 { font-size: 18px; margin-top: 0; color: #f1f5f9; }
        input, button { padding: 12px; margin: 8px 0; width: 100%; border-radius: 6px; border: 1px solid #475569; background: #1e293b; color: white; box-sizing: border-box; font-size: 14px; }
        button { background: #0284c7; cursor: pointer; font-weight: bold; transition: background 0.2s; }
        button:hover { background: #0ea5e9; }
        .result-box { margin-top: 12px; padding: 12px; background: #0f172a; border-radius: 6px; color: #38bdf8; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Novessa Pro Max</h1>
        <div class="subtitle">Wildberries & Ozon Analytics, Unit Economics & SEO Platform</div>
        
        <div class="section">
            <h2>📊 Յունիթ Էկոնոմիկայի Հաշվիչ (Unit Economics)</h2>
            <input type="number" id="price" placeholder="Վաճառքի գին (₽)">
            <input type="number" id="cost" placeholder="Ապրանքի ինքնարժեք (₽)">
            <input type="number" id="logistics" placeholder="Հանձնաժողով և լոգիստիկա (%) (օր.՝ 30)">
            <button onclick="calculate()">Հաշվարկել Մաքուր Շահույթը</button>
            <div id="result" class="result-box" style="display:none;"></div>
        </div>

        <div class="section">
            <h2>✨ SEO Վերնագրերի և Բանալի բառերի գեներատոր</h2>
            <input type="text" id="productName" placeholder="Մուտքագրեք ապրանքի անունը (օր.՝ կանացի ամառային շորտեր)">
            <button onclick="generateSEO()">Գեներատոր SEO Վերնագիր</button>
            <div id="seoResult" class="result-box" style="display:none;"></div>
        </div>
    </div>

    <script>
        function calculate() {
            let p = parseFloat(document.getElementById('price').value) || 0;
            let c = parseFloat(document.getElementById('cost').value) || 0;
            let l = parseFloat(document.getElementById('logistics').value) || 0;
            
            let commissionAndLog = p * (l / 100);
            let profit = p - c - commissionAndLog;
            let roi = c > 0 ? ((profit / c) * 100).toFixed(1) : 0;
            
            let resDiv = document.getElementById('result');
            resDiv.style.display = 'block';
            resDiv.innerHTML = \`Մաքուր շահույթ: \${profit.toFixed(1)} ₽ | ROI: \${roi}%\`;
        }

        function generateSEO() {
            let name = document.getElementById('productName').value;
            if(!name) return;
            let resDiv = document.getElementById('seoResult');
            resDiv.style.display = 'block';
            resDiv.innerHTML = \`Օպտիմիզացված Վերնագիր: \${name} - թրենդային, նորաոճ, բարձր որակի, հարմարավետ WB և Ozon-ի համար\`;
        }
    </script>
</body>
</html>`);
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
