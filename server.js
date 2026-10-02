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

        // Маскируемся под обычный браузер
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9',
        });

        let m3u8Url = null;

        // Перехватываем запросы со всей страницы и её iframe
        page.on('request', request => {
            const url = request.url();
            if ((url.includes('.m3u8') || url.includes('master.m3u8')) && !m3u8Url) {
                console.log('Найден m3u8:', url);
                m3u8Url = url;
            }
        });

        // Загружаем плеер
        await page.goto(`https://vidsrc.me/embed/movie/${tmdbId}`, {
            waitUntil: 'domcontentloaded',
            timeout: 20000
        }).catch(() => {});

        // Ожидаем отрисовки элементов и пытаемся кликнуть по центру (запуск воспроизведения)
        await new Promise(r => setTimeout(r, 3000));
        await page.mouse.click(640, 360).catch(() => {});
        
        // Ожидаем отправки сетевых запросов после клика
        await new Promise(r => setTimeout(r, 4000));

        await browser.close();

        if (m3u8Url) {
            return res.json({ url: m3u8Url });
        } else {
            return res.status(404).json({ 
                error: 'Поток m3u8 не перехвачен',
                tip: 'Возможно, плеер требует решения капчи или сменил структуру.'
            });
        }

    } catch (e) {
        if (browser) await browser.close();
        return res.status(500).json({ error: e.message });
    }
});

app.listen(PORT, () => {
    console.log(`Парсер запущен на порту ${PORT}`);
});
