const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

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
        // Указываем бинарник chromium из пакета
        browser = await puppeteer.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
        });

        const page = await browser.newPage();
        let m3u8Url = null;

        // Перехватываем ссылки на .m3u8
        page.on('request', request => {
            const url = request.url();
            if (url.includes('.m3u8') && !m3u8Url) {
                m3u8Url = url;
            }
        });

        // Заходим на балансер
        await page.goto(`https://vidsrc.me/embed/movie/${tmdbId}`, {
            waitUntil: 'networkidle2',
            timeout: 25000
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
