import {Request, Response} from "express";
import Logger from "../../config/logger";
import * as filmReviews from '../models/film.review.server.model';
import * as films from '../models/film.server.model';
import * as auth from "../middleware/auth";
import * as users from "../models/user.server.model";
import moment from "moment";
import {validate} from "../../config/validate";
import * as schemas from "../resources/schemas.json";

const namespace = "film.review.server.controller.ts > ";

const getReviews = async (req: Request, res: Response): Promise<void> => {
    Logger.info(`${namespace}GET return all reviews on the database for film ${req.params.id}`);
    const id = parseInt(req.params.id, 10);

    try{
        // If the input isn't a proper number then you won't find a user
        if (/^\d+$/.test(id.toString()) === false) {
            Logger.error(`${namespace} CODE 404: Input parameter ${id} is not a number`);
            res.statusMessage = 'Not Found. No film found with id';
            res.status(404).send();
            return;
        }

        // Check if the film exists at that id
        const filmCheck = await films.getOneFilmId(id);

        if (filmCheck.length === 0) {
            Logger.error(`${namespace}CODE 404: No film exists at the ID: ${id}`);
            res.statusMessage = "Not Found. No film found with id";
            res.status(404).send();
            return;
        }

        // Get the reviews for that film
        const result = await filmReviews.getAllReviews(id);

        Logger.info(`Got all reviews for film at ${id}`);
        res.json(result);
        return;
    } catch (err) {
        Logger.error(err);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
        return;
    }
}

const addReview = async (req: Request, res: Response): Promise<void> => {
    try{
        Logger.info(`${namespace}POST adding a review for film: ${req.params.id}`);
        const id = parseInt(req.params.id, 10);
        const rating = req.body.rating;
        let review = req.body.review;
        const timestamp = moment().format("YYYY-MM-DD hh:mm:ss");

        if (!review) review = "NULL";

        // Validate the user inputted data
        const validation = await validate(schemas.film_review_post, req.body);

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

        if (JSON.parse(JSON.stringify(film).slice(1,-1)).release_date > moment().format('YYYY-MM-DD hh:mm:ss')) {
            Logger.error(`${namespace}CODE 403: Film not released yet. Date: ${JSON.parse(JSON.stringify(film).slice(1,-1)).release_date}`);
            res.statusMessage = "Forbidden. Cannot review your own film, or cannot post a review on a film that has not yet released";
            res.status(403).send();
            return;
        }

        const userId = JSON.parse(JSON.stringify(user).slice(1,-1)).id;
        const directorId = JSON.parse(JSON.stringify(film).slice(1,-1)).director_id;

        // Check if the authenticated user is the film's director.
        Logger.info(`${namespace}User ID: ${userId} | Director ID: ${directorId}`);

        if (userId === directorId) {
            Logger.error(`${namespace}CODE 403: Forbidden. User authenticated is the director. Can't review your own film`);
            res.statusMessage = "Forbidden. Cannot review your own film, or cannot post a review on a film that has not yet released";
            res.status(403).send();
            return;
        }

        // Place the review
        Logger.info(`${namespace}Creating a review for film at id:${id}`);
        await filmReviews.createReview(id, userId, rating, review, timestamp);
        res.statusMessage = "Created";
        res.status(201).send();
        return;
    } catch (err) {
        Logger.error(err);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
        return;
    }
}

export {getReviews, addReview}