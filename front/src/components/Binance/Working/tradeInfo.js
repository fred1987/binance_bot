import {useState} from 'react';
import {observer} from 'mobx-react-lite';
import BinanceWorkingDetail from './detail';
import wss from '../../../socket';
import UserStore from '../../../store/user';

const TradeInfo = observer(({
                                symbol: {
                                    altCoin,
                                    baseCoin,
                                    settings,
                                    price,
                                    priceStop,
                                    reload,
                                    stopLossPrice,
                                    profitOrderData,
                                    grid,
                                    isStopped,
                                },
                            }) => {
    const [viewForm, setViewForm] = useState(false);

    const stopTrading = () => {
        wss.client?.readyState === 1 && wss.client.send(JSON.stringify({
            type: 'binance',
            event: 'setStop',
            userKey: UserStore.wsUserId,
            data: {symbol: `${altCoin}${baseCoin}`, isStopped: !isStopped},
        }));
    };

    return (
        <div className="item">
            <div className="info_panel">
                <div className="header">
                    <h2>{altCoin}_{baseCoin}:{settings.strategy}</h2>
                    <button
                        type="submit"
                        className="danger"
                        onClick={stopTrading}
                    >
                        {isStopped ? 'Continue' : 'Stop'}
                    </button>
                </div>
                {stopLossPrice > 0 && <div className="stoploss-msg">Распродажа по цене ниже {stopLossPrice}</div>}
                <div className="price_info">
                    <div>price: <span>{price}</span></div>
                    <div>reload price: <span>{reload || '-'}</span></div>
                    <div>stop price: <span>{priceStop}</span></div>
                </div>
                <div className="main_info">
                    {profitOrderData &&
                    <div>
                        <h3>Profit order</h3>
                        <table className="grid profit">
                            <thead>
                                <tr>
                                    <th>Side</th>
                                    <th>Price</th>
                                    <th>Quantity</th>
                                    <th>Executed quantity</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td className={settings.strategy !== 'Long' ? 'green' : 'red'}>
                                        {settings.strategy !== 'Long' ? 'BUY' : 'SELL'}
                                    </td>
                                    <td>{profitOrderData.price}</td>
                                    <td>{profitOrderData.quantity}</td>
                                    <td>{profitOrderData.executed}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    }
                    {grid.length > 0 &&
                    <div>
                        <h3>Order grid</h3>
                        <table className="grid">
                            <thead>
                                <tr>
                                    <th>Side</th>
                                    <th>Price</th>
                                    <th>Quantity</th>
                                    <th>Executed quantity</th>
                                </tr>
                            </thead>
                            <tbody>
                                {
                                    grid.map(x =>
                                        <tr>
                                            <td className={settings.strategy === 'Long' ? 'green' : 'red'}>
                                                {settings.strategy === 'Long' ? 'BUY' : 'SELL'}
                                            </td>
                                            <td>{x.price}</td>
                                            <td>{x.quantity}</td>
                                            <td>{x.executed}</td>
                                        </tr>,
                                    )
                                }
                            </tbody>
                        </table>
                    </div>
                    }
                </div>
                <button
                    onClick={() => setViewForm(!viewForm)}
                    className="text settings-btn"
                >
                    {viewForm ? 'hide' : 'show'} settings
                    <i className="material-icons-outlined">{viewForm ? 'expand_less' : 'expand_more'}</i>
                </button>
            </div>
            <div className={viewForm ? 'detail-form active' : 'detail-form'}>
                <BinanceWorkingDetail settings={settings}/>
            </div>
        </div>
    );
});

export default TradeInfo;
