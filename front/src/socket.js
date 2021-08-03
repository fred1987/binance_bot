const Store = {
    BinanceStore: null,
    UserStore: null,
    NoticeStore: null,
};

//присваиваем сторы константе Store
(function () {
    Object.keys(Store).forEach(async storeName => {
        Store[storeName] = await import(`./store/${storeName.replace('Store', '').toLocaleLowerCase()}`);
    });
}());

export default {
    client: null,
    init: function (user_key) {
        this.client = new WebSocket(process.env.REACT_APP_WSS_SERVER);

        this.client.onopen = () => {
            this.client.send(JSON.stringify({type: 'init', userKey: user_key || null}));
        };

        this.client.onclose = (event) => {
            if (event.wasClean) {
                console.log(`Соединение закрыто чисто`);
            } else {
                // например, сервер убил процесс или сеть недоступна
                // обычно в этом случае event.code 1006
                console.error(`Соединение прервано! event code - ${event.code}`);
            }
        };

        this.client.onmessage = res => {
            const response = JSON.parse(res.data);
            if (response.type === 'Info') {
                console.log(response.data);
            } else {
                Store[response.type]['default'][response.event](response.data);
            }
        };

        this.client.onerror = function (error) {
            console.error(error.message);
        };
    },
};
