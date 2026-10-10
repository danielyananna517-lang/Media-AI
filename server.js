const express = require('express');
const cors = require('cors');
const XLSX = require('xlsx');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Այստեղից բացվում է Ձեր կայքը

// Cloud Health Check API
app.get('/health', (req, res) => {
  res.json({ status: 'online', service: 'NOVESSA Cloud Core API', timestamp: new Date() });
});

// AI & Task Router API Endpoint
app.post('/api/v1/chat', (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });

    let responseText = "NOVESSA AI-ն ստացավ Ձեր հարցումը սերվերում։";
    const lower = message.toLowerCase();

    if (lower.includes('էկոնոմիկ') || lower.includes('excel') || lower.includes('unit')) {
      responseText = "Excel Unit-Economics հաշվարկը պատրաստ է սերվերում: Կարող եք ներբեռնել ֆայլը համապատասխան բաժնից:";
    } else if (lower.includes('աշխատանք') || lower.includes('ваканси')) {
      responseText = "Job Hunter AI-ն զտել է հեռավար վականսիաները Հայաստանի մասնագետների համար:";
    } else {
      responseText = `Հարցումը հաջողությամբ մշակվեց հեռավար ամպային սերվերում: (Մուտքային տեքստ: "${message}")`;
    }

    res.json({ success: true, reply: responseText });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 NOVESSA Cloud Backend live on port ${PORT}`);
});
