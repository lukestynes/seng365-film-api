import { getPool } from '../../config/db';
import Logger from "../../config/logger";
import {start} from "repl";

const namespace = 'film.server.model.ts > ';

const getAllFilms = async (queries: any): Promise<any> => {
    // Returns all films in the database
    Logger.info(`${namespace}Getting all films from the database`);
    const conn = await getPool().getConnection();

    let queryOptions = '';
    if (JSON.stringify(queries) !== '{}') queryOptions = 'WHERE'
    let sortOption = ' ORDER BY release_date ASC';

    // Extract the genre ID's
    if (queries.genreIds) {
        let genreIds = '';
        if (typeof queries.genreIds === 'object') {
            for (const genre of queries.genreIds) {
                genreIds += ` ${genre},`;
            }
            queryOptions += ` genre_id IN (${genreIds.slice(0,-1)}) AND`;
        } else {
            queryOptions += ` genre_id = ${queries.genreIds} AND`;
        }
    }

    // Extract the age ratings
    if (queries.ageRatings) {
        let ageRatings = '';

        for (const rating of queries.ageRatings) {
            ageRatings += ` '${rating}',`;
        }
        queryOptions += ` age_rating IN (${ageRatings.slice(0,-1)}) AND`;
    }

    if (queries.q) queryOptions += ` (title LIKE '%${queries.q}%' OR description LIKE '%${queries.q}%') AND`;
    if (queries.directorId) queryOptions += ` director_id = ${queries.directorId} AND`;

    // Deals with finding the films by reviewer ID.
    let reviewerClause = '';
    let reviewerClause2 = '';
    if (queries.reviewerId) {
        queryOptions += ` film_review.user_id = ${queries.reviewerId} AND`;
        reviewerClause = 'JOIN film_review ON film.id = film_review.film_id';
        reviewerClause2 = 'GROUP BY title';
    }

    switch (queries.sortBy) {
        case 'ALPHABETICAL_ASC':
            sortOption = ` ORDER BY title ASC`;
            break;
        case 'ALPHABETICAL_DESC':
            sortOption = ' ORDER BY title DESC';
            break;
        case 'RELEASED_ASC':
            sortOption = ' ORDER BY release_date ASC';
            break;
        case 'RELEASED_DESC':
            sortOption = ' ORDER BY release_date DESC';
            break;
    }

    const query = `SELECT * FROM film ${reviewerClause} ${queryOptions.slice(0,-4)} ${reviewerClause2}${sortOption} `;
    Logger.info(`${namespace} Query w/ Queries: "${query}"`);
    const [rows] = await conn.query(query);
    await conn.release();
    return rows;
};

const getOneFilmId = async (id: number): Promise<any> => {
    // Returns one film in the database
    Logger.info(`${namespace}Getting film ${id} from the database`);
    const conn = await getPool().getConnection();
    const query = `SELECT * FROM film WHERE id=${id}`;
    const [rows] = await conn.query(query);
    await conn.release();
    return rows;
};

const getOneFilmTitle = async (title: string): Promise<any> => {
    // Returns one film in the database
    Logger.info(`${namespace}Getting film ${title} from the database`);
    const conn = await getPool().getConnection();
    const query = `SELECT * FROM film WHERE title="${title}"`;
    const [rows] = await conn.query(query);
    await conn.release();
    return rows;
};

const getGenres = async (): Promise<any> => {
    // Returns all films in the database
    Logger.info(`${namespace}Getting all genres from the database`);
    const conn = await getPool().getConnection();
    const query = `SELECT id AS 'genreId', name FROM genre`;
    const [rows] = await conn.query(query);
    await conn.release();
    return rows;
};

const getGenreId = async (id: number): Promise<any> => {
    // Returns all films in the database
    Logger.info(`${namespace}Getting genre at ID: ${id} from the database`);
    const conn = await getPool().getConnection();
    const query = `SELECT * FROM genre WHERE id=${id}`;
    const [rows] = await conn.query(query);
    await conn.release();
    return rows;
};

const addFilm = async (directorId: number, title: string, description: string, releaseDate: string, genreId: number, runtime: number, ageRating: string): Promise<any> => {
    Logger.info(`${namespace}Adding new film ${title} to database`);
    const conn = await getPool().getConnection();
    const query = `INSERT INTO film (title, description, release_date, image_filename, runtime, director_id, genre_id, age_rating) VALUES ("${title}", "${description}", "${releaseDate}", NULL, ${runtime}, ${directorId}, ${genreId}, "${ageRating}")`;
    const [rows] = await conn.query(query);
    await conn.release();
    return rows;
};

const deleteFilm = async (id: number): Promise<any> => {
    Logger.info(`${namespace}Deleting film at ${id} from database`);
    const conn = await getPool().getConnection();
    const query = `DELETE FROM film WHERE id=${id}`;
    const [rows] = await conn.query(query);
    await conn.release();
    return rows;
};

const updateFilm = async (id: number, queryDetails: any): Promise<any> => {
    Logger.info(`${namespace}Updating film at ${id} in the database`);
    const conn = await getPool().getConnection();
    let queryOptions = '';
    for (let i = 0; i < 6; i++) {
        if (Object.values(queryDetails)[i] !== -1) {
            if (typeof Object.values(queryDetails)[i] === 'string') {
                queryOptions = queryOptions + ` ${Object.keys(queryDetails)[i]} = "${Object.values(queryDetails)[i]}",`;
            } else {
                queryOptions = queryOptions + ` ${Object.keys(queryDetails)[i]} = ${Object.values(queryDetails)[i]},`;
            }
        }
    }
    // Logger.info(`${namespace}QUERY DETAILS: ${queryOptions.slice(0,-1)}`);
    const query = `UPDATE film SET${queryOptions.slice(0,-1)} WHERE id=${id}`;

    // Logger.info(`${namespace}QUERY: ${query}`);

    const [rows] = await conn.query(query);
    await conn.release();
    return rows;
};



export {getAllFilms, getOneFilmId, getOneFilmTitle, getGenres, getGenreId, addFilm, deleteFilm, updateFilm};