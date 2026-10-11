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
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
    <script src="https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
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

        .home-card {
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 16px;
            overflow: hidden;
            cursor: pointer;
            transition: all 0.2s;
            box-shadow: 0 12px 35px rgba(12, 9, 22, 0.6);
            display: flex;
            flex-direction: column;
        }
        .home-card:hover {
            border-color: var(--accent-purple);
            transform: translateY(-3px);
        }
        .home-card img {
            width: 100%;
            height: 160px;
            object-fit: cover;
            border-bottom: 1px solid var(--border-color);
        }
        .home-card-body { padding: 20px; }

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

    <div class="sidebar">
        <div class="logo">🚀 Novessa Pro Max</div>
        <button class="nav-btn active" onclick="switchPage('home')">🏠 Գլխավոր (Dashboard)</button>
        <button class="nav-btn" onclick="switchPage('masterCalc')">📊 Յունիթ, Լոգիստիկա & Export</button>
        <button class="nav-btn" onclick="switchPage('stockPredictor')">📦 Stock-Out Predictor</button>
        <button class="nav-btn" onclick="switchPage('cardStudio')">🎨 Card Studio & Background</button>
        <button class="nav-btn" onclick="switchPage('funnelAndAd')">📉 Վաճառքի Ձագար & AD Test</button>
        <button class="nav-btn" onclick="switchPage('seoStudio')">✍️ SEO & Keywords
