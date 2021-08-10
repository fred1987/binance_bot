import {readFileSync} from 'fs';
import {createServer} from 'https';
import Binance from 'binance-api-node';
import {default as WebSocket} from 'ws';
import isEmpty from 'lodash/isEmpty.js';
import cloneDeep from 'lodash/cloneDeep.js';
import DB from './lowdb.js';
import actions from './actions.js';
import binanceStore from './binance/store.js';
import tinkoffStore from './tinkoff/store.js';
import mainStore from './store.js';
import {logger} from './logger.js';
import telegramBot from './telegram.js';
import {circle} from './binance/trading/netter/circle.js';
import {binance_keys, binance_secrets} from './config.js';
import helpers from './helpers.js';
import {sendMessage} from './utils.js';
//import {wsPartialDepth} from './binance/actions.js';

//подключаем ключевые функции, вызываемые через wss
const DF = {
    ...await import('./binance/trading/netter/calculator.js'),
    ...await import('./binance/trading/netter/functions.js'),
    ...await import('./binance/trading/netter/start.js'),
};

const server = new createServer({
    cert: readFileSync('/etc/letsencrypt/live/ifred.ru/fullchain.pem'),
    key: readFileSync('/etc/letsencrypt/live/ifred.ru/privkey.pem'),
});

const wss = new WebSocket.Server({server});

//при запуске заберем из БД необходимые данные
await DB.read();
if (!isEmpty(DB.data)) {
    Object.entries(DB.data).forEach(async ([userKey, value]) => {
        const data = cloneDeep(value);
        if (data?.mainStore) mainStore[userKey] = {...data.mainStore, wssClient: null};
        if (data?.binanceStore) {
            const s = userKey.slice(-5).toUpperCase();
            const [binance_key, binance_secret] = [binance_keys[s], binance_secrets[s]];
            binanceStore[userKey] = {
                ...data.binanceStore,

                //добавим недостающие свойства
                client: Binance.default({
                    apiKey: binance_key,
                    apiSecret: binance_secret,
                    getTime: () => Date.now(),
                }),
                ws: {partialDepth: null},
                requestList: [],
                get trading() {
                    return Object.keys(this.symbols);
                },
            };

            //установим ссылки для БД
            DB.data[userKey].binanceStore = {
                symbols: binanceStore[userKey].symbols,
                limits: binanceStore[userKey].limits,
                telegram: binanceStore[userKey].telegram,
            };
        }

        //уведомление, что сервер снова в сети
        await sendMessage(userKey, `Сервер в сети.`);

        //если велась торговля до перезапуска, возобновим
        if (!isEmpty(binanceStore[userKey]?.symbols)) {

            //цены для торговых пар
            //wsPartialDepth(userKey);

            //запустим циклы
            Object.keys(binanceStore[userKey]?.symbols).forEach(symbol => circle(userKey, symbol));

            //уведомление о перезапуске алгоритмов
            await sendMessage(userKey, `Торговые алгоритмы перезапущены.`);
        }
    });
}

wss.on('connection', async ws => {
    ws.on('message', async msg => {
        const data = JSON.parse(msg);
        if (data?.userKey) {
            //кинем ошибку если не отправили тип события
            if (!data?.type) {
                ws.send(JSON.stringify({
                    type: 'NoticeStore',
                    event: 'message',
                    data: {
                        msg: 'Необходим тип вызываемого события',
                        type: 'error',
                    },
                }));
                return;
            }
            if (data.type === 'action') {
                if (data.event in actions) await actions[data.event](data.userKey, data?.data || null);
            } else if (data.type === 'init') {
                let is_DB_write = false;

                //создаем экземпляр сокета для пользователя
                if (!mainStore[data.userKey]) {
                    mainStore[data.userKey] = {
                        wssClient: ws,
                        telegramChatId: null,
                    };

                    if (!DB.data[data.userKey]) DB.data[data.userKey] = {};
                    DB.data[data.userKey].mainStore = {telegramChatId: null};
                    is_DB_write = true;
                } else {
                    mainStore[data.userKey].wssClient = ws;
                }

                if (!binanceStore[data.userKey]) {
                    binanceStore[data.userKey] = {
                        client: null,
                        ws: {
                            partialDepth: null, // сокет текущих цен
                        },
                        requestList: [], //запросы за последнюю минуту
                        get trading() { //торгующиеся пары
                            return Object.keys(this.symbols);
                        },
                        symbols: {}, //данные по торговым парам
                        limits: { //лимиты по запросам и ордерам
                            requestWeight: null,
                            ordersPerSecond: null,
                            ordersPerDay: null,
                        },
                        telegram: {
                            notifications: ['profit', 'stopLoss', 'stopTrade'], //profit, stopLoss, stopTrade
                        },
                    };

                    //установим ссылки для БД
                    DB.data[data.userKey].binanceStore = {
                        symbols: binanceStore[data.userKey].symbols,
                        limits: binanceStore[data.userKey].limits,
                        telegram: binanceStore[data.userKey].telegram,
                    };

                    is_DB_write = true;
                }

                is_DB_write && await DB.write();

                //если есть торгуемые пары, то отправим данные в интерфейс
                if (data.userKey in binanceStore) {
                    Object.values(binanceStore[data.userKey].symbols).forEach(x => {
                        const symbol = `${x.settings.altCoin}${x.settings.baseCoin}`;
                        ws.send(JSON.stringify({
                            type: 'BinanceStore',
                            event: 'setTrading',
                            data: {symbol, data: binanceStore[data.userKey].symbols[symbol]},
                        }));
                    });
                }
            } else {
                if (!data?.event) {
                    ws.send(JSON.stringify({
                        type: 'NoticeStore',
                        event: 'message',
                        data: {
                            msg: 'Необходимо название вызываемого события',
                            type: 'error',
                        },
                    }));
                    return;
                }
                try {
                    const res = await DF[`${data.type}_${data.event}`](data.userKey, data?.data || null);
                    res && ws.send(JSON.stringify(res));
                } catch (error) {
                    logger.error(error);
                    ws.send(JSON.stringify({
                        type: 'NoticeStore',
                        event: 'message',
                        data: {
                            msg: `${error.message} ${error.code ? 'CODE ' + error.code : ''}`.trim(),
                            type: 'error',
                            duration: 5000,
                        },
                    }));
                }
            }
        } else {
            ws.send(JSON.stringify({
                type: 'NoticeStore',
                event: 'message',
                data: {
                    msg: 'Необходим идентификационный ключ пользователя!',
                    type: 'error',
                    duration: 5000,
                },
            }));
        }
    });

    ws.on('close', code => {
        //const user = Object.entries(mainStore).filter(([key, value]) => value?.wssClient?.['_readyState'] === 3);
        const user = Object.entries(mainStore).filter(([key, value]) => value?.wssClient === ws);
        const id = user?.[0]?.[0];
        if (id && id in mainStore) mainStore[id].wssClient = null;
    });
});

telegramBot.on('polling_error', error => {
    if (error?.code === 'EFATAL') {
        //похоже пропала сеть
    } else {
        logger.error(error);
    }
});

telegramBot.on('message', async msg => {
    try {
        let user_key = null;

        //попробуем найти пользователя в нашем сторе
        const user = Object.entries(mainStore).filter(([key, value]) => value?.telegramChatId === msg.chat.id);

        if (Array.isArray(user) && user.length) {
            user_key = user?.[0]?.[0];
        }

        // если не нашли -> проинициализируем
        if (!user_key && msg.text.startsWith('init::')) {
            user_key = msg.text.split('::')[1];

            if (mainStore[user_key]) {
                //сохраним id чата
                mainStore[user_key].telegramChatId = DB.data[user_key].mainStore.telegramChatId = msg.chat.id;

                //запишем в БД
                await DB.write();

                //отправим сообщение в телеграм об инициализации
                await sendMessage(user_key, `Спасибо! Бот инициализирован!`);
            }
        }

        if (!user_key) return;

        //types: B -> Binance, T - Tinkoff
        const [type, command, data] = msg.text.split('::').map(x => x.trim());
        if (type === 'B' && binanceStore?.[user_key]) {
            switch (command) {
                case 'notifications':
                    //сохраним в сторе
                    binanceStore[user_key].telegram.notifications = data.split(',').map(x => x.trim());

                    //запишем в БД
                    await DB.write();

                    //отправим уведомление о записи
                    await sendMessage(user_key, `Спасибо! Уведомления ${data} подключены!`);
                    break;
                case 'check':
                    const symbol = data.toUpperCase().trim();
                    const symbolData = binanceStore?.[user_key]?.symbols?.[symbol];
                    if (symbolData) {
                        const {meta, profitOrderData, altCoin, baseCoin, price, grid} = symbolData;
                        const profit = profitOrderData
                            ? ` Профитный ордер - ${helpers.truncated(profitOrderData.origQty, meta.stepSize)}${altCoin}  по цене ${helpers.truncated(profitOrderData.price, meta.tickSize)}${baseCoin}.`
                            : '';
                        const gridData = symbolData.grid.length
                            ? ` Ордера в гриде - ${grid.map(x => helpers.truncated(x.origQty) + altCoin + ' по цене ' + helpers.truncated(x.price, meta.tickSize) + baseCoin).join(', ')}.`
                            : '';
                        await sendMessage(user_key, `${symbol}. Текущая цена - ${price}.${profit}${gridData}`);
                    } else {
                        await sendMessage(user_key, `${symbol} не торгуется.`);
                    }
                    break;
                case 'stop':
                    if ('binance_setStop' in DF) {
                        await DF.binance_setStop(user_key, {symbol: data.trim(), isStopped: true});
                        await sendMessage(user_key, `Флаг остановки торговли по паре ${data.trim()} установлен.`);
                    }
                    break;
                default:
                    await sendMessage(user_key, `Неизвестная команда.`);
            }
        } else if (type === 'T' && tinkoffStore?.[user_key]) {

        }
    } catch (error) {
        logger.error(error);
    }
});

server.listen(9000);
