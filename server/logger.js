import winston from 'winston';

const {createLogger, format, transports} = winston;
const {combine, timestamp, printf, errors} = format;

const debugFormat = printf(({message, level, timestamp, stack, meta, code}) => {
    return `${level.toUpperCase()} ${timestamp}:${meta ? ' ' + meta + ' ' : ' '}${code ? 'code ' + code + ' ' : ' '}${stack || message}`;
});

export const logger = createLogger({
    format: combine(
        timestamp({format: () => new Date().toLocaleString('ru', {timeZone: 'Europe/Moscow'})}),
        errors({stack: true}),
        debugFormat,
    ),
    transports: [
        new transports.File({filename: 'logs/errors.log', level: 'error'}),
        //new transports.Console(),
    ],
});
