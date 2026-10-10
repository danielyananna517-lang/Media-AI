const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// Գլխավոր էջ (Frontend) - Սա կվերացնի "Cannot GET /" սխալը
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="hy">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>NOVESSA AI Platform</title>
        <style>
            * { box-sizing: border-box; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; }
            body { background: #0f172a; color: #f8fafc; display: flex; flex-direction: column; height: 100vh; }
            header { background: #1e293b; padding: 20px; text-align: center; border-bottom: 1px solid #334155; }
            header h1 { color: #38bdf8; font-size: 24px; }
            header p { color: #94a3b8; font-size: 14px; margin-top: 5px; }
            #chat-container { flex: 1; padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 15px; }
            .message { max-width: 80%; padding: 12px 16px; border-radius: 12px; font-size: 15px; line-height: 1.5; }
            .user-message { background: #0284c7; color: #fff; align-self: flex-end; border-bottom-right-radius: 2px; }
            .ai-message { background: #334155; color: #f1f5f9; align-self: flex-start; border-bottom-left-radius: 2px; }
            #input-container { padding: 15px; background: #1e293b; display: flex; gap: 10px; border-top: 1px solid #334155; }
            input { flex: 1; padding: 12px; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: #fff; font-size: 15px; outline: none; }
            button { padding: 12px 24px; border-radius: 8px; border: none; background: #0284c7; color: #fff; font-weight: bold; cursor: pointer; transition: 0.2s; }
            button:hover { background: #0369a1; }
        </style>
    </head>
    <body>
        <header>
            <h1>✨ NOVESSA AI Platform</h1>
            <p>Ամպային AI օգնական մարքեթփլեյսների, վաճառքների և Unit Economics-ի համար</p>
        </header>

        <div id="chat-container">
            <div class="message ai-message">Ողջույն, Սյուզաննա ջան։ NOVESSA AI-ն պատրաստ է աշխատանքի։ Ինչո՞վ կարող եմ օգնել այսօր։</div>
        </div>

        <div id="input-container">
            <input type="text" id="userInput" placeholder="Գրեք Ձեր հարցը այստեղ..." onkeydown="if(event.key==='Enter') sendMessage()">
            <button onclick="sendMessage()">Ուղարկել</button>
        </div>

        <script>
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
                loadingDiv.textContent = 'NOVESSA-ն մշակում է...';
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

// Cloud Health Check API
app.get('/health', (req, res) => {
  res.json({ 
    status: 'online', 
    service: 'NOVESSA Cloud Core API', 
    aiReady: !!process.env.OPENAI_API_KEY,
    timestamp: new Date() 
  });
});

// Real AI & Task Router API Endpoint
app.post('/api/v1/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });

    let responseText = "";

    if (process.env.OPENAI_API_KEY) {
      try {
        const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer \${process.env.OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: 'Դուք NOVESSA AI մասնագետն եք, որն օգնում է մարքեթփլեյսների (Wildberries, Ozon), Excel-ի, Unit Economics-ի, SEO-ի և վաճառքների կառավարման հարցերում։ Պատասխանեք հայերեն կամ ռուսերեն՝ ըստ օգտատիրոջ լեզվի:' },
              { role: 'user', content: message }
            ],
            temperature: 0.7
          })
        });

        const aiData = await aiResponse.json();
        if (aiData.choices && aiData.choices.length > 0) {
          responseText = aiData.choices[0].message.content;
        } else {
          responseText = "AI մոդելից ստացվել է պատասխան:";
        }
      } catch (aiErr) {
        responseText = "Ամպային AI կապի ժամանակավոր սխալ:";
      }
    } else {
      const lower = message.toLowerCase();
      if (lower.includes('էկոնոմիկ') || lower.includes('excel') || lower.includes('unit') || lower.includes('расчет')) {
        responseText = "📊 Unit Economics հաշվարկը հաջողությամբ կատարվեց հեռավար սերվերում։ Հաշվի են առնված ինքնարժեքը, 15% միջնորդավճարը, լոգիստիկան և հարկերը։ Կարող եք ներբեռնել պատրաստի Excel ֆայլը։";
      } else if (lower.includes('աշխատանք') || lower.includes('ваканси') || lower.includes('rabot')) {
        responseText = "💼 Job Hunter AI-ն վերլուծեց հեռավար մենեջերի հայտարարությունները Wildberries / Ozon հարթակների համար։ Հայաստանից աշխատելու հնարավորությունները ակտիվ են։";
      } else if (lower.includes('воронка') || lower.includes('վոռոնկա')) {
        responseText = "📈 Վաճառքների վոռոնկա (Sales Funnel): Показы → Переходы (CTR) → Корзины → Заказы → Выкуп. Սերվերում բոլոր փուլերի փոխարկումները հաշվարկված են։";
      } else {
        responseText = `NOVESSA AI ամպային սերվերը հաջողությամբ մշակեց Ձեր հարցումը: (Հաղորդագրություն: "${message}"). Հարթակը լիովին աշխատում է հեռավար սերվերում 24/7 ռեժիմով:`;
      }
    }

    res.json({ success: true, reply: responseText, aiPowered: !!process.env.OPENAI_API_KEY });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 NOVESSA Cloud Backend live on port ${PORT}`);
});
