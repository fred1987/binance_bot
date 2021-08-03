import {telegram_token} from './config.js';
import TelegramBot from 'node-telegram-bot-api';

//SOCKS5 proxy with the socks5-https-client lib
//const Agent = require('socks5-https-client/lib/Agent')
//const bot = new TelegramBot(process.env.TELEGRAM_API_TOKEN, {
//    polling: true,
//    request: {
//        agentClass: Agent,
//        agentOptions: {
//            socksHost: process.env.PROXY_SOCKS5_HOST,
//            socksPort: parseInt(process.env.PROXY_SOCKS5_PORT),
//            // If authorization is needed:
//            // socksUsername: process.env.PROXY_SOCKS5_USERNAME,
//            // socksPassword: process.env.PROXY_SOCKS5_PASSWORD
//        }
//    }
//})

export default new TelegramBot(telegram_token, {polling: true});
