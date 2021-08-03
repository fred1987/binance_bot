import binanceStore from './binance/store.js';
import DB from './lowdb.js';

export default {
    clearBinanceStore: async userKey => {
        delete binanceStore[userKey];

        //сохраним в БД
        delete DB.data[userKey].binanceStore;
        await DB.write();
    },
};
