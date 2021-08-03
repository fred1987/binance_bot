import './style.scss';
import {observer} from 'mobx-react-lite';

const Notice = observer(({data: {notices}}) => {
        return (
            <div className="notices">
                {notices.length > 0 &&
                notices.map(x => <div className={`${x.type} item`} key={x.id}>{x.msg}</div>)
                }
            </div>
        );
    },
);

export default Notice;
