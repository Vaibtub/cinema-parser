const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');

const app = express();
app.use(cors());

const PORT = process.env.PORT || 10000;

app.get('/stream', async (req, res) => {
    const tmdbId = req.query.tmdb;
    if (!tmdbId) {
        return res.status(400).json({ error: 'Укажите tmdb ID' });
    }

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--single-process'
            ]
        });

        const page = await browser.newPage();
        let m3u8Url = null;

        // Перехват сетевых запросов .m3u8
        page.on('request', request => {
            const url = request.url();
            if (url.includes('.m3u8') && !m3u8Url) {
                m3u8Url = url;
            }
        });

        // Заходим на балансер VidSrc
        await page.goto(`https://vidsrc.me/embed/movie/${tmdbId}`, {
            waitUntil: 'networkidle2',
            timeout: 20000
        }).catch(() => {});

        if (!m3u8Url) {
            await new Promise(r => setTimeout(r, 3000));
        }

        await browser.close();

        if (m3u8Url) {
            return res.json({ url: m3u8Url });
        } else {
            return res.status(404).json({ error: 'Поток m3u8 не перехвачен' });
        }

    } catch (e) {
        if (browser) await browser.close();
        return res.status(500).json({ error: e.message });
    }
});

app.listen(PORT, () => {
    console.log(`Парсер запущен на порту ${PORT}`);
});
