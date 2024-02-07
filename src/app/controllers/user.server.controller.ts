import {Request, Response} from "express";
import Logger from "../../config/logger";
import * as users from '../models/user.server.model';
import * as schemas from '../resources/schemas.json'
import {validate} from "../../config/validate";
import bcrypt from "bcryptjs"
import randToken from "rand-token";
import * as auth from "../middleware/auth";

const namespace = 'user.server.controller.ts >';

const register = async (req: Request, res: Response): Promise<void> => {
    try{
        Logger.info(`${namespace} POST adding new user ${req.body.email} to database`);

        // Validate the user inputted data
        const validation = await validate(schemas.user_register, req.body);

        if (validation !== true) {
            Logger.error(`${namespace} CODE 400: Bad Request. ${validation.toString()}`);
            res.statusMessage = `Bad Request. Invalid Information`;
            res.status(400).send();
            return;
        }

        // Pulls the data after being validated, hashes the password and creates a user.
        const { firstName, lastName, email, password } = req.body;
        const emailCheck = await users.getUserEmail(email);

        // Check if the user email already exists and is linked to a current user.
        if (emailCheck.length !== 0) {
            Logger.error(`${namespace} CODE 403: Forbidden. Email already in use. email: ${email}`);
            res.statusMessage = "Forbidden. Email already in use.";
            res.status(403).send();
            return;
        }

        // Given that everything has gone well, register a new user in the database.
        const hashedPassword = await bcrypt.hash(password, 10);
        await users.createUser(email, firstName, lastName, hashedPassword);
        const user = await users.getUserEmail(email);
        const parsedUser = JSON.parse(JSON.stringify(user).slice(1,-1));

        Logger.http(`${namespace} CODE 201: Successfully created user at ID: ${parsedUser.id}`);
        res.statusMessage = "CREATED";
        res.status(201).json({'userId': parsedUser.id});
    } catch (err) {
        Logger.error(`${namespace} ${err}`);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
        return;
    }
}

const login = async (req: Request, res: Response): Promise<void> => {
    try{
        Logger.info(`${namespace} POST logging in user ${req.body.email}.`);

        // Pull data from request
        const { email, password } = req.body;

        // Validate the user inputted data
        const validation = await validate(schemas.user_login, req.body);

        if (validation !== true) {
            Logger.error(`${namespace} CODE 400: Bad Request. ${validation.toString()}`);
            res.statusMessage = `Bad Request. Invalid Information}`;
            res.status(400).send();
            return;
        }

        // Check if there is a user at that email
        const userRequest = await users.getUserEmail(email);

        if (userRequest.length === 0) {
            // Specified email does not exist in database, invalid request
            Logger.error(`${namespace} CODE 401: Not Authorised. Invalid email, no user exists at email: ${email}`);
            res.statusMessage = "Not Authorised. Invalid email/password";
            res.status(401).send();
            return;
        }

        // Compare the hashed password to what the user just entered.
        const extractedUser = JSON.parse(JSON.stringify(userRequest).slice(1,-1));

        bcrypt.compare(password, extractedUser.password, (err: any, resp: any) => {
            if (err) {
                Logger.error(`${namespace} BCRYPT ERROR ${err}`);
                res.statusMessage = "Not Authorised. Invalid email/password";
                res.status(401).send();
                return;
            }
            if (resp) {
                // Passwords match send auth token
                Logger.info(`${namespace} Signing user access token`);
                const accessToken = randToken.uid(32);
                res.setHeader('X-Authorization', `${accessToken}`); // Put the token in the header
                // res.cookie('Authorization', accessToken, {httpOnly: true}); // Put the token as a HTTP Only cookie
                users.addLoginToken(email, accessToken);

                Logger.http(`${namespace} CODE 200: Success. User :${extractedUser.id} logged in with token: ${accessToken}`);
                res.statusMessage = "OK";
                res.status(200).json({'userId': extractedUser.id, 'token': accessToken});
                return;

            } else {
                // Passwords do not match
                Logger.error(`${namespace} CODE 401: Not Authorised. Invalid password.`);
                res.statusMessage = "Not Authorised. Invalid email/password";
                res.status(401).send();
                return;
            }
        });
    } catch (err) {
        Logger.error(err);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
        return;
    }
}

const logout = async (req: Request, res: Response): Promise<void> => {
    try{
        const token = auth.pullTokenHeader(req, res);
        Logger.info(`${namespace} POST logging out user with token: ${token}`);

        // Check if someone is even logged in to start with
        if (!token) {
            Logger.error(`${namespace} CODE 401: Unauthorized. No user logged in, so can't log out.`);
            res.statusMessage = "Unauthorized. Cannot log out if you are not authenticated";
            res.status(401).send();
            return;
        }

        // Remove the current auth token from the database and the client
        await users.removeUserToken(token);
        Logger.info(`${namespace} Clearing auth cookie`);
        // res.clearCookie('Authorization');

        Logger.http(`${namespace} CODE 200: User logged out.`);
        res.statusMessage = "OK";
        res.status(200).send();
        return;
    } catch (err) {
        Logger.error(`${namespace} ${err}`);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
        return;
    }
}

const view = async (req: Request, res: Response): Promise<void> => {
    // Allows you to view the details about a user. Changes if you are signed in or not.
    try{
        Logger.info(`${namespace} GET user id: ${req.params.id} information from the database for display`);
        const id = req.params.id;


        // If the input isn't a proper number then you won't find a user
        if (/^\d+$/.test(id) === false) {
            Logger.error(`${namespace} CODE 404: Input parameter ${id} is not a number`);
            res.statusMessage = 'Not Found. No user with specified ID';
            res.status(404).send();
            return;
        }

        const result = await users.getUserId(parseInt(id, 10));
        if (result.length === 0) {
            // No user returned by database at that ID
            Logger.error(`${namespace} CODE 404: No user found at ID: ${id}`);
            res.statusMessage = 'Not Found. No user with specified ID';
            res.status(404).send();
            return;
        }

        // Parse the user result data into a usable format
        const jsonResult = JSON.parse(JSON.stringify(result).slice(1,-1));

        // Check their authentication status. If they are not viewing themselves while logged in, they can't see the email field.
        const authenticated = auth.validateTokenHeader(req, res, jsonResult.auth_token);

        if (authenticated === 1) {
            Logger.info(`${namespace} User ${jsonResult.email} is authenticated to view details`);
            res.status(200).json({'email': jsonResult.email, 'firstName': jsonResult.first_name, 'lastName': jsonResult.last_name});
            return;
        } else {
            Logger.info(`${namespace} Not Authenticated to view this user. Not displaying email field`);
            res.status(200).json({'firstName': jsonResult.first_name, 'lastName': jsonResult.last_name});
            return;
        }
    } catch (err) {
        Logger.error(err);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
        return;
    }
}

const update = async (req: Request, res: Response): Promise<void> => {
    try{
        const id = parseInt(req.params.id, 10);
        Logger.info(`${namespace} PATCH updating user: ${id}'s details.`);

        // If the input isn't a proper number then you won't find a user
        if (/^\d+$/.test(id.toString()) === false) {
            Logger.error(`${namespace} CODE 404: Input parameter ${id} is not a number`);
            res.statusMessage = 'Not Found. No user found with id';
            res.status(404).send();
            return;
        }

        // Pull the details from the request
        let { email, firstName, lastName, password, currentPassword } = req.body;

        // Validate the user inputted data
        const validation = await validate(schemas.user_edit, req.body);

        if (validation !== true) {
            Logger.error(`${namespace} CODE 400: Bad Request. ${validation.toString()}`);
            res.statusMessage = `Bad Request. Invalid Information}`;
            res.status(400).send();
            return;
        }

        // Set blank values if nothing was set by the user.
        if (!email) email = -1;
        if (!firstName) firstName = -1;
        if (!lastName) lastName = -1;
        if (!password) password = -1;
        if (!currentPassword) currentPassword = -1;

        const queryDetails = {
            'email': email,
            'first_name': firstName,
            'last_name': lastName,
            'password': password
        };

        if (currentPassword === password && currentPassword !== -1 && password !== -1) {
            Logger.error(`${namespace} CODE 403: Identical current and new passwords. They can't match`);
            res.statusMessage = "Forbidden. This is not your account, or the email is already in use, or identical current and new passwords";
            res.status(403).send();
            return;
        }

        // Check if the request is from an authenticated user.
        const token = auth.pullTokenHeader(req, res);

        if (token === '') {
            Logger.error(`${namespace} CODE 401: Unauthorised. No access token found`);
            res.statusMessage = "Unauthorized or Invalid Password";
            res.status(401).send();
            return;
        }

        // Check a user actually exists at that ID
        const user = await users.getUserId(id);
        if (user.length === 0) {
            Logger.error(`${namespace} CODE 404: User not found at ID: ${id}`);
            res.statusMessage = "Not Found";
            res.status(404).send();
            return;
        }

        // Check the user is correctly authenticated
        const parsedUser = JSON.parse(JSON.stringify(user).slice(1,-1))
        const authenticated = auth.validateTokenHeader(req, res, parsedUser.auth_token);

        // Incorrect authentication
        if (authenticated !== 1) {
            Logger.error(`${namespace} CODE 403: Unauthorized user`);
            res.statusMessage = "Forbidden. This is not your account, or the email is already in use, or identical current and new passwords";
            res.status(403).send();
            return;
        }

        // Check if the supplied email is unique
        if (email !== -1) {
            const result = await users.getUserEmail(email);

            // If we get a result looking up the email, it's not unique.
            if (result.length !== 0) {
                Logger.error(`${namespace} CODE 403: Email is already used.`);
                res.statusMessage = "Forbidden. This is not your account, or the email is already in use, or identical current and new passwords";
                res.status(403).send();
                return;
            }
        }

        // Check if the current password is correct.
        if (password !== -1 && currentPassword !== -1) {
            bcrypt.compare(currentPassword, parsedUser.password, (err: any, resp: any) => {
                if (err) {
                    Logger.error(`${namespace} Bcrypt Error: ${err}`);
                    res.statusMessage = "Unauthorized or Invalid currentPassword";
                    res.status(401).send();
                    return;
                }
                if (!resp) {
                    // Passwords do not match
                    Logger.error(`${namespace} CODE 401: Not authorised. Passwords don't match`);
                    res.statusMessage = "Unauthorized or Invalid currentPassword";
                    res.status(401).send();
                    return;
                }
            });
            queryDetails.password = await bcrypt.hash(password, 10);
        }

        // Submit the data to the model to update the database
        Logger.info(`${namespace} Submitting new user data to model.`);
        await users.update(id, queryDetails);

        Logger.http(`${namespace} CODE 200: Updated users details successfully`);
        res.status(200).send();
        return;
    } catch (err) {
        Logger.error(err);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
        return;
    }
}

export {register, login, logout, view, update}