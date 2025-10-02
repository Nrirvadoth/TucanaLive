require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const puppeteer = require('puppeteer');

const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const TARGET_URL = process.env.TARGET_URL;

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  partials: [Partials.Channel]
});

function getParisTime() {
  const now = new Date();
  return now.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris'
  });
}

async function fetchMilitaryRankingWithPuppeteer() {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  await page.goto(TARGET_URL, {
    waitUntil: 'networkidle2',
    timeout: 30000
  });

  // Clique sur l’onglet MD/ML
  await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a, button, span'));
    for (const el of links) {
      const txt = el.textContent.trim().toLowerCase();
      if (txt === 'md/ml' || txt.includes('md/ml')) {
        el.click();
        break;
      }
    }
  });

  // Attente que le contenu MD/ML soit visible
  await page.waitForSelector('#a1a1a1 .gridcontainer_live', { timeout: 15000 });
  await new Promise(resolve => setTimeout(resolve, 1000)); // petit délai pour le rendu

  const players = await page.evaluate(() => {
    const container = document.querySelector('#a1a1a1 .gridcontainer_live');
    if (!container) return [];

    const spans = Array.from(container.querySelectorAll('span'));
    const results = [];

    for (let i = 0; i < spans.length; i++) {
      const span = spans[i];
      const cls = span.className;

      if (cls && (cls.includes('top_color') || cls.includes('flop_color'))) {
        const points = span.textContent.trim();

        // Trouver pseudo (.Style9) dans les éléments suivants
        let pseudo = 'Inconnu';
        for (let j = i + 1; j < spans.length; j++) {
          const container = spans[j];
          const tooltip = container.querySelector('.tooltiptext .Style9');
          const visible = container.querySelector('.Style9');

          if (tooltip) {
            pseudo = tooltip.textContent.trim(); // nom complet dans le tooltip
            break;
          } else if (visible) {
            pseudo = visible.textContent.trim(); // pseudo visible (court)
            break;
          }
        }

        // Trouver le dernier .Style8topflop non vide dans les suivants
        let alliance = '';
        for (let j = i + 1; j < spans.length; j++) {
          const allianceSpans = spans[j].querySelectorAll('.Style8topflop');
          if (allianceSpans.length > 0) {
            for (let k = allianceSpans.length - 1; k >= 0; k--) {
              const text = allianceSpans[k].textContent.trim();
              if (text) {
                alliance = text;
                break;
              }
            }
            break;
          }
        }

        results.push({ pseudo, alliance, points });
      }
    }

    return results;
  });

  await browser.close();
  return players;
}

async function postMilitaryRanking(channel) {
  try {
    const data = await fetchMilitaryRankingWithPuppeteer();

    if (!data || data.length === 0) {
      await channel.send('⚠️ Aucune donnée militaire trouvée ou parsing MD/ML échoué.');
      return;
    }

    const top = data.filter(d => d.points.startsWith('+')).slice(0, 10);
    const flop = data.filter(d => d.points.startsWith('-')).slice(0, 10);
    const heureParis = getParisTime();

    let message = `🛡️ **Update de ${heureParis}**\n\n`;

    message += `📈 **Top** :\n`;
    top.forEach(({ pseudo, alliance, points }, i) => {
      message += `**${i + 1}.** **${pseudo}** ${alliance} : *${points}*\n`;
    });

    message += `\n📉 **Flop** :\n`;
    flop.forEach(({ pseudo, alliance, points }, i) => {
      message += `**${i + 1}.** **${pseudo}** ${alliance} : *${points}*\n`;
    });

    await channel.send(message);

  } catch (err) {
    console.error('Erreur postMilitaryRanking :', err);
    await channel.send('❌ Erreur lors de la récupération des données MD/ML.');
  }
}

client.once('ready', async () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);
  const channel = await client.channels.fetch(CHANNEL_ID);

  await postMilitaryRanking(channel);

  function scheduleHourlyTask(taskFn) {
    const now = new Date();
    const delayUntilNextHour =
      (60 - now.getMinutes()) * 60 * 1000 -
      now.getSeconds() * 1000 -
      now.getMilliseconds();

    setTimeout(() => {
      taskFn(); // première exécution à l’heure pile
      setInterval(taskFn, 60 * 60 * 1000); // ensuite toutes les heures
    }, delayUntilNextHour);
  }

  scheduleHourlyTask(() => postMilitaryRanking(channel));
});

// --- Serveur HTTP minimal pour keep-alive ---

const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('OK');
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Serveur HTTP keep-alive lancé sur le port ${PORT}`);
});

client.login(TOKEN);
