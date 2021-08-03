import * as Yup from 'yup';

const Schema = Yup.object().shape({
    altCoin: Yup.string()
        .required('AltCoin is required'),
    baseCoin: Yup.string()
        .required('BaseCoin is required'),
    strategy: Yup.string()
        .required('Strategy is required'),
    openOrders: Yup.string()
        .required('Open orders is required'),
    firstStep: Yup.string()
        .required('First step is required'),
    ordersStep: Yup.string()
        .required('Orders step is required'),
    plusStep: Yup.string()
        .required('Plus step is required'),
    depositOrders: Yup.string()
        .required('Deposit orders is required'),
    martingale: Yup.string()
        .required('Martingale is required'),
    profit: Yup.string()
        .required('Profit is required'),
    reload: Yup.string()
        .required('Reload is required'),
    limitDeposit: Yup.string()
        .required('Limit Deposit is required'),
    stoploss: Yup.string()
        .required('Stoploss is required'),
    prepump: Yup.string()
        .required('dumpStop is required'),
    httpTimeout: Yup.string()
        .required('HTTP Timeout is required'),
});

export default Schema;
