//import {default as isReachable} from 'is-reachable';
import Binance from 'binance-api-node';
import {binance_keys, binance_secrets} from '../config.js';
import {MAX_ERROR_COUNT} from './constants.js';
import store from './store.js';
import helpers from '../helpers.js';
import mainStore from '../store.js';

//считаем вес всех запросов
setInterval(() => {
    for (let client in store) {
        if (client === 'weight') continue;
        store[client].requestList.forEach((x, i) => {
            if (x.time + 1000 * 60 <= Date.now()) {
                store[client].requestList.splice(i, 1);
            }
        });
    }

    //посчитаем общий вес всех запросов
    store.weight = Object.values(store).reduce((prev, cur) => {
        if (Array.isArray(cur?.requestList)) {
            prev += cur.requestList.reduce((_, __) => {
                _ += __.weight;
                return _;
            }, 0);
        }
        return prev;
    }, 0);

    //отправим в интерфейс
    Object.values(mainStore).forEach(x => x.wssClient && store.weight && x.wssClient.send(JSON.stringify({
        type: 'BinanceStore',
        event: 'setWeight',
        data: store.weight,
    })));

}, 1000);

async function actionWrapper(userKey, {fncName, params, weight}) {
    let errorCount = 0;
    while (1) {
        try {
            if (!store[userKey].client) {
                const s = userKey.slice(-5).toUpperCase();
                const [binance_key, binance_secret] = [binance_keys[s], binance_secrets[s]];
                store[userKey].client = Binance.default({
                    apiKey: binance_key,
                    apiSecret: binance_secret,
                    getTime: () => Date.now(),
                });
            }
            //проверим есть ли доступ к binance
            //await isReachable('https://api.binance.com/api/v3/ping');

            //если в течение 10 секунд не резолвится основной запрос, выбросим ошибку
            const result = await Promise.race(
                [
                    store[userKey].client[fncName](params),
                    new Promise((resolve, reject) => setTimeout(() => {
                        let error = new Error('Сеть недоступна!');
                        error.code = 'EAI_AGAIN';
                        reject(error);
                    }, 10000)),
                ]);
            store[userKey].requestList.push({weight, fncName, time: Date.now()});
            return result;
        } catch (error) {
            //нет доступа к сети
            if (error?.code === 'EAI_AGAIN') throw error;

            if (error.code === -1021) {
                //TODO может как то можно синхронизировать время?
            }

            errorCount++;
            if (errorCount > MAX_ERROR_COUNT) throw error;
            await helpers.sleep(500);
        }
    }
}

export const ping = userKey => {
    return actionWrapper(userKey, {fncName: 'ping', weight: 1});
};

export const time = userKey => {
    return actionWrapper(userKey, {fncName: 'time', weight: 1});
};

export const tradeFee = userKey => {
    return actionWrapper(userKey, {fncName: 'tradeFee', weight: 1});
};

export const capitalConfigs = userKey => {
    return actionWrapper(userKey, {fncName: 'capitalConfigs', weight: 1});
};

export const accountInfo = userKey => {
    return actionWrapper(userKey, {fncName: 'accountInfo', params: {recvWindow: 30000}, weight: 10});
};

export const exchangeInfo = userKey => {
    return actionWrapper(userKey, {fncName: 'exchangeInfo', weight: 10});
};

export const candles = (userKey, params) => {
    return actionWrapper(userKey, {fncName: 'candles', params, weight: 1});
};

export const book = (userKey, params) => {
    return actionWrapper(userKey, {fncName: 'book', params: {limit: 5, ...params}, weight: 1});
};

export const order = (userKey, params) => {
    return actionWrapper(userKey, {fncName: 'order', params: {...params, recvWindow: 30000}, weight: 1});
};

export const openOrders = (userKey, params) => {
    return actionWrapper(userKey, {fncName: 'openOrders', params: {...params, recvWindow: 30000}, weight: 1});
};

export const cancelOrder = (userKey, params) => {
    return actionWrapper(userKey, {fncName: 'cancelOrder', params: {...params, recvWindow: 30000}, weight: 1});
};

export const cancelOpenOrders = (userKey, params) => {
    return actionWrapper(userKey, {fncName: 'cancelOpenOrders', params, weight: 1});
};

export const myTrades = (userKey, params) => {
    return actionWrapper(userKey, {fncName: 'myTrades', params: {limit: 300, ...params, recvWindow: 30000}, weight: 5});
};

//TODO: сокет закрывается через какое то время, будем перезапускать по таймеру? (возможно из-за обрыва сети)
export const wsPartialDepth = userKey => {
    if (typeof store[userKey].ws.partialDepth === 'function') {
        store[userKey].ws.partialDepth();
        store[userKey].ws.partialDepth = null;
    }

    const prices = store[userKey].trading.reduce((prev, curr) => {
        prev.push({symbol: curr, level: 5});
        return prev;
    }, []);
    if (!prices.length) return;
    store[userKey].ws.partialDepth = store[userKey].client.ws.partialDepth(prices, data => {
        const symbol = store[userKey].symbols[data.symbol];
        if (symbol) {
            let price = (symbol.settings.strategy === 'Long') ? data.bids[0]['price'] : data.asks[0]['price'];
            symbol.price = helpers.truncated(price, symbol.meta.tickSize);

            //отправим данные в интерфейс
            mainStore?.[userKey]?.wssClient && mainStore?.[userKey]?.wssClient.send(JSON.stringify({
                type: 'BinanceStore',
                event: 'setPrice',
                data: {
                    symbol: data.symbol,
                    price: symbol.price,
                },
            }));
        }
    });
};
