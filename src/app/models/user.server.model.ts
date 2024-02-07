import { getPool } from '../../config/db';
import Logger from "../../config/logger";

const namespace = 'user.server.model.ts > ';

const getUserId = async (id: number): Promise<any> => {
    // Returns the information of one user so that their name and/or email (auth dependent) can be viewed.
    Logger.info(`Getting user ${id} from the database`);
    const conn = await getPool().getConnection();
    const query = `SELECT * FROM user WHERE id = ${id}`;
    const [rows] = await conn.query(query, [id]);
    await conn.release();
    return rows;
};
const getUserEmail = async (email: string): Promise<any> => {
    // Returns the information of a user via looking up their email. Primarily used to ensure 2 accounts aren't registered with the same email.
    Logger.info(`Getting user ${email} from the database`);
    const conn = await getPool().getConnection();
    const query = `SELECT * FROM user WHERE email = "${email}"`;
    const [rows] = await conn.query(query);
    await conn.release();
    return rows;
};

const getUserToken = async (token: string): Promise<any> => {
    // Returns the information of a user via looking up their email. Primarily used to ensure 2 accounts aren't registered with the same email.
    Logger.info(`Getting user from token ${token} from the database`);
    const conn = await getPool().getConnection();
    const query = `SELECT * FROM user WHERE auth_token = "${token}"`;
    const [rows] = await conn.query(query);
    await conn.release();
    return rows;
};

const removeUserToken = async (token: string): Promise<any> => {
    // Returns the information of a user via looking up their email. Primarily used to ensure 2 accounts aren't registered with the same email.
    Logger.info(`Removing users token. Matching token: ${token} from the database`);
    const conn = await getPool().getConnection();
    const query = `UPDATE user SET auth_token = NULL WHERE auth_token = "${token}"`;
    const [rows] = await conn.query(query);
    await conn.release();
    return rows;
};

const createUser = async (email: string, firstName: string, lastName: string, password: string): Promise<any> => {
    // Allows you to create a user so that you can register new accounts.
    Logger.info(`Creating a new user: ${firstName} ${lastName}`);
    const conn = await getPool().getConnection();
    const query = `INSERT INTO user (email, first_name, last_name, password) VALUES ("${email}", "${firstName}", "${lastName}", "${password}")`; // Need to update auth_token
    const [result] = await conn.query(query, [email], [firstName], [lastName], [password]);
    await conn.release();
    return result;
};

const update = async (id: number, queryDetails: any): Promise<any> => {
    // Allows you to update a users information if required.
    Logger.info(`${namespace} Updating user information for user ID: ${id} in the database.`);
    const conn = await getPool().getConnection();

    let queryOptions = '';
    for (let i = 0; i < 4; i++) {
        if (Object.values(queryDetails)[i] !== -1) {
            if (typeof Object.values(queryDetails)[i] === 'string') {
                queryOptions = queryOptions + ` ${Object.keys(queryDetails)[i]} = "${Object.values(queryDetails)[i]}",`;
            } else {
                queryOptions = queryOptions + ` ${Object.keys(queryDetails)[i]} = ${Object.values(queryDetails)[i]},`;
            }
        }
    }
    // Logger.info(`${namespace}QUERY DETAILS: ${queryOptions.slice(0,-1)}`);
    const query = `UPDATE user SET${queryOptions.slice(0,-1)} WHERE id=${id}`;
    const [rows] = await conn.query(query);
    // Logger.info(`${namespace}QUERY: ${query}`);
    await conn.release();
    return rows;
};

const addLoginToken = async(email: string, token: string): Promise<any> => {
    // Updates a user's login token when they log in to the website, or log out.
    Logger.info(`Updating user: ${email} access token`);
    const conn = await getPool().getConnection();
    const query = `UPDATE user SET auth_token = "${token}" WHERE email = "${email}"`;
    const [result] = await conn.query(query, [token], [email]);
    await conn.release();
    return result;
}

const updateImageFilename = async (id: number, filename: string): Promise<any> => {
    // Lets you update an image filename
    Logger.info(`${namespace} Updating user ID: ${id} filename to ${filename} in database`);
    const conn = await getPool().getConnection();
    const query = `UPDATE user SET image_filename = "${filename}" WHERE id = ${id}`;
    const [result] = await conn.query(query);
    await conn.release();
    return result;
};



export {getUserId, getUserEmail, getUserToken, createUser, update, updateImageFilename, addLoginToken, removeUserToken}