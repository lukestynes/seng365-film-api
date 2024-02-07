import { getPool } from '../../config/db';
import Logger from "../../config/logger";

const namespace = 'film.image.server.model.ts >';
const getPhoto = async(id: number): Promise<any> => {
    // Gets the filename of a users image from the database.
    Logger.info(`${namespace} Getting film: ${id} image filename.`);
    const conn = await getPool().getConnection();
    const query = `SELECT image_filename FROM film WHERE id = "${id}"`;
    const [result] = await conn.query(query);
    await conn.release();
    return result;
}

const updateImageFilename = async (id: number, filename: string): Promise<any> => {
    // Lets you update an image filename
    Logger.info(`${namespace} Updating user ID: ${id} filename to ${filename} in database`);
    const conn = await getPool().getConnection();
    const query = `UPDATE film SET image_filename = "${filename}" WHERE id = ${id}`;
    const [result] = await conn.query(query);
    await conn.release();
    return result;
};

export {getPhoto, updateImageFilename}