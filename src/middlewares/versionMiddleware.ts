import { Request, Response, NextFunction, RequestHandler } from "express";
import { BadRequestError } from "../utils/api.errors";

export const apiVersion: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
    const version = req.headers['x-api-version']
    if (!version) {
        return next(new BadRequestError("API version header required"));
    }
    next();
}