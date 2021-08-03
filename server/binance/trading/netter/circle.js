//import {setIntervalAsync, clearIntervalAsync} from 'set-interval-async/fixed/index.js';
import {evaluate} from 'mathjs';
import {COMMISSION_BNB} from '../../constants.js';
import mainStore from '../../../store.js';
import store from '../../store.js';
import {cancelOrders, setGridOrders, stopTrade} from './functions.js';
import {
    book,
    cancelOrder,
    capitalConfigs,
    myTrades,
    openOrders,
    order,
} from '../../actions.js';
import helpers from '../../../helpers.js';
import {logger} from '../../../logger.js';
import {sendMessage} from '../../../utils.js';

export const circle = (userKey, symbol) => {
    if (!store[userKey].symbols[symbol]) return;
    const S = store[userKey].symbols[symbol];
    const isLong = S.settings.strategy === 'Long';
    const timeout = S.settings.httpTimeout;

    const trader = async () => {
        //price -> текущая цена
        //meta -> мета данные торговой пары
        //grid -> текущие открытые ордера сетки
        //orderGridHistory -> хранит все выставленные ордера сетки за итерацию
        //profitOrderData -> хранится состояние ордера на профит
        //firstTradeId => id первого трейда в одной итерации
        //settings -> настройки стратегии
        //reload -> цена при которой произойдет автоматическая перестановка ордеров
        //stopLossPrice -> цена продажи профит ордера, если закончилось депо и рынок идет против нас
        //lastGridOrder -> был ли установлен последний ордер в гриде
        //priceStop -> цена PUMP/DUMP при которой бот автоматически остановит торговлю
        //isReloading -> требуется ли перезагрузка с новыми настройками
        //isStopped -> остановлена ли торговля
        //changeTimer -> таймер отсчета при автоматической смене альта
        //canChange -> ответ на вопрос можно ли сейчас переключаться на другой altCoin
        //gridTradesSum -> потрачено baseCoin в одной итерации покупок - продаже
        //commonProfit -> общая прибыль по торговой паре
        //shortGrowsBase -> рост baseCoin при шорте

        try {
            //текущая цена
            const prices = await book(userKey, {symbol});
            S.price = (S.settings.strategy === 'Long')
                ? helpers.truncated(prices.bids[0].price, S.meta.tickSize)
                : helpers.truncated(prices.asks[0].price, S.meta.tickSize);

            //отправим данные в интерфейс
            mainStore?.[userKey]?.wssClient && mainStore?.[userKey]?.wssClient.send(JSON.stringify({
                type: 'BinanceStore',
                event: 'setPrice',
                data: {symbol, price: S.price},
            }));

            //if (!S.price) {
            //    setTimeout(trader, timeout);
            //    return;
            //}

            //события на которые отправляем уведомления в telegram
            const telegramNotifications = store[userKey].telegram.notifications;

            const math_operation = isLong ? '+' : '-';
            const orders = await openOrders(userKey, {symbol});
            const side = (S.settings.strategy === 'Short') ? 'SELL' : 'BUY';

            //ордера из сетки
            S.grid = orders?.filter(x => x.side === side).map(x => ({
                orderId: x.orderId,
                price: x.price,
                origQty: x.origQty,
                executedQty: x.executedQty,
            })) || [];

            //ордер на прибыль
            const profit = orders?.filter(x => x.side !== side).map(x => ({
                orderId: x.orderId,
                price: x.price,
                origQty: x.origQty,
                executedQty: x.executedQty,
            }))?.[0] || null;

            //отправим открытые ордера в интерфейс
            mainStore?.[userKey]?.wssClient && mainStore?.[userKey]?.wssClient.send(JSON.stringify({
                type: 'BinanceStore',
                event: 'setOrders',
                data: {
                    symbol,
                    grid: S.grid.map(x => ({
                        orderId: x.orderId,
                        price: helpers.truncated(x.price, S.meta.tickSize),
                        origQty: helpers.truncated(x.origQty, S.meta.stepSize),
                        executedQty: helpers.truncated(x.executedQty, S.meta.stepSize),
                    })),
                    profitOrderData: profit ? {
                        orderId: profit.orderId,
                        price: helpers.truncated(profit.price, S.meta.tickSize),
                        origQty: helpers.truncated(profit.origQty, S.meta.stepSize),
                        executedQty: helpers.truncated(profit.executedQty, S.meta.stepSize),
                    } : null,
                },
            }));

            //профитный ордер был исполнен
            if (S.profitOrderData && !profit) {
                //дополнительная проверка в случае когда был забран ордер из грида и ордер на прибыль
                //тогда мы должны установить ордер в грид, а тот что исполнился в гриде выставить как профитный
                if (S.grid.length === S.settings.openOrders || S.lastGridOrder) {
                    if (S.grid.length) {
                        await cancelOrders(userKey, {symbol, ids: S.grid.map(x => x.orderId)});

                        //очистим историю по текущей итерации
                        S.orderGridHistory = [];

                        const price = S.price;

                        //выставим новую сетку ордеров
                        await setGridOrders(userKey, {currentPrice: price, symbol});

                        //перезапишем priceReload
                        S.reload = helpers.truncated(evaluate(`${price} ${math_operation} ${price} * ${S.settings.reload} / 100`), S.meta.tickSize);

                        //отправим priceReload в интерфейс
                        mainStore?.[userKey]?.wssClient && mainStore?.[userKey]?.wssClient.send(JSON.stringify({
                            type: 'BinanceStore',
                            event: 'setReload',
                            data: {symbol, reload: S.reload},
                        }));
                    }

                    //посчитаем прибыль за эту итерацию
                    const revenueWithoutCommission = isLong || S.settings.shortGrowsBase
                        ? helpers.truncated(evaluate(`${S.profitOrderData.origQty} * ${S.profitOrderData.price}`), 8)
                        : S.profitOrderData.origQty;

                    const currentProfit = helpers.truncated(evaluate(S.settings.shortGrowsBase && S.settings.strategy === 'Short'
                        ? `${S.gridTradesSum} - ${revenueWithoutCommission}`
                        : `${revenueWithoutCommission} - ${S.gridTradesSum}`), 8);
                    S.commonProfit = helpers.truncated(evaluate(`${S.commonProfit} + ${currentProfit}`), 8);

                    //отправим уведомление в telegram
                    const coinName = isLong || S.settings.shortGrowsBase ? S.baseCoin : S.altCoin;
                    await sendMessage(
                        userKey,
                        `${symbol}: исполнен ордер с прибылью. Прибыль - ${currentProfit}${coinName}. Общая прибыль без учета комиссии - ${S.commonProfit}${coinName}.`,
                        telegramNotifications.includes('profit'),
                    );

                    //очистим настройки
                    S.profitOrderData = null;
                    S.lastGridOrder = false;
                    S.firstTradeId = S.gridTradesSum = S.stopLossPrice = 0;

                    setTimeout(trader, timeout);
                    return;
                }
            } else {
                S.profitOrderData = profit;
            }

            //stopLoss
            if (S.stopLossPrice > 0 && S.settings.stoploss) {
                const isStop = isLong ? S.price <= S.stopLossPrice : S.price >= S.stopLossPrice;
                if (isStop) {
                    //отменим ордер на прибыль
                    await cancelOrder(userKey, {symbol, orderId: S.profitOrderData.orderId});
                    await helpers.sleep(2000);
                    const availableCoins = await capitalConfigs(userKey);
                    const coin = isLong ? S.altCoin : S.baseCoin;
                    const quantity = availableCoins.find(x => x.coin === coin).free;

                    //продадим все по рынку
                    const result = await order(userKey, {
                        symbol,
                        type: 'MARKET',
                        newOrderRespType: 'FULL',
                        side: isLong ? 'SELL' : 'BUY',
                        quantity: helpers.truncated(quantity, S.meta.stepSize),
                    });

                    //посчитаем общий убыток
                    const myTradesData = await myTrades(userKey, {
                        symbol,
                        ...S.firstTradeId ? {fromId: S.firstTradeId} : {},
                    });

                    //торги по гриду
                    const gridActualTrades = myTradesData.filter(x => S.orderGridHistory.some(z => z.orderId === x.orderId));

                    //вся коммиссия
                    let commission = 0;

                    //кол-во потраченных baseCoin + учтем комиссию в bnb
                    const [gridTradesSum, altTradesQty] = gridActualTrades.reduce((prev, cur) => {
                        let sum = evaluate(`${cur.price} * ${cur.qty}`);
                        prev[0] = evaluate(`${prev[0]} + ${sum}`);
                        prev[1] = evaluate(`${prev[1]} + ${cur.qty}`);
                        commission = evaluate(`${commission} + ${cur.commission}`);
                        return prev;
                    }, [0, 0]);

                    //получено при распродаже в baseCoin + учтем комиссию в bnb
                    const [resultCoins, resultAlt] = result.fills.reduce((prev, cur) => {
                        let sum = evaluate(`${cur.price} * ${cur.qty}`);
                        prev[0] = evaluate(`${prev[0]} + ${sum}`);
                        prev[1] = evaluate(`${prev[1]} + ${cur.qty}`);
                        commission = evaluate(`${commission} + ${cur.commission}`);
                        return prev;
                    }, [0, 0]);

                    //потеряно в baseCoin включая коммиссию
                    const loss = helpers.truncated(evaluate(`${gridTradesSum} - ${resultCoins}`), 8);
                    const qtyLoss = helpers.truncated(evaluate(`${altTradesQty} - ${resultAlt}`), S.meta.stepSize);

                    const msg = isLong
                        ? `Все монеты ${S.altCoin} распроданы. Убыток - ${loss}${S.baseCoin} + комиссия ${commission}BNB`
                        : S.settings.shortGrowsBase
                            ? `Монеты ${S.altCoin} откуплены заново. Убыток - ${loss}${S.baseCoin} + комиссия ${commission}BNB`
                            : `Монеты ${S.altCoin} откуплены заново. Убыток - ${qtyLoss}${S.altCoin} + комиссия ${commission}BNB`;

                    //отправим уведомление в telegram
                    await sendMessage(
                        userKey,
                        `${symbol}: сработал стоплос. ${msg}`,
                        telegramNotifications.includes('stopLoss'),
                    );

                    //остановим весь цикл и торги
                    await stopTrade(userKey, symbol);
                } else {
                    setTimeout(trader, timeout);
                }

                return;
            }

            //выставим недостающие ордера, если есть такая возможность
            if ((S.grid.length < S.settings.openOrders) && !S.lastGridOrder) {
                //получим id первого трейда, если его еще нет
                if (!S.firstTradeId) {
                    let myTradesData = await myTrades(userKey, {symbol});
                    S.firstTradeId = myTradesData.find(x => x.orderId === S.orderGridHistory[0].orderId)?.id || 0;
                }

                //установим недостающие ордера
                await setGridOrders(userKey, {
                    currentPrice: S.price,
                    symbol,
                    iterFrom: S.orderGridHistory.length,
                    iterTo: S.orderGridHistory.length + S.settings.openOrders - S.grid.length,
                });

                setTimeout(trader, timeout);
                return;
            }

            //перезапустим сетку, если достигли цены priceReload, отсутствует ордер на прибыль и все ордера в гриде на месте
            const isReload = S.reload && isLong ? S.price >= S.reload : S.price <= S.reload;
            if (isReload && S.grid.length === S.settings.openOrders && !S.profitOrderData && S.orderGridHistory.length === S.settings.openOrders) {
                //отменим ордера сетки
                await cancelOrders(userKey, {symbol, ids: S.grid.map(x => x.orderId)});

                //очистим настройки
                S.orderGridHistory = [];

                //установим новые ордера
                await setGridOrders(userKey, {
                    currentPrice: S.price,
                    symbol,
                });

                //перезапишем priceReload
                S.reload = helpers.truncated(evaluate(`${S.price} ${math_operation} ${S.price} * ${S.settings.reload} / 100`), S.meta.tickSize);

                //отправим priceReload в интерфейс
                mainStore?.[userKey]?.wssClient && mainStore?.[userKey]?.wssClient.send(JSON.stringify({
                    type: 'BinanceStore',
                    event: 'setReload',
                    data: {symbol, reload: S.reload},
                }));

                setTimeout(trader, timeout);
                return;
            }

            //если нет ордеров в гриде и последний ордер из грида был выставлен, то установим цену распродажи
            if (!S.stopLossPrice && S.settings.stoploss && S.lastGridOrder && !S.grid.length) {
                const mo = isLong ? '-' : '+';
                const price = S.price;

                //установим цену при которой произойдет распродажа
                S.stopLossPrice = helpers.gaussRound(evaluate(`${price} ${mo} (${price} * ${S.settings.stoploss}/100)`), S.meta.tickSize);

                //отправим уведомление в telegram
                await sendMessage(
                    userKey,
                    `${symbol}: выставлен стоплос по цене ${S.stopLossPrice}.`,
                    telegramNotifications.includes('stopLoss'),
                );
            }

            //проверим есть ли исполненные монеты из грида и положим их в профитный ордер
            let availableCoins = await capitalConfigs(userKey);
            let altCoinBalance = availableCoins.find(x => x.coin === S.altCoin).free;
            let baseCoinBalance = availableCoins.find(x => x.coin === S.baseCoin).free;
            if ((isLong && altCoinBalance) || (S.settings.strategy === 'Short' && baseCoinBalance)) {
                let coins = isLong ? helpers.truncated(altCoinBalance, S.meta.stepSize) : 0;

                //Техника - "ЧОТКИЙ АНАЛИЗ ПАЦАНА"
                //Для стратегии LONG. Найдем цену по которой исполнился ордер в гриде, если ордера на прибыль еще не было
                const executedFromGridPrice = isLong && !S.profitOrderData
                    ? S.orderGridHistory.length > S.settings.openOrders
                        ? S.orderGridHistory[S.orderGridHistory.length - S.settings.openOrders - 1].price
                        : S.orderGridHistory[0].price
                    : S.price;

                //предварительная проверка, если кол-во монет соответствует необходимому минимуму
                if ((isLong && ((coins >= S.meta.minQty && S.profitOrderData) || (!S.profitOrderData && evaluate(`${coins} * (${executedFromGridPrice} + (${executedFromGridPrice} * ${S.settings.profit} / 100))`) > S.meta.minNotional))) ||
                    (!isLong && (S.settings.shortGrowsBase || (!S.profitOrderData && baseCoinBalance > S.meta.minNotional && !S.settings.shortGrowsBase) || (S.profitOrderData && baseCoinBalance > 0)))) {

                    //отмена профитного ордера для Long
                    if (isLong && S.profitOrderData) {
                        await cancelOrder(userKey, {symbol, orderId: S.profitOrderData.orderId});

                        //иначе монеты из cancelOrder находятся в availableCoins.find(x => x.coin === S.altCoin).locked
                        await helpers.sleep(1500);

                        //пересчитаем доступные монеты
                        availableCoins = await capitalConfigs(userKey);
                        altCoinBalance = availableCoins.find(x => x.coin === S.altCoin).free;
                        baseCoinBalance = availableCoins.find(x => x.coin === S.baseCoin).free;
                        coins = isLong ? helpers.truncated(altCoinBalance, S.meta.stepSize) : 0;
                    }

                    //получим мои торги по данной торговой паре
                    let myTradesData = await myTrades(userKey, {
                        symbol,
                        ...S.firstTradeId ? {fromId: S.firstTradeId} : {},
                    });

                    if (Array.isArray(myTradesData) && myTradesData.length) {
                        //торги по гриду
                        const gridActualTrades = myTradesData.filter(x => S.orderGridHistory.some(z => z.orderId === x.orderId));

                        //кол-во потраченных baseCoin
                        S.gridTradesSum = gridActualTrades.reduce((prev, cur) => {
                            if (isLong || S.settings.shortGrowsBase) {
                                let sum = evaluate(`${cur.price} * ${cur.qty}`);
                                prev = evaluate(`${prev} + ${sum}`);
                            } else {
                                prev = evaluate(`${prev} + ${cur.qty}`);
                            }
                            return prev;
                        }, 0);

                        //торги по профитному ордеру
                        let profitActualTrades = [];
                        let profitExecutedBaseCoins = 0; //сколько мы получили baseCoins в профитном ордере
                        if (S.firstTradeId && S.profitOrderData?.orderId) {
                            profitActualTrades = myTradesData.filter(x => x.orderId === S.profitOrderData?.orderId);
                            profitExecutedBaseCoins = profitActualTrades.reduce((prev, cur) => {
                                prev = evaluate(`${prev} + ${cur.price} * ${cur.qty}`);
                                return prev;
                            }, 0);
                        }

                        //получим id первого трейда, если его еще нет
                        if (!S.firstTradeId && gridActualTrades.length) {
                            S.firstTradeId = gridActualTrades.sort((a, b) => a.id - b.id)[0]['id'];
                        }

                        //высчитаем среднюю цену всех сделок
                        const [altSpent, baseSpent] = gridActualTrades.reduce((prev, cur) => {
                            prev[0] = evaluate(`${prev[0]} + ${cur.qty}`);
                            prev[1] = evaluate(`${prev[1]} + ${cur.price} * ${cur.qty}`);
                            return prev;
                        }, [0, 0]);

                        //средняя цена всех завершенных сделок в гриде
                        const averagePrice = evaluate(`${baseSpent} / ${altSpent}`);

                        //высчитаем цену ордера на профит
                        let profitPrice = helpers.gaussRound(evaluate(`${averagePrice} ${math_operation} (${averagePrice} * ${S.settings.profit} / 100 + ${averagePrice} * ${COMMISSION_BNB} * 2 / 100)`), S.meta.tickSize);

                        //отмена профитного ордера для Short
                        if (!isLong) {
                            coins = S.settings.shortGrowsBase
                                ? helpers.truncated(altSpent, S.meta.stepSize)
                                : helpers.truncated(evaluate(`${baseCoinBalance} / ${profitPrice}`), S.meta.stepSize);

                            if (S.profitOrderData) {
                                if ((S.settings.shortGrowsBase && evaluate(`${coins} - ${S.profitOrderData.origQty}`) > S.meta.minQty) || (!S.settings.shortGrowsBase && coins > S.meta.minQty)) {
                                    //отменим текущий ордер
                                    await cancelOrder(userKey, {symbol, orderId: S.profitOrderData.orderId});

                                    //пересчитаем монеты с отмененным ордером на прибыль
                                    if (!S.settings.shortGrowsBase) {
                                        //сделаем паузу иначе монеты из cancelOrder находятся в availableCoins.find(x => x.coin === S.altCoin).locked
                                        await helpers.sleep(1500);

                                        //пересчитаем доступные монеты
                                        availableCoins = await capitalConfigs(userKey);
                                        baseCoinBalance = availableCoins.find(x => x.coin === S.baseCoin).free;

                                        coins = helpers.truncated(evaluate(`${baseCoinBalance} / ${profitPrice}`), S.meta.stepSize);
                                    } else {
                                        if (S.profitOrderData.executedQty) coins = helpers.truncated(evaluate(`${coins} - ${S.profitOrderData.executedQty}`), S.meta.stepSize);
                                    }
                                } else {
                                    //чтобы повторно не выставлял ордер, если он уже выставлен и переставлять нет нужды
                                    if (S.settings.shortGrowsBase) coins = 0;
                                }
                            }
                        }

                        //если были исполнены монеты в ордере на прибыль ранее
                        if (profitExecutedBaseCoins && isLong) {
                            //сколько должны получить
                            const mustToGet = evaluate(`${coins} *  ${profitPrice}`);

                            //сколько осталось получить
                            const wantToGet = evaluate(`${mustToGet} -  ${profitExecutedBaseCoins}`);

                            //пересчитаем цену ордера на профит
                            profitPrice = helpers.gaussRound(evaluate(`${wantToGet} / ${coins}`), S.meta.tickSize);
                        }

                        //если минимальная итоговая сумма ордера соотвествует правилу, выставим ордер на прибыль
                        const baseQty = evaluate(`${coins} *  ${profitPrice}`);
                        if (baseQty > S.meta.minNotional) {
                            let profit;
                            try {
                                profit = await order(userKey, {
                                    symbol,
                                    price: profitPrice,
                                    side: isLong ? 'SELL' : 'BUY',
                                    quantity: coins,
                                });
                            } catch (error) {
                                if (error?.code === -2010) {
                                    let err = new Error(`Недостаточно средств для выставления ордера на прибыль. Попытка выставить на ${isLong
                                        ? 'продажу'
                                        : 'покупку'} ${coins}${S.altCoin} по цене ${profitPrice}${S.baseCoin}.`);
                                    err.code = -2010;
                                    throw err;
                                } else {
                                    throw error;
                                }
                            }

                            //сохраним в сторе
                            S.profitOrderData = {
                                orderId: profit.orderId,
                                price: profit.price,
                                origQty: profit.origQty,
                                executedQty: profit.executedQty,
                            };

                            S.reload = 0;

                            //отправим priceReload в интерфейс
                            mainStore?.[userKey]?.wssClient && mainStore?.[userKey]?.wssClient.send(JSON.stringify({
                                type: 'BinanceStore',
                                event: 'setReload',
                                data: {symbol, reload: S.reload},
                            }));

                            setTimeout(trader, timeout);
                            return;
                        } else {
                            //отправим уведомление в telegram
                            if (profitExecutedBaseCoins && isLong) {
                                await sendMessage(
                                    userKey,
                                    `${symbol}: ордер на прибыль отменен, а новый выставить не смогли так как он слишком мал.`,
                                );
                            }
                        }
                    }
                }
            }

            //перезапуск с новыми настройками
            if (S.isReloading) {
                const orderIds = S.grid.map(x => x.orderId);
                if (S.profitOrderData) orderIds.push(S.profitOrderData.orderId);

                //отменим ордера
                await cancelOrders(userKey, {symbol, ids: orderIds});

                if (!S.profitOrderData) {
                    S.orderGridHistory = [];

                    //установим новые ордера
                    await setGridOrders(userKey, {
                        currentPrice: S.price,
                        symbol,
                    });

                    //перезапишем priceReload
                    S.reload = helpers.truncated(evaluate(`${S.price} ${math_operation} ${S.price} * ${S.settings.reload} / 100`), S.meta.tickSize);

                    //отправим в интерфейс
                    mainStore?.[userKey]?.wssClient && mainStore?.[userKey]?.wssClient.send(JSON.stringify({
                        type: 'BinanceStore',
                        event: 'setReload',
                        data: {symbol, reload: S.reload},
                    }));
                } else {
                    S.profitOrderData = null;
                    S.reload = 0;

                    //удалим отмененные ордера из истории
                    S.orderGridHistory.splice(-(orderIds.length - 1), orderIds.length - 1);
                }

                mainStore?.[userKey]?.wssClient && mainStore?.[userKey]?.wssClient.send(JSON.stringify({
                    type: 'BinanceStore',
                    event: 'setSettings',
                    data: {symbol, settings: S.settings},
                }));

                S.isReloading = false;

                setTimeout(trader, timeout);
                return;
            }

            //проверим не пора ли сменить alt
            if (S.settings.autoSwitch && S.canChange) {
                //TODO автосмена торгуемых пар
            }

            //проверим не достигли ли цены PUMP/DUMP для полной остановки
            let PUMP_DUMP = false;
            if (S.settings.prepump > 0) {
                PUMP_DUMP = isLong ? S.price >= S.priceStop : S.price <= S.priceStop;
            }

            //остановим торги, если нет текущего ордера на прибыль
            if ((S.isStopped || PUMP_DUMP) && !S.profitOrderData) {
                if (PUMP_DUMP) {
                    await sendMessage(
                        userKey,
                        `${symbol}: цена достигла ${isLong ? 'pump stop' : 'dump stop'}.`,
                    );
                }
                await stopTrade(userKey, symbol);
            } else {
                setTimeout(trader, timeout);
            }
        } catch (error) {
            if (error?.code === 'EAI_AGAIN') {
                //если нет доступа к сети, попробуем перезапустить через 15 сек
                const time = new Date().toLocaleDateString('ru', {
                    timeZone: 'Europe/Moscow',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                });

                console.log(`Нет доступа к сети. Время - ${time}. Пробуем переподключиться.`);
                setTimeout(trader, 15 * 1000);
            } else {
                logger.error(error);
                await stopTrade(userKey, symbol, false, true);
            }
        }
    };

    setTimeout(trader, timeout);
};
