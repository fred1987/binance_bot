import '../style.scss';
import './style.scss';
import {observer} from 'mobx-react-lite';
import {useEffect} from 'react';
import wss from '../../../socket';
import {Form, Formik} from 'formik';
import Schema from '../validateSchema';
import BinanceStore from '../../../store/binance';
import UserStore from '../../../store/user';

const BinanceStart = observer(({data: {calculatorData}}) => {

        useEffect(() => {
            return () => {
                if (calculatorData) BinanceStore.calculator(null);
            };
        }, []);

        const calculate = (e, values) => {
            e.preventDefault();
            wss.client?.readyState === 1 && wss.client.send(JSON.stringify({
                type: 'binance',
                event: 'calculate',
                userKey: UserStore.wsUserId,
                data: {
                    altCoin: values.altCoin,
                    baseCoin: values.baseCoin,
                    settings: Object.entries(values)
                        .map(([key, value]) => ({[key]: isNaN(+value) ? value : +value}))
                        .reduce((prev, cur) => {
                            prev = {...prev, ...cur};
                            return prev;
                        }, {}),
                },
            }));
        };

        return (
            <div className="binance-start binance-form">
                <Formik
                    initialValues={{
                        altCoin: 'ADA',
                        baseCoin: 'USDT',
                        strategy: 'Long',
                        openOrders: 2,
                        firstStep: 0.3,
                        ordersStep: 0.3,
                        plusStep: 0.25,
                        depositOrders: 11,
                        martingale: 30,
                        profit: 0.3,
                        reload: 0.3,
                        limitDeposit: 100,
                        stoploss: 0,
                        prepump: 20,
                        httpTimeout: 300,
                        changeAlts: 'ICX, ONT, EOS, IOTA, NEO',
                        autoSwitch: false,
                        shortGrowsBase: false,
                        changeTime: 60,
                    }}
                    validationSchema={Schema}
                    onSubmit={values => {
                        wss.client?.readyState === 1 && wss.client.send(JSON.stringify({
                            type: 'binance',
                            event: 'start',
                            userKey: UserStore.wsUserId,
                            data: {
                                altCoin: values.altCoin,
                                baseCoin: values.baseCoin,
                                settings: Object.entries(values)
                                    .map(([key, value]) => ({[key]: isNaN(+value) ? value : +value}))
                                    .reduce((prev, cur) => {
                                        prev = {...prev, ...cur};
                                        return prev;
                                    }, {}),
                            },
                        }));
                    }}
                >
                    {({
                          isSubmitting,
                          values,
                          errors,
                          touched,
                          handleChange,
                          handleBlur,
                      }) => (
                        <Form>
                            <div className="row clearfix">
                                <label>
                                    <span>AltCoin</span>
                                    <input
                                        name="altCoin"
                                        onChange={handleChange}
                                        onBlur={handleBlur}
                                        value={values.altCoin}
                                        className={errors.altCoin && touched.altCoin ? 'has_error' : ''}
                                    />
                                </label>
                                <label>
                                    <span>BaseCoin</span>
                                    <input
                                        name="baseCoin"
                                        onChange={handleChange}
                                        onBlur={handleBlur}
                                        value={values.baseCoin}
                                        className={errors.baseCoin && touched.baseCoin ? 'has_error' : ''}
                                    />
                                </label>
                                <label>
                                    <span>Strategy</span>
                                    <select
                                        name="strategy"
                                        onChange={handleChange}
                                        value={values.strategy}
                                        className={errors.strategy && touched.strategy ? 'has_error' : ''}
                                    >
                                        <option value="Long">Long</option>
                                        <option value="Short">Short</option>
                                    </select>
                                </label>
                            </div>
                            <div className="row clearfix">
                                <label>
                                    <span>Open orders</span>
                                    <input
                                        name="openOrders"
                                        onChange={handleChange}
                                        onBlur={handleBlur}
                                        value={values.openOrders}
                                        className={errors.openOrders && touched.openOrders ? 'has_error' : ''}
                                    />
                                </label>
                                <label>
                                    <span>First step</span>
                                    <input
                                        name="firstStep"
                                        onChange={handleChange}
                                        onBlur={handleBlur}
                                        value={values.firstStep}
                                        className={errors.firstStep && touched.firstStep ? 'has_error' : ''}
                                    />
                                </label>
                                <label>
                                    <span>Orders step</span>
                                    <input
                                        name="ordersStep"
                                        onChange={handleChange}
                                        onBlur={handleBlur}
                                        value={values.ordersStep}
                                        className={errors.ordersStep && touched.ordersStep ? 'has_error' : ''}
                                    />
                                </label>
                                <label>
                                    <span>Plus step</span>
                                    <input
                                        name="plusStep"
                                        onChange={handleChange}
                                        onBlur={handleBlur}
                                        value={values.plusStep}
                                        className={errors.plusStep && touched.plusStep ? 'has_error' : ''}
                                    />
                                </label>
                            </div>
                            <div className="row clearfix">
                                <label>
                                    <span>Deposit orders</span>
                                    <input
                                        name="depositOrders"
                                        onChange={handleChange}
                                        onBlur={handleBlur}
                                        value={values.depositOrders}
                                        className={errors.depositOrders && touched.depositOrders ? 'has_error' : ''}
                                    />
                                </label>
                                <label>
                                    <span>Martingale</span>
                                    <input
                                        name="martingale"
                                        onChange={handleChange}
                                        onBlur={handleBlur}
                                        value={values.martingale}
                                        className={errors.martingale && touched.martingale ? 'has_error' : ''}
                                    />
                                </label>
                                <label>
                                    <span>Profit</span>
                                    <input
                                        name="profit"
                                        onChange={handleChange}
                                        onBlur={handleBlur}
                                        value={values.profit}
                                        className={errors.profit && touched.profit ? 'has_error' : ''}
                                    />
                                </label>
                                <label>
                                    <span>Reload</span>
                                    <input
                                        name="reload"
                                        onChange={handleChange}
                                        onBlur={handleBlur}
                                        value={values.reload}
                                        className={errors.reload && touched.reload ? 'has_error' : ''}
                                    />
                                </label>
                            </div>
                            <div className="row clearfix">
                                <label>
                                    <span>Limit deposit</span>
                                    <input
                                        name="limitDeposit"
                                        onChange={handleChange}
                                        onBlur={handleBlur}
                                        value={values.limitDeposit}
                                        className={errors.limitDeposit && touched.limitDeposit ? 'has_error' : ''}
                                    />
                                </label>
                                <label>
                                    <span>Stoploss</span>
                                    <input
                                        name="stoploss"
                                        onChange={handleChange}
                                        onBlur={handleBlur}
                                        value={values.stoploss}
                                        className={errors.stoploss && touched.stoploss ? 'has_error' : ''}
                                    />
                                </label>
                                <label>
                                    <span>{(values.strategy === 'Long') ? 'PUMP' : 'DUMP'} stop</span>
                                    <input
                                        name="prepump"
                                        onChange={handleChange}
                                        onBlur={handleBlur}
                                        value={values.prepump}
                                        className={errors.prepump && touched.prepump ? 'has_error' : ''}
                                    />
                                </label>
                                <label>
                                    <span>HTTP timeout</span>
                                    <input
                                        name="httpTimeout"
                                        onChange={handleChange}
                                        onBlur={handleBlur}
                                        value={values.httpTimeout}
                                        className={errors.httpTimeout && touched.httpTimeout ? 'has_error' : ''}
                                    />
                                </label>
                            </div>
                            {values.strategy === 'Short' &&
                            <div className="row clearfix">
                                <input
                                    id="short_increase_base"
                                    type="checkbox"
                                    name="shortGrowsBase"
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    value={values.shortGrowsBase}
                                    className={errors.shortGrowsBase && touched.shortGrowsBase ? 'has_error' : ''}
                                />
                                <label htmlFor="short_increase_base" className="checkbox">
                                    Making profit in {values.baseCoin}
                                </label>
                            </div>
                            }
                            {
                                Object.entries(errors).some(x => touched[x[0]] && errors[x[0]]) &&
                                <div className="form-errors">
                                    {
                                        Object.entries(errors)
                                            .filter(x => touched[x[0]])
                                            .map(x => <div className="error-text" key={x[0]}>{`${x[1]}`}</div>)
                                    }
                                </div>
                            }
                            <button
                                type="submit"
                                className="success"
                            >
                                Start
                            </button>
                            <button
                                onClick={(e) => calculate(e, values)}
                                className="primary calc"
                            >
                                Calculate
                            </button>
                        </Form>
                    )}
                </Formik>

                {calculatorData &&
                <div className="calculator">
                    <div className="calculator-header">
                        <span className="price"><b>Current price</b> - {calculatorData.currentPrice}</span>
                        <div className="coverage">
                            <span><b>Coverage</b> - {calculatorData.coverage}%</span>
                            <span><b>Maximum coverage</b> - {calculatorData.coverageMax}%</span>
                        </div>
                    </div>
                    <div className="calculator-table">
                        <table>
                            <thead>
                            <tr>
                                <th>#</th>
                                <th>Deposit order</th>
                                <th>Price</th>
                                <th>Amount</th>
                            </tr>
                            </thead>
                            <tbody>
                            {calculatorData.orders.map((order, i) =>
                                <tr className={!order.full ? 'warning' : ''} key={order.price}>
                                    <td>{i + 1}</td>
                                    <td>{order.MainQuantity}</td>
                                    <td>{order.price}</td>
                                    <td>{order.altQuantity}</td>
                                </tr>,
                            )}
                            </tbody>
                        </table>
                    </div>
                </div>
                }
            </div>
        );
    },
);

export default BinanceStart;
