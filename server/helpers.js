import {evaluate} from 'mathjs';

export default {
    //получить ключ объекта по его значению в объекте
    getKeyByValue(object, value) {
        return Object.keys(object).find(key => object[key] === value);
    },
    sleep(ms) {
        return new Promise(res => setTimeout(res, ms));
    },
    //проверка значения на дробное число
    isFloat(value) {
        if (/^(\-|\+)?([0-9]+(\.[0-9]+)?|Infinity)$/
            .test(value)) {
            return Number(value);
        }
        return NaN;
    },
    //округление по Гауссу
    gaussRound(num, decimalPlaces) {
        let d = decimalPlaces || 0,
            m = Math.pow(10, d),
            n = +(d ? num * m : num).toFixed(8),
            i = Math.floor(n),
            f = n - i,
            e = 1e-8,
            r = (f > 0.5 - e && f < 0.5 + e) ? ((i % 2 === 0) ? i : i + 1) : Math.round(n);
        return d ? r / m : r;
    },
    //Усечение десятичных чисел
    truncated(num, decimalPlaces) {
        if (num.toString().includes('.')) {
            let c = this.floatNum(num);
            if (c < decimalPlaces) decimalPlaces = c;
            const arr = num.toString().split('.');
            arr[1] = arr[1].substring(0, decimalPlaces);
            return evaluate(`${arr.join('.')} * 1`);
        } else {
            return evaluate(`${num} * 1`);
        }
    },
    //посчитать кол-во знаков после запятой
    floatNum(x) {
        let z = evaluate(`${x} + 1`);
        return (z.toString().includes('.')) ? (z.toString().split('.').pop().length) : (0);
    },
    //находит путь к свойствам объекта
    //objPath(obj, 'foo.bar.some.property')
    objPath(obj, path) {
        let parts = path.split('.');
        if (parts.length === 1) return obj[parts[0]];
        return this.objPath(obj[parts[0]], parts.slice(1).join('.'));
    },
};
