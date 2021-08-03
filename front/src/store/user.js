import {
    makeAutoObservable,
    autorun,
} from 'mobx';
import wss from '../socket';

class UserStore {
    user_key = 'df8xp-d8h1l-243rm-mc3ds-23okm'

    get wsUserId() {
        return user?.user_key || null;
    }

    constructor() {
        makeAutoObservable(this);
    }
}

const user = new UserStore();

autorun(() => {
    //инициализируем сокеты после авторизации
    wss.init(user.user_key);
});

export default user;
