import {evaluate} from 'mathjs';
import DB from '../../../lowdb.js';
import helpers from '../../../helpers.js';
import store from '../../store.js';
import {
    cancelOrder,
    capitalConfigs,
    exchangeInfo,
    openOrders,
    order,
    //tradeFee,
    candles,
    //wsPartialDepth,
} from '../../actions.js';
import mainStore from '../../../store.js';
import {sendMessage} from '../../../utils.js';

//инфа по торговой паре
export const getSymbolInfo = async (userKey, {altCoin, baseCoin, isCalc = false}) => {
    try {
        const symbol = `${altCoin}${baseCoin}`;
        store[userKey].symbols[symbol] = {};

        //комиссия по торговой паре
        //const feeArray = await tradeFee(userKey);
        //const symbolFee = feeArray.find(x => x.symbol === symbol);
        //if (symbolFee) {
        //    store[userKey].symbols[symbol] = {};
        //    store[userKey].symbols[symbol].fee = {
        //        makerCommission: symbolFee.makerCommission,
        //        takerCommission: symbolFee.takerCommission,
        //    };
        //    console.log(store[userKey].symbols[symbol].fee);
        //} else {
        //    throw new Error('Invalid symbol');
        //}

        const data = await exchangeInfo(userKey);

        //лимиты
        store[userKey].limits.requestWeight = data.rateLimits.find(x => x.rateLimitType === 'REQUEST_WEIGHT').limit;
        store[userKey].limits.ordersPerSecond = data.rateLimits.find(x => x.rateLimitType === 'ORDERS' && x.interval === 'SECOND').limit;
        store[userKey].limits.ordersPerDay = data.rateLimits.find(x => x.rateLimitType === 'ORDERS' && x.interval === 'DAY').limit;

        const symbolData = data.symbols.find(x => x.symbol === symbol);

        if (!symbolData) {
            throw new Error('Invalid symbol');
        }

        //мета данные торговой пары
        store[userKey].symbols[symbol].meta = {
            //минимальный объем монет альткоина
            minQty: helpers.truncated(symbolData.filters.find(x => x.filterType === 'LOT_SIZE').minQty, 8),

            //максимльный объем монет альткоина
            maxQty: helpers.truncated(symbolData.filters.find(x => x.filterType === 'LOT_SIZE').maxQty, 8),

            //минимальное изменение цены альткоина при торгах
            oneTick: +symbolData.filters.find(x => x.filterType === 'PRICE_FILTER').tickSize,

            //цена альткоина должна быть кратна этому значению
            tickSize: helpers.floatNum(symbolData.filters.find(x => x.filterType === 'PRICE_FILTER').tickSize),

            //объем ордера должен быть кратен этому значению
            stepSize: helpers.floatNum(symbolData.filters.find(x => x.filterType === 'LOT_SIZE').stepSize),

            //минимальная итоговая сумма ордера (считается в базовой монете)
            minNotional: +symbolData.filters.find(x => x.filterType === 'MIN_NOTIONAL').minNotional,

            multiplierDown: +symbolData.filters.find(x => x.filterType === 'PERCENT_PRICE').multiplierDown,

            multiplierUp: +symbolData.filters.find(x => x.filterType === 'PERCENT_PRICE').multiplierUp,

            maxNumAlgoOrders: +symbolData.filters.find(x => x.filterType === 'MAX_NUM_ALGO_ORDERS').maxNumAlgoOrders,
        };

        //остальные параметры для торговли
        store[userKey].symbols[symbol].altCoin = altCoin;
        store[userKey].symbols[symbol].baseCoin = baseCoin;
        store[userKey].symbols[symbol].grid = [];
        store[userKey].symbols[symbol].orderGridHistory = [];
        store[userKey].symbols[symbol].profitOrderData = null;
        store[userKey].symbols[symbol].settings = {};
        store[userKey].symbols[symbol].reload = 0;
        store[userKey].symbols[symbol].price = 0;
        store[userKey].symbols[symbol].stopLossPrice = 0;
        store[userKey].symbols[symbol].priceStop = 0;
        store[userKey].symbols[symbol].firstTradeId = 0;
        store[userKey].symbols[symbol].lastGridOrder = false;
        store[userKey].symbols[symbol].isReloading = false;
        store[userKey].symbols[symbol].isStopped = false;
        store[userKey].symbols[symbol].changeTimer = null;
        store[userKey].symbols[symbol].canChange = false;
        store[userKey].symbols[symbol].gridTradesSum = 0;
        store[userKey].symbols[symbol].commonProfit = 0;
        //сохраним в БД
        if (!isCalc) await DB.write();
    } catch (error) {
        throw error;
    }
};

//остановить торги по торговой паре
export const stopTrade = async (userKey, symbol, fullClose = false, withError = false) => {
    try {
        //отменим текущие ордера из грида
        if (store[userKey]?.symbols?.[symbol]?.grid?.length) {
            const ids = [...store[userKey].symbols[symbol].grid.map(x => x.orderId)];

            //если необходимо отменим и ордер на прибыль
            if (fullClose && store[userKey]?.symbols?.[symbol]?.profitOrderData?.orderId) {
                ids.push(store[userKey].symbols[symbol].profitOrderData?.orderId);
            }

            await cancelOrders(userKey, {symbol, ids});
        }

        delete store[userKey].symbols[symbol];
        //wsPartialDepth(userKey);

        //сохраним в БД
        await DB.write();

        //отправим в интерфейс
        mainStore?.[userKey]?.wssClient && mainStore?.[userKey]?.wssClient.send(JSON.stringify({
            type: 'BinanceStore',
            event: 'stopTrade',
            data: {symbol},
        }));

        //отправим уведомление в telegram
        const msg = withError ? `торговля остановлена с ошибкой.` : `торговля остановлена.`;
        await sendMessage(userKey, `${symbol}: ${msg}`, store[userKey].telegram.notifications.includes('stopTrade'));
    } catch (error) {
        throw error;
    }
};

export const binance_setStop = async (userKey, {symbol, isStopped}) => {
    try {
        store[userKey].symbols[symbol].isStopped = isStopped;

        //сохраним в БД
        await DB.write();

        //отправим в интерфейс
        mainStore?.[userKey]?.wssClient && mainStore?.[userKey]?.wssClient.send(JSON.stringify({
            type: 'BinanceStore',
            event: 'setStopState',
            data: {symbol, isStopped},
        }));
    } catch (error) {
        throw error;
    }
};

export const binance_reload = async (userKey, {symbol, settings}) => {
    try {
        store[userKey].symbols[symbol].settings = {
            ...store[userKey].symbols[symbol].settings,
            ...settings,
        };
        store[userKey].symbols[symbol].isReloading = true;

        //сохраним в БД
        await DB.write();
    } catch (error) {
        throw error;
    }
};

export const cancelOrders = async (userKey, {symbol, ids}) => {
    try {
        const promises = ids.map(id => cancelOrder(userKey, {symbol, orderId: id}));
        await Promise.all(promises);
    } catch (error) {
        throw error;
    }
};

//выставление сетки ордеров
export const setGridOrders = async (userKey, {currentPrice, symbol, iterFrom = 0, iterTo = store[userKey].symbols[symbol]['settings']['openOrders']}) => {
    if (!store[userKey]?.symbols?.[symbol]) throw new Error(`${symbol}: такого символа нет в сторе.`);

    let price = 0, //цена с шагом отступа
        step = 0, //шаг оступа в %
        quantity = 0; //кол-во альтов, которое можем купить

    const {settings, meta, orderGridHistory, altCoin, baseCoin} = store[userKey].symbols[symbol];
    const math_operation = (settings.strategy === 'Long') ? '-' : '+';

    try {
        //ордера, которые необходимо выставить
        for (let i = iterFrom; i < iterTo; i++) {
            if (i === 0) {
                //первый шаг фиксированный, берется из настроек.
                step = settings.firstStep;

                //посчитаем цену с отступом и округлим в соответствии с tickSize
                price = helpers.gaussRound(evaluate(`${currentPrice} ${math_operation} ${currentPrice} * ${step} / 100`), meta.tickSize);

                //посчитаем какое количество altcoin или maincoin
                //мы можем купить исходя из настроек Deposit orders (минимальный первый ордер)
                //и Margintale (процент увеличения Deposit orders в последующих ордерах)
                //затем округлим это в соотвествии со stepSize
                quantity = helpers.gaussRound(evaluate(`1 / ${price} * ${settings.depositOrders}`), meta.stepSize);
            } else if (i === 1) {
                //второй шаг фиксированный, берется из настроек.
                step = helpers.gaussRound(evaluate(`${settings.ordersStep} + ${settings.ordersStep} * ${settings.plusStep}`), 8);
                price = helpers.gaussRound(evaluate(`${orderGridHistory[i - 1].price} ${math_operation} ${orderGridHistory[i - 1].price} * ${step} / 100`), meta.tickSize);
                quantity = helpers.gaussRound(evaluate(`${orderGridHistory[i - 1].quantity} + ${orderGridHistory[i - 1].quantity} * ${settings.martingale} / 100`), meta.stepSize);
            } else {
                //третий и последующие шаги рассчитываются исходя из предыдущего шага
                step = helpers.gaussRound(evaluate(`${orderGridHistory[i - 1].step} + ${settings.ordersStep} * ${settings.plusStep}`), 8);
                price = helpers.gaussRound(evaluate(`${orderGridHistory[i - 1].price} ${math_operation} ${orderGridHistory[i - 1].price} * ${step} / 100`), meta.tickSize);
                quantity = helpers.gaussRound(evaluate(`${orderGridHistory[i - 1].quantity} + ${orderGridHistory[i - 1].quantity} * ${settings.martingale} / 100`), meta.stepSize);
            }

            const orderData = await order(userKey, {
                symbol,
                newOrderRespType: 'ACK',
                side: (settings.strategy === 'Long') ? 'BUY' : 'SELL',
                quantity,
                price,
            });

            orderGridHistory.push(
                {
                    orderId: orderData.orderId,
                    price,
                    step,
                    quantity,
                },
            );
        }
        //сохраним в БД
        await DB.write();
    } catch (error) {
        //минимальный объем монет альткоина - minQty
        //минимальная итоговая сумма ордера (считается в базовой монете) - minNotional
        if (error?.code === -2010) {
            //посмотрим, что у нас есть на счете
            const capital = await capitalConfigs(userKey);
            let altQuantity = capital.find(x => x.coin === altCoin)?.free;
            let baseQuantity = capital.find(x => x.coin === baseCoin)?.free;
            altQuantity = helpers.truncated(altQuantity, meta.stepSize);

            //посчитам монеты для Long или Short
            const quantity = (settings.strategy === 'Long')
                ? helpers.truncated(evaluate(`${baseQuantity} / ${price}`), meta.stepSize)
                : altQuantity;

            //проверим монеты на минимальные требования
            if (quantity > meta.minQty && evaluate(`${quantity} *  ${price}`) > meta.minNotional) {
                const orderData = await order(userKey, {
                    symbol,
                    newOrderRespType: 'ACK',
                    side: (settings.strategy === 'Long') ? 'BUY' : 'SELL',
                    quantity,
                    price,
                });
                orderGridHistory.push(
                    {
                        orderId: orderData.orderId,
                        price,
                        step,
                        quantity,
                    },
                );
            }

            //установлен последний ордер в гриде
            store[userKey].symbols[symbol].lastGridOrder = true;
        } else if (error?.code === -1013) {
            //Filter failure: MIN_NOTIONAL
            throw new Error(`Минимальная сумма ордера - ${meta.minNotional}${baseCoin}. У нас - ${evaluate(quantity + ' * ' + price).toFixed(meta.tickSize)}${baseCoin}`);
        } else {
            throw error;
        }
    }
};

export const getSymbolsAmplitude = async symbols => {
    try {
        const result = [];
        //получим волотильность за последний час
        const response = await Promise.all(symbols.map(symbol => candles({symbol, interval: '5m', limit: 12})));
        console.log(response);

        symbols.forEach((symbol, i) => {
            let high_low_percent_diff_sum = 0;
            response[i].forEach(item => {
                //амплитуда свечи
                const diff = helpers.truncated(evaluate(`${item[2]} - ${item[3]}`), 8);
                const y = helpers.truncated(evaluate(`(100 * ${diff}) / ${item[1]}`), 8);
                high_low_percent_diff_sum = helpers.truncated(evaluate(`${high_low_percent_diff_sum} + ${y}`), 8);
            });
            result.push({symbol, 'average_percent_change': helpers.truncated(evaluate(`${high_low_percent_diff_sum} / 12`), 5)});
        });
        return result;
    } catch (error) {
        throw error;
    }
};
