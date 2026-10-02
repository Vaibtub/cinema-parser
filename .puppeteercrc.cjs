const { join } = require('path');

/**
 * Указываем Puppeteer скачивать Chrome прямо в папку проекта,
 * чтобы Render не удалял его из системного кэша.
 */
module.exports = {
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
