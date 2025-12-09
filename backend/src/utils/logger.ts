import { createLogger, format, transports } from 'winston';

const { combine, timestamp, printf, colorize, json } = format;

// Custom format for local development
const logFormat = printf(({ level, message, timestamp, ...metadata }) => {
    let msg = `${timestamp} [${level}] : ${message}`;
    if (Object.keys(metadata).length > 0) {
        msg += JSON.stringify(metadata);
    }
    return msg;
});

export const logger = createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: combine(
        timestamp({
            format: 'YYYY-MM-DD HH:mm:ss',
        }),
        json() // Default to JSON for production
    ),
    transports: [
        new transports.Console({
            format: process.env.NODE_ENV === 'development'
                ? combine(colorize(), logFormat)
                : json(),
        }),
    ],
});
