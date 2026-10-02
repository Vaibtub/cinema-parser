const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

const app = express();
app.use(cors());

const PORT = process.env.PORT || 10000;

app.get('/stream', async (req, res) => {
    const tmdbId = req.query.tmdb || 'tt1300854';

    let browser;
    try {
        browser = await puppeteer.launch({
            args: [
                ...chromium.args,
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process'
            ],
            defaultViewport: { width: 1280, height: 720 },
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
        });

        const page = await browser.newPage();

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

        // Загружаем плеер VidSrc
        await page.goto(`https://vidsrc.sh/embed/movie/${tmdbId}`, {
            waitUntil: 'networkidle2',
            timeout: 25000
        }).catch(() => {});

        // Ждем 3 секунды, чтобы всё отрисовалось
        await new Promise(r => setTimeout(r, 3000));

        // 📸 ДЕЛАЕМ СКРИНШОТ В ПАМЯТЬ
        const imageBuffer = await page.screenshot({ type: 'png' });

        await browser.close();

        // Отправляем картинку прямо в браузер
        res.setHeader('Content-Type', 'image/png');
        return res.send(imageBuffer);

    } catch (e) {
        if (browser) await browser.close();
        return res.status(500).json({ error: e.message });
    }
});

app.listen(PORT, () => {
    console.log(`Парсер запущен на порту ${PORT}`);
});
