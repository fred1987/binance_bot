import './style.scss';
import Tabs from '../../components/Tabs';
import BinanceStart from '../../components/Binance/Start';
import BinanceWorking from '../../components/Binance/Working';
import BinanceStore from '../../store/binance';

function AdminBinance() {
    return (
        <div className="binance">
            <h1>Binance trading bot</h1>
            <Tabs>
                <div label="В работе">
                    <BinanceWorking data={BinanceStore}/>
                </div>
                <div label="Старт">
                    <BinanceStart data={BinanceStore}/>
                </div>
            </Tabs>
        </div>
    );
}

export default AdminBinance;
