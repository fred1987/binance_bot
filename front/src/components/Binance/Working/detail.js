import '../style.scss';
import './style.scss';
import {Form, Formik} from 'formik';
import Schema from '../validateSchema';
import {observer} from 'mobx-react-lite';
import wss from '../../../socket';
import UserStore from '../../../store/user';

const BinanceWorkingDetail = observer(({settings}) => {
    return (
        <div className="binance-working-detail binance-form">
            <Formik
                initialValues={{
                    ...settings,
                }}
                validationSchema={Schema}
                onSubmit={values => {
                    wss.client?.readyState === 1 && wss.client.send(JSON.stringify({
                        type: 'binance',
                        event: 'reload',
                        userKey: UserStore.wsUserId,
                        data: {
                            symbol: `${settings.altCoin}${settings.baseCoin}`,
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
                      values,
                      errors,
                      touched,
                      handleChange,
                      handleBlur,
                  }) => (
                    <Form>
                        <div className="buttons">
                            <button
                                type="submit"
                                className="choco"
                            >
                                Reload
                            </button>
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
                        <div className="row clearfix">
                            {!!values.shortGrowsBase && <span>Making profit in {values.baseCoin}</span>}
                        </div>
                        {
                            Object.entries(errors).some(x => touched[x[0]] && errors[x[0]]) &&
                            <div className="form-errors">
                                {Object.entries(errors)
                                    .filter(x => touched[x[0]])
                                    .map(x => <div className="error-text" key={x[0]}>{`${x[1]}`}</div>)
                                }
                            </div>
                        }
                    </Form>
                )}
            </Formik>
        </div>
    );
});

export default BinanceWorkingDetail;
