import {evaluate} from 'mathjs';
import helpers from '../../../helpers.js';
import {
    book,
    //wsPartialDepth,
    capitalConfigs,
} from '../../actions.js';
import {getSymbolInfo, stopTrade, setGridOrders} from './functions.js';
import store from '../../store.js';
import mainStore from '../../../store.js';
import {circle} from './circle.js';
import {sendMessage} from '../../../utils.js';

export const binance_start = async (userKey, {altCoin, baseCoin, settings}) => {
    const symbol = `${altCoin}${baseCoin}`;
    const {strategy} = settings;
    const math_operation = strategy === 'Long' ? '+' : '-';

    let currentPrice = null; // текущая цена

    //проверим текущий баланс
    try {
        const capital = await capitalConfigs(userKey);
        const baseQuantity = capital.find(x => x.coin === baseCoin)?.free;
        const altQuantity = capital.find(x => x.coin === altCoin)?.free;
        if ((baseQuantity && strategy === 'Long' && baseQuantity < settings.limitDeposit) || (altQuantity && strategy === 'Short' && altQuantity < settings.limitDeposit)) {
            mainStore?.[userKey]?.wssClient && mainStore?.[userKey]?.wssClient.send(JSON.stringify({
                type: 'NoticeStore',
                event: 'message',
                data: {
                    msg: `Недостаточно депозита на счете. Необходимо ${settings.limitDeposit}${strategy === 'Long' ? baseCoin : altCoin}. На счете ${strategy === 'Long' ? baseQuantity : altQuantity}`,
                    type: 'warning',
                    duration: 5000,
                },
            }));
            return;
        }
    } catch (error) {
        throw error;
    }

    try {
        //данные о торговой паре
        await getSymbolInfo(userKey, {altCoin, baseCoin});
        store[userKey].symbols[symbol].settings = settings;
    } catch (error) {
        throw error;
    }

    try {
        //текущая цена
        const prices = await book(userKey, {symbol});
        currentPrice = (strategy === 'Long') ? prices.bids[0].price : prices.asks[0].price;
    } catch (error) {
        throw error;
    }

    //цена при которой произойдет перестановка ордеров согласно настройкам RELOAD
    store[userKey].symbols[symbol]['reload'] = helpers.truncated(
        evaluate(`${currentPrice} ${math_operation} ${currentPrice} * ${settings.reload} / 100`),
        store[userKey].symbols[symbol].meta.tickSize,
    );

    //цена при которой торги прекратятся (PUMP/DUMP)
    if (settings.prepump) {
        store[userKey].symbols[symbol]['priceStop'] = helpers.truncated(
            evaluate(`${currentPrice} ${math_operation} ${currentPrice} * ${settings.prepump} / 100`),
            store[userKey].symbols[symbol].meta.tickSize,
        );
    }

    //websocket для получения цен
    //wsPartialDepth(userKey);

    try {
        //выставим первые ордера
        await setGridOrders(userKey, {currentPrice, symbol});

        //отправим данные о новой торгуемой паре в интерфейс
        mainStore?.[userKey]?.wssClient && mainStore?.[userKey]?.wssClient.send(JSON.stringify({
            type: 'BinanceStore',
            event: 'setTrading',
            data: {
                symbol,
                data: store[userKey].symbols[symbol],
            },
        }));

        //запустим цикл
        circle(userKey, symbol);

        //интерфейс
        mainStore?.[userKey]?.wssClient && mainStore?.[userKey]?.wssClient.send(JSON.stringify({
            type: 'NoticeStore',
            event: 'message',
            data: {
                msg: 'Алгоритм успешно запущен',
                type: 'success',
            },
        }));

        //telegram уведомление
        await sendMessage(userKey, `${symbol}:${strategy} бот стартовал!`);
    } catch (error) {
        await stopTrade(userKey, symbol);
        throw error;
    }
};

