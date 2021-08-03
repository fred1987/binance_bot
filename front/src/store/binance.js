import {makeAutoObservable} from 'mobx';

class BinanceStore {
    weight = 0;
    calculatorData = null;
    symbols = {};

    get trades() {
        return Object.keys(this.symbols);
    }

    constructor() {
        makeAutoObservable(this);
    }

    calculator(payload) {
        this.calculatorData = payload;
    }

    setPrice({symbol, price}) {
        if (this.symbols[symbol]) {
            this.symbols[symbol].price = price;
        }
    }

    setTrading({symbol, data}) {
        this.symbols[symbol] = data;
    }

    setSettings({symbol, settings}) {
        if (this.symbols[symbol]) this.symbols[symbol].settings = settings;
    }

    setOrders({symbol, grid, profitOrderData}) {
        if (this.symbols[symbol]) {
            this.symbols[symbol].grid = grid.map(x => ({price: x.price, quantity: x.origQty, executed: x.executedQty}));
            this.symbols[symbol].profitOrderData = profitOrderData
                ? {price: profitOrderData.price, quantity: profitOrderData.origQty, executed: profitOrderData.executedQty}
                : null;
        }
    }

    setReload({symbol, reload}) {
        if (this.symbols[symbol]) {
            this.symbols[symbol].reload = reload;
        }
    }

    setStopState({symbol, isStopped}) {
        if (this.symbols[symbol]) {
            this.symbols[symbol].isStopped = isStopped;
        }
    }

    stopTrade({symbol}) {
        delete this.symbols[symbol];
    }

    setWeight(weight) {
        this.weight = weight;
    }
}

export default new BinanceStore();
