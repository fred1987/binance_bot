import telegramBot from './telegram.js';
import {logger} from './logger.js';
import mainStore from './store.js';
import binanceStore from './binance/store.js';
import tinkoffStore from './tinkoff/store.js';

export const sendMessage = async (userKey, msg, condition = true) => {
    try {
        const telegramChatId = mainStore?.[userKey]?.telegramChatId;
        if (telegramChatId && condition) {
            await telegramBot.sendMessage(telegramChatId, msg);
        }
    } catch (error) {
        logger.error(error);
    }
};
