import {makeAutoObservable} from 'mobx';

class NoticeStore {
    notices = [];

    constructor() {
        makeAutoObservable(this);
    }

    message(payload) {
        const id = '_' + Math.random().toString(36).substr(2, 9);
        this.notices.push({msg: payload.msg, id, type: payload.type});
        setTimeout(() => {
            this.notices = this.notices.filter(x => x.id !== id);
        }, payload?.duration || 3000);
    }
}

const notice = new NoticeStore();

export default notice;
