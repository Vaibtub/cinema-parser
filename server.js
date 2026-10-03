const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

const app = express();
app.use(cors());

const PORT = process.env.PORT || 10000;

app.get('/stream-rezka', async (req, res) => {
    // Принимаем прямую ссылку на фильм с HDRezka или поисковый запрос
    const movieUrl = req.query.url; 
    if (!movieUrl) {
        return res.status(400).json({ error: 'Укажите URL страницы фильма на HDRezka' });
    }

    let browser;
    try {
        browser = await puppeteer.launch({
            args: [
                ...chromium.args,
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-web-security'
            ],
            defaultViewport: { width: 1280, height: 720 },
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
        });

        const page = await browser.newPage();

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

        let m3u8Urls = [];

        // Перехватываем ответы от CDN и AJAX
        page.on('response', async response => {
            const url = response.url();
            
            // 1. Прямой перехват .m3u8
            if (url.includes('.m3u8')) {
                m3u8Urls.push(url);
            }

            // 2. Перехват зашифрованного ответа от AJAX HDRezka
            if (url.includes('/ajax/get_cdn_series/')) {
                try {
                    const json = await response.json();
                    if (json.url) {
                        // Сохраняем зашифрованный поток для отладки
                        console.log('Найден зашифрованный поток Резки:', json.url);
                    }
                } catch (e) {}
            }
        });

        // Заходим на страницу HDRezka
        await page.goto(movieUrl, {
            waitUntil: 'networkidle2',
            timeout: 25000
        }).catch(() => {});

        // Кликаем по плееру, чтобы спровоцировать расшифровку и запуск
        await new Promise(r => setTimeout(r, 2000));
        await page.mouse.click(640, 360).catch(() => {});
        await new Promise(r => setTimeout(r, 3000));

        // Если нужно посмотреть, заблокирован ли IP
        if (req.query.debug === 'true') {
            const imageBuffer = await page.screenshot({ type: 'png' });
            await browser.close();
            res.setHeader('Content-Type', 'image/png');
            return res.send(imageBuffer);
        }

        await browser.close();

        if (m3u8Urls.length > 0) {
            return res.json({ streams: m3u8Urls });
        } else {
            return res.status(404).json({ error: 'Поток HDRezka не перехвачен. Возможно, IP заблокирован.' });
        }

    } catch (e) {
        if (browser) await browser.close();
        return res.status(500).json({ error: e.message });
    }
});

app.listen(PORT, () => {
    console.log(`Парсер запущен на порту ${PORT}`);
});
