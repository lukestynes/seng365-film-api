import {Request, Response} from "express";
import Logger from "../../config/logger";
import * as filmImage from '../models/film.image.server.model';
import path from "path";
import * as users from "../models/user.server.model";
import * as auth from "../middleware/auth";
import fs from "fs";
import * as films from "../models/film.server.model";

const namespace = 'file.image.server.controller >';

const getImage = async (req: Request, res: Response): Promise<void> => {
    try{
        Logger.info(`${namespace} GET pulling film ${req.params.id} picture from the server`);
        const id = parseInt(req.params.id, 10);

        // If the input isn't a proper number then you won't find a user
        if (/^\d+$/.test(id.toString()) === false) {
            Logger.error(`${namespace} CODE 404: Input parameter ${id} is not a number`);
            res.statusMessage = 'Not Found. No film found with id';
            res.status(404).send();
            return;
        }

        const result = await filmImage.getPhoto(id);

        if (result.length === 0) {
            Logger.info(`${namespace} CODE 404: No film exists for that id`);
            res.statusMessage = "Not found. No film found with id, or film has no image";
            res.status(404).send();
            return;
        }

        const filename = JSON.parse(JSON.stringify(result).slice(1,-1)).image_filename;

        if (filename === null) {
            Logger.info(`${namespace} CODE 404: No image for this film`);
            res.statusMessage = "Not found. No film found with id, or film has no image";
            res.status(404).send();
            return;
        }

        // Filename found, sending file in a response.
        Logger.http(`${namespace} CODE 200: Serving image`);
        res.sendFile(path.join(__dirname, '../../../storage/images', filename));
        return;
    } catch (err) {
        Logger.error(err);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
        return;
    }
}

const setImage = async (req: Request, res: Response): Promise<void> => {
    try{
        Logger.info(`${namespace}PUT updating film: ${req.params.id} hero image`);
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

        const userId = JSON.parse(JSON.stringify(user).slice(1,-1)).id;
        const directorId = JSON.parse(JSON.stringify(film).slice(1,-1)).director_id;

        // Check if the authenticated user is the film's director.
        Logger.info(`${namespace}User ID: ${userId} | Director ID: ${directorId}`);

        if (userId !== directorId) {
            Logger.error(`${namespace}CODE 403: Forbidden. User authenticated is not the director`);
            res.statusMessage = "Forbidden. Only the director of an film can edit the hero image";
            res.status(403).send();
            return;
        } else {
            // Token exists and user is authenticated to continue.
            // Check if the film at the ID exists.
            if (film.length === 0) {
                Logger.error(`${namespace} CODE 404: No user at ID: ${id}`);
                res.statusMessage = "Not found. No such user with ID given";
                res.status(404).send(res.statusMessage);
                return;
            } else {
                if (JSON.parse(JSON.stringify(film).slice(1,-1)).image_filename === null) {
                    // No image exists, creating one
                    Logger.info(`${namespace} Creating an image for film ${id}`);

                    // Extract the image from the request
                    const image = new Buffer(req.body,'binary');

                    // Set the file extension and generate filename
                    const type = req.header('Content-Type').split('/')[1];
                    Logger.debug(`${namespace} ${type}`);
                    let fileExtension;

                    if (type === 'png') {
                        fileExtension = 'png';
                    } else if (type === 'jpeg') {
                        fileExtension = 'jpeg';
                    } else if (type === 'gif') {
                        fileExtension = 'gif';
                    } else {
                        Logger.error(`${namespace} CODE 400: Incorrect image filetype.`);
                        res.statusMessage = "Bad Request. Invalid image supplied (possibly incorrect file type";
                        res.status(400).send();
                        return;
                    }

                    const filename = `user_${id}.${fileExtension}`;

                    // Write file to server files and update reference filename for user
                    fs.writeFileSync(`storage/images/${filename}`, image);
                    await filmImage.updateImageFilename(id, filename)

                    // Success
                    Logger.http(`CODE 201: Created an image for film ${id}`);
                    res.statusMessage = "Created";
                    res.status(201).send();
                    return;
                } else {
                    // User had an image, simply updating
                    Logger.info(`${namespace} Updating the image for film ${id}`);

                    // Extract the image from the request

                    const image = Buffer.from(req.body,'binary');
                    // Set the file extension and generate filename
                    const type = req.header('Content-Type').split('/')[1];
                    Logger.debug(`${namespace} ${type}`);
                    let fileExtension;

                    if (type === 'png') {
                        fileExtension = 'png';
                    } else if (type === 'jpeg') {
                        fileExtension = 'jpeg';
                    } else if (type === 'gif') {
                        fileExtension = 'gif';
                    }  else {
                        Logger.error(`${namespace} CODE 400: Incorrect image filetype.`);
                        res.statusMessage = "Bad Request. Invalid image supplied (possibly incorrect file type";
                        res.status(400).send();
                        return;
                    }

                    const filename = `film_${id}.${fileExtension}`;

                    // Write file to server files and update reference filename for user
                    fs.writeFileSync(`storage/images/${filename}`, image);
                    await filmImage.updateImageFilename(id, filename)

                    // Success
                    Logger.http(`CODE 200: Updated image for film ${id}`);
                    res.statusMessage = "OK. Image updated";
                    res.status(200).send();
                    return;
                }
            }
        }
    } catch (err) {
        Logger.error(err);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
        return;
    }
}

export {getImage, setImage};