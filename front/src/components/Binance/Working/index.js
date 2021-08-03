import './style.scss';
import TradeInfo from './tradeInfo';
import {observer} from 'mobx-react-lite';

const BinanceWorking = observer(({data: {trades, symbols, weight}}) => {

    return (
        <div className="binance-working">
            <div className="account_info">
                {weight > 1 && <div className="weight">Вес запросов - {weight}</div>}
            </div>
            <div className="list">
                {/*<pre>{JSON.stringify(trades, null, 2)}</pre>*/}
                {
                    trades.length
                        ? trades?.map(trade => <TradeInfo symbol={symbols[trade]} key={trade}/>)
                        : <div className="empty_list">Торговые пары в работе отсутствуют</div>
                }
            </div>
        </div>
    );
});

export default BinanceWorking;
