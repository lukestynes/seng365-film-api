import {Request, Response} from "express";
import Logger from "../../config/logger";
import * as films from "../models/film.server.model";
import * as filmReviews from "../models/film.review.server.model";
import * as users from "../models/user.server.model";
import {validate} from "../../config/validate";
import * as auth from "../middleware/auth";
import moment from "moment";
import * as schemas from "../resources/schemas.json";

const namespace = 'film.server.controller.ts > ';

// TODO: Fix that one issue with sorting by rating.
const viewAll = async (req: Request, res: Response): Promise<void> => {
    try{
        Logger.info(`${namespace}GET returning all films.`);

        // Extract all the values from the route queries and prepare them for request.
        const queries = req.query;
        Logger.debug(`${namespace}QUERIES: ${JSON.stringify(queries)}`);

        // Validate the user inputted data
        const validation = await validate(schemas.film_search, req.query);

        if (validation !== true) {
            Logger.error(`${namespace} CODE 400: Bad Request. ${validation.toString()}`);
            res.statusMessage = `Bad Request. Invalid Information`;
            res.status(400).send();
            return;
        }

        // Get the current list of genre id's
        if (queries.genreIds) {
            if (typeof queries.genreIds === 'object') {
                // @ts-ignore
                for (const genre of queries.genreIds) {
                    const genreLookup = await films.getGenreId(genre)
                    if (genreLookup.length === 0) {
                        Logger.error(`${namespace} CODE 400: Bad Request. Genre id's given are invalid`);
                        res.statusMessage = `Bad Request. Invalid Information`;
                        res.status(400).send();
                        return;
                    }
                }
            } else {
                const genreLookup = await films.getGenreId(parseInt(queries.genreIds, 10))
                if (genreLookup.length === 0) {
                    Logger.error(`${namespace} CODE 400: Bad Request. Genre id's given are invalid`);
                    res.statusMessage = `Bad Request. Invalid Information`;
                    res.status(400).send();
                    return;
                }
            }
        }

        // Pull all the films that match the queries
        const result = await films.getAllFilms(queries);
        const resultParse = JSON.parse(JSON.stringify(result));

        // Paginate the results
        let startIndex = 0;
        if (queries.startIndex) startIndex = parseInt(`${queries.startIndex}`, 10);

        let count = Object.keys(resultParse).length;
        if (queries.count) count = parseInt(`${queries.count}`, 10);

        // Generated the detailed information for each movie.
        const resultListRated = [];
        const resultListBlank = [];
        let resultList = [];

        for (const film of resultParse) {
            // Return the directors name (user id comes from film table)
            const user = await users.getUserId(parseInt(film.director_id, 10));
            const userParse = JSON.parse(JSON.stringify(user).slice(1,-1));

            // Return the reviews and then calculate an average and count the number
            const reviews = await filmReviews.getAllReviews(film.id);
            const reviewsParse = JSON.parse(JSON.stringify(reviews));

            // Calculate the average rating value
            const reviewsCount = Object.keys(reviewsParse).length;
            let ratingsTotal = 0;
            let averageRating = 0;

            if (reviewsCount !== 0) {
                for (const review of reviewsParse) {
                    ratingsTotal += JSON.parse(JSON.stringify(review)).rating;
                }
                averageRating = (ratingsTotal)/(reviewsCount);

                // Round the average rating to 2 dp as wanted
                if (averageRating.toString().length > 4) {
                    averageRating = parseFloat(averageRating.toFixed(2));
                }
            }

            const detailedInfo = {
                'filmId': film.id,
                'title': film.title,
                'genreId': film.genre_id,
                'directorId': film.director_id,
                'directorFirstName': userParse.first_name,
                'directorLastName': userParse.last_name,
                'releaseDate': film.release_date,
                'ageRating': film.age_rating,
                'rating': averageRating
            };
            if (queries.sortBy === 'RATING_ASC' || queries.sortBy === 'RATING_DESC') {
                if (detailedInfo.rating !== 0) resultListRated.push(detailedInfo);
                if (detailedInfo.rating === 0) resultListBlank.push(detailedInfo);
            } else {
                resultList.push(detailedInfo);
            }
        }


        // Sort the list by review ID if needed


        if (queries.sortBy === 'RATING_ASC') {
            resultListRated.sort( (a: any, b: any) => a.rating - b.rating);
            resultListBlank.sort((a: any, b: any) => a.filmId - b.filmId);
            resultList = resultListBlank.concat(resultListRated);
        } else if (queries.sortBy === 'RATING_DESC') {
            resultListRated.sort( (a: any, b: any) => b.rating - a.rating);
            resultListBlank.sort((a: any, b: any) => a.filmId - b.filmId);
            resultList = resultListRated.concat(resultListBlank);
        }



        // Add the count of results to the end of the query

        Logger.http(`${namespace}CODE 200: OK. Returned all films matching that query criteria`);
        res.status(200).json({'films': resultList.slice(startIndex, startIndex + count), 'count': resultList.length});
        return;
    } catch (err) {
        Logger.error(`${namespace}` + err);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
        return;
    }
}

const getOne = async (req: Request, res: Response): Promise<void> => {
    Logger.info(`${namespace}GET retrieving all information about film ${req.params.id}`);
    const id = parseInt(req.params.id, 10);

    try{
        // If the input isn't a proper number then you won't find a user
        if (/^\d+$/.test(id.toString()) === false) {
            Logger.error(`${namespace} CODE 404: Input parameter ${id} is not a number`);
            res.statusMessage = 'Not Found. No film found with id';
            res.status(404).send();
            return;
        }

        // Return all the film details from 'film' table
        const film = await films.getOneFilmId(id);

        // No film found
        if (film.length === 0) {
            Logger.error(`${namespace}CODE 404: No film returned at ID: ${id}`);
            res.statusMessage = `Not Found. No film with id ${id}`;
            res.status(404).send();
            return;
        }

        const filmParse = JSON.parse(JSON.stringify(film).slice(1,-1));

        // Return the directors name (user id comes from film table)
        const user = await users.getUserId(parseInt(filmParse.director_id, 10));
        const userParse = JSON.parse(JSON.stringify(user).slice(1,-1));

        // Return the reviews and then calculate an average and count the number
        const reviews = await filmReviews.getAllReviews(id);
        const reviewsParse = JSON.parse(JSON.stringify(reviews));

        // Calculate the average rating value
        const reviewsCount = Object.keys(reviewsParse).length;
        let ratingsTotal = 0;
        let averageRating = 0;

        if (reviewsCount !== 0) {
            for (const review of reviewsParse) {
                ratingsTotal += JSON.parse(JSON.stringify(review)).rating;
            }
            averageRating = (ratingsTotal)/(reviewsCount);

            if (averageRating.toString().length > 4) {
                averageRating = parseFloat(averageRating.toFixed(2));
            }
        }

        const detailedInfo = {
            'filmId': id,
            'title': filmParse.title,
            'description': filmParse.description,
            'genreId': filmParse.genre_id,
            'directorId': filmParse.director_id,
            'directorFirstName': userParse.first_name,
            'directorLastName': userParse.last_name,
            'releaseDate': filmParse.release_date,
            'ageRating': filmParse.age_rating,
            'runtime': filmParse.runtime,
            'rating': averageRating,
            'numReviews': reviewsCount
        };

        Logger.info(`${namespace}Success, sending detailed film info for Movie: "${filmParse.title}" in response.`);
        res.json(detailedInfo);
        return;
    } catch (err) {
        Logger.error(`${namespace}` + err);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
        return;
    }
}

const addOne = async (req: Request, res: Response): Promise<void> => {
    try{
         Logger.info(`${namespace}POST adding one film to the database`);

         // Pull the data from the request body
         const { title, description, genreId } = req.body;
         let { releaseDate, runtime, ageRating } = req.body;

         // Validate the user inputted data
        const validation = await validate(schemas.film_post, req.body);

        if (validation !== true) {
            Logger.error(`${namespace} CODE 400: Bad Request. ${validation.toString()}`);
            res.statusMessage = `Bad Request. Invalid Information`;
            res.status(400).send();
            return;
        }

        // Using the auth middleware see if a user is logged in or not.

        const token = auth.pullTokenHeader(req, res);

        if (token === '') {
            // Token doesn't exist so user is logged out.
            Logger.error(`${namespace}CODE 401: No authentication.`);
            res.statusMessage = "Unauthorized";
            res.status(401).send(res.statusMessage);
            return;
        }

        const user = await users.getUserToken(token);

        // Check if a film already exists at that title.
        const filmCheck = await films.getOneFilmTitle(title);

        if (filmCheck.length !== 0) {
            Logger.error(`${namespace}CODE 403: Forbidden, film already exists with that title`);
            res.statusMessage = "Forbidden. Film title is not unique, or cannot release a film in the past";
            res.status(403).send(res.statusMessage);
            return;
        }

        if (releaseDate < moment().format('YYYY-MM-DD hh:mm:ss')) {
            Logger.error(`${namespace} CODE 403: Bad Request. Release date in past`);
            res.statusMessage = `Bad Request. Invalid Information`;
            res.status(403).send();
            return;
        }

        if (!runtime) runtime = null;
        if (!ageRating) ageRating = "TBC";
        if (!releaseDate) releaseDate = moment().format('YYYY-MM-DD hh:mm:ss');

        // Pull the users id as the person creating is the director
        const directorId = JSON.parse(JSON.stringify(user).slice(1,-1)).id;

        // Create the new film
        Logger.info(`${namespace}Adding film ${title}`);
        const addResult = await films.addFilm(directorId, title, description, releaseDate, genreId, runtime, ageRating);

        // Find the newly created films ID and return it.
        const newFilm = await films.getOneFilmTitle(title);
        const newFilmId = JSON.parse(JSON.stringify(newFilm).slice(1,-1)).id;

        Logger.http(`${namespace}CODE 201: Successfully created new film at ID ${newFilmId}`);
        res.status(201).json({filmId: newFilmId});
        return;
    } catch (err) {
        Logger.error(`${namespace}` + err);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
        return;
    }
}

const editOne = async (req: Request, res: Response): Promise<void> => {
    try{
        const id = parseInt(req.params.id, 10);
        Logger.info(`${namespace}PATCH updating film: ${id}'s details.`);

        // If the input isn't a proper number then you won't find a user
        if (/^\d+$/.test(id.toString()) === false) {
            Logger.error(`${namespace} CODE 404: Input parameter ${id} is not a number`);
            res.statusMessage = 'Not Found. No film found with id';
            res.status(404).send();
            return;
        }

        // Extract all the values from the body and prepare them for the request.
        let { title, description, releaseDate, genreId, runtime, ageRating } = req.body;

        if (!title) title = -1;
        if (!description) description = -1;
        if (!releaseDate) releaseDate = -1;
        if (!genreId) genreId = -1;
        if (!runtime) runtime = -1;
        if (!ageRating) ageRating = -1;

        const queryDetails = {
            'title': title,
            'description': description,
            'release_date': releaseDate,
            'genre_id': genreId,
            'runtime': runtime,
            'age_rating': ageRating
        };

        // Validate the user inputted data
        const validation = await validate(schemas.film_patch, req.body);

        if (validation !== true || /^\d+$/.test(id.toString()) === false) {
            Logger.error(`${namespace} CODE 400: Bad Request. ${validation.toString()}`);
            res.statusMessage = `Bad Request. Invalid Information`;
            res.status(400).send();
            return;
        }


        // Check if the request is from an authenticated user.
        const token = auth.pullTokenHeader(req, res);

        if (!token) {
            Logger.error(`${namespace}CODE 401: Unauthorised. No access token found`);
            res.statusMessage = "Unauthorized";
            res.status(401).send(res.statusMessage);
            return;
        }

        const film = await films.getOneFilmId(id);
        const user = await users.getUserToken(token);

        // Look up the film at the ID to check it exists in the first place.
        if (film.length === 0) {
            Logger.error(`${namespace}CODE 404: Film not found at id: ${id}`);
            res.statusMessage = "Not Found. No film found with id";
            res.status(404).send();
            return;
        }

        // Check the title doesn't already exist
        if (title !== -1) {
            const filmTitleLookup = await films.getOneFilmTitle(title);
            if (filmTitleLookup.length !== 0) {
                Logger.error(`${namespace}CODE 400: Movie with the title: ${title} already exists`);
                res.statusMessage = "Bad Request. Invalid Information";
                res.status(400).send();
                return;
            }
        }

        const userId = JSON.parse(JSON.stringify(user).slice(1,-1)).id;
        const directorId = JSON.parse(JSON.stringify(film).slice(1,-1)).director_id;

        // Check if the authenticated user is the film's director.
        Logger.info(`${namespace}User ID: ${userId} | Director ID: ${directorId}`);

        // Check that the data given doesn't invalid our rules on release dates, reviews, or authentication
        const currentTime = moment().format("YYYY-MM-DD hh:mm:ss");
        const reviews = await filmReviews.getAllReviews(id);
        const filmRelease = JSON.parse(JSON.stringify(film).slice(1,-1)).release_date;

        if (userId !== directorId || reviews.length !== 0 || releaseDate < currentTime || filmRelease <= currentTime) {
            Logger.error(`${namespace}CODE 403: Forbidden. User authenticated is not the director, or reviews exist, or that dates invalid.`);
            res.statusMessage = "Forbidden. Only the director of an film may change it, cannot change the releaseDate since it has already passed, cannot edit a film that has a review placed, or cannot release a film in the past";
            res.status(403).send();
            return;
        }

        // Update the films information
        await films.updateFilm(id, queryDetails);
        Logger.info(`${namespace}CODE 200: Updated films details successfully`);
        res.status(200).send();
        return;
    } catch (err) {
        Logger.error(`${namespace}` + err);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
        return;
    }
}

const deleteOne = async (req: Request, res: Response): Promise<void> => {
    try{
        Logger.info(`${namespace}DELETE removing film: ${req.params.id}`);
        const id = parseInt(req.params.id, 10);

        // If the input isn't a proper number then you won't find a user
        if (/^\d+$/.test(id.toString()) === false) {
            Logger.error(`${namespace} CODE 404: Input parameter ${id} is not a number`);
            res.statusMessage = 'Not Found. No film found with id';
            res.status(404).send();
            return;
        }

        // Check if the request is from an authenticated user.
        const token = auth.pullTokenHeader(req, res);

        if (token === '') {
            Logger.error(`${namespace}CODE 401: Unauthorised. No access token found`);
            res.statusMessage = "Unauthorized";
            res.status(401).send(res.statusMessage);
            return;
        }

        const film = await films.getOneFilmId(id);
        const user = await users.getUserToken(token);

        // Look up the film at the ID to check it exists in the first place.
        if (film.length === 0) {
            Logger.error(`${namespace}CODE 404: Film not found at id: ${id}`);
            res.statusMessage = "Not Found. No film found with id";
            res.status(404).send();
            return;
        }

        const userId = JSON.parse(JSON.stringify(user).slice(1,-1)).id;
        const directorId = JSON.parse(JSON.stringify(film).slice(1,-1)).director_id;

        // Check if the authenticated user is the film's director.
        Logger.info(`${namespace}User ID: ${userId} | Director ID: ${directorId}`);

        if (userId !== directorId) {
            Logger.error(`${namespace}CODE 403: Forbidden. User authenticated is not the director`);
            res.statusMessage = "Forbidden. Only the director of an film can delete it";
            res.status(403).send();
            return;
        }

        // Delete the film
        Logger.info(`${namespace}Deleting the film at id:${id}`);
        await films.deleteFilm(id);
        res.statusMessage = "OK";
        res.status(200).send();
        return;
    } catch (err) {
        Logger.error(`${namespace}` + err);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
        return;
    }
}

const getGenres = async (req: Request, res: Response): Promise<void> => {
    Logger.info(`${namespace}GET displaying all film genres.`);
    try{
        const result = await films.getGenres();

        Logger.info(`${namespace}CODE 200: Successfully sent all genres`);
        res.status(200).json(result);
        return;
    } catch (err) {
        Logger.error(`${namespace}` + err);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
        return;
    }
}

export {viewAll, getOne, addOne, editOne, deleteOne, getGenres};