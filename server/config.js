import {config} from 'dotenv';
import {join} from 'path';

const root = join.bind(this, process.cwd(), './');
config({path: root('.env')});

export const telegram_token = process.env.TELEGRAM_TOKEN;
export const binance_keys = {
    'BC62D': process.env.BC62D_BINANCE_KEY,
};
export const binance_secrets = {
    'BC62D': process.env.BC62D_BINANCE_SECRET,
};
