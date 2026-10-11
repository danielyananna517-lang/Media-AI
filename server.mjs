import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Հիմնական տնային էջը
app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="hy">
<head>
    <meta charset="UTF-8">
    <title>Novessa Pro Max</title>
    <style>
        body { font-family: sans-serif; background: #0c0916; color: white; padding: 40px; display: flex; justify-content: center; }
        .card { background: #151126; border: 1px solid #3f326b; padding: 30px; border-radius: 16px; width: 100%; max-width: 400px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        input, button { width: 100%; padding: 12px; margin: 8px 0; border-radius: 8px; box-sizing: border-box; border: 1px solid #3f326b; background: #1e1938; color: white; font-size: 14px; }
        button { background: linear-gradient(135deg, #7c3aed, #2563eb); border: none; cursor: pointer; font-weight: bold; }
    </style>
</head>
<body>
    <div class="card">
        <h2>🚀 Novessa Core</h2>
        <p style="color: #9ca3af; font-size: 13px;">համակարգը հաջողությամբ միացված է։</p>
        <input type="number" id="price" placeholder="Վաճառքի գին (֏)">
        <input type="number" id="cost" placeholder="Ինքնարժեք (֏)">
        <button onclick="calc()">Հաշվարկել Շահույթը</button>
        <h3 id="res" style="color: #c084fc; margin-top: 15px;"></h3>
    </div>
    <script>
        function calc() {
            let p = Number(document.getElementById('price').value) || 0;
            let c = Number(document.getElementById('cost').value) || 0;
            document.getElementById('res').textContent = 'Մաքուր շահույթ: ' + (p - c) + ' ֏';
        }
    </script>
</body>
</html>`);
});

app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});
