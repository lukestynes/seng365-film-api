import { getPool } from '../../config/db';
import Logger from "../../config/logger";

const getPhoto = async(id: number): Promise<any> => {
    // Gets the filename of a users image from the database.
    Logger.info(`Getting user: ${id} image filename.`);
    const conn = await getPool().getConnection();
    const query = `SELECT * FROM user WHERE id = "${id}"`;
    const [result] = await conn.query(query);
    await conn.release();
    return result;
}

const updatePhoto = async(id: number, filename: string): Promise<any> => {
    // Updates the filename for a users image from the database.
    Logger.info(`Updating user: ${id} image to file: ${filename}.`);
    const conn = await getPool().getConnection();
    const query = `UPDATE user SET image_filename = "${filename}"WHERE id = "${id}"`;
    const [result] = await conn.query(query);
    await conn.release();
    return result;
}

const deletePhoto = async(id: number): Promise<any> => {
    // Updates the filename for a users image from the database.
    Logger.info(`Deleting user: ${id} image}.`);
    const conn = await getPool().getConnection();
    const query = `UPDATE user SET image_filename = NULL WHERE id = "${id}"`;
    const [result] = await conn.query(query);
    await conn.release();
    return result;
}

export {getPhoto, updatePhoto, deletePhoto}