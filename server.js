const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// Main Page
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="hy">
<head>
    <meta charset="UTF-8">
    <title>NOVESSA AI Platform</title>
    <style>
        body { background: #0f172a; color: #fff; font-family: Arial, sans-serif; text-align: center; padding-top: 50px; }
        h1 { color: #38bdf8; }
        p { color: #94a3b8; font-size: 18px; }
    </style>
</head>
<body>
    <h1>✨ NOVESSA AI Platform Live!</h1>
    <p>Հարթակն հաջողությամբ միացված է և աշխատում է։</p>
</body>
</html>`);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'online', time: new Date() });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
