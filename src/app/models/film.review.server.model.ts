import { getPool } from '../../config/db';
import Logger from "../../config/logger";

const namespace = "film.review.server.model.ts > ";

const getAllReviews = async (id: number): Promise<any> => {
    Logger.info(`${namespace} Pulling all reviews for film id: ${id} from database`);
    const conn = await getPool().getConnection();
    const query = `SELECT user.id AS 'reviewerId', first_name AS 'reviewerFirstName', last_name AS 'reviewerLastName', rating, review, timestamp FROM film_review JOIN user ON film_review.user_id = user.id WHERE film_id=${id} ORDER BY timestamp DESC`;
    const [rows] = await conn.query(query);
    await conn.release();
    return rows;
};

const createReview = async (filmId: number, userId: number, rating: number, review: string, timestamp: string): Promise<any> => {
    Logger.info(`${namespace}Inserting a review for film id: ${filmId} into database`);
    const conn = await getPool().getConnection();
    const query = `INSERT INTO film_review (film_id, user_id, rating, review, timestamp) VALUES (${filmId}, ${userId}, ${rating}, "${review}", "${timestamp}")`;
    const [rows] = await conn.query(query);
    await conn.release();
    return rows;
};
export {getAllReviews, createReview}