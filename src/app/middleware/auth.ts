import Logger from "../../config/logger";
import {Request, Response} from "express";

const namespace = 'auth.ts >';
const validateToken = (req: Request, res: Response, userToken: string) => {
    Logger.info(`${namespace} Authentication token with middleware...`);

    try {
        const token = pullToken(req, res);
        Logger.info(`${namespace} Token: ${token} User Token: ${userToken}`);

        if (token === userToken) {
            Logger.info(`${namespace} Token authenticated`);
            return 1;
        } else {
            return 0;
        }
    } catch (err) {
        Logger.error(`${namespace} ERR: ${err}`);
        return -1;
    }
};

const validateTokenHeader = (req: Request, res: Response, userToken: string) => {
    try {
        Logger.info(`${namespace} Authentication token with middleware...`);
        const token = req.header('X-Authorization');

        Logger.info(`${namespace} Token: ${token} User Token: ${userToken}`);

        if (!token || token !== userToken) {
            // No token found or token is incorrect. Not authorised
            return 0;
        } else {
            return 1;
        }
    } catch (err) {
        Logger.error(`${namespace} ERR: ${err}`);
        return -1;
    }
}

const pullToken = (req: Request, res: Response) => {
    Logger.info(`${namespace} Pulling token from cookies...`);
    try {
        const token = req.headers.cookie.split(';')[0].split('Authorization=')[1];
        Logger.info(`${namespace} Extracted token: ${token}`);

        return token;
    } catch (err) {
        Logger.error(`${namespace} No Token Exists.`);
        return '';
    }
}

const pullTokenHeader = (req: Request, res: Response) => {
    Logger.info(`${namespace} Pulling token from header...`);
    try {
        const token = req.header('X-Authorization');
        Logger.info(`${namespace} Extracted token: ${token}`);

        return token;
    } catch (err) {
        Logger.error(`${namespace} No Token Exists. ERR: ${err}`);
        return '';
    }
}


export {validateToken, validateTokenHeader, pullToken, pullTokenHeader};