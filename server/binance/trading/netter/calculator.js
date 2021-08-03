import {evaluate} from 'mathjs';
import helpers from '../../../helpers.js';
import store from '../../store.js';
import {getSymbolInfo} from './functions.js';
import {book} from '../../actions.js';

export const binance_calculate = async (userKey, {altCoin, baseCoin, settings}) => {
    try {
        const symbol = `${altCoin}${baseCoin}`;

        if (!store[userKey].symbols[symbol]) await getSymbolInfo(userKey, {altCoin, baseCoin, isCalc: true});

        const {meta} = store[userKey].symbols[symbol];

        //получим текущую цену
        const prices = await book(userKey, {symbol});
        const currentPrice = (settings.strategy === 'Long') ? prices.bids[0].price : prices.asks[0].price;

        //если текущий депозит меньше одного ордера
        let mainCoins = (settings.strategy === 'Long') ? settings.limitDeposit : evaluate(`${currentPrice} * ${settings.limitDeposit}`);
        if (mainCoins < settings.depositOrders) {
            throw new Error('Limit deposit меньше чем Deposit orders. Проверьте настройки и пофиксите их');
        }

        //калькулятор
        let depoFilling = 0,
            percent = 0,
            percentMax = 0,
            orders = [],
            m = (settings.strategy === 'Long') ? '-' : '+';

        //посчитаем и соберем в массив ордера, которые необходимо выставить
        for (let i = 0; i < 1000; i++) {
            let price = 0,
                priceTest = 0,
                step = 0,
                altQuantity = 0,
                MainQuantity = 0,
                full = true;
            if (depoFilling > settings.limitDeposit) {
                //удалим последний добавленный ордер,
                //так как на него не хватает достаточного количества coin
                orders.pop();

                let spend = 0;

                //получим все потраченные coin
                orders.forEach(item => {
                    spend += (settings.strategy === 'Long') ? item.MainQuantity : item.altQuantity;
                });

                //посчитаем остаток coin
                let rest = settings.limitDeposit - spend;

                if (i === 2) {
                    step = helpers.gaussRound(evaluate(`${settings.ordersStep} + ${settings.ordersStep} * ${settings.plusStep}`), 8);
                } else {
                    let lastStep = 0;
                    if (orders[i - 2]['step'] === 0) lastStep = orders[i - 3]['step'];
                    step = helpers.gaussRound(evaluate(`${orders[i - 2]['step']} + ${settings.ordersStep} * ${settings.plusStep}`), 8);
                }

                priceTest = evaluate(`${orders[i - 2]['price']} ${m} ${orders[i - 2]['price']} * ${step} / 100`);
                if (priceTest < meta.oneTick) {
                    price = meta.oneTick.toFixed(meta.tickSize);
                } else {
                    price = helpers.gaussRound(priceTest, meta.tickSize).toFixed(meta.tickSize);
                }

                //посчитаем сколько освновного сoin мы можем купить на наши альты
                if (settings.strategy === 'Short') {
                    MainQuantity = helpers.gaussRound(evaluate(`${rest} * ${price}`), 8);
                }

                //если остаток больше чем минимальный ордер, то доставим еще один ордер
                if ((settings.strategy === 'Long') ? rest : MainQuantity >= meta.minNotional) {
                    full = false;
                    altQuantity = (settings.strategy === 'Long') ? helpers.gaussRound(evaluate(`1 / ${price} * ${rest}`), meta.stepSize) : helpers.gaussRound(rest, meta.stepSize);
                    if (settings.strategy === 'Long') {
                        MainQuantity = helpers.gaussRound(evaluate(`${altQuantity} * ${price}`), 8);
                        if (MainQuantity < settings.depositOrders) {
                            MainQuantity = settings.depositOrders;
                            altQuantity = helpers.gaussRound(evaluate(`${MainQuantity} / ${price}`), meta.stepSize);
                        }
                    }
                    orders.push({
                        price,
                        step,
                        altQuantity,
                        MainQuantity,
                        full,
                    });
                    percentMax = (priceTest < meta.oneTick) ? percent : step + percent;
                }
                break;
            } else if (depoFilling < settings.limitDeposit) {
                if (i === 0) {
                    step = +settings.firstStep;
                    priceTest = evaluate(`${currentPrice} ${m} ${currentPrice} * ${step} / 100`);
                    price = helpers.gaussRound(priceTest, meta.tickSize).toFixed(meta.tickSize);
                    altQuantity = helpers.gaussRound(evaluate(`1 / ${price} * ${settings.depositOrders}`), meta.stepSize);
                    MainQuantity = helpers.gaussRound(evaluate(`${altQuantity} * ${price}`), 8);
                } else if (i === 1) {
                    step = helpers.gaussRound(evaluate(`${settings.ordersStep} + ${settings.ordersStep} * ${settings.plusStep}`), 8);
                    priceTest = evaluate(`${orders[i - 1]['price']} ${m} ${orders[i - 1]['price']} * ${step} / 100`);
                    price = helpers.gaussRound(priceTest, meta.tickSize).toFixed(meta.tickSize);
                    altQuantity = helpers.gaussRound(evaluate(`${orders[i - 1]['altQuantity']} + ${orders[i - 1]['altQuantity']} * ${settings.martingale} / 100`), meta.stepSize);
                    MainQuantity = helpers.gaussRound(evaluate(`${altQuantity} * ${price}`), 8);
                } else {
                    step = helpers.gaussRound(evaluate(`${orders[i - 1]['step']} + ${settings.ordersStep} * ${settings.plusStep}`), 8);
                    priceTest = evaluate(`${orders[i - 1]['price']} ${m} ${orders[i - 1]['price']} * ${step} / 100`);
                    if (priceTest < meta.oneTick) {
                        price = meta.oneTick.toFixed(meta.tickSize);
                        percent = evaluate(`${percent} + 100 - ${meta.oneTick} * 100 / ${orders[i - 1]['price']}`);
                    } else {
                        price = helpers.gaussRound(priceTest, meta.tickSize).toFixed(meta.tickSize);
                    }
                    altQuantity = helpers.gaussRound(evaluate(`${orders[i - 1]['altQuantity']} + ${orders[i - 1]['altQuantity']} * ${settings.martingale} / 100`), meta.stepSize);
                    MainQuantity = helpers.gaussRound(evaluate(`${altQuantity} * ${price}`), 8);
                    if (MainQuantity < settings.depositOrders) {
                        MainQuantity = settings.depositOrders;
                        altQuantity = helpers.gaussRound(evaluate(`${MainQuantity} / ${price}`), meta.stepSize);
                    }
                }

                //если не хватило на минимальный ордер остановимся
                let rest = (settings.strategy === 'Long')
                    ? helpers.gaussRound(evaluate(`${settings.limitDeposit} - ${depoFilling}`), 8)
                    : helpers.gaussRound(evaluate(`(${settings.limitDeposit} - ${depoFilling}) * ${price}`), 8);
                if (rest < meta.minNotional) break;

                orders.push({
                    price,
                    step,
                    altQuantity,
                    MainQuantity,
                    full,
                });

                depoFilling += (settings.strategy === 'Long') ? MainQuantity : altQuantity;
                if (priceTest >= meta.oneTick) {
                    percent += (rest < MainQuantity) ? 0 : step;
                    percentMax = percent;
                }
            } else {
                percentMax = percent;
            }
        }

        //удалим данные из стора
        delete store[userKey].symbols[symbol];

        return {
            type: 'BinanceStore',
            event: 'calculator',
            data: {
                coverage: percent.toFixed(5),
                coverageMax: percentMax.toFixed(5),
                currentPrice,
                orders,
            },
        };
    } catch (error) {
        throw error;
    }
};
