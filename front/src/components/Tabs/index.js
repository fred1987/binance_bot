import './style.scss';
import {useState} from 'react';

const Tabs = ({children}) => {
    const [activeTab, setActiveTab] = useState(children[0].props.label);

    return (
        <div className={'tabs'}>
            <ul className={'tabs-links'}>
                {children.map(tab =>
                    <li
                        onClick={() => setActiveTab(tab.props.label)}
                        className={`link${activeTab === tab.props.label ? ' selected' : ''}`}
                        key={tab.props.label}
                    >{tab.props.label}
                    </li>)}
            </ul>
            {children
                .filter(one => activeTab === one.props.label)
                .map(one => <div className={'content'} key={one.props.label}>{one.props.children}</div>)}
        </div>
    );
};

export default Tabs;
