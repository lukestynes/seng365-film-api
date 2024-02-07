import {Request, Response} from "express";
import Logger from "../../config/logger";
import * as auth from "../middleware/auth";
import * as usersImage from '../models/user.image.server.model';
import * as users from '../models/user.server.model';
import path from "path";
import bodyParser from "body-parser";
import Jimp from "jimp";
import fs from "fs";

const namespace = 'user.image.server.controller >';

const getImage = async (req: Request, res: Response): Promise<void> => {
    // Returns the user's profile picture image in a response
    try{
        Logger.info(`${namespace} GET pulling user ${req.body.email} image from database`);
        const id = req.params.id;

        // If the input isn't a proper number then you won't find a user
        if (/^\d+$/.test(id.toString()) === false) {
            Logger.error(`${namespace} CODE 404: Input parameter ${id} is not a number`);
            res.statusMessage = 'Not Found. No user found with id';
            res.status(404).send();
            return;
        }

        const result = await usersImage.getPhoto(parseInt(id, 10));

        if (result.length === 0) {
            // Nothing returned by the database lookup. No user exists.
            Logger.error(`${namespace} CODE 404: No user with specified ID`);
            res.statusMessage = 'Not Found. No user with specified ID, or user has no image';
            res.status(404).send();
        } else {
            // Parses the incoming user data to just get image filename.
            const imgFilename = JSON.parse(JSON.stringify(result).slice(1,-1)).image_filename;
            Logger.info(`${namespace} Filename: ${imgFilename}`);

            if (!imgFilename) {
                // The database returned a blank filename, means the user has no image.
                Logger.error(`${namespace} CODE 404: User has no image`);
                res.statusMessage = 'Not Found. No user with specified ID, or user has no image';
                res.status(404).send(res.statusMessage);
            } else {
                // Image name returned successfully, find the file on the server and serve it.
                Logger.http(`${namespace} CODE 200: OK`);
                res.sendFile(path.join(__dirname, '../../../storage/images', imgFilename));
            }
        }
        return;
    } catch (err) {
        Logger.error(`${namespace} ${err}`);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
        return;
    }
}

const setImage = async (req: Request, res: Response): Promise<void> => {
    // Allows the user to set themselves a new profile image.
    try{
        Logger.info(`${namespace} PATCH updating user: ${req.params.id} profile picture`);
        const id = req.params.id;

        // If the input isn't a proper number then you won't find a user
        if (/^\d+$/.test(id.toString()) === false) {
            Logger.error(`${namespace} CODE 404: Input parameter ${id} is not a number`);
            res.statusMessage = 'Not Found. No user found with id';
            res.status(404).send();
            return;
        }

        // Check the users authentication first, as no update is allowed for non-authenticated users.
        const result = await users.getUserId(parseInt(id, 10));
        let authenticated = 2;
        let jsonResult;

        if (result.length !== 0) {
            jsonResult = JSON.parse(JSON.stringify(result).slice(1,-1));
            authenticated = auth.validateTokenHeader(req, res, jsonResult.auth_token);
        }

        if (authenticated === -1) {
            // Token doesn't exist so user is logged out.
            Logger.error(`${namespace} CODE 401: No authentication.`);
            res.statusMessage = "Unauthorized";
            res.status(401).send();
            return;
        }

        if (authenticated === 0) {
            // Token exists but user trying to update someone else's image.
            Logger.error(`${namespace} CODE 403: Forbidden, can't update someone else's picture`);
            res.statusMessage = "Forbidden. Can not change another user's profile photo";
            res.status(403).send();
            return;
        } else {
            // Token exists and user is authenticated to continue.
            // Check if the user at the ID exists.
            if (result.length === 0) {
                Logger.error(`${namespace} CODE 404: No user at ID: ${id}`);
                res.statusMessage = "Not found. No such user with ID given";
                res.status(404).send(res.statusMessage);
                return;
            } else {
                if (jsonResult.image_filename === null) {
                    // No image exists, creating one
                    Logger.info(`${namespace} Creating an image for user ${id}`);

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
                    await users.updateImageFilename(parseInt(id, 10), filename)

                    // Success
                    Logger.http(`CODE 201: Created an image for user ${id}`);
                    res.statusMessage = "Created. New image created";
                    res.status(201).send();
                    return;
                } else {
                    // User had an image, simply updating
                    Logger.info(`${namespace} Updating the image for user ${id}`);

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
                    }  else {
                        Logger.error(`${namespace} CODE 400: Incorrect image filetype.`);
                        res.statusMessage = "Bad Request. Invalid image supplied (possibly incorrect file type";
                        res.status(400).send();
                        return;
                    }

                    const filename = `user_${id}.${fileExtension}`;

                    // Write file to server files and update reference filename for user
                    fs.writeFileSync(`storage/images/${filename}`, image);
                    await users.updateImageFilename(parseInt(id, 10), filename)

                    // Success
                    Logger.http(`CODE 200: Updated image for user ${id}`);
                    res.statusMessage = "OK. Image updated";
                    res.status(200).send();
                    return;
                }
            }
        }
    } catch (err) {
        Logger.error(`${namespace} ${err}`);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
        return;
    }
}

const deleteImage = async (req: Request, res: Response): Promise<void> => {
    try{
        const id = req.params.id;
        Logger.info(`${namespace} PATCH updating user: ${id} profile picture`);

        // Check the users authentication first, as no update is allowed for non-authenticated users.
        const user = await users.getUserId(parseInt(id, 10));
        let authenticated = 2;
        let parsedUser;

        if (user.length !== 0) {
            parsedUser = JSON.parse(JSON.stringify(user).slice(1,-1));
            authenticated = auth.validateTokenHeader(req, res, parsedUser.auth_token);
        }

        if (!auth.pullTokenHeader(req, res)) {
            // Token doesn't exist so user is logged out.
            Logger.error(`${namespace} CODE 401: No authentication.`);
            res.statusMessage = "Unauthorized";
            res.status(401).send();
            return;
        }

        if (authenticated === 0) {
            // Token exists but user trying to delete someone else's image.
            Logger.error(`${namespace} CODE 403: Forbidden. Can not delete another user's profile photo`);
            res.statusMessage = "Forbidden. Can not delete another user's profile photo";
            res.status(403).send();
            return;
        } else {
            // Token exists and user is authenticated to continue.
            // Check if the user at the ID exists.
            if (user.length === 0) {
                Logger.error(`${namespace} CODE 404: No user at ID: ${id}`);
                res.statusMessage = "Not found. No such user with ID given";
                res.status(404).send();
                return;
            } else {
                // Delete the users image
                await usersImage.deletePhoto(parseInt(id, 10));
                Logger.info(`${namespace} CODE 200: OK. Image deleted.`);
                res.status(200).send();
                return;
            }
        }
    } catch (err) {
        Logger.error(`${namespace} ${err}`);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
        return;
    }
}

export {getImage, setImage, deleteImage}