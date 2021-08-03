import './app.scss';
import NoticeStore from './store/notice';
import Notice from './components/Notice';
import AdminBinance from "./views/Binance";

function App() {
    return (
        <div className="content">
            <AdminBinance/>
            <Notice data={NoticeStore}/>
        </div>
    );
}

export default App;
